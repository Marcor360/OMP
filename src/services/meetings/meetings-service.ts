import {
  Timestamp,
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

import { congregationMeetingsCollectionRef, meetingDocRef } from '@/src/lib/firebase/refs';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingCategory,
  MeetingStatus,
  MeetingType,
  UpdateMeetingDTO,
} from '@/src/types/meeting';

const isMeetingStatus = (value: unknown): value is MeetingStatus =>
  value === 'pending' ||
  value === 'scheduled' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled';

const isMeetingType = (value: unknown): value is MeetingType =>
  value === 'internal' ||
  value === 'external' ||
  value === 'review' ||
  value === 'training' ||
  value === 'midweek' ||
  value === 'weekend';

const isMeetingCategory = (value: unknown): value is MeetingCategory =>
  value === 'general' || value === 'midweek';

const normalizeMeeting = (id: string, data: Record<string, unknown>): Meeting => {
  const rawType = isMeetingType(data.type) ? data.type : 'weekend';
  const meetingCategory = isMeetingCategory(data.meetingCategory)
    ? data.meetingCategory
    : rawType === 'midweek'
      ? 'midweek'
      : 'general';

  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : undefined,
    type: meetingCategory === 'midweek' ? 'midweek' : rawType,
    meetingCategory,
    status: isMeetingStatus(data.status) ? data.status : 'scheduled',
    weekLabel: typeof data.weekLabel === 'string' ? data.weekLabel : undefined,
    bibleReading: typeof data.bibleReading === 'string' ? data.bibleReading : undefined,
    startDate: (data.startDate as Meeting['startDate']) ?? Timestamp.now(),
    endDate: (data.endDate as Meeting['endDate']) ?? Timestamp.now(),
    location: typeof data.location === 'string' ? data.location : undefined,
    meetingUrl: typeof data.meetingUrl === 'string' ? data.meetingUrl : undefined,
    organizerUid: typeof data.organizerUid === 'string' ? data.organizerUid : '',
    organizerName: typeof data.organizerName === 'string' ? data.organizerName : 'Sistema',
    attendees: Array.isArray(data.attendees)
      ? data.attendees.filter((value): value is string => typeof value === 'string')
      : [],
    attendeeNames: Array.isArray(data.attendeeNames)
      ? data.attendeeNames.filter((value): value is string => typeof value === 'string')
      : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    openingSong: typeof data.openingSong === 'string' ? data.openingSong : undefined,
    openingPrayer: typeof data.openingPrayer === 'string' ? data.openingPrayer : undefined,
    closingSong: typeof data.closingSong === 'string' ? data.closingSong : undefined,
    closingPrayer: typeof data.closingPrayer === 'string' ? data.closingPrayer : undefined,
    chairman: typeof data.chairman === 'string' ? data.chairman : undefined,
    midweekSections: Array.isArray(data.midweekSections)
      ? (data.midweekSections as Meeting['midweekSections'])
      : undefined,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    createdAt: (data.createdAt as Meeting['createdAt']) ?? Timestamp.now(),
    updatedAt: (data.updatedAt as Meeting['updatedAt']) ?? Timestamp.now(),
  };
};

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
export const getMeetingById = async (congregationId: string, id: string): Promise<Meeting | null> => {
  const snap = await getDoc(meetingDocRef(congregationId, id));
  if (!snap.exists()) return null;
  return normalizeMeeting(snap.id, snap.data());
};

/** Obtiene todas las reuniones ordenadas por fecha */
export const getAllMeetings = async (congregationId: string): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const q = query(congregationMeetingsCollectionRef(congregationId));
  const snap = await getDocs(q);
  return sortMeetings(snap.docs.map((d) => normalizeMeeting(d.id, d.data())));
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
  return snap.docs.map((d) => normalizeMeeting(d.id, d.data()));
};

/** Obtiene reuniones donde el usuario es organizador o asistente */
export const getMeetingsByUser = async (congregationId: string, uid: string): Promise<Meeting[]> => {
  const meetingsRef = congregationMeetingsCollectionRef(congregationId);

  const [organizerSnap, attendeeSnap] = await Promise.all([
    getDocs(query(meetingsRef, where('organizerUid', '==', uid), orderBy('startDate', 'desc'))),
    getDocs(query(meetingsRef, where('attendees', 'array-contains', uid), orderBy('startDate', 'desc'))),
  ]);

  const byId = new Map<string, Meeting>();
  [...organizerSnap.docs, ...attendeeSnap.docs].forEach((d) => {
    byId.set(d.id, normalizeMeeting(d.id, d.data()));
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
  const meetingCategory: MeetingCategory = data.meetingCategory ?? (data.type === 'midweek' ? 'midweek' : 'general');
  const normalizedType: MeetingType = meetingCategory === 'midweek' ? 'midweek' : data.type;

  const ref = await addDoc(congregationMeetingsCollectionRef(congregationId), {
    ...data,
    type: normalizedType,
    meetingCategory,
    organizerUid,
    organizerName,
    status: data.status ?? ('scheduled' as MeetingStatus),
    createdBy: data.createdBy ?? organizerUid,
    updatedBy: data.updatedBy ?? organizerUid,
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
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (typeof data.updatedBy === 'string' && data.updatedBy.trim().length > 0) {
    payload.updatedBy = data.updatedBy;
  }

  await updateDoc(meetingDocRef(congregationId, id), payload);
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
      const meetings = sortMeetings(snap.docs.map((d) => normalizeMeeting(d.id, d.data())));
      callback(meetings);
    },
    (error) => {
      console.error('subscribeToMeetings error:', error);
      onError?.(error);
    }
  );
};
