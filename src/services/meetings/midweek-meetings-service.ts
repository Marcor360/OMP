import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { applyPublishedPlanningToMeeting } from '@/src/services/meetings/meeting-autofill-service';
import {
  convertProgramSectionsToLegacyMidweekSections,
  normalizeMeetingProgramPayload,
} from '@/src/services/meetings/meeting-program-utils';
import type { MidweekMeeting } from '@/src/services/meetings/midweek-meeting.mapper';
import { firestoreMidweekMeetingRepository } from '@/src/services/repositories/firestore/firestore-midweek-meeting-repository';
import type {
  MidweekMeetingRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/midweek-meeting-repository.port';
import type {
  MidweekMeetingSection,
} from '@/src/types/midweek-meeting';
import type { MeetingStatus } from '@/src/types/meeting';
import {
  MeetingProgramSection,
  MeetingPublicationStatus,
  buildMeetingSearchableText,
  collectAssignedUserIds,
} from '@/src/types/meeting/program';
import { createLogger } from '@/src/utils/logger';

export type { MidweekMeeting };

const log = createLogger('midweek-meetings-service');

export interface MidweekMeetingPayload {
  title: string;
  description?: string;
  weekLabel: string;
  bibleReading: string;
  startDate: MidweekMeeting['startDate'];
  endDate: MidweekMeeting['endDate'];
  meetingDate?: MidweekMeeting['meetingDate'];
  status?: MeetingStatus;
  publicationStatus?: MeetingPublicationStatus;
  publishedAt?: MidweekMeeting['publishedAt'];
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  middleSong?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections: MidweekMeetingSection[];
  sections?: MeetingProgramSection[];
  assignedUserIds?: string[];
  searchableText?: string;
  attendeeNames?: string[];
}

export interface MidweekMeetingActor {
  uid: string;
  displayName: string;
}

let midweekMeetingRepository: MidweekMeetingRepository = firestoreMidweekMeetingRepository;

export const __setMidweekMeetingRepositoryForTests = (
  repo: MidweekMeetingRepository
): void => {
  midweekMeetingRepository = repo;
};

export const __resetMidweekMeetingRepositoryForTests = (): void => {
  midweekMeetingRepository = firestoreMidweekMeetingRepository;
};

const isInvalidRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate;

export const getMidweekMeetingById = async (
  congregationId: string,
  meetingId: string
): Promise<MidweekMeeting | null> => {
  if (!congregationId || typeof congregationId !== 'string' || !meetingId) {
    return null;
  }

  return midweekMeetingRepository.getById(congregationId, meetingId);
};

export const getMidweekMeetings = async (congregationId: string): Promise<MidweekMeeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  return midweekMeetingRepository.getAllByCongregation(congregationId);
};

export const getMidweekMeetingsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: { forceServer?: boolean; maxItems?: number }
): Promise<MidweekMeeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  if (isInvalidRange(startDate, endDate)) {
    return [];
  }

  return midweekMeetingRepository.getByRange(congregationId, startDate, endDate, options);
};

export const createMidweekMeeting = async (
  congregationId: string,
  payload: MidweekMeetingPayload,
  actor: MidweekMeetingActor
): Promise<string> => {
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: payload.title,
    description: payload.description,
    startDate: payload.startDate,
    meetingDate: payload.meetingDate,
    sections: payload.sections,
    publicationStatus: payload.publicationStatus,
    legacyMidweekSections: payload.midweekSections,
  });
  let shouldUseManagerFunction = false;
  const planning = await applyPublishedPlanningToMeeting({
    congregationId,
    meetingType: 'midweek',
    meetingDate: normalizedProgram.meetingDate.toDate(),
    sections: normalizedProgram.sections,
  }).catch((error) => {
    if (isFirebaseErrorCode(error, 'permission-denied')) {
      shouldUseManagerFunction = true;
    }

    log.warn('Midweek meeting planning autofill skipped:', error);
    return null;
  });
  const plannedSections = planning?.sections ?? normalizedProgram.sections;
  const normalizedSections = convertProgramSectionsToLegacyMidweekSections(
    plannedSections
  );
  const plannedAssignedUserIds = collectAssignedUserIds(plannedSections);

  const rawPayload: Record<string, unknown> = {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    meetingDate: normalizedProgram.meetingDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt: payload.publishedAt ?? null,
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    zoomMeetingId: payload.zoomMeetingId?.trim() || null,
    zoomPasscode: payload.zoomPasscode?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    middleSong: payload.middleSong?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    sections: plannedSections,
    midweekSections: normalizedSections,
    assignedUserIds: plannedAssignedUserIds,
    searchableText: buildMeetingSearchableText({
      title: payload.title,
      description: payload.description,
      sections: plannedSections,
    }),
    cleaningAssignmentMode:
      planning && planning.cleaningGroupIds.length > 0 ? 'selected' : undefined,
    cleaningGroupIds:
      planning && planning.cleaningGroupIds.length > 0 ? planning.cleaningGroupIds : undefined,
    cleaningGroupNames:
      planning && planning.cleaningGroupNames.length > 0 ? planning.cleaningGroupNames : undefined,
    organizerUid: actor.uid,
    organizerName: actor.displayName,
    attendees: actor.uid ? [actor.uid] : [],
    attendeeNames: payload.attendeeNames?.filter((name) => name.trim().length > 0) ?? [],
    createdBy: actor.uid,
    updatedBy: actor.uid,
  };

  return midweekMeetingRepository.create(congregationId, rawPayload, {
    requiresManager: shouldUseManagerFunction,
  });
};

export const updateMidweekMeeting = async (
  congregationId: string,
  meetingId: string,
  payload: MidweekMeetingPayload,
  actorUid?: string
): Promise<void> => {
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: payload.title,
    description: payload.description,
    startDate: payload.startDate,
    meetingDate: payload.meetingDate,
    sections: payload.sections,
    publicationStatus: payload.publicationStatus,
    legacyMidweekSections: payload.midweekSections,
  });
  let shouldUseManagerFunction = false;
  const planning = await applyPublishedPlanningToMeeting({
    congregationId,
    meetingId,
    meetingType: 'midweek',
    meetingDate: normalizedProgram.meetingDate.toDate(),
    sections: normalizedProgram.sections,
  }).catch((error) => {
    if (isFirebaseErrorCode(error, 'permission-denied')) {
      shouldUseManagerFunction = true;
    }

    log.warn('Midweek meeting planning autofill skipped:', error);
    return null;
  });
  const plannedSections = planning?.sections ?? normalizedProgram.sections;
  const normalizedSections = convertProgramSectionsToLegacyMidweekSections(
    plannedSections
  );
  const plannedAssignedUserIds = collectAssignedUserIds(plannedSections);

  const rawUpdatePayload: Record<string, unknown> = {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    meetingDate: normalizedProgram.meetingDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt: payload.publishedAt ?? null,
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    zoomMeetingId: payload.zoomMeetingId?.trim() || null,
    zoomPasscode: payload.zoomPasscode?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    middleSong: payload.middleSong?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    sections: plannedSections,
    midweekSections: normalizedSections,
    assignedUserIds: plannedAssignedUserIds,
    searchableText: buildMeetingSearchableText({
      title: payload.title,
      description: payload.description,
      sections: plannedSections,
    }),
    cleaningAssignmentMode:
      planning && planning.cleaningGroupIds.length > 0 ? 'selected' : undefined,
    cleaningGroupIds:
      planning && planning.cleaningGroupIds.length > 0 ? planning.cleaningGroupIds : undefined,
    cleaningGroupNames:
      planning && planning.cleaningGroupNames.length > 0 ? planning.cleaningGroupNames : undefined,
  };

  if (actorUid && actorUid.trim().length > 0) {
    rawUpdatePayload.updatedBy = actorUid;
  }

  await midweekMeetingRepository.update(congregationId, meetingId, rawUpdatePayload, {
    requiresManager: shouldUseManagerFunction,
  });
};

export const subscribeToMidweekMeetings = (
  congregationId: string,
  callback: (meetings: MidweekMeeting[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar reuniones de entre semana.'));
    return () => undefined;
  }

  return midweekMeetingRepository.subscribeToMidweekMeetings(
    congregationId,
    callback,
    onError
  );
};
