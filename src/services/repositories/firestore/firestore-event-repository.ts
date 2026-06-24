import { getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { eventDocRef, eventsCollectionRef } from '@/src/lib/firebase/refs';
import type { EventRepository } from '@/src/services/repositories/ports/event-repository.port';
import type {
  CongregationEvent,
  CongregationEventFormValues,
} from '@/src/types/event';

export const firestoreEventRepository: EventRepository = {
  listByCongregation: async (congregationId: string): Promise<CongregationEvent[]> => {
    const q = query(eventsCollectionRef(), where('congregationId', '==', congregationId));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<CongregationEvent, 'id'>),
    }));
  },

  getById: async (eventId: string): Promise<CongregationEvent | null> => {
    const snap = await getDoc(eventDocRef(eventId));
    if (!snap.exists()) return null;
    return {
      id: snap.id,
      ...(snap.data() as Omit<CongregationEvent, 'id'>),
    };
  },

  create: async (payload: {
    congregationId: string;
    eventData: CongregationEventFormValues;
  }): Promise<string> => {
    const callable = httpsCallable<
      { congregationId: string; eventData: CongregationEventFormValues },
      { eventId: string }
    >(functions, 'createEventByManager');
    const response = await callable(payload);
    return response.data.eventId;
  },

  update: async (payload: {
    congregationId: string;
    eventId: string;
    eventData: CongregationEventFormValues;
  }): Promise<void> => {
    const callable = httpsCallable<
      { congregationId: string; eventId: string; eventData: CongregationEventFormValues },
      { ok: true }
    >(functions, 'updateEventByManager');
    await callable(payload);
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
  },
};
