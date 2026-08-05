import {
  Timestamp,
  collectionGroup,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import {
  assignmentDocRef,
  congregationMeetingsCollectionRef,
  meetingAssignmentsCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import {
  applyAssignmentFilters,
  dedupeAssignments,
  normalizeAssignment,
  sortAssignmentsByDueDate,
} from '@/src/services/assignments/assignment.mapper';
import {
  getDocumentCacheFirst,
  getQueryCacheFirst,
  invalidateCacheEntry,
} from '@/src/services/repositories/firestore-cache-first';
import type {
  AssignmentRangeOptions,
  AssignmentRepository,
} from '@/src/services/repositories/ports/assignment-repository.port';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
  CreateCleaningAssignmentDTO,
  UpdateAssignmentDTO,
} from '@/src/types/assignment';

const SUBSCRIBE_WINDOW_MONTHS_BACK = 3;
const SUBSCRIBE_MAX_MEETINGS = 60;

export interface SubscribeToAssignmentsOptions {
  /** Meses hacia atrás incluidos en la ventana (default 3). El futuro entra completo. */
  windowMonthsBack?: number;
  /** Tope de reuniones escuchadas simultáneamente (default 60). */
  maxMeetings?: number;
}

type SerializableTimestamp = {
  seconds: number;
  nanoseconds: number;
};

type MeetingIdsOptions = {
  startDate?: Date;
  endDate?: Date;
  maxItems?: number;
  forceServer?: boolean;
};

const ASSIGNMENTS_CACHE_TTL_MS = 60 * 1000;
const ASSIGNMENT_DOC_CACHE_TTL_MS = 60 * 1000;

const isInvalidRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) ||
  Number.isNaN(endDate.getTime()) ||
  startDate > endDate;

const toSerializableTimestamp = (value: Timestamp): SerializableTimestamp => ({
  seconds: value.seconds,
  nanoseconds: value.nanoseconds,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const toCallableSafe = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Timestamp) return toSerializableTimestamp(value);
  if (Array.isArray(value)) {
    return value.map((item) => toCallableSafe(item)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    Object.entries(value).forEach(([key, child]) => {
      const safeChild = toCallableSafe(child);
      if (safeChild !== undefined) output[key] = safeChild;
    });
    return output;
  }
  return value;
};

const assignmentDocCacheKey = (
  congregationId: string,
  meetingId: string,
  assignmentId: string
): string => `assignments/${congregationId}/meeting/${meetingId}/doc/${assignmentId}`;

const invalidateAssignmentCache = (
  congregationId: string,
  meetingId?: string,
  assignmentId?: string
): void => {
  if (meetingId && assignmentId) {
    invalidateCacheEntry(assignmentDocCacheKey(congregationId, meetingId, assignmentId));
  }

  clearSessionCacheByPrefix(`query:assignments/${congregationId}/`);
  clearSessionCacheByPrefix(`query:assignments-panel/${congregationId}/`);
};

const getMeetingIds = async (
  congregationId: string,
  options?: MeetingIdsOptions
): Promise<string[]> => {
  const maxItems = options?.maxItems ?? 120;
  const constraints: QueryConstraint[] = [orderBy('startDate', 'desc'), limit(maxItems)];

  if (options?.startDate && options?.endDate && !isInvalidRange(options.startDate, options.endDate)) {
    constraints.unshift(
      where('startDate', '>=', Timestamp.fromDate(options.startDate)),
      where('startDate', '<=', Timestamp.fromDate(options.endDate))
    );
  }

  const rangeKey =
    options?.startDate && options?.endDate
      ? `${options.startDate.toISOString()}::${options.endDate.toISOString()}`
      : 'all';

  return getQueryCacheFirst<string[]>({
    cacheKey: `assignments/${congregationId}/meeting-ids/${rangeKey}/limit/${maxItems}`,
    query: query(congregationMeetingsCollectionRef(congregationId), ...constraints),
    maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    persist: false,
    mapSnapshot: (snapshot) => snapshot.docs.map((docSnap) => docSnap.id),
  });
};

const buildAssignmentsQuery = (
  congregationId: string,
  meetingId: string,
  extraConstraints: QueryConstraint[]
): Query<DocumentData> => {
  return query(
    meetingAssignmentsCollectionRef(congregationId, meetingId),
    ...extraConstraints
  );
};

const getCachedAssignmentsForMeeting = async (
  congregationId: string,
  meetingId: string,
  constraints: QueryConstraint[],
  cacheKeySuffix: string,
  forceServer?: boolean
): Promise<Assignment[]> => {
  return getQueryCacheFirst<Assignment[]>({
    cacheKey: `assignments/${congregationId}/meeting/${meetingId}/${cacheKeySuffix}`,
    query: buildAssignmentsQuery(congregationId, meetingId, constraints),
    maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
    forceServer,
    persist: false,
    mapSnapshot: (snapshot) =>
      snapshot.docs.map((docSnap) =>
        normalizeAssignment(meetingId, docSnap.id, docSnap.data())
      ),
  });
};

const getAssignmentsForMeetings = async (
  congregationId: string,
  constraintsFactory: (meetingId: string) => QueryConstraint[],
  options?: MeetingIdsOptions & { cacheKeyPrefix?: string }
): Promise<Assignment[]> => {
  const meetingIds = await getMeetingIds(congregationId, options);

  if (meetingIds.length === 0) return [];

  const assignmentGroups = await Promise.all(
    meetingIds.map((meetingId) =>
      getCachedAssignmentsForMeeting(
        congregationId,
        meetingId,
        constraintsFactory(meetingId),
        options?.cacheKeyPrefix ?? 'all',
        options?.forceServer
      )
    )
  );

  return sortAssignmentsByDueDate(dedupeAssignments(assignmentGroups.flat()));
};

const createAssignmentViaFunction = async (
  congregationId: string,
  meetingId: string,
  data: CreateAssignmentDTO,
  assignedByUid: string,
  assignedByName: string
): Promise<string> => {
  const callable = httpsCallable<
    {
      congregationId: string;
      meetingId: string;
      assignmentData: Record<string, unknown>;
      assignedByName: string;
    },
    { assignmentId: string }
  >(functions, 'createMeetingAssignmentByManager');

  const result = await callable({
    congregationId,
    meetingId,
    assignmentData: toCallableSafe({
      ...data,
      meetingId,
      assignedByUid,
      assignedByName,
      status: 'pending' as AssignmentStatus,
    }) as Record<string, unknown>,
    assignedByName,
  });

  invalidateAssignmentCache(congregationId, meetingId, result.data.assignmentId);
  return result.data.assignmentId;
};

const updateAssignmentViaFunction = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string,
  data: UpdateAssignmentDTO
): Promise<void> => {
  const callable = httpsCallable<
    {
      congregationId: string;
      meetingId: string;
      assignmentId: string;
      assignmentData: Record<string, unknown>;
    },
    { ok: true }
  >(functions, 'updateMeetingAssignmentByManager');

  await callable({
    congregationId,
    meetingId,
    assignmentId,
    assignmentData: toCallableSafe(data) as Record<string, unknown>,
  });
};

export const firestoreAssignmentRepository: AssignmentRepository = {
  getById: async (
    congregationId: string,
    assignmentId: string,
    meetingIdHint?: string
  ): Promise<Assignment | null> => {
    const readAssignment = (meetingId: string): Promise<Assignment | null> =>
      getDocumentCacheFirst<Assignment>({
        cacheKey: assignmentDocCacheKey(congregationId, meetingId, assignmentId),
        ref: assignmentDocRef(congregationId, meetingId, assignmentId),
        mapSnapshot: (snapshot) =>
          normalizeAssignment(meetingId, snapshot.id, snapshot.data() ?? {}),
        maxAgeMs: ASSIGNMENT_DOC_CACHE_TTL_MS,
        persist: false,
      });

    if (meetingIdHint && meetingIdHint.trim().length > 0) {
      try {
        const directAssignment = await readAssignment(meetingIdHint);

        if (directAssignment) {
          return directAssignment;
        }
      } catch {
        // Continue with broader fallback strategy.
      }
    }

    const meetingIds = await getMeetingIds(congregationId);

    if (meetingIds.length === 0) return null;

    const assignments = await Promise.all(meetingIds.map((meetingId) => readAssignment(meetingId)));

    return assignments.find((assignment): assignment is Assignment => assignment !== null) ?? null;
  },

  getAll: async (congregationId: string): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [orderBy('dueDate', 'asc')], {
      cacheKeyPrefix: 'all',
    });
  },

  getByUser: async (congregationId: string, uid: string): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [
      where('assignedToUid', '==', uid),
      orderBy('dueDate', 'asc'),
    ], {
      cacheKeyPrefix: `user/${uid}`,
    });
  },

  getByStatus: async (
    congregationId: string,
    status: AssignmentStatus
  ): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [
      where('status', '==', status),
      orderBy('dueDate', 'asc'),
    ], {
      cacheKeyPrefix: `status/${status}`,
    });
  },

  getByRange: async (
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: AssignmentRangeOptions
  ): Promise<Assignment[]> => {
    const dueStart = Timestamp.fromDate(startDate);
    const dueEnd = Timestamp.fromDate(endDate);
    const maxPerMeeting = options?.perMeetingLimit ?? 40;
    const meetingIds = await getMeetingIds(congregationId, {
      startDate,
      endDate,
      maxItems: options?.maxMeetings ?? 60,
      forceServer: options?.forceServer,
    });

    if (meetingIds.length === 0) return [];

    const rangeKey = `${startDate.toISOString()}::${endDate.toISOString()}`;
    const userKey = options?.userUid ? `/user/${options.userUid}` : '';
    const statusKey = options?.status ? `/status/${options.status}` : '';

    const readAssignmentsForMeeting = async (meetingId: string): Promise<Assignment[]> => {
      const primaryConstraints: QueryConstraint[] = [
        where('dueDate', '>=', dueStart),
        where('dueDate', '<=', dueEnd),
        orderBy('dueDate', 'asc'),
        limit(maxPerMeeting),
      ];

      if (options?.userUid) {
        primaryConstraints.unshift(where('assignedToUid', '==', options.userUid));
      }

      if (options?.status) {
        primaryConstraints.unshift(where('status', '==', options.status));
      }

      try {
        return await getCachedAssignmentsForMeeting(
          congregationId,
          meetingId,
          primaryConstraints,
          `range/${rangeKey}/limit/${maxPerMeeting}${userKey}${statusKey}`,
          options?.forceServer
        );
      } catch {
        const fallbackConstraints: QueryConstraint[] = [limit(maxPerMeeting * 2)];

        if (options?.userUid) {
          fallbackConstraints.unshift(where('assignedToUid', '==', options.userUid));
        }

        if (options?.status) {
          fallbackConstraints.unshift(where('status', '==', options.status));
        }

        return getCachedAssignmentsForMeeting(
          congregationId,
          meetingId,
          fallbackConstraints,
          `range-fallback/${rangeKey}/limit/${maxPerMeeting * 2}${userKey}${statusKey}`,
          options?.forceServer
        );
      }
    };

    const assignmentGroups = await Promise.all(
      meetingIds.map((meetingId) => readAssignmentsForMeeting(meetingId))
    );

    const merged = assignmentGroups.flatMap((assignments) =>
      assignments.filter((assignment) => {
        const millis = assignment.dueDate?.toMillis?.();
        if (typeof millis !== 'number') return false;
        return millis >= dueStart.toMillis() && millis <= dueEnd.toMillis();
      })
    );

    return sortAssignmentsByDueDate(dedupeAssignments(merged));
  },

  getByMeeting: async (
    congregationId: string,
    meetingId: string
  ): Promise<Assignment[]> => {
    const q = query(
      meetingAssignmentsCollectionRef(congregationId, meetingId),
      orderBy('dueDate', 'asc')
    );

    return getQueryCacheFirst<Assignment[]>({
      cacheKey: `assignments/${congregationId}/meeting/${meetingId}`,
      query: q,
      maxAgeMs: ASSIGNMENTS_CACHE_TTL_MS,
      persist: false,
      mapSnapshot: (snapshot) =>
        sortAssignmentsByDueDate(
          snapshot.docs.map((docSnapshot) =>
            normalizeAssignment(meetingId, docSnapshot.id, docSnapshot.data())
          )
        ),
    });
  },

  create: async (
    congregationId: string,
    meetingId: string,
    data: CreateAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string> => {
    return createAssignmentViaFunction(
      congregationId, meetingId, data, assignedByUid, assignedByName
    );
  },

  createCleaningGroup: async (
    congregationId: string,
    meetingId: string,
    data: CreateCleaningAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string> => {
    return createAssignmentViaFunction(
      congregationId,
      meetingId,
      {
        ...data,
        category: 'cleaning',
        assignedToUid: data.cleaningGroupId,
        assignedToName: data.cleaningGroupName,
        meetingId,
      },
      assignedByUid,
      assignedByName
    );
  },

  update: async (
    congregationId: string,
    meetingId: string,
    assignmentId: string,
    data: UpdateAssignmentDTO
  ): Promise<void> => {
    await updateAssignmentViaFunction(congregationId, meetingId, assignmentId, data);

    invalidateAssignmentCache(congregationId, meetingId, assignmentId);
  },

  delete: async (
    congregationId: string,
    meetingId: string,
    assignmentId: string
  ): Promise<void> => {
    const callable = httpsCallable<
      {congregationId: string; meetingId: string; assignmentId: string},
      {ok: true; assignmentId: string; notificationsDeleted: number}
    >(functions, 'deleteMeetingAssignmentByManager');
    await callable({congregationId, meetingId, assignmentId});
    invalidateAssignmentCache(congregationId, meetingId, assignmentId);
  },

  count: async (
    congregationId: string,
    status?: AssignmentStatus
  ): Promise<number> => {
    const all = status
      ? await firestoreAssignmentRepository.getByStatus(congregationId, status)
      : await firestoreAssignmentRepository.getAll(congregationId);

    return all.length;
  },

  subscribeToAssignments: (
    congregationId: string,
    callback: (assignments: Assignment[]) => void,
    filters,
    onError?: (error: unknown) => void,
    options?: SubscribeToAssignmentsOptions
  ) => {
    const listenerKey = `assignments:congregation:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const windowStart = new Date();
    windowStart.setMonth(
      windowStart.getMonth() -
        (options?.windowMonthsBack ?? SUBSCRIBE_WINDOW_MONTHS_BACK)
    );
    const windowEnd = new Date();
    windowEnd.setMonth(windowEnd.getMonth() + 2);
    windowEnd.setHours(23, 59, 59, 999);

    const unsubscribe = onSnapshot(
      query(
        collectionGroup(db, 'assignments'),
        where('congregationId', '==', congregationId),
        where('dueDate', '>=', Timestamp.fromDate(windowStart)),
        where('dueDate', '<=', Timestamp.fromDate(windowEnd)),
        orderBy('dueDate', 'asc'),
        limit((options?.maxMeetings ?? SUBSCRIBE_MAX_MEETINGS) * 20)
      ),
      (snapshot) => {
        const assignments = snapshot.docs.map((docSnap) => {
          const meetingId = docSnap.ref.parent.parent?.id ?? '';
          return normalizeAssignment(meetingId, docSnap.id, docSnap.data());
        });
        callback(applyAssignmentFilters(sortAssignmentsByDueDate(assignments), filters));
      },
      (error) => {
        onError?.(error);
      }
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },
};
