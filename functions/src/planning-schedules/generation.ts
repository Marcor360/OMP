import { FieldValue } from 'firebase-admin/firestore';

import { dayRange, formatDateKey } from './date-utils.js';

export type HospitalityMeetingType = 'midweek' | 'weekend';
export type PlanningMeetingCandidate = { dateKey: string; meetingType: HospitalityMeetingType };
type FirestoreRecord = Record<string, unknown>;

export const PLANNING_MEETING_TITLES: Record<HospitalityMeetingType, string> = {
  midweek: 'Reunion Vida y Ministerio Cristianos',
  weekend: 'Reunion del fin de semana',
};

export const planningMeetingDocId = (dateKey: string, meetingType: HospitalityMeetingType): string =>
  `planning-${dateKey}-${meetingType}`;

export const buildPlanningMeetingSkeleton = (params: {
  dateKey: string;
  meetingType: HospitalityMeetingType;
  requesterUid: string;
}): FirestoreRecord => {
  const range = dayRange(params.dateKey);
  return {
    type: params.meetingType,
    meetingCategory: params.meetingType,
    title: PLANNING_MEETING_TITLES[params.meetingType],
    publicationStatus: 'awaiting_assignments',
    startDate: range.start,
    endDate: range.end,
    meetingDate: range.start,
    assignedUserIds: [],
    sections: [],
    createdBy: params.requesterUid,
    updatedBy: params.requesterUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
};

export const buildPlanningMeetingCandidates = (params: {
  startDate: Date;
  endDate: Date;
  midweekDay: number;
  weekendDay: number;
  today?: Date;
}): PlanningMeetingCandidate[] => {
  const candidates: PlanningMeetingCandidate[] = [];
  const cursor = new Date(params.startDate);
  const todayKey = formatDateKey(params.today ?? new Date());
  while (cursor <= params.endDate) {
    const dateKey = formatDateKey(cursor);
    if (dateKey < todayKey) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    if (cursor.getDay() === params.midweekDay) candidates.push({ dateKey, meetingType: 'midweek' });
    if (cursor.getDay() === params.weekendDay) candidates.push({ dateKey, meetingType: 'weekend' });
    cursor.setDate(cursor.getDate() + 1);
  }
  return candidates;
};

export const reconcilePlanningMeetingCandidates = (
  candidates: PlanningMeetingCandidate[],
  existingKeys: Set<string>
): { toCreate: PlanningMeetingCandidate[]; createdMidweek: number; createdWeekend: number; existing: number } => {
  let createdMidweek = 0;
  let createdWeekend = 0;
  let existing = 0;
  const toCreate: PlanningMeetingCandidate[] = [];
  for (const candidate of candidates) {
    if (existingKeys.has(`${candidate.dateKey}::${candidate.meetingType}`)) {
      existing += 1;
      continue;
    }
    toCreate.push(candidate);
    if (candidate.meetingType === 'midweek') createdMidweek += 1;
    else createdWeekend += 1;
  }
  return { toCreate, createdMidweek, createdWeekend, existing };
};
