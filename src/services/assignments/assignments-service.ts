import {
  Timestamp,
  addDoc,
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
  updateDoc,
  where,
  type Query,
  type QueryConstraint,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  assignmentDocRef,
  congregationMeetingsCollectionRef,
  meetingAssignmentsCollectionRef,
} from '@/src/lib/firebase/refs';
import { db } from '@/src/lib/firebase/app';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
} from '@/src/types/assignment';

type AssignmentFilters = {
  userUid?: string;
  status?: AssignmentStatus;
};

const ASSIGNMENTS_CACHE_TTL_MS = 60 * 1000;

type MeetingIdsOptions = {
  startDate?: Date;
  endDate?: Date;
  maxItems?: number;
  forceServer?: boolean;
};

const isInvalidRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate;

const assignmentSortByDueDate = (a: Assignment, b: Assignment): number => {
  const aDue = a.dueDate?.toMillis?.() ?? 0;
  const bDue = b.dueDate?.toMillis?.() ?? 0;
  return aDue - bDue;
};

const normalizeAssignment = (
  meetingId: string,
  id: string,
  data: Record<string, unknown>
): Assignment => {
  const base = { id, ...data } as Assignment;
  return {
    ...base,
    meetingId: base.meetingId ?? meetingId,
  };
};

const applyAssignmentFilters = (
  assignments: Assignment[],
  filters?: AssignmentFilters
): Assignment[] => {
  if (!filters) return assignments;

  return assignments.filter((assignment) => {
    if (filters.userUid && assignment.assignedToUid !== filters.userUid) {
      return false;
    }

    if (filters.status && assignment.status !== filters.status) {
      return false;
    }

    return true;
  });
};

const dedupeAssignments = (assignments: Assignment[]): Assignment[] => {
  const byId = new Map<string, Assignment>();

  assignments.forEach((assignment) => {
    const key = `${assignment.meetingId ?? 'none'}:${assignment.id}`;
    byId.set(key, assignment);
  });

  return Array.from(byId.values());
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

  return dedupeAssignments(merged).sort(assignmentSortByDueDate);
};

/** Obtiene una asignacion por ID dentro de la congregacion */
export const getAssignmentById = async (
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
    meetingIds.map((meetingId) => getDoc(assignmentDocRef(congregationId, meetingId, assignmentId)))
  );

  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];

    if (snapshot.exists()) {
      return normalizeAssignment(meetingIds[index], snapshot.id, snapshot.data());
    }
  }

  return null;
};

/** Obtiene todas las asignaciones de la congregacion */
export const getAllAssignments = async (congregationId: string): Promise<Assignment[]> => {
  return getAssignmentsForMeetings(congregationId, () => [orderBy('dueDate', 'asc')]);
};

/** Obtiene asignaciones de un usuario especifico dentro de la congregacion */
export const getAssignmentsByUser = async (
  congregationId: string,
  uid: string
): Promise<Assignment[]> => {
  return getAssignmentsForMeetings(congregationId, () => [
    where('assignedToUid', '==', uid),
    orderBy('dueDate', 'asc'),
  ]);
};

/** Obtiene asignaciones por estado dentro de la congregacion */
export const getAssignmentsByStatus = async (
  congregationId: string,
  status: AssignmentStatus
): Promise<Assignment[]> => {
  return getAssignmentsForMeetings(congregationId, () => [
    where('status', '==', status),
    orderBy('dueDate', 'asc'),
  ]);
};

/** Obtiene asignaciones del rango visible (semana/rango) */
export const getAssignmentsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    userUid?: string;
    status?: AssignmentStatus;
    forceServer?: boolean;
    maxMeetings?: number;
    perMeetingLimit?: number;
  }
): Promise<Assignment[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  if (isInvalidRange(startDate, endDate)) {
    return [];
  }

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

      return await getDocs(
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

  return dedupeAssignments(merged).sort(assignmentSortByDueDate);
};

/** Obtiene asignaciones de una reunion */
export const getAssignmentsByMeeting = async (
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
      snapshot.docs
        .map((docSnapshot) => normalizeAssignment(meetingId, docSnapshot.id, docSnapshot.data()))
        .sort(assignmentSortByDueDate),
  });
};

/** Crea una asignacion en la subcoleccion de la reunion */
export const createAssignment = async (
  congregationId: string,
  meetingId: string,
  data: CreateAssignmentDTO,
  assignedByUid: string,
  assignedByName: string
): Promise<string> => {
  const ref = await addDoc(meetingAssignmentsCollectionRef(congregationId, meetingId), {
    ...data,
    meetingId,
    assignedByUid,
    assignedByName,
    status: 'pending' as AssignmentStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  clearSessionCacheByPrefix(`query:assignments/${congregationId}/`);
  return ref.id;
};

/** Actualiza una asignacion */
export const updateAssignment = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string,
  data: UpdateAssignmentDTO
): Promise<void> => {
  const extra: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (data.status === 'completed') {
    extra.completedAt = serverTimestamp();
  }

  await updateDoc(assignmentDocRef(congregationId, meetingId, assignmentId), {
    ...data,
    ...extra,
  });
  clearSessionCacheByPrefix(`query:assignments/${congregationId}/`);
};

/** Elimina una asignacion */
export const deleteAssignment = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string
): Promise<void> => {
  await deleteDoc(assignmentDocRef(congregationId, meetingId, assignmentId));
  clearSessionCacheByPrefix(`query:assignments/${congregationId}/`);
};

/** Cuenta asignaciones por estado */
export const getAssignmentsCount = async (
  congregationId: string,
  status?: AssignmentStatus
): Promise<number> => {
  const all = status
    ? await getAssignmentsByStatus(congregationId, status)
    : await getAllAssignments(congregationId);

  return all.length;
};

/**
 * Suscripcion consolidada en tiempo real de asignaciones por congregacion.
 * Escucha reuniones y crea listeners por subcoleccion assignments con limpieza completa.
 */
export const subscribeToAssignments = (
  congregationId: string,
  callback: (assignments: Assignment[]) => void,
  filters?: AssignmentFilters,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const assignmentsByMeeting = new Map<string, Assignment[]>();
  const assignmentsUnsubs = new Map<string, Unsubscribe>();
  const listenerKey = `assignments:congregation:${congregationId}`;
  logFirestoreListenerCreated(listenerKey);

  const emit = () => {
    const merged = dedupeAssignments(Array.from(assignmentsByMeeting.values()).flat())
      .sort(assignmentSortByDueDate);
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
    (meetingsSnap: QuerySnapshot) => {
      const nextMeetingIds = new Set(meetingsSnap.docs.map((meetingDoc) => meetingDoc.id));

      // Limpia listeners de reuniones que ya no existen.
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
};
