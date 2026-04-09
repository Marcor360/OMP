import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/config/firebase/firebase';
import {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
} from '@/src/types/assignment';

const COLLECTION = 'assignments';
const col = () => collection(db, COLLECTION);

const docToAssignment = (id: string, data: Record<string, unknown>): Assignment =>
  ({ id, ...data } as Assignment);

/** Obtiene una asignación por ID */
export const getAssignmentById = async (id: string): Promise<Assignment | null> => {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return docToAssignment(snap.id, snap.data());
};

/** Obtiene todas las asignaciones */
export const getAllAssignments = async (): Promise<Assignment[]> => {
  const q = query(col(), orderBy('dueDate', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToAssignment(d.id, d.data()));
};

/** Obtiene asignaciones de un usuario específico */
export const getAssignmentsByUser = async (uid: string): Promise<Assignment[]> => {
  const q = query(
    col(),
    where('assignedToUid', '==', uid),
    orderBy('dueDate', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToAssignment(d.id, d.data()));
};

/** Obtiene asignaciones por estado */
export const getAssignmentsByStatus = async (
  status: AssignmentStatus
): Promise<Assignment[]> => {
  const q = query(col(), where('status', '==', status), orderBy('dueDate', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToAssignment(d.id, d.data()));
};

/** Obtiene asignaciones de una reunión */
export const getAssignmentsByMeeting = async (meetingId: string): Promise<Assignment[]> => {
  const q = query(col(), where('meetingId', '==', meetingId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToAssignment(d.id, d.data()));
};

/** Crea una asignación */
export const createAssignment = async (
  data: CreateAssignmentDTO,
  assignedByUid: string,
  assignedByName: string
): Promise<string> => {
  const ref = await addDoc(col(), {
    ...data,
    assignedByUid,
    assignedByName,
    status: 'pending' as AssignmentStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/** Actualiza una asignación */
export const updateAssignment = async (
  id: string,
  data: UpdateAssignmentDTO
): Promise<void> => {
  const extra: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.status === 'completed') {
    extra.completedAt = serverTimestamp();
  }
  await updateDoc(doc(db, COLLECTION, id), { ...data, ...extra });
};

/** Elimina una asignación */
export const deleteAssignment = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

/** Cuenta asignaciones por estado */
export const getAssignmentsCount = async (
  status?: AssignmentStatus
): Promise<number> => {
  const q = status
    ? query(col(), where('status', '==', status))
    : col();
  const snap = await getDocs(q);
  return snap.size;
};

/** Suscripción en tiempo real a todas las asignaciones */
export const subscribeToAssignments = (
  callback: (assignments: Assignment[]) => void,
  userUid?: string
): Unsubscribe => {
  const q = userUid
    ? query(col(), where('assignedToUid', '==', userUid), orderBy('dueDate', 'asc'))
    : query(col(), orderBy('dueDate', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToAssignment(d.id, d.data())));
  });
};
