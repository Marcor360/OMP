import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { getActiveLocale } from '@/src/i18n/active-locale';
import { applyPublishedPlanningToMeeting } from '@/src/services/meetings/meeting-autofill-service';
import {
  convertProgramSectionsToLegacyMidweekSections,
  normalizeMeetingProgramPayload,
} from '@/src/services/meetings/meeting-program-utils';
import {
  createCurrentMeetingTimestamp,
  timestampToDate,
} from '@/src/services/meetings/meeting.mapper';
import { firestoreMeetingRepository } from '@/src/services/repositories/firestore/firestore-meeting-repository';
import type {
  MeetingRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/meeting-repository.port';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingCategory,
  MeetingStatus,
  MeetingType,
  UpdateMeetingDTO,
} from '@/src/types/meeting';
import {
  buildMeetingSearchableText,
  collectAssignedUserIds,
  MeetingPublicationStatus,
} from '@/src/types/meeting/program';
import { AppError } from '@/src/utils/errors/errors';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('meetings-service');

let meetingRepository: MeetingRepository = firestoreMeetingRepository;

export const __setMeetingRepositoryForTests = (repo: MeetingRepository): void => {
  meetingRepository = repo;
};

export const __resetMeetingRepositoryForTests = (): void => {
  meetingRepository = firestoreMeetingRepository;
};

const isInvalidDateRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate;

const filterByPublicationStatus = (
  meetings: Meeting[],
  publicationStatus?: MeetingPublicationStatus | 'all'
): Meeting[] => {
  if (!publicationStatus || publicationStatus === 'all') {
    return meetings;
  }

  return meetings.filter((meeting) => meeting.publicationStatus === publicationStatus);
};

type MeetingProgramKind = 'midweek' | 'weekend';

const resolveProgramKindFromMeeting = (
  meeting: Pick<Meeting, 'type' | 'meetingCategory'>
): MeetingProgramKind =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const rangesOverlap = (
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date
): boolean => leftStart <= rightEnd && rightStart <= leftEnd;

const formatShortDate = (value: Date): string =>
  value.toLocaleDateString(getActiveLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const findMeetingConflictByRange = async (params: {
  congregationId: string;
  meetingType: MeetingProgramKind;
  rangeStart: Date;
  rangeEnd: Date;
  excludeMeetingId?: string;
}): Promise<Meeting | null> => {
  if (isInvalidDateRange(params.rangeStart, params.rangeEnd)) {
    return null;
  }

  const meetings = await meetingRepository.getByDateRangeMerged(
    params.congregationId,
    params.rangeStart,
    params.rangeEnd
  );

  const conflict = meetings.find((meeting) => {
    if (params.excludeMeetingId && meeting.id === params.excludeMeetingId) {
      return false;
    }

    if (resolveProgramKindFromMeeting(meeting) !== params.meetingType) {
      return false;
    }

    const meetingStart =
      timestampToDate(meeting.startDate) ?? timestampToDate(meeting.meetingDate);
    const meetingEnd =
      timestampToDate(meeting.endDate) ?? meetingStart;

    if (!meetingStart || !meetingEnd) {
      return false;
    }

    return rangesOverlap(
      params.rangeStart,
      params.rangeEnd,
      meetingStart,
      meetingEnd
    );
  });

  return conflict ?? null;
};

/** Obtiene una reunion por ID */
export const getMeetingById = async (
  congregationId: string,
  id: string
): Promise<Meeting | null> => {
  if (!congregationId || typeof congregationId !== 'string' || !id) {
    return null;
  }

  return meetingRepository.getById(congregationId, id);
};

/** Obtiene todas las reuniones ordenadas por fecha */
export const getAllMeetings = async (congregationId: string): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  return meetingRepository.getAllByCongregation(congregationId);
};

/** Obtiene reuniones del rango visible (semana/rango) con cache-first */
export const getMeetingsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    forceServer?: boolean;
    includeMidweek?: boolean;
    maxItems?: number;
    publicationStatus?: MeetingPublicationStatus | 'all';
  }
): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  if (isInvalidDateRange(startDate, endDate)) {
    return [];
  }

  const meetings = await meetingRepository.getByRange(congregationId, startDate, endDate, {
    forceServer: options?.forceServer,
    maxItems: options?.maxItems,
  });

  const byStatus = filterByPublicationStatus(meetings, options?.publicationStatus);

  if (options?.includeMidweek) {
    return byStatus;
  }

  return byStatus.filter(
    (meeting) => meeting.meetingCategory !== 'midweek' && meeting.type !== 'midweek'
  );
};

/** Obtiene reuniones por estado */
export const getMeetingsByStatus = async (
  congregationId: string,
  status: MeetingStatus
): Promise<Meeting[]> => meetingRepository.getByStatus(congregationId, status);

/** Obtiene reuniones donde el usuario es organizador o asistente */
export const getMeetingsByUser = async (
  congregationId: string,
  uid: string
): Promise<Meeting[]> => meetingRepository.getByUser(congregationId, uid);

/** Crea una reunion */
export const createMeeting = async (
  congregationId: string,
  data: CreateMeetingDTO,
  organizerUid: string,
  organizerName: string
): Promise<string> => {
  const meetingCategory: MeetingCategory =
    data.meetingCategory ??
    (data.type === 'midweek' ? 'midweek' : data.type === 'weekend' ? 'weekend' : 'general');
  const normalizedType: MeetingType =
    meetingCategory === 'midweek' ? 'midweek' : data.type;
  const inferredType = normalizedType === 'midweek' ? 'midweek' : 'weekend';
  const meetingRangeStart = timestampToDate(data.startDate);
  const meetingRangeEnd = timestampToDate(data.endDate) ?? meetingRangeStart;

  if (!meetingRangeStart || !meetingRangeEnd) {
    throw new AppError('La reunion debe tener un rango de fechas valido.');
  }

  if (isInvalidDateRange(meetingRangeStart, meetingRangeEnd)) {
    throw new AppError('La reunion debe tener un rango de fechas valido.');
  }

  if (meetingRangeEnd < startOfToday()) {
    throw new AppError('No se pueden crear reuniones con fechas que ya pasaron.');
  }

  let shouldUseManagerFunction = true;
  let duplicatedMeeting: Meeting | null = null;

  try {
    duplicatedMeeting = await findMeetingConflictByRange({
      congregationId,
      meetingType: inferredType,
      rangeStart: meetingRangeStart,
      rangeEnd: meetingRangeEnd,
    });
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    // Si no se puede leer reuniones desde el cliente, delegamos validacion y escritura al backend.
    shouldUseManagerFunction = true;
  }

  if (duplicatedMeeting) {
    throw new AppError(
      `Ya existe una reunion de ${
        inferredType === 'midweek' ? 'entre semana' : 'fin de semana'
      } para ese rango (${formatShortDate(meetingRangeStart)} al ${formatShortDate(
        meetingRangeEnd
      )}).`
    );
  }

  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: inferredType,
    title: data.title,
    description: data.description,
    startDate: data.startDate,
    meetingDate: data.meetingDate,
    sections: data.sections,
    publicationStatus: data.publicationStatus,
    legacyMidweekSections: data.midweekSections,
  });
  const planningMeetingDate = timestampToDate(normalizedProgram.meetingDate);
  const planning = planningMeetingDate
    ? await applyPublishedPlanningToMeeting({
        congregationId,
        meetingType: inferredType,
        meetingDate: planningMeetingDate,
        sections: normalizedProgram.sections,
      }).catch((error) => {
        log.warn('Meeting planning autofill skipped:', error);
        return null;
      })
    : null;
  const plannedSections = planning?.sections ?? normalizedProgram.sections;
  const plannedAssignedUserIds = collectAssignedUserIds(plannedSections);
  const plannedCleaningGroupIds = data.cleaningGroupIds ?? [];
  const plannedCleaningGroupNames = data.cleaningGroupNames ?? [];

  const legacyMidweekSections =
    inferredType === 'midweek'
      ? convertProgramSectionsToLegacyMidweekSections(plannedSections)
      : undefined;

  const rawPayload: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    type: normalizedType,
    meetingCategory,
    weekLabel: data.weekLabel,
    bibleReading: data.bibleReading,
    startDate: data.startDate,
    endDate: data.endDate,
    meetingDate: normalizedProgram.meetingDate,
    publishedAt: data.publishedAt,
    location: data.location,
    meetingUrl: data.meetingUrl,
    zoomMeetingId: data.zoomMeetingId,
    zoomPasscode: data.zoomPasscode,
    attendees: data.attendees,
    attendeeNames: data.attendeeNames,
    notes: data.notes,
    openingSong: data.openingSong,
    openingPrayer: data.openingPrayer,
    closingSong: data.closingSong,
    closingPrayer: data.closingPrayer,
    chairman: data.chairman,
    publicationStatus: normalizedProgram.publicationStatus,
    sections: plannedSections,
    assignedUserIds: plannedAssignedUserIds,
    cleaningAssignmentMode: data.cleaningAssignmentMode ?? 'none',
    cleaningGroupIds: plannedCleaningGroupIds,
    cleaningGroupNames: plannedCleaningGroupNames,
    searchableText: buildMeetingSearchableText({
      title: data.title,
      description: data.description,
      sections: plannedSections,
    }),
    midweekSections: legacyMidweekSections ?? data.midweekSections ?? null,
    organizerUid,
    organizerName,
    status: data.status ?? ('scheduled' as MeetingStatus),
    createdBy: data.createdBy ?? organizerUid,
    updatedBy: data.updatedBy ?? organizerUid,
  };

  return meetingRepository.create(congregationId, rawPayload, {
    requiresManager: shouldUseManagerFunction,
  });
};

/** Actualiza una reunion */
export const updateMeeting = async (
  congregationId: string,
  id: string,
  data: UpdateMeetingDTO
): Promise<void> => {
  const inferredType =
    data.type === 'midweek' || data.meetingCategory === 'midweek' ? 'midweek' : 'weekend';
  const fallbackStartDate =
    data.startDate ?? data.meetingDate ?? createCurrentMeetingTimestamp();

  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: inferredType,
    title: data.title ?? 'Reunion',
    description: data.description,
    startDate: fallbackStartDate,
    meetingDate: data.meetingDate,
    sections: data.sections,
    publicationStatus: data.publicationStatus,
    legacyMidweekSections: data.midweekSections,
  });
  const planningMeetingDate = timestampToDate(normalizedProgram.meetingDate);
  const planning = planningMeetingDate
    ? await applyPublishedPlanningToMeeting({
        congregationId,
        meetingId: id,
        meetingType: inferredType,
        meetingDate: planningMeetingDate,
        sections: normalizedProgram.sections,
      }).catch((error) => {
        log.warn('Meeting planning autofill skipped:', error);
        return null;
      })
    : null;
  const plannedSections = planning?.sections ?? normalizedProgram.sections;
  const plannedAssignedUserIds = collectAssignedUserIds(plannedSections);
  const plannedCleaningGroupIds = data.cleaningGroupIds;
  const plannedCleaningGroupNames = data.cleaningGroupNames;

  const rawPayload: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    type: data.type,
    meetingCategory: data.meetingCategory,
    status: data.status,
    weekLabel: data.weekLabel,
    bibleReading: data.bibleReading,
    startDate: data.startDate,
    endDate: data.endDate,
    meetingDate: normalizedProgram.meetingDate,
    publishedAt: data.publishedAt,
    location: data.location,
    meetingUrl: data.meetingUrl,
    zoomMeetingId: data.zoomMeetingId,
    zoomPasscode: data.zoomPasscode,
    attendees: data.attendees,
    attendeeNames: data.attendeeNames,
    notes: data.notes,
    openingSong: data.openingSong,
    openingPrayer: data.openingPrayer,
    closingSong: data.closingSong,
    closingPrayer: data.closingPrayer,
    chairman: data.chairman,
    publicationStatus: normalizedProgram.publicationStatus,
    sections: plannedSections,
    assignedUserIds: plannedAssignedUserIds,
    cleaningAssignmentMode: data.cleaningAssignmentMode,
    cleaningGroupIds: plannedCleaningGroupIds,
    cleaningGroupNames: plannedCleaningGroupNames,
    searchableText: buildMeetingSearchableText({
      title: data.title ?? 'Reunion',
      description: data.description,
      sections: plannedSections,
    }),
  };

  if (inferredType === 'midweek') {
    rawPayload.midweekSections = convertProgramSectionsToLegacyMidweekSections(
      plannedSections
    );
  }

  if (typeof data.updatedBy === 'string' && data.updatedBy.trim().length > 0) {
    rawPayload.updatedBy = data.updatedBy;
  }

  const updateRangeStart =
    timestampToDate(data.startDate) ??
    timestampToDate(normalizedProgram.meetingDate);
  const updateRangeEnd = timestampToDate(data.endDate) ?? updateRangeStart;

  let shouldUseManagerFunction = true;

  if (updateRangeStart && updateRangeEnd) {
    try {
      const conflict = await findMeetingConflictByRange({
        congregationId,
        meetingType: inferredType,
        rangeStart: updateRangeStart,
        rangeEnd: updateRangeEnd,
        excludeMeetingId: id,
      });

      if (conflict) {
        throw new AppError(
          `Ya existe otra reunion de ${
            inferredType === 'midweek' ? 'entre semana' : 'fin de semana'
          } para ese rango (${formatShortDate(updateRangeStart)} al ${formatShortDate(
            updateRangeEnd
          )}).`
        );
      }
    } catch (error) {
      if (error instanceof AppError || !isFirebaseErrorCode(error, 'permission-denied')) {
        throw error;
      }

      // Sin permiso de lectura en cliente, delegamos la validacion de conflicto al backend.
      shouldUseManagerFunction = true;
    }
  }

  await meetingRepository.update(congregationId, id, rawPayload, {
    requiresManager: shouldUseManagerFunction,
  });
};

/** Elimina una reunion */
export const deleteMeeting = async (
  congregationId: string,
  id: string
): Promise<void> => {
  await meetingRepository.delete(congregationId, id);
};

/** Cuenta reuniones por estado */
export const getMeetingsCount = async (
  congregationId: string,
  status?: MeetingStatus
): Promise<number> => meetingRepository.count(congregationId, status);

/** Suscripcion en tiempo real a todas las reuniones */
export const subscribeToMeetings = (
  congregationId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar reuniones.'));
    return () => undefined;
  }

  return meetingRepository.subscribeToMeetings(congregationId, callback, onError);
};
