import { eventDay, isEventDay } from '@/functions/src/shared/event-planning';
import { firestoreEventRepository } from '@/src/services/repositories/firestore/firestore-event-repository';
import type { EventRepository } from '@/src/services/repositories/ports/event-repository.port';
import {
  CongregationEvent,
  CongregationEventFormValues,
  CongregationEventType,
  OPTIONAL_END_DATE_EVENT_TYPES,
  SINGLE_DAY_EVENT_TYPES,
} from '@/src/types/event';

let eventRepository: EventRepository = firestoreEventRepository;

export const __setEventRepositoryForTests = (repo: EventRepository): void => {
  eventRepository = repo;
};

export const __resetEventRepositoryForTests = (): void => {
  eventRepository = firestoreEventRepository;
};

export const normalizeEventEndDate = (
  type: CongregationEventType,
  startDate: string,
  endDate: string
): string => {
  if (SINGLE_DAY_EVENT_TYPES.includes(type)) {
    return startDate;
  }

  if (OPTIONAL_END_DATE_EVENT_TYPES.includes(type) && endDate.trim().length === 0) {
    return startDate;
  }

  return endDate;
};

export const eventToFormValues = (
  event?: CongregationEvent | null
): CongregationEventFormValues => ({
  type: event?.type ?? 'conmemoracion',
  title: event?.title ?? '',
  superintendentName: event?.superintendentName ?? '',
  superintendentWifeName: event?.superintendentWifeName ?? '',
  startDate: event ? eventDay(event.startDate.toDate()) : '',
  endDate: event ? eventDay(event.endDate.toDate()) : '',
  location: event?.location ?? '',
  categories: event?.categories ?? [],
  schedules: event?.schedules?.map(({ people: _people, ...schedule }) => schedule) ?? [],
  audience: event?.audience?.groupId ? { kind: event.audience.kind, groupId: event.audience.groupId } : { kind: 'congregation' },
});

export const validateEventForm = (
  values: CongregationEventFormValues
): string[] => {
  const errors: string[] = [];
  const startDateInput = values.startDate.trim();
  const endDateInput = normalizeEventEndDate(
    values.type,
    startDateInput,
    values.endDate.trim()
  );

  if (!isEventDay(startDateInput)) {
    errors.push('La fecha inicial es requerida en formato YYYY-MM-DD.');
  }

  if (!isEventDay(endDateInput)) {
    errors.push('La fecha final es requerida en formato YYYY-MM-DD.');
  }

  if (values.type === 'visita_superintendente') {
    if (!values.superintendentName.trim()) {
      errors.push('El nombre del superintendente es requerido.');
    }
  } else if (!values.title.trim()) {
    errors.push('El titulo del evento es requerido.');
  }

  if (errors.length === 0 && endDateInput < startDateInput) {
    errors.push('La fecha final no puede ser menor que la fecha inicial.');
  }

  return errors;
};

export const getActiveEvents = async (
  congregationId: string,
  forceServer = false
): Promise<CongregationEvent[]> => {
  const nowMs = Date.now();
  const events = await eventRepository.listByCongregation(congregationId, forceServer);

  return events
    .filter((event) => event.deleteAt.toMillis() > nowMs)
    .sort(
      (a, b) =>
        a.startDate.toMillis() - b.startDate.toMillis() ||
        a.deleteAt.toMillis() - b.deleteAt.toMillis()
    );
};

export const getEventById = async (
  eventId: string
): Promise<CongregationEvent | null> => {
  return eventRepository.getById(eventId);
};

export const createEvent = async (params: {
  requestId?: string;
  values: CongregationEventFormValues;
  congregationId: string;
  uid: string;
}): Promise<string> => {
  const errors = validateEventForm(params.values);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return eventRepository.create({
    ...(params.requestId ? { requestId: params.requestId } : {}),
    congregationId: params.congregationId,
    eventData: params.values,
  });
};

export const updateEvent = async (params: {
  expectedRevision?: number;
  eventId: string;
  values: CongregationEventFormValues;
  congregationId: string;
  uid: string;
}): Promise<void> => {
  const errors = validateEventForm(params.values);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  await eventRepository.update({
    ...(params.expectedRevision !== undefined ? { expectedRevision: params.expectedRevision } : {}),
    congregationId: params.congregationId,
    eventId: params.eventId,
    eventData: params.values,
  });
};

export const deleteEvent = async (params: {
  eventId: string;
  congregationId: string;
}): Promise<void> => {
  await eventRepository.delete(params);
};
