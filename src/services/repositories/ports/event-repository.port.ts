import type {
  CongregationEvent,
  CongregationEventFormValues,
} from '@/src/types/event';

export interface EventRepository {
  listByCongregation(congregationId: string): Promise<CongregationEvent[]>;
  getById(eventId: string): Promise<CongregationEvent | null>;
  create(payload: {
    congregationId: string;
    eventData: CongregationEventFormValues;
  }): Promise<string>;
  update(payload: {
    congregationId: string;
    eventId: string;
    eventData: CongregationEventFormValues;
  }): Promise<void>;
  delete(payload: {
    congregationId: string;
    eventId: string;
  }): Promise<void>;
}
