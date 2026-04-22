/**
 * Hook principal del Módulo: Contador de Horas de Predicación.
 *
 * Provee acceso memoizado a:
 * - totales del día, semana y mes actual
 * - estructura del calendario mensual
 * - acciones de guardado y eliminación
 * - estado de carga y purga automática
 */

import { useMemo } from 'react';

import { useFieldServiceContext } from '@/src/modules/field-service/context/FieldServiceContext';
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
  MonthSummary,
  SaveDayInput,
  WeekSummary,
} from '@/src/modules/field-service/types/field-service.types';
import type { FieldServiceStore } from '@/src/modules/field-service/types/field-service.types';

// ─── Interfaz del hook ────────────────────────────────────────────────────────

export interface UseFieldServiceResult {
  // ── Estado general ─────────────────────────────────────────────────────────
  loading: boolean;
  error: string | null;
  purgeExecutedThisSession: boolean;
  store: FieldServiceStore | null;

  // ── Resumen del mes actual (para dashboard y pantalla) ─────────────────────
  currentMonthSummary: MonthSummary;

  // ── Resumen de semana que contiene la fecha seleccionada ───────────────────
  getWeekSummaryForDate: (date: Date) => WeekSummary;

  // ── Resumen de un mes específico ───────────────────────────────────────────
  getMonthSummaryFor: (year: number, month: number) => MonthSummary;

  // ── Calendario de un mes específico ───────────────────────────────────────
  buildCalendar: (year: number, month: number) => CalendarMonth;

  // ── Total del día ──────────────────────────────────────────────────────────
  getDayMinutes: (date: string) => number;

  // ── Acciones ───────────────────────────────────────────────────────────────
  saveDay: (input: SaveDayInput) => Promise<void>;
  removeDay: (date: string) => Promise<void>;
  reload: () => Promise<void>;

  // ── Navegación de mes (helper puro) ───────────────────────────────────────
  navigateMonth: (
    year: number,
    month: number,
    direction: 'prev' | 'next'
  ) => { year: number; month: number };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFieldService(): UseFieldServiceResult {
  const { store, loading, error, purgeExecutedThisSession, saveDay, removeDay, reload } =
    useFieldServiceContext();

  // Resumen del mes actual — memoizado, se recalcula solo si cambia el store
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
          const now = new Date();
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
    saveDay,
    removeDay,
    reload,
    navigateMonth,
  };
}
