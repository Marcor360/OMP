import {
  Timestamp,
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import {
  congregationMeetingsCollectionRef,
  meetingDocRef,
} from '@/src/lib/firebase/refs';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';
import {
  createMeetingByManager,
  deleteMeetingByManager,
  updateMeetingByManager,
} from '@/src/services/meetings/manager-meetings-service';
import {
  normalizeMeeting,
  sortMeetings,
} from '@/src/services/meetings/meeting.mapper';
import {
  getDocumentCacheFirst,
  getQueryCacheFirst,
  invalidateCacheEntry,
} from '@/src/services/repositories/firestore-cache-first';
import type { MeetingRepository } from '@/src/services/repositories/ports/meeting-repository.port';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import type { Meeting, MeetingStatus } from '@/src/types/meeting';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('meetings-service');

const MEETINGS_RANGE_CACHE_TTL_MS = 60 * 1000;
const MEETING_DOC_CACHE_TTL_MS = 60 * 1000;

const toRangeKey = (startDate: Date, endDate: Date): string =>
  `${startDate.toISOString()}::${endDate.toISOString()}`;

const invalidateMeetingCache = (congregationId: string, id?: string): void => {
  if (id) {
    invalidateCacheEntry(`meetings/${congregationId}/doc/${id}`);
  }
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
};

export const firestoreMeetingRepository: MeetingRepository = {
  getById: async (congregationId: string, id: string): Promise<Meeting | null> => {
    return getDocumentCacheFirst<Meeting>({
      cacheKey: `meetings/${congregationId}/doc/${id}`,
      ref: meetingDocRef(congregationId, id),
      mapSnapshot: (snapshot) =>
        normalizeMeeting(snapshot.id, snapshot.data() as Record<string, unknown>),
      maxAgeMs: MEETING_DOC_CACHE_TTL_MS,
      persist: false,
    });
  },

  getAllByCongregation: async (congregationId: string): Promise<Meeting[]> => {
    const snap = await getDocs(congregationMeetingsCollectionRef(congregationId));
    return sortMeetings(snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data())));
  },

  getByRange: async (
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: { forceServer?: boolean; maxItems?: number }
  ): Promise<Meeting[]> => {
    const maxItems = options?.maxItems ?? 60;
    const rangeKey = toRangeKey(startDate, endDate);
    const q = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingDate', '>=', Timestamp.fromDate(startDate)),
      where('meetingDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('meetingDate', 'asc'),
      limit(maxItems)
    );

    return getQueryCacheFirst<Meeting[]>({
      cacheKey: `meetings/${congregationId}/range/${rangeKey}/limit/${maxItems}`,
      query: q,
      maxAgeMs: MEETINGS_RANGE_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      persist: false,
      mapSnapshot: (snapshot) =>
        sortMeetings(
          snapshot.docs.map((docSnapshot) =>
            normalizeMeeting(docSnapshot.id, docSnapshot.data())
          )
        ),
    });
  },

  getByDateRangeMerged: async (
    congregationId: string,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<Meeting[]> => {
    const byMeetingDateQuery = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingDate', '>=', Timestamp.fromDate(rangeStart)),
      where('meetingDate', '<=', Timestamp.fromDate(rangeEnd)),
      limit(60)
    );

    const byStartDateQuery = query(
      congregationMeetingsCollectionRef(congregationId),
      where('startDate', '>=', Timestamp.fromDate(rangeStart)),
      where('startDate', '<=', Timestamp.fromDate(rangeEnd)),
      limit(60)
    );

    const [meetingDateSnap, startDateSnap] = await Promise.all([
      getDocs(byMeetingDateQuery),
      getDocs(byStartDateQuery),
    ]);

    const byId = new Map<string, Meeting>();
    [...meetingDateSnap.docs, ...startDateSnap.docs].forEach((docSnap) => {
      byId.set(docSnap.id, normalizeMeeting(docSnap.id, docSnap.data()));
    });

    return Array.from(byId.values());
  },

  getByStatus: async (
    congregationId: string,
    status: MeetingStatus
  ): Promise<Meeting[]> => {
    const q = query(
      congregationMeetingsCollectionRef(congregationId),
      where('status', '==', status),
      orderBy('meetingDate', 'asc')
    );
    const snap = await getDocs(q);
    return sortMeetings(snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data())));
  },

  getByUser: async (congregationId: string, userId: string): Promise<Meeting[]> => {
    const meetingsRef = congregationMeetingsCollectionRef(congregationId);

    const [organizerSnap, attendeeSnap] = await Promise.all([
      getDocs(
        query(meetingsRef, where('organizerUid', '==', userId), orderBy('meetingDate', 'asc'))
      ),
      getDocs(
        query(
          meetingsRef,
          where('attendees', 'array-contains', userId),
          orderBy('meetingDate', 'asc')
        )
      ),
    ]);

    const byId = new Map<string, Meeting>();
    [...organizerSnap.docs, ...attendeeSnap.docs].forEach((docSnap) => {
      byId.set(docSnap.id, normalizeMeeting(docSnap.id, docSnap.data()));
    });

    return sortMeetings(Array.from(byId.values()));
  },

  create: async (
    congregationId: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<string> => {
    const createViaFunction = async (): Promise<string> => {
      const managerPayload = { ...payload };
      delete managerPayload.createdAt;
      delete managerPayload.updatedAt;

      const meetingId = await createMeetingByManager({
        congregationId,
        meetingData: managerPayload,
      });

      invalidateMeetingCache(congregationId);
      return meetingId;
    };

    if (options?.requiresManager) {
      return createViaFunction();
    }

    try {
      const ref = await addDoc(
        congregationMeetingsCollectionRef(congregationId),
        sanitizeForFirestore({
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      invalidateMeetingCache(congregationId);
      return ref.id;
    } catch (error) {
      if (!isFirebaseErrorCode(error, 'permission-denied')) {
        throw error;
      }

      return createViaFunction();
    }
  },

  update: async (
    congregationId: string,
    id: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<void> => {
    const updateViaFunction = async (): Promise<void> => {
      const managerPayload = { ...payload };
      delete managerPayload.updatedAt;

      await updateMeetingByManager({
        congregationId,
        meetingId: id,
        meetingData: managerPayload,
      });
    };

    if (options?.requiresManager) {
      await updateViaFunction();
      invalidateMeetingCache(congregationId, id);
      return;
    }

    try {
      await updateDoc(
        meetingDocRef(congregationId, id),
        sanitizeForFirestore({
          ...payload,
          updatedAt: serverTimestamp(),
        })
      );
    } catch (error) {
      if (!isFirebaseErrorCode(error, 'permission-denied')) {
        throw error;
      }

      await updateViaFunction();
    }

    invalidateMeetingCache(congregationId, id);
  },

  delete: async (congregationId: string, id: string): Promise<void> => {
    try {
      await deleteDoc(meetingDocRef(congregationId, id));
    } catch (error) {
      if (!isFirebaseErrorCode(error, 'permission-denied')) {
        throw error;
      }

      await deleteMeetingByManager({
        congregationId,
        meetingId: id,
      });
    }

    invalidateMeetingCache(congregationId, id);
  },

  count: async (congregationId: string, status?: MeetingStatus): Promise<number> => {
    const meetingsRef = congregationMeetingsCollectionRef(congregationId);
    const q = status ? query(meetingsRef, where('status', '==', status)) : meetingsRef;
    const snap = await getDocs(q);
    return snap.size;
  },

  subscribeToMeetings: (
    congregationId: string,
    callback: (meetings: Meeting[]) => void,
    onError?: (error: unknown) => void
  ) => {
    if (!congregationId || typeof congregationId !== 'string') {
      onError?.(new Error('No existe congregationId para cargar reuniones.'));
      return () => undefined;
    }

    const q = query(congregationMeetingsCollectionRef(congregationId));
    const listenerKey = `meetings:congregation:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const meetings = sortMeetings(
          snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data()))
        );
        callback(meetings);
      },
      (error) => {
        log.error('subscribeToMeetings error:', error);
        onError?.(error);
      }
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },
};
