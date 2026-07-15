import { getScheduledOutgoingTalksForWeek } from '@/src/modules/assignments/services/outgoing-talks.service';
import { resolveOutgoingTalkWeekRange } from '@/src/modules/assignments/utils/outgoing-talks';
import { congregationMeetingsCollectionRef } from '@/src/lib/firebase/refs';
import { getDocs, query, Timestamp, where } from 'firebase/firestore';
import { collectAssignedUserIds, type MeetingProgramSection } from '@/src/types/meeting/program';
import { parseDateKey } from '@/src/utils/dates/date-key';

export const isWeekendMeeting = (meeting: {
  type?: string;
  meetingCategory?: string;
  status?: string;
}): boolean =>
  meeting.status !== 'cancelled' &&
  (
    meeting.meetingCategory === 'weekend' ||
    meeting.type === 'weekend' ||
    meeting.type === 'internal' ||
    meeting.type === 'external' ||
    meeting.type === 'review' ||
    meeting.type === 'training'
  );

const getWeekDates = (dateKey: string): { startDate: Date; endDate: Date } => {
  const range = resolveOutgoingTalkWeekRange(dateKey);
  const startDate = parseDateKey(range.weekStartDate);
  const endDate = parseDateKey(range.weekEndDate);

  if (!startDate || !endDate) {
    throw new Error('La fecha de discurso no es valida.');
  }

  endDate.setHours(23, 59, 59, 999);
  return { startDate, endDate };
};

export const getWeekendAssignedUserIdsForWeek = async (params: {
  congregationId: string;
  weekDate: string;
}): Promise<Set<string>> => {
  const { startDate, endDate } = getWeekDates(params.weekDate);
  const meetingsRef = congregationMeetingsCollectionRef(params.congregationId);
  const [meetingDateSnap, startDateSnap] = await Promise.all([
    getDocs(query(
      meetingsRef,
      where('meetingDate', '>=', Timestamp.fromDate(startDate)),
      where('meetingDate', '<=', Timestamp.fromDate(endDate))
    )),
    getDocs(query(
      meetingsRef,
      where('startDate', '>=', Timestamp.fromDate(startDate)),
      where('startDate', '<=', Timestamp.fromDate(endDate))
    )),
  ]);
  const meetings = new Map(
    [...meetingDateSnap.docs, ...startDateSnap.docs].map((docSnap) => [docSnap.id, docSnap.data()])
  );
  const assigned = new Set<string>();

  Array.from(meetings.values())
    .filter(isWeekendMeeting)
    .forEach((meeting) => {
      const ids =
        Array.isArray(meeting.assignedUserIds) && meeting.assignedUserIds.length > 0
          ? meeting.assignedUserIds.filter((value): value is string => typeof value === 'string')
          : collectAssignedUserIds(
              Array.isArray(meeting.sections)
                ? meeting.sections as MeetingProgramSection[]
                : []
            );

      ids.forEach((userId) => assigned.add(userId));
    });

  return assigned;
};

export const getScheduledOutgoingSpeakerIdsForWeek = async (params: {
  congregationId: string;
  weekDate: string;
}): Promise<Set<string>> => {
  const outgoingTalks = await getScheduledOutgoingTalksForWeek(
    params.congregationId,
    params.weekDate
  );
  return new Set(
    outgoingTalks
      .filter((talk) => talk.status === 'scheduled')
      .map((talk) => talk.speakerUserId)
      .filter(Boolean)
  );
};

export const assertUserIsFreeForOutgoingTalk = async (params: {
  congregationId: string;
  speakerUserId: string;
  talkDate: string;
  excludeOutgoingTalkId?: string;
}): Promise<void> => {
  const [assignedUserIds, outgoingTalks] = await Promise.all([
    getWeekendAssignedUserIdsForWeek({
      congregationId: params.congregationId,
      weekDate: params.talkDate,
    }),
    getScheduledOutgoingTalksForWeek(params.congregationId, params.talkDate),
  ]);

  if (assignedUserIds.has(params.speakerUserId)) {
    throw new Error(
      'No se puede asignar. Este hermano ya tiene una asignacion en la reunion de fin de semana de esa semana.'
    );
  }

  const duplicate = outgoingTalks.some((talk) => (
    talk.id !== params.excludeOutgoingTalkId &&
    talk.status === 'scheduled' &&
    talk.speakerUserId === params.speakerUserId
  ));

  if (duplicate) {
    throw new Error('Este hermano ya tiene una salida activa en esa misma semana.');
  }
};
