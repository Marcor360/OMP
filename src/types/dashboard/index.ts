import { Timestamp } from 'firebase/firestore';

import { AssignmentPriority, AssignmentStatus } from '@/src/types/assignment';
import { MeetingCategory, MeetingType } from '@/src/types/meeting';
import { MeetingPublicationStatus } from '@/src/types/meeting/publication-flow';

export interface DashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalMeetings: number;
  scheduledMeetings: number;
  totalAssignments: number;
  pendingAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
}

export interface DashboardSummaryMeetingPreview {
  id: string;
  title: string;
  publicationStatus?: MeetingPublicationStatus;
  type?: MeetingType;
  meetingCategory?: MeetingCategory;
  startDate: Timestamp;
  endDate?: Timestamp;
  location?: string;
}

export interface DashboardSummaryAssignmentPreview {
  id: string;
  title: string;
  status?: AssignmentStatus;
  priority?: AssignmentPriority;
  dueDate: Timestamp;
  assignedToName?: string;
  assignedToUid?: string;
  assignedToGroupId?: string;
  meetingId?: string;
}

export interface DashboardSummary {
  congregationId: string;
  metrics: DashboardMetrics;
  upcomingMeetings: DashboardSummaryMeetingPreview[];
  pendingAssignments: DashboardSummaryAssignmentPreview[];
  generatedAt?: Timestamp;
  updatedAt?: Timestamp;
}

