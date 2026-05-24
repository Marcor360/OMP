import type { Timestamp } from 'firebase/firestore';

export type TerritoryDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TerritoryDayOfWeek = TerritoryDay;

export interface TerritoryItem {
  number: number;
  description: string;
  enabled: boolean;
}

export interface TerritorySchedule {
  id: string;
  congregationId: string;
  dayOfWeek: TerritoryDay;
  territories: TerritoryItem[];
  active: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type CreateTerritoryScheduleInput = {
  dayOfWeek: TerritoryDay;
  territories: TerritoryItem[];
  active?: boolean;
};

export type UpdateTerritoryScheduleInput = Partial<CreateTerritoryScheduleInput>;

export const TERRITORY_DAYS: TerritoryDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const TERRITORY_DAY_LABELS: Record<TerritoryDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sabado',
  sunday: 'Domingo',
};

export const TERRITORY_DESCRIPTION_MAX_LENGTH = 100;
export const TERRITORIES_PER_DAY_MAX = 12;
