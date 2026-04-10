import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
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

const getMeetingIds = async (congregationId: string): Promise<string[]> => {
  const meetingsSnap = await getDocs(
    query(congregationMeetingsCollectionRef(congregationId), orderBy('startDate', 'desc'))
  );

  return meetingsSnap.docs.map((docSnap) => docSnap.id);
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
  constraintsFactory: (meetingId: string) => QueryConstraint[]
): Promise<Assignment[]> => {
  const meetingIds = await getMeetingIds(congregationId);

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
  assignmentId: string
): Promise<Assignment | null> => {
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

/** Obtiene asignaciones de una reunion */
export const getAssignmentsByMeeting = async (
  congregationId: string,
  meetingId: string
): Promise<Assignment[]> => {
  const q = query(
    meetingAssignmentsCollectionRef(congregationId, meetingId),
    orderBy('dueDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => normalizeAssignment(meetingId, d.id, d.data()))
    .sort(assignmentSortByDueDate);
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
};

/** Elimina una asignacion */
export const deleteAssignment = async (
  congregationId: string,
  meetingId: string,
  assignmentId: string
): Promise<void> => {
  await deleteDoc(assignmentDocRef(congregationId, meetingId, assignmentId));
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

  const emit = () => {
    const merged = dedupeAssignments(Array.from(assignmentsByMeeting.values()).flat())
      .sort(assignmentSortByDueDate);
    callback(applyAssignmentFilters(merged, filters));
  };

  const releaseMeetingListener = (meetingId: string) => {
    const unsubscribe = assignmentsUnsubs.get(meetingId);
    if (unsubscribe) {
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

        assignmentsUnsubs.set(meetingId, assignmentUnsub);
      });

      emit();
    },
    (error) => {
      onError?.(error);
    }
  );

  return () => {
    meetingsUnsub();
    assignmentsUnsubs.forEach((unsubscribe) => unsubscribe());
    assignmentsUnsubs.clear();
    assignmentsByMeeting.clear();
  };
};