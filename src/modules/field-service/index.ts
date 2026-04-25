// ─── Módulo: Contador de Horas de Predicación ────────────────────────────────
// 100% local. Sin Firebase. Sin sincronización remota.

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type {
  DayEntry,
  FieldServiceMeta,
  FieldServiceStore,
  MonthlyReportRecord,
  MonthlyReportStatus,
  MonthlyReportWindow,
  WeekSummary,
  MonthSummary,
  CalendarCell,
  CalendarWeek,
  CalendarMonth,
  FieldServiceState,
  SaveDayInput,
  SubmitMonthlyReportResult,
} from './types/field-service.types';

// ─── Servicios ────────────────────────────────────────────────────────────────
export {
  loadStore,
  saveDay,
  submitMonthlyReport,
  getMonthlyReportStatus,
  getCurrentMonthlyReportWindow,
  removeDay,
  getEntryByDate,
  getEntriesForMonth,
  getEntriesForWeek,
  toLocalDateString,
} from './services/field-service-storage';

// ─── Utilidades de fecha ──────────────────────────────────────────────────────
export {
  todayLocal,
  parseLocalDate,
  isSameDay,
  isSunday,
  getWeekMonday,
  getWeekSaturday,
  getWeekDates,
  getDayTotal,
  getWeekTotal,
  getMonthTotal,
  getWeekSummary,
  getCurrentMonthSummary,
  getMonthSummary,
  buildCalendarMonth,
  formatMinutes,
  formatMinutesCompact,
  formatMonthHeader,
  navigateMonth,
  getDayName,
  validateTimeInput,
  WEEK_HEADER_LABELS,
} from './utils/field-service-dates';

// ─── Context ──────────────────────────────────────────────────────────────────
export { FieldServiceProvider, useFieldServiceContext } from './context/FieldServiceContext';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export { useFieldService } from './hooks/use-field-service';

// ─── Componentes ─────────────────────────────────────────────────────────────
export { FieldServiceCalendar } from './components/FieldServiceCalendar';
export { FieldServiceDayModal } from './components/FieldServiceDayModal';
export { FieldServiceWeekSummary } from './components/FieldServiceWeekSummary';
export { FieldServiceDashboardCard } from './components/FieldServiceDashboardCard';

// ─── Pantallas ────────────────────────────────────────────────────────────────
export { FieldServiceScreen } from './screens/FieldServiceScreen';
