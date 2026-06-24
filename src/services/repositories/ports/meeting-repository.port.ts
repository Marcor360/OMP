import type { Unsubscribe } from 'firebase/firestore';

import type { Meeting, MeetingStatus } from '@/src/types/meeting';

export type { Unsubscribe };

export interface MeetingRepository {
  getById(congregationId: string, id: string): Promise<Meeting | null>;
  getAllByCongregation(congregationId: string): Promise<Meeting[]>;
  getByRange(
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: { forceServer?: boolean; maxItems?: number }
  ): Promise<Meeting[]>;
  getByDateRangeMerged(
    congregationId: string,
    rangeStart: Date,
    rangeEnd: Date
  ): Promise<Meeting[]>;
  getByStatus(congregationId: string, status: MeetingStatus): Promise<Meeting[]>;
  getByUser(congregationId: string, userId: string): Promise<Meeting[]>;
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
  delete(congregationId: string, id: string): Promise<void>;
  count(congregationId: string, status?: MeetingStatus): Promise<number>;
  subscribeToMeetings(
    congregationId: string,
    callback: (meetings: Meeting[]) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
}
