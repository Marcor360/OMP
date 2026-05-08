import { AppUser } from '@/src/types/user';
import { formatDateKey, getWeekRangeForDate, parseDateKey } from '@/src/utils/dates/week-range';
import { OutgoingTalk } from '@/src/modules/assignments/types/outgoing-talks.types';

export const OUTGOING_TALK_BLOCK_MESSAGE =
  'No disponible: salida a discursar esta semana';

export const canBeOutgoingSpeaker = (
  user: Pick<AppUser, 'isActive' | 'congregationId' | 'isElder' | 'isMinisterialServant'> | null | undefined,
  currentCongregationId: string
): boolean =>
  Boolean(
    user &&
      user.isActive === true &&
      user.congregationId === currentCongregationId &&
      (user.isElder === true || user.isMinisterialServant === true)
  );

export const isWeekendDateKey = (dateKey: string): boolean => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return false;
  const day = parsed.getDay();
  return day === 0 || day === 6;
};

export const resolveOutgoingTalkWeekRange = (
  talkDate: string
): { weekStartDate: string; weekEndDate: string } => {
  const range = getWeekRangeForDate(talkDate);
  return {
    weekStartDate: range.weekStartDate,
    weekEndDate: range.weekEndDate,
  };
};

export const isUserBlockedByOutgoingTalk = (
  userId: string | null | undefined,
  assignmentDate: Date | string,
  outgoingTalks: Pick<OutgoingTalk, 'speakerUserId' | 'status' | 'weekStartDate' | 'weekEndDate'>[]
): boolean => {
  if (!userId) return false;
  const assignmentDateKey =
    typeof assignmentDate === 'string'
      ? assignmentDate
      : formatDateKey(assignmentDate);

  return outgoingTalks.some((talk) => (
    talk.status === 'scheduled' &&
    talk.speakerUserId === userId &&
    assignmentDateKey >= talk.weekStartDate &&
    assignmentDateKey <= talk.weekEndDate
  ));
};

export const getBlockedOutgoingTalkUserIds = (
  assignmentDate: Date | string,
  outgoingTalks: Pick<OutgoingTalk, 'speakerUserId' | 'status' | 'weekStartDate' | 'weekEndDate'>[]
): Set<string> => {
  const blocked = new Set<string>();
  outgoingTalks.forEach((talk) => {
    if (isUserBlockedByOutgoingTalk(talk.speakerUserId, assignmentDate, [talk])) {
      blocked.add(talk.speakerUserId);
    }
  });
  return blocked;
};
