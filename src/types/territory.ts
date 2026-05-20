import type { Timestamp } from 'firebase/firestore';

export type TerritoryStatus = 'active' | 'inactive';

export type TerritoryDayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface Territory {
  id: string;
  congregationId: string;
  number: number | null;
  name: string;
  description: string;
  status: TerritoryStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TerritorySchedule {
  id: string;
  congregationId: string;
  dayOfWeek: TerritoryDayOfWeek;
  territoryIds: string[];
  note: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TerritoryFormValues = {
  number: number | null;
  name: string;
  description: string;
};

export type TerritoryScheduleFormValues = {
  dayOfWeek: TerritoryDayOfWeek;
  territoryIds: string[];
  note: string;
};

export const TERRITORY_DAYS: TerritoryDayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const TERRITORY_DAY_LABELS: Record<TerritoryDayOfWeek, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo',
};

export const TERRITORY_NAME_MAX_LENGTH = 50;
export const TERRITORY_DESCRIPTION_MAX_LENGTH = 160;
export const TERRITORY_DAY_NOTE_MAX_LENGTH = 300;
