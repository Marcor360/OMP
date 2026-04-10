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
  type Unsubscribe,
} from 'firebase/firestore';

import {
  congregationMeetingsCollectionRef,
  meetingDocRef,
} from '@/src/lib/firebase/refs';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingStatus,
  UpdateMeetingDTO,
} from '@/src/types/meeting';

const docToMeeting = (id: string, data: Record<string, unknown>): Meeting =>
  ({ id, ...data } as Meeting);

const getMeetingTime = (meeting: Meeting): number => {
  const raw: unknown = meeting.startDate;

  if (!raw) return 0;

  if (raw instanceof Date) {
    return raw.getTime();
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'toDate' in raw &&
    typeof (raw as { toDate?: unknown }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const sortMeetings = (items: Meeting[]): Meeting[] => {
  return [...items].sort((a, b) => getMeetingTime(b) - getMeetingTime(a));
};

/** Obtiene una reunion por ID */
export const getMeetingById = async (
  congregationId: string,
  id: string
): Promise<Meeting | null> => {
  const snap = await getDoc(meetingDocRef(congregationId, id));
  if (!snap.exists()) return null;
  return docToMeeting(snap.id, snap.data());
};

/** Obtiene todas las reuniones ordenadas por fecha */
export const getAllMeetings = async (congregationId: string): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const q = query(congregationMeetingsCollectionRef(congregationId));
  const snap = await getDocs(q);
  return sortMeetings(snap.docs.map((d) => docToMeeting(d.id, d.data())));
};

/** Obtiene reuniones por estado */
export const getMeetingsByStatus = async (
  congregationId: string,
  status: MeetingStatus
): Promise<Meeting[]> => {
  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('status', '==', status),
    orderBy('startDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToMeeting(d.id, d.data()));
};

/** Obtiene reuniones donde el usuario es organizador o asistente */
export const getMeetingsByUser = async (
  congregationId: string,
  uid: string
): Promise<Meeting[]> => {
  const meetingsRef = congregationMeetingsCollectionRef(congregationId);

  const [organizerSnap, attendeeSnap] = await Promise.all([
    getDocs(query(meetingsRef, where('organizerUid', '==', uid), orderBy('startDate', 'desc'))),
    getDocs(query(meetingsRef, where('attendees', 'array-contains', uid), orderBy('startDate', 'desc'))),
  ]);

  const byId = new Map<string, Meeting>();
  [...organizerSnap.docs, ...attendeeSnap.docs].forEach((d) => {
    byId.set(d.id, docToMeeting(d.id, d.data()));
  });

  return Array.from(byId.values()).sort((a, b) => b.startDate.seconds - a.startDate.seconds);
};

/** Crea una reunion */
export const createMeeting = async (
  congregationId: string,
  data: CreateMeetingDTO,
  organizerUid: string,
  organizerName: string
): Promise<string> => {
  const ref = await addDoc(congregationMeetingsCollectionRef(congregationId), {
    ...data,
    organizerUid,
    organizerName,
    status: 'scheduled' as MeetingStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
};

/** Actualiza una reunion */
export const updateMeeting = async (
  congregationId: string,
  id: string,
  data: UpdateMeetingDTO
): Promise<void> => {
  await updateDoc(meetingDocRef(congregationId, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/** Elimina una reunion */
export const deleteMeeting = async (congregationId: string, id: string): Promise<void> => {
  await deleteDoc(meetingDocRef(congregationId, id));
};

/** Cuenta reuniones por estado */
export const getMeetingsCount = async (
  congregationId: string,
  status?: MeetingStatus
): Promise<number> => {
  const meetingsRef = congregationMeetingsCollectionRef(congregationId);
  const q = status ? query(meetingsRef, where('status', '==', status)) : meetingsRef;
  const snap = await getDocs(q);
  return snap.size;
};

/** Suscripcion en tiempo real a todas las reuniones */
export const subscribeToMeetings = (
  congregationId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar reuniones.'));
    return () => {};
  }

  const q = query(congregationMeetingsCollectionRef(congregationId));

  return onSnapshot(
    q,
    (snap) => {
      const meetings = sortMeetings(snap.docs.map((d) => docToMeeting(d.id, d.data())));
      callback(meetings);
    },
    (error) => {
      console.error('subscribeToMeetings error:', error);
      onError?.(error);
    }
  );
};
