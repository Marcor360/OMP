export type AssignmentCategory = 'midweek' | 'weekend' | 'cleaning' | 'hospitality';

export type AssignmentSubType = 'microphone' | 'platform' | null;

export type AssignmentMeetingType = 'midweek' | 'weekend' | null;

export type AssignmentStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'overdue';

export interface AssignmentPerson {
  userId?: string;
  name: string;
}

export interface Assignment {
  id: string;
  sourceKey: string;
  source: 'meeting' | 'congregation';
  congregationId: string;
  meetingId?: string;
  category: AssignmentCategory;
  subType: AssignmentSubType;
  meetingType: AssignmentMeetingType;
  date: string;
  assignedUsers: AssignmentPerson[];
  notes?: string;
  status?: AssignmentStatus;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
}

export type AssignmentCategoryFilter = AssignmentCategory | 'all';

export type AssignmentSubTypeFilter = Exclude<AssignmentSubType, null> | 'all';

export type AssignmentStatusFilter = AssignmentStatus | 'all';

export interface AssignmentFilters {
  exactDate: string;
  rangeStart: string;
  rangeEnd: string;
  category: AssignmentCategoryFilter;
  subType: AssignmentSubTypeFilter;
  assignedPerson: string;
  congregationId: string;
  status: AssignmentStatusFilter;
}

export type AssignmentSummary = Record<AssignmentCategory, number>;

export const ASSIGNMENT_CATEGORY_LABELS: Record<AssignmentCategory, string> = {
  midweek: 'Entre semana',
  weekend: 'Fin de semana',
  cleaning: 'Limpieza',
  hospitality: 'Hospitalidad',
};

export const ASSIGNMENT_SUBTYPE_LABELS: Record<Exclude<AssignmentSubType, null>, string> = {
  microphone: 'Microfono',
  platform: 'Plataforma',
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: 'Pendiente',
  assigned: 'Asignada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  overdue: 'Vencida',
};
