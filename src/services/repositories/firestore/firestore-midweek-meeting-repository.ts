import {
  Timestamp,
  addDoc,
  getDoc,
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
  updateMeetingByManager,
} from '@/src/services/meetings/manager-meetings-service';
import {
  normalizeMidweekText,
  sortMidweekMeetingsByStartDateDesc,
  toMidweekMeeting,
} from '@/src/services/meetings/midweek-meeting.mapper';
import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import type { MidweekMeetingRepository } from '@/src/services/repositories/ports/midweek-meeting-repository.port';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import type { MidweekMeeting } from '@/src/services/meetings/midweek-meeting.mapper';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('midweek-meetings-service');

const MIDWEEK_RANGE_CACHE_TTL_MS = 60 * 1000;

const buildRangeKey = (startDate: Date, endDate: Date): string =>
  `${startDate.toISOString()}::${endDate.toISOString()}`;

const invalidateMidweekMeetingCaches = (congregationId: string): void => {
  clearSessionCacheByPrefix(`query:midweek/${congregationId}/`);
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
};

export const firestoreMidweekMeetingRepository: MidweekMeetingRepository = {
  getById: async (
    congregationId: string,
    meetingId: string
  ): Promise<MidweekMeeting | null> => {
    const snap = await getDoc(meetingDocRef(congregationId, meetingId));

    if (!snap.exists()) return null;

    const data = snap.data();
    const category = normalizeMidweekText(data.meetingCategory);
    const type = normalizeMidweekText(data.type);

    if (category !== 'midweek' && type !== 'midweek') {
      return null;
    }

    return toMidweekMeeting(congregationId, snap.id, data);
  },

  getAllByCongregation: async (congregationId: string): Promise<MidweekMeeting[]> => {
    const q = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingCategory', '==', 'midweek')
    );

    const snap = await getDocs(q);

    return sortMidweekMeetingsByStartDateDesc(
      snap.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
    );
  },

  getByRange: async (
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: { forceServer?: boolean; maxItems?: number }
  ): Promise<MidweekMeeting[]> => {
    const maxItems = options?.maxItems ?? 50;
    const cacheKey = `midweek/${congregationId}/range/${buildRangeKey(startDate, endDate)}/limit/${maxItems}`;

    const q = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingCategory', '==', 'midweek'),
      where('startDate', '>=', Timestamp.fromDate(startDate)),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('startDate', 'desc'),
      limit(maxItems)
    );

    try {
      return await getQueryCacheFirst<MidweekMeeting[]>({
        cacheKey,
        query: q,
        forceServer: options?.forceServer,
        maxAgeMs: MIDWEEK_RANGE_CACHE_TTL_MS,
        persist: false,
        mapSnapshot: (snapshot) =>
          sortMidweekMeetingsByStartDateDesc(
            snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
          ),
      });
    } catch {
      const fallbackQuery = query(
        congregationMeetingsCollectionRef(congregationId),
        where('meetingCategory', '==', 'midweek'),
        orderBy('startDate', 'desc'),
        limit(maxItems * 2)
      );

      const fallback = await getQueryCacheFirst<MidweekMeeting[]>({
        cacheKey: `${cacheKey}/fallback`,
        query: fallbackQuery,
        forceServer: options?.forceServer,
        maxAgeMs: MIDWEEK_RANGE_CACHE_TTL_MS,
        persist: false,
        mapSnapshot: (snapshot) =>
          sortMidweekMeetingsByStartDateDesc(
            snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
          ),
      });

      const startMillis = Timestamp.fromDate(startDate).toMillis();
      const endMillis = Timestamp.fromDate(endDate).toMillis();

      return fallback.filter((meeting) => {
        const millis = meeting.startDate.toMillis();
        return millis >= startMillis && millis <= endMillis;
      });
    }
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

      return createMeetingByManager({
        congregationId,
        meetingData: managerPayload,
      });
    };

    let meetingId: string;
    if (options?.requiresManager) {
      meetingId = await createViaFunction();
    } else {
      try {
        const ref = await addDoc(
          congregationMeetingsCollectionRef(congregationId),
          sanitizeForFirestore({
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        meetingId = ref.id;
      } catch (error) {
        if (!isFirebaseErrorCode(error, 'permission-denied')) {
          throw error;
        }

        meetingId = await createViaFunction();
      }
    }

    invalidateMidweekMeetingCaches(congregationId);
    return meetingId;
  },

  update: async (
    congregationId: string,
    meetingId: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<void> => {
    const updateViaFunction = async (): Promise<void> => {
      const managerPayload = { ...payload };
      delete managerPayload.updatedAt;

      await updateMeetingByManager({
        congregationId,
        meetingId,
        meetingData: managerPayload,
      });
    };

    if (options?.requiresManager) {
      await updateViaFunction();
    } else {
      try {
        await updateDoc(
          meetingDocRef(congregationId, meetingId),
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
    }

    invalidateMidweekMeetingCaches(congregationId);
  },

  subscribeToMidweekMeetings: (
    congregationId: string,
    callback: (meetings: MidweekMeeting[]) => void,
    onError?: (error: unknown) => void
  ) => {
    if (!congregationId || typeof congregationId !== 'string') {
      onError?.(new Error('No existe congregationId para cargar reuniones de entre semana.'));
      return () => undefined;
    }

    const q = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingCategory', '==', 'midweek')
    );
    const listenerKey = `midweek:congregation:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const meetings = sortMidweekMeetingsByStartDateDesc(
          snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
        );

        callback(meetings);
      },
      (error) => {
        log.error('subscribeToMidweekMeetings error:', error);
        onError?.(error);
      }
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },
};
