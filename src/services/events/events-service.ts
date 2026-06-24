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

const MEXICO_CITY_OFFSET = '-06:00';

const isValidDateInput = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const toMexicoCityDate = (value: string): Date => {
  const trimmed = value.trim();
  if (!isValidDateInput(trimmed)) {
    throw new Error('Usa el formato YYYY-MM-DD.');
  }

  return new Date(`${trimmed}T00:00:00${MEXICO_CITY_OFFSET}`);
};

const toDateInput = (value: { toDate(): Date }): string => {
  const date = value.toDate();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
};

const normalizeEndDateInput = (
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
  startDate: event ? toDateInput(event.startDate) : '',
  endDate: event ? toDateInput(event.endDate) : '',
  location: event?.location ?? '',
});

export const validateEventForm = (
  values: CongregationEventFormValues
): string[] => {
  const errors: string[] = [];
  const startDateInput = values.startDate.trim();
  const endDateInput = normalizeEndDateInput(
    values.type,
    startDateInput,
    values.endDate.trim()
  );

  if (!isValidDateInput(startDateInput)) {
    errors.push('La fecha inicial es requerida en formato YYYY-MM-DD.');
  }

  if (!isValidDateInput(endDateInput)) {
    errors.push('La fecha final es requerida en formato YYYY-MM-DD.');
  }

  if (values.type === 'visita_superintendente') {
    if (!values.superintendentName.trim()) {
      errors.push('El nombre del superintendente es requerido.');
    }
  } else if (!values.title.trim()) {
    errors.push('El titulo del evento es requerido.');
  }

  if (errors.length === 0) {
    const start = toMexicoCityDate(startDateInput);
    const end = toMexicoCityDate(endDateInput);

    if (end.getTime() < start.getTime()) {
      errors.push('La fecha final no puede ser menor que la fecha inicial.');
    }
  }

  return errors;
};

export const getActiveEvents = async (
  congregationId: string
): Promise<CongregationEvent[]> => {
  const nowMs = Date.now();
  const events = await eventRepository.listByCongregation(congregationId);

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
  values: CongregationEventFormValues;
  congregationId: string;
  uid: string;
}): Promise<string> => {
  const errors = validateEventForm(params.values);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return eventRepository.create({
    congregationId: params.congregationId,
    eventData: params.values,
  });
};

export const updateEvent = async (params: {
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
