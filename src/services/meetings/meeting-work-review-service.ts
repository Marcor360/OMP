import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';

export type MeetingReviewKind = 'history' | 'duplicates';

export type MeetingWorkReview = {
  history: {
    id: string;
    createdAt: number;
    ownChange: boolean;
    detailsChanged: boolean;
    publicationChanged: boolean;
    sectionsTruncated: boolean;
    changedSections: { key: string; title: string; change: 'added' | 'updated' | 'removed' }[];
  }[];
  duplicates: {
    id: string;
    title: string;
    target: string;
    day: string;
    status: string;
  }[][];
  assignmentsTruncated: boolean;
  assignmentsReviewed?: number;
};

export const getMeetingWorkReview = async (
  congregationId: string,
  meetingId: string,
  review: MeetingReviewKind,
): Promise<MeetingWorkReview> => {
  const callable = httpsCallable<{ congregationId: string; meetingId: string; review: MeetingReviewKind }, MeetingWorkReview>(
    functions, 'getMeetingWorkReview'
  );
  return (await callable({ congregationId, meetingId, review })).data;
};
