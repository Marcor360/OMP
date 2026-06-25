import {
  Timestamp,
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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
import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
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

const invalidateAssignmentCache = (congregationId: string): void => {
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
    mapSnapshot: (snapshot) => snapshot.docs.map((docSnap) => docSnap.id),
  });
};

const buildAssignmentsQuery = (
  congregationId: string,
  meetingId: string,
  extraConstraints: QueryConstraint[]
): Query => {
  return query(
    meetingAssignmentsCollectionRef(congregationId, meetingId),
    ...extraConstraints
  );
};

const getAssignmentsForMeetings = async (
  congregationId: string,
  constraintsFactory: (meetingId: string) => QueryConstraint[],
  options?: MeetingIdsOptions
): Promise<Assignment[]> => {
  const meetingIds = await getMeetingIds(congregationId, options);

  if (meetingIds.length === 0) return [];

  const snapshots = await Promise.all(
    meetingIds.map((meetingId) =>
      getDocs(buildAssignmentsQuery(congregationId, meetingId, constraintsFactory(meetingId)))
    )
  );

  const merged = snapshots.flatMap((snapshot, index) => {
    const meetingId = meetingIds[index];
    return snapshot.docs.map((docSnap) =>
      normalizeAssignment(meetingId, docSnap.id, docSnap.data())
    );
  });

  return sortAssignmentsByDueDate(dedupeAssignments(merged));
};

export const firestoreAssignmentRepository: AssignmentRepository = {
  getById: async (
    congregationId: string,
    assignmentId: string,
    meetingIdHint?: string
  ): Promise<Assignment | null> => {
    if (meetingIdHint && meetingIdHint.trim().length > 0) {
      try {
        const directSnapshot = await getDoc(
          assignmentDocRef(congregationId, meetingIdHint, assignmentId)
        );

        if (directSnapshot.exists()) {
          return normalizeAssignment(meetingIdHint, directSnapshot.id, directSnapshot.data());
        }
      } catch {
        // Continue with broader fallback strategy.
      }
    }

    try {
      const grouped = await getDocs(
        query(collectionGroup(db, 'assignments'), where(documentId(), '==', assignmentId), limit(6))
      );

      for (const docSnapshot of grouped.docs) {
        const pathSegments = docSnapshot.ref.path.split('/');

        if (
          pathSegments.length >= 6 &&
          pathSegments[0] === 'congregations' &&
          pathSegments[1] === congregationId &&
          pathSegments[2] === 'meetings' &&
          pathSegments[4] === 'assignments'
        ) {
          const meetingId = pathSegments[3];
          return normalizeAssignment(meetingId, docSnapshot.id, docSnapshot.data());
        }
      }
    } catch {
      // Fallback to deterministic scan below if collectionGroup is not available.
    }

    const meetingIds = await getMeetingIds(congregationId);

    if (meetingIds.length === 0) return null;

    const snapshots = await Promise.all(
      meetingIds.map((meetingId) =>
        getDoc(assignmentDocRef(congregationId, meetingId, assignmentId))
      )
    );

    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];

      if (snapshot.exists()) {
        return normalizeAssignment(meetingIds[index], snapshot.id, snapshot.data());
      }
    }

    return null;
  },

  getAll: async (congregationId: string): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [orderBy('dueDate', 'asc')]);
  },

  getByUser: async (congregationId: string, uid: string): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [
      where('assignedToUid', '==', uid),
      orderBy('dueDate', 'asc'),
    ]);
  },

  getByStatus: async (
    congregationId: string,
    status: AssignmentStatus
  ): Promise<Assignment[]> => {
    return getAssignmentsForMeetings(congregationId, () => [
      where('status', '==', status),
      orderBy('dueDate', 'asc'),
    ]);
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

    const readAssignmentsForMeeting = async (meetingId: string) => {
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
        return await getDocs(
          query(meetingAssignmentsCollectionRef(congregationId, meetingId), ...primaryConstraints)
        );
      } catch {
        const fallbackConstraints: QueryConstraint[] = [limit(maxPerMeeting * 2)];

        if (options?.userUid) {
          fallbackConstraints.unshift(where('assignedToUid', '==', options.userUid));
        }

        if (options?.status) {
          fallbackConstraints.unshift(where('status', '==', options.status));
        }

        return getDocs(
          query(meetingAssignmentsCollectionRef(congregationId, meetingId), ...fallbackConstraints)
        );
      }
    };

    const snapshots = await Promise.all(
      meetingIds.map((meetingId) => readAssignmentsForMeeting(meetingId))
    );

    const merged = snapshots.flatMap((snapshot, index) =>
      snapshot.docs
        .map((docSnap) => normalizeAssignment(meetingIds[index], docSnap.id, docSnap.data()))
        .filter((assignment) => {
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

    invalidateAssignmentCache(congregationId);
    return result.data.assignmentId;
  },

  createCleaningGroup: async (
    congregationId: string,
    data: CreateCleaningAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'congregations', congregationId, 'assignments'), {
      congregationId,
      category: 'cleaning',
      type: 'cleaning',
      title: data.title,
      description: data.description ?? '',
      notes: data.description ?? '',
      priority: data.priority,
      cleaningGroupId: data.cleaningGroupId,
      cleaningGroupName: data.cleaningGroupName,
      assignedToUid: data.cleaningGroupId,
      assignedToName: data.cleaningGroupName,
      assignedByUid,
      assignedByName,
      createdBy: assignedByUid,
      updatedBy: assignedByUid,
      dueDate: data.dueDate,
      date: data.dueDate,
      status: 'pending' as AssignmentStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    invalidateAssignmentCache(congregationId);
    return ref.id;
  },

  update: async (
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
    invalidateAssignmentCache(congregationId);
  },

  delete: async (
    congregationId: string,
    meetingId: string,
    assignmentId: string
  ): Promise<void> => {
    await deleteDoc(assignmentDocRef(congregationId, meetingId, assignmentId));
    invalidateAssignmentCache(congregationId);
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
    onError?: (error: unknown) => void
  ) => {
    const assignmentsByMeeting = new Map<string, Assignment[]>();
    const assignmentsUnsubs = new Map<string, () => void>();
    const listenerKey = `assignments:congregation:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const emit = () => {
      const merged = sortAssignmentsByDueDate(
        dedupeAssignments(Array.from(assignmentsByMeeting.values()).flat())
      );
      callback(applyAssignmentFilters(merged, filters));
    };

    const releaseMeetingListener = (meetingId: string) => {
      const unsubscribe = assignmentsUnsubs.get(meetingId);
      if (unsubscribe) {
        logFirestoreListenerDestroyed(`assignments:meeting:${congregationId}:${meetingId}`);
        unsubscribe();
        assignmentsUnsubs.delete(meetingId);
      }

      assignmentsByMeeting.delete(meetingId);
    };

    const meetingsUnsub = onSnapshot(
      query(congregationMeetingsCollectionRef(congregationId), orderBy('startDate', 'desc')),
      (meetingsSnap) => {
        const nextMeetingIds = new Set(meetingsSnap.docs.map((meetingDoc) => meetingDoc.id));

        Array.from(assignmentsUnsubs.keys()).forEach((meetingId) => {
          if (!nextMeetingIds.has(meetingId)) {
            releaseMeetingListener(meetingId);
          }
        });

        meetingsSnap.docs.forEach((meetingDoc) => {
          const meetingId = meetingDoc.id;

          if (assignmentsUnsubs.has(meetingId)) {
            return;
          }

          const assignmentsQuery = query(
            meetingAssignmentsCollectionRef(congregationId, meetingId),
            orderBy('dueDate', 'asc')
          );

          const assignmentUnsub = onSnapshot(
            assignmentsQuery,
            (assignmentsSnap) => {
              assignmentsByMeeting.set(
                meetingId,
                assignmentsSnap.docs.map((docSnap) =>
                  normalizeAssignment(meetingId, docSnap.id, docSnap.data())
                )
              );
              emit();
            },
            (error) => {
              onError?.(error);
            }
          );

          logFirestoreListenerCreated(`assignments:meeting:${congregationId}:${meetingId}`);
          assignmentsUnsubs.set(meetingId, assignmentUnsub);
        });

        emit();
      },
      (error) => {
        onError?.(error);
      }
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      meetingsUnsub();
      assignmentsUnsubs.forEach((unsubscribe) => unsubscribe());
      assignmentsUnsubs.clear();
      assignmentsByMeeting.clear();
    };
  },
};
