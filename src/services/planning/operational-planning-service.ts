import {
  formatDateKey,
  getMonthIdFromDateKey,
} from '@/src/utils/dates/date-key';

export type PlanningModule =
  | 'meetings'
  | 'cleaning'
  | 'hospitalityMicrophones'
  | 'outgoingTalks';

export interface PlanningWindow {
  startDate: string;
  endDate: string;
  monthIds: string[];
  totalDays: number;
}

export interface PlanningValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export const MAX_PLANNING_DAYS = 62;

const MIN_DAYS_FOR_FOUR_POTENTIAL_MEETINGS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const isValidDate = (date: Date): boolean =>
  date instanceof Date && !Number.isNaN(date.getTime());

const addMonthId = (monthIds: string[], dateKey: string): void => {
  const monthId = getMonthIdFromDateKey(dateKey);
  if (!monthIds.includes(monthId)) {
    monthIds.push(monthId);
  }
};

export const buildPlanningWindow = (startDate: Date, endDate: Date): PlanningWindow => {
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const monthIds: string[] = [];

  if (isValidDate(start) && isValidDate(end) && totalDays > 0) {
    const cursor = new Date(start);
    while (cursor <= end) {
      addMonthId(monthIds, formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return {
    startDate: isValidDate(start) ? formatDateKey(start) : '',
    endDate: isValidDate(end) ? formatDateKey(end) : '',
    monthIds,
    totalDays: Number.isFinite(totalDays) ? Math.max(totalDays, 0) : 0,
  };
};

export const validatePlanningWindow = (params: {
  startDate: Date;
  endDate: Date;
  module: PlanningModule;
}): PlanningValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isValidDate(params.startDate)) {
    errors.push('La fecha inicial no es valida.');
  }

  if (!isValidDate(params.endDate)) {
    errors.push('La fecha final no es valida.');
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  const window = buildPlanningWindow(params.startDate, params.endDate);

  if (window.totalDays <= 0) {
    errors.push('La lista debe cubrir al menos un dia.');
  }

  if (window.startDate > window.endDate) {
    errors.push('La fecha final no puede ser menor que la fecha inicial.');
  }

  if (window.totalDays > MAX_PLANNING_DAYS) {
    errors.push(`La lista no puede cubrir mas de ${MAX_PLANNING_DAYS} dias.`);
  }

  if (window.monthIds.length > 2) {
    errors.push('La lista no puede cubrir mas de dos meses calendario.');
  }

  if (window.totalDays > 0 && window.totalDays < MIN_DAYS_FOR_FOUR_POTENTIAL_MEETINGS) {
    warnings.push(
      'El rango cubre menos de cuatro reuniones potenciales; revisa si conviene ampliar la lista.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
};

