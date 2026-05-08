import { Timestamp } from 'firebase/firestore';

import type { AppUser } from '@/src/types/user';

export type PioneerType = 'regular' | 'auxiliary';

export interface PreachingReportSubmission {
  id: string;
  userId: string;
  userName: string;
  congregationId: string;
  congregationName?: string;
  monthId: string;
  monthName: string;
  participated: boolean;
  bibleStudies: number;
  returnVisits: number;
  comments?: string | null;
  isPioneer: boolean;
  pioneerType?: PioneerType | null;
  hours?: number | null;
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  submittedBy: string;
}

export interface PreachingReportFormValues {
  participated: boolean;
  bibleStudies: number;
  returnVisits: number;
  comments?: string | null;
  hours?: number | null;
}

export interface SubmitPreachingReportInput extends PreachingReportFormValues {
  user: AppUser;
  monthId: string;
  congregationName?: string;
}

export interface PreachingReportSummary {
  totalActivePublishers: number;
  totalSubmitted: number;
  totalMissing: number;
  totalPioneerHours: number;
  totalBibleStudies: number;
  totalReturnVisits: number;
}

export interface MissingPreachingReportUser {
  uid: string;
  displayName: string;
  privileges?: AppUser['privileges'];
}
