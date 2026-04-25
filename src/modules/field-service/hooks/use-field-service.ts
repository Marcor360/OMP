/**
 * Hook principal del modulo: Contador de Horas de Predicacion.
 *
 * Provee acceso memoizado a:
 * - totales del dia, semana y mes actual
 * - estructura del calendario mensual
 * - estado del informe mensual
 * - acciones de guardado y eliminacion
 */

import { useMemo } from 'react';

import { useFieldServiceContext } from '@/src/modules/field-service/context/FieldServiceContext';
import { getMonthlyReportStatus } from '@/src/modules/field-service/services/field-service-storage';
import {
  buildCalendarMonth,
  getCurrentMonthSummary,
  getDayTotal,
  getMonthSummary,
  getWeekSummary,
  navigateMonth,
} from '@/src/modules/field-service/utils/field-service-dates';
import type {
  CalendarMonth,
  FieldServiceStore,
  MonthSummary,
  MonthlyReportStatus,
  SaveDayInput,
  SubmitMonthlyReportResult,
  WeekSummary,
} from '@/src/modules/field-service/types/field-service.types';

export interface UseFieldServiceResult {
  loading: boolean;
  error: string | null;
  purgeExecutedThisSession: boolean;
  store: FieldServiceStore | null;

  currentMonthSummary: MonthSummary;
  getWeekSummaryForDate: (date: Date) => WeekSummary;
  getMonthSummaryFor: (year: number, month: number) => MonthSummary;
  buildCalendar: (year: number, month: number) => CalendarMonth;
  getDayMinutes: (date: string) => number;
  monthlyReportStatus: MonthlyReportStatus | null;

  saveDay: (input: SaveDayInput) => Promise<void>;
  removeDay: (date: string) => Promise<void>;
  submitMonthlyReport: () => Promise<SubmitMonthlyReportResult>;
  reload: () => Promise<void>;

  navigateMonth: (
    year: number,
    month: number,
    direction: 'prev' | 'next'
  ) => { year: number; month: number };
}

export function useFieldService(): UseFieldServiceResult {
  const {
    store,
    loading,
    error,
    purgeExecutedThisSession,
    saveDay,
    removeDay,
    submitMonthlyReport,
    reload,
  } = useFieldServiceContext();

  const currentMonthSummary = useMemo<MonthSummary>(() => {
    if (!store) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        totalMinutes: 0,
        daysWithEntries: 0,
        entries: [],
      };
    }
    return getCurrentMonthSummary(store);
  }, [store]);

  const getWeekSummaryForDate = useMemo(
    () =>
      (date: Date): WeekSummary => {
        if (!store) {
          return {
            weekStart: '',
            weekEnd: '',
            totalMinutes: 0,
            days: [],
          };
        }
        return getWeekSummary(store, date);
      },
    [store]
  );

  const getMonthSummaryFor = useMemo(
    () =>
      (year: number, month: number): MonthSummary => {
        if (!store) {
          return { year, month, totalMinutes: 0, daysWithEntries: 0, entries: [] };
        }
        return getMonthSummary(store, year, month);
      },
    [store]
  );

  const buildCalendar = useMemo(
    () =>
      (year: number, month: number): CalendarMonth => {
        if (!store) {
          return { year, month, weeks: [] };
        }
        return buildCalendarMonth(store, year, month);
      },
    [store]
  );

  const getDayMinutes = useMemo(
    () =>
      (date: string): number => {
        if (!store) return 0;
        return getDayTotal(store, date);
      },
    [store]
  );

  const monthlyReportStatus = useMemo(() => {
    if (!store) return null;
    return getMonthlyReportStatus(store);
  }, [store]);

  return {
    loading,
    error,
    purgeExecutedThisSession,
    store,
    currentMonthSummary,
    getWeekSummaryForDate,
    getMonthSummaryFor,
    buildCalendar,
    getDayMinutes,
    monthlyReportStatus,
    saveDay,
    removeDay,
    submitMonthlyReport,
    reload,
    navigateMonth,
  };
}
