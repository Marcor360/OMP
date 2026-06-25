import type { Unsubscribe } from 'firebase/firestore';

import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentDTO,
  CreateCleaningAssignmentDTO,
  UpdateAssignmentDTO,
} from '@/src/types/assignment';
import type { AssignmentFilters } from '@/src/services/assignments/assignment.mapper';

export type { Unsubscribe };

export type AssignmentRangeOptions = {
  userUid?: string;
  status?: AssignmentStatus;
  forceServer?: boolean;
  maxMeetings?: number;
  perMeetingLimit?: number;
};

export interface AssignmentRepository {
  getById(
    congregationId: string,
    assignmentId: string,
    meetingIdHint?: string
  ): Promise<Assignment | null>;
  getAll(congregationId: string): Promise<Assignment[]>;
  getByUser(congregationId: string, uid: string): Promise<Assignment[]>;
  getByStatus(
    congregationId: string,
    status: AssignmentStatus
  ): Promise<Assignment[]>;
  getByRange(
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: AssignmentRangeOptions
  ): Promise<Assignment[]>;
  getByMeeting(congregationId: string, meetingId: string): Promise<Assignment[]>;
  create(
    congregationId: string,
    meetingId: string,
    data: CreateAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string>;
  createCleaningGroup(
    congregationId: string,
    data: CreateCleaningAssignmentDTO,
    assignedByUid: string,
    assignedByName: string
  ): Promise<string>;
  update(
    congregationId: string,
    meetingId: string,
    assignmentId: string,
    data: UpdateAssignmentDTO
  ): Promise<void>;
  delete(congregationId: string, meetingId: string, assignmentId: string): Promise<void>;
  count(congregationId: string, status?: AssignmentStatus): Promise<number>;
  subscribeToAssignments(
    congregationId: string,
    callback: (assignments: Assignment[]) => void,
    filters?: AssignmentFilters,
    onError?: (error: unknown) => void
  ): Unsubscribe;
}
