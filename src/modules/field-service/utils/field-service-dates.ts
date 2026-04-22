/**
 * Utilidades de fecha para el Módulo: Contador de Horas de Predicación.
 *
 * Reglas de este módulo:
 * - Semana: lunes a sábado (6 días activos). Domingo NO es activo.
 * - Todas las fechas usan hora local del dispositivo (no UTC).
 * - Locale 'es-MX' para formato de texto.
 * - Funciones puras sin efectos secundarios.
 */

import type {
  CalendarCell,
  CalendarMonth,
  CalendarWeek,
  DayEntry,
  MonthSummary,
  WeekSummary,
} from '@/src/modules/field-service/types/field-service.types';
import type { FieldServiceStore } from '@/src/modules/field-service/types/field-service.types';
import { toLocalDateString } from '@/src/modules/field-service/services/field-service-storage';

// ─── Fecha local ──────────────────────────────────────────────────────────────

/** Devuelve hoy como YYYY-MM-DD usando hora local del dispositivo */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/** Parsea YYYY-MM-DD a Date con hora local al inicio del día */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Compara si dos strings YYYY-MM-DD son el mismo día */
export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

/** Devuelve true si la fecha dada es domingo */
export function isSunday(dateStr: string): boolean {
  return parseLocalDate(dateStr).getDay() === 0;
}

// ─── Semana Lunes-Sábado ─────────────────────────────────────────────────────

/**
 * Dado cualquier día de la semana, devuelve el lunes de esa semana.
 * Semana del módulo: lunes-sábado.
 */
export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const shift = day === 0 ? -6 : 1 - day; // si es domingo, retrocede al lunes anterior
  d.setDate(d.getDate() + shift);
  return d;
}

/**
 * Dado el lunes de una semana, devuelve el sábado de esa semana.
 */
export function getWeekSaturday(monday: Date): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + 5);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Dado un Date, devuelve las 6 fechas YYYY-MM-DD de esa semana (lun-sáb).
 */
export function getWeekDates(anyDayInWeek: Date): string[] {
  const monday = getWeekMonday(anyDayInWeek);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toLocalDateString(d);
  });
}

// ─── Totales ─────────────────────────────────────────────────────────────────

/** Total de minutos de un día dado */
export function getDayTotal(store: FieldServiceStore, date: string): number {
  return store.entries[date]?.totalMinutes ?? 0;
}

/** Total de minutos de una semana (lun-sáb) dado cualquier día de la semana */
export function getWeekTotal(store: FieldServiceStore, anyDay: Date): number {
  const dates = getWeekDates(anyDay);
  return dates.reduce((sum, d) => sum + getDayTotal(store, d), 0);
}

/** Total de minutos de un mes completo */
export function getMonthTotal(
  store: FieldServiceStore,
  year: number,
  month: number
): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return Object.values(store.entries)
    .filter((e) => e.date.startsWith(prefix))
    .reduce((sum, e) => sum + e.totalMinutes, 0);
}

// ─── Resúmenes ────────────────────────────────────────────────────────────────

/** Construye el resumen de la semana que contiene `anyDay` */
export function getWeekSummary(
  store: FieldServiceStore,
  anyDay: Date
): WeekSummary {
  const dates = getWeekDates(anyDay);
  const days = dates
    .map((d) => store.entries[d])
    .filter((e): e is DayEntry => !!e);

  return {
    weekStart: dates[0],
    weekEnd: dates[5],
    totalMinutes: days.reduce((s, e) => s + e.totalMinutes, 0),
    days,
  };
}

/** Construye el resumen del mes actual */
export function getCurrentMonthSummary(store: FieldServiceStore): MonthSummary {
  const now = new Date();
  return getMonthSummary(store, now.getFullYear(), now.getMonth() + 1);
}

/** Construye el resumen de un mes específico */
export function getMonthSummary(
  store: FieldServiceStore,
  year: number,
  month: number
): MonthSummary {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const entries = Object.values(store.entries).filter((e) =>
    e.date.startsWith(prefix)
  );

  return {
    year,
    month,
    totalMinutes: entries.reduce((s, e) => s + e.totalMinutes, 0),
    daysWithEntries: entries.length,
    entries,
  };
}

// ─── Calendario Mensual ───────────────────────────────────────────────────────

/**
 * Genera la estructura del calendario mensual para este módulo.
 *
 * Reglas:
 * - 6 columnas: lunes, martes, miércoles, jueves, viernes, sábado
 * - Domingo NO aparece como columna
 * - Las semanas que cruzan meses se muestran completas (días del mes adyacente
 *   tienen isCurrentMonth = false)
 * - Solo días de lun-sáb generan celdas
 */
export function buildCalendarMonth(
  store: FieldServiceStore,
  year: number,
  month: number
): CalendarMonth {
  const today = todayLocal();

  // Primer día del mes
  const firstDay = new Date(year, month - 1, 1);
  // Último día del mes
  const lastDay = new Date(year, month, 0);

  // Lunes de la semana que contiene el primer día del mes
  const calStart = getWeekMonday(firstDay);
  // Sábado de la semana que contiene el último día del mes
  // Buscamos el sábado de esa semana
  const lastDayMonday = getWeekMonday(lastDay);
  const calEnd = getWeekSaturday(lastDayMonday);

  const weeks: CalendarWeek[] = [];
  const cursor = new Date(calStart);

  while (cursor <= calEnd) {
    const week: CalendarWeek = [];

    // 6 días: lun(0) a sáb(5)
    for (let i = 0; i < 6; i++) {
      const cellDate = new Date(cursor);
      cellDate.setDate(cursor.getDate() + i);

      const dateStr = toLocalDateString(cellDate);
      const isCurrentMonth =
        cellDate.getFullYear() === year &&
        cellDate.getMonth() + 1 === month;

      week.push({
        date: dateStr,
        day: cellDate.getDate(),
        isToday: dateStr === today,
        hasEntry: !!store.entries[dateStr] && (store.entries[dateStr]?.totalMinutes ?? 0) > 0,
        totalMinutes: store.entries[dateStr]?.totalMinutes ?? 0,
        isCurrentMonth,
        isSunday: false, // nunca Sunday porque generamos lun-sáb
      });
    }

    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7); // avanzar una semana completa
  }

  return { year, month, weeks };
}

// ─── Formateo ─────────────────────────────────────────────────────────────────

/**
 * Convierte minutos a texto legible.
 * Ejemplos:
 *   0 → "0 min"
 *   30 → "30 min"
 *   60 → "1 h"
 *   90 → "1 h 30 min"
 *   120 → "2 h"
 */
export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

/**
 * Versión compacta para celdas del calendario (espacio reducido).
 * Ejemplos: "2h", "1h30", "45m"
 */
export function formatMinutesCompact(totalMinutes: number): string {
  if (totalMinutes <= 0) return '';

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}`;
}

/**
 * Formatea un mes/año para mostrar en encabezado del calendario.
 * Ejemplo: Date(2025, 0) → "Enero 2025"
 */
export function formatMonthHeader(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

/**
 * Etiquetas de encabezado del calendario (lun-sáb en español abreviado).
 */
export const WEEK_HEADER_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Navega entre meses: devuelve { year, month } del mes anterior o siguiente.
 */
export function navigateMonth(
  year: number,
  month: number,
  direction: 'prev' | 'next'
): { year: number; month: number } {
  let newMonth = month + (direction === 'next' ? 1 : -1);
  let newYear = year;

  if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  } else if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  }

  return { year: newYear, month: newMonth };
}

/**
 * Nombre corto del día de la semana en español.
 */
export function getDayName(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('es-MX', { weekday: 'long' });
}

/**
 * Valida que un input de horas/minutos sea razonable.
 * Retorna null si es válido, o un mensaje de error si no.
 */
export function validateTimeInput(hours: number, minutes: number): string | null {
  if (isNaN(hours) || !isFinite(hours)) return 'Horas inválidas';
  if (isNaN(minutes) || !isFinite(minutes)) return 'Minutos inválidos';
  if (hours < 0 || minutes < 0) return 'No se permiten valores negativos';
  if (minutes >= 60) return 'Los minutos deben ser entre 0 y 59';
  if (hours > 24) return 'El máximo es 24 horas por día';
  if (hours === 24 && minutes > 0) return 'El máximo es 24 horas por día';
  return null;
}
