import { Timestamp } from 'firebase/firestore';

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type AssignmentPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  assignedToUid: string;
  assignedToName: string;
  assignedByUid: string;
  assignedByName: string;
  category?: 'platform' | 'cleaning' | 'hospitality';
  cleaningGroupId?: string;
  cleaningGroupName?: string;
  dueDate: Timestamp;
  completedAt?: Timestamp;
  meetingId?: string;
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAssignmentDTO {
  title: string;
  description?: string;
  priority: AssignmentPriority;
  assignedToUid: string;
  assignedToName: string;
  category?: 'platform' | 'cleaning' | 'hospitality';
  cleaningGroupId?: string;
  cleaningGroupName?: string;
  dueDate: Timestamp;
  meetingId?: string;
  tags?: string[];
}

export interface CreateCleaningAssignmentDTO {
  title: string;
  description?: string;
  priority: AssignmentPriority;
  cleaningGroupId: string;
  cleaningGroupName: string;
  dueDate: Timestamp;
}

export interface UpdateAssignmentDTO {
  title?: string;
  description?: string;
  status?: AssignmentStatus;
  priority?: AssignmentPriority;
  assignedToUid?: string;
  assignedToName?: string;
  dueDate?: Timestamp;
  tags?: string[];
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  overdue: 'Vencida',
};

export const ASSIGNMENT_PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};
