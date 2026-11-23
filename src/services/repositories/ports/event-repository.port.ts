import type {
  CongregationEvent,
  CongregationEventFormValues,
} from '@/src/types/event';

export interface EventRepository {
  listByCongregation(congregationId: string, forceServer?: boolean): Promise<CongregationEvent[]>;
  getById(eventId: string): Promise<CongregationEvent | null>;
  create(payload: {
    requestId?: string;
    congregationId: string;
    eventData: CongregationEventFormValues;
  }): Promise<string>;
  update(payload: {
    expectedRevision?: number;
    congregationId: string;
    eventId: string;
    eventData: CongregationEventFormValues;
  }): Promise<void>;
  delete(payload: {
    congregationId: string;
    eventId: string;
  }): Promise<void>;
}
