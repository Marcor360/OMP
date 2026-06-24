import type { Unsubscribe } from 'firebase/firestore';

import type { MidweekMeeting } from '@/src/services/meetings/midweek-meeting.mapper';

export type { Unsubscribe };

export interface MidweekMeetingRepository {
  getById(congregationId: string, id: string): Promise<MidweekMeeting | null>;
  getAllByCongregation(congregationId: string): Promise<MidweekMeeting[]>;
  getByRange(
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: { forceServer?: boolean; maxItems?: number }
  ): Promise<MidweekMeeting[]>;
  create(
    congregationId: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<string>;
  update(
    congregationId: string,
    id: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<void>;
  subscribeToMidweekMeetings(
    congregationId: string,
    callback: (meetings: MidweekMeeting[]) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
}
