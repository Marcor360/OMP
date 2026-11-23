import { getDoc, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { getQueryCacheFirst, invalidateCacheEntry } from '@/src/services/repositories/firestore-cache-first';
import { functions } from '@/src/lib/firebase/app';
import { eventDocRef, eventsCollectionRef } from '@/src/lib/firebase/refs';
import type { EventRepository } from '@/src/services/repositories/ports/event-repository.port';
import type {
  CongregationEvent,
  CongregationEventFormValues,
} from '@/src/types/event';

const eventsKey = (congregationId: string) => `events/${congregationId}`;

export const firestoreEventRepository: EventRepository = {
  listByCongregation: (congregationId, forceServer) => getQueryCacheFirst({
    cacheKey: eventsKey(congregationId),
    query: query(eventsCollectionRef(), where('congregationId', '==', congregationId)),
    maxAgeMs: 30_000,
    persist: false,
    requireServerOnCacheMiss: true,
    forceServer,
    mapSnapshot: (snap) => snap.docs.map((docSnap) => ({
      ...(docSnap.data() as Omit<CongregationEvent, 'id'>),
      id: docSnap.id,
    })),
  }),

  getById: async (eventId: string): Promise<CongregationEvent | null> => {
    const snap = await getDoc(eventDocRef(eventId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<CongregationEvent, 'id'>),
    };
  },

  create: async (payload: {
    requestId?: string;
    congregationId: string;
    eventData: CongregationEventFormValues;
  }): Promise<string> => {
    const callable = httpsCallable<
      { congregationId: string; requestId?: string; eventData: CongregationEventFormValues },
      { eventId: string }
    >(functions, 'createEventByManager');
    const response = await callable(payload);
    await invalidateCacheEntry(eventsKey(payload.congregationId));
    return response.data.eventId;
  },

  update: async (payload: {
    expectedRevision?: number;
    congregationId: string;
    eventId: string;
    eventData: CongregationEventFormValues;
  }): Promise<void> => {
    const callable = httpsCallable<
      { congregationId: string; eventId: string; expectedRevision?: number; eventData: CongregationEventFormValues },
      { ok: true }
    >(functions, 'updateEventByManager');
    await callable(payload);
    await invalidateCacheEntry(eventsKey(payload.congregationId));
  },

  delete: async (payload: {
    congregationId: string;
    eventId: string;
  }): Promise<void> => {
    const callable = httpsCallable<
      { congregationId: string; eventId: string },
      { ok: true }
    >(functions, 'deleteEventByManager');
    await callable(payload);
    await invalidateCacheEntry(eventsKey(payload.congregationId));
  },
};
