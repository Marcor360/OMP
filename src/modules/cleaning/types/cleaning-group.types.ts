import { Timestamp } from 'firebase/firestore';

// ─── Modelo principal del grupo de limpieza ───────────────────────────────────

export interface CleaningGroup {
  id: string;
  name: string;
  description: string;
  congregationId: string;
  groupType: CleaningGroupType;
  memberIds: string[];
  memberCount: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CleaningGroupType = 'standard' | 'family';

export const CLEANING_GROUP_TYPE_LABELS: Record<CleaningGroupType, string> = {
  standard: 'Grupo',
  family: 'Familia',
};

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateCleaningGroupDTO {
  name: string;
  description: string;
  groupType?: CleaningGroupType;
  isActive?: boolean;
}

export interface UpdateCleaningGroupDTO {
  name?: string;
  description?: string;
  groupType?: CleaningGroupType;
  isActive?: boolean;
}

// ─── Estado de un usuario en el contexto de asignación de limpieza ────────────

export type CleaningMemberStatus =
  | 'available'        // Puede ser agregado a un grupo
  | 'assigned_here'    // Ya pertenece a ESTE grupo
  | 'assigned_other'   // Asignado a un grupo diferente
  | 'inactive'         // Usuario inactivo
  | 'not_eligible';    // cleaningEligible === false

export const CLEANING_MEMBER_STATUS_LABELS: Record<CleaningMemberStatus, string> = {
  available: 'Disponible',
  assigned_here: 'Ya en este grupo',
  assigned_other: 'Asignado a otro grupo',
  inactive: 'Inactivo',
  not_eligible: 'No elegible',
};

// ─── Usuario enriquecido con estado de asignabilidad ─────────────────────────

export interface CleaningAssignableUser {
  uid: string;
  displayName: string;
  email: string;
  congregationId: string;
  isActive: boolean;
  cleaningGroupId: string | null;
  cleaningGroupName: string | null;
  cleaningEligible: boolean;
  /** Estado calculado en relación con un grupo específico */
  memberStatus: CleaningMemberStatus;
}

// ─── Estadísticas del módulo para la pantalla de resumen ─────────────────────

export interface CleaningStats {
  totalGroups: number;
  activeGroups: number;
  totalAssigned: number;
  totalAvailable: number;
}

// ─── Error del servicio de limpieza ──────────────────────────────────────────

export type CleaningServiceErrorCode =
  | 'GROUP_NOT_FOUND'
  | 'USER_ALREADY_ASSIGNED'
  | 'USER_NOT_IN_GROUP'
  | 'PERMISSION_DENIED'
  | 'INVALID_DATA'
  | 'TRANSACTION_FAILED';

export class CleaningServiceError extends Error {
  constructor(
    public readonly code: CleaningServiceErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CleaningServiceError';
  }
}
