import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_EVENT_TEAM_SIZE, EVENT_LIMITS, isEventTeamSize } from '@/functions/src/shared/event-planning';

import type { CongregationEventFormValues } from '@/src/types/event';

export type EventDraft = {
  values: CongregationEventFormValues;
  requestId: string;
  revision?: number;
  pendingCreate?: boolean;
};

export function eventDraftKey(uid: string, congregationId: string, eventId: string | null): string {
  return `@omp/event-drafts/v1/${encodeURIComponent(uid)}/${encodeURIComponent(congregationId)}/${encodeURIComponent(eventId ?? 'new')}`;
}

export async function loadEventDraft(key: string): Promise<EventDraft | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as Partial<EventDraft>;
    if (!draft?.values || typeof draft.requestId !== 'string') return null;
    const schedules = draft.values.schedules?.map((schedule) => ({
      ...schedule,
      teamSize: isEventTeamSize(schedule.teamSize) ? schedule.teamSize
        : schedule.teamSize > EVENT_LIMITS.teamSize ? EVENT_LIMITS.teamSize : DEFAULT_EVENT_TEAM_SIZE,
    }));
    return { ...draft, requestId: draft.requestId, values: { ...draft.values, schedules } };
  } catch {
    return null;
  }
}

export const saveEventDraft = (key: string, draft: EventDraft) => AsyncStorage.setItem(key, JSON.stringify(draft));
export const clearEventDraft = (key: string) => AsyncStorage.removeItem(key);
