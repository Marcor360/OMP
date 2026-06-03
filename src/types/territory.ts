import type { Timestamp } from 'firebase/firestore';

export type TerritoryStatus = 'active' | 'inactive';
export type TerritoryAssignmentScope = 'congregation' | 'group';

export type Territory = {
  id: string;
  congregationId: string;
  number: number;
  description: string;
  status: TerritoryStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type PreachingGroup = {
  id: string;
  congregationId: string;
  name: string;
  number: number;
  captainUserId: string;
  captainName: string;
  assistantUserId?: string | null;
  assistantName?: string | null;
  memberIds: string[];
  memberNames: string[];
  memberCount: number;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type TerritoryAssignmentTarget = {
  id: string;
  scope: TerritoryAssignmentScope;
  groupId?: string | null;
  groupName?: string | null;
  territoryIds: string[];
  territoryNumbers: number[];
  notes?: string | null;
};

export type MonthlyTerritoryAssignment = {
  id: string;
  congregationId: string;
  monthId: string;
  assignments: TerritoryAssignmentTarget[];
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type TerritoryInput = {
  number: number;
  description: string;
  status?: TerritoryStatus;
};

export type PreachingGroupInput = {
  number: number;
  captainUserId: string;
  captainName: string;
  assistantUserId?: string | null;
  assistantName?: string | null;
  memberIds: string[];
  memberNames: string[];
  isActive?: boolean;
};

export type MonthlyTerritoryAssignmentInput = {
  assignments: TerritoryAssignmentTarget[];
};

export type VisibleMonthlyTerritories = {
  monthId: string;
  congregationTargets: TerritoryAssignmentTarget[];
  groupTargets: TerritoryAssignmentTarget[];
  territoriesById: Map<string, Territory>;
  userGroup: PreachingGroup | null;
};

export const TERRITORY_DESCRIPTION_MAX_LENGTH = 100;

export const buildTerritoryId = (number: number): string => `territory_${number}`;

export const getCurrentMonthId = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const getMonthLabel = (monthId: string): string => {
  const [year, month] = monthId.split('-').map(Number);
  if (!year || !month) return monthId;
  return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
};

export const isValidMonthId = (value: string): boolean => /^\d{4}-\d{2}$/.test(value);

