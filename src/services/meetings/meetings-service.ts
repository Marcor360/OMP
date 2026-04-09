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
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/config/firebase/firebase';
import {
  Meeting,
  CreateMeetingDTO,
  UpdateMeetingDTO,
  MeetingStatus,
} from '@/src/types/meeting';

const COLLECTION = 'meetings';
const col = () => collection(db, COLLECTION);

const docToMeeting = (id: string, data: Record<string, unknown>): Meeting =>
  ({ id, ...data } as Meeting);

/** Obtiene una reunión por ID */
export const getMeetingById = async (id: string): Promise<Meeting | null> => {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return docToMeeting(snap.id, snap.data());
};

/** Obtiene todas las reuniones ordenadas por fecha */
export const getAllMeetings = async (): Promise<Meeting[]> => {
  const q = query(col(), orderBy('startDate', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToMeeting(d.id, d.data()));
};

/** Obtiene reuniones por estado */
export const getMeetingsByStatus = async (
  status: MeetingStatus
): Promise<Meeting[]> => {
  const q = query(
    col(),
    where('status', '==', status),
    orderBy('startDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToMeeting(d.id, d.data()));
};

/** Obtiene reuniones donde el usuario es organizador o asistente */
export const getMeetingsByUser = async (uid: string): Promise<Meeting[]> => {
  const [organizerSnap, attendeeSnap] = await Promise.all([
    getDocs(query(col(), where('organizerUid', '==', uid), orderBy('startDate', 'desc'))),
    getDocs(query(col(), where('attendees', 'array-contains', uid), orderBy('startDate', 'desc'))),
  ]);

  const byId = new Map<string, Meeting>();
  [...organizerSnap.docs, ...attendeeSnap.docs].forEach((d) => {
    byId.set(d.id, docToMeeting(d.id, d.data()));
  });
  return Array.from(byId.values()).sort(
    (a, b) => b.startDate.seconds - a.startDate.seconds
  );
};

/** Crea una reunión */
export const createMeeting = async (
  data: CreateMeetingDTO,
  organizerUid: string,
  organizerName: string
): Promise<string> => {
  const ref = await addDoc(col(), {
    ...data,
    organizerUid,
    organizerName,
    status: 'scheduled' as MeetingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

/** Actualiza una reunión */
export const updateMeeting = async (
  id: string,
  data: UpdateMeetingDTO
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/** Elimina una reunión */
export const deleteMeeting = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

/** Cuenta reuniones por estado */
export const getMeetingsCount = async (
  status?: MeetingStatus
): Promise<number> => {
  const q = status
    ? query(col(), where('status', '==', status))
    : col();
  const snap = await getDocs(q);
  return snap.size;
};

/** Suscripción en tiempo real a todas las reuniones */
export const subscribeToMeetings = (
  callback: (meetings: Meeting[]) => void
): Unsubscribe => {
  const q = query(col(), orderBy('startDate', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => docToMeeting(d.id, d.data())));
  });
};
