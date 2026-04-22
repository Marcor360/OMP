// ─── Tipos del Módulo: Contador de Horas de Predicación ──────────────────────
// 100% local. Sin Firebase. Sin sincronización remota.
// Almacenamiento: AsyncStorage clave @field_service_v1

/**
 * Registro de horas para un día específico.
 * Se usa minutos internamente para evitar errores de punto flotante.
 */
export interface DayEntry {
  /** Fecha en formato YYYY-MM-DD (hora local del dispositivo) */
  date: string;
  /** Total de minutos registrados ese día (siempre entero, ≥ 0) */
  totalMinutes: number;
  /** ISO 8601 — cuándo se creó este registro */
  createdAt: string;
  /** ISO 8601 — cuándo se actualizó por última vez */
  updatedAt: string;
}

/**
 * Metadatos del módulo para control de ciclo y purga automática semestral.
 */
export interface FieldServiceMeta {
  /**
   * ISO 8601 de la última purga automática.
   * Si es null, nunca se ha ejecutado una purga (primera ejecución).
   */
  lastAutoPurgeAt: string | null;
}

/**
 * Estructura raíz almacenada en AsyncStorage.
 * Clave: @field_service_v1
 */
export interface FieldServiceStore {
  /** Versión del esquema — permite migraciones futuras */
  version: 1;
  /**
   * Registro de días indexados por fecha YYYY-MM-DD.
   * Un solo registro por día. Upsert garantizado.
   */
  entries: Record<string, DayEntry>;
  meta: FieldServiceMeta;
}

// ─── Resúmenes calculados (no almacenados) ────────────────────────────────────

/** Resumen de una semana lunes-sábado */
export interface WeekSummary {
  /** Fecha de inicio de la semana (lunes) en YYYY-MM-DD */
  weekStart: string;
  /** Fecha de fin de la semana (sábado) en YYYY-MM-DD */
  weekEnd: string;
  /** Total de minutos en la semana */
  totalMinutes: number;
  /** Entradas por día (solo días con datos) */
  days: DayEntry[];
}

/** Resumen de un mes completo */
export interface MonthSummary {
  /** Año del mes */
  year: number;
  /** Mes (1-12) */
  month: number;
  /** Total de minutos en el mes */
  totalMinutes: number;
  /** Número de días con al menos 1 minuto registrado */
  daysWithEntries: number;
  /** Todas las entradas del mes */
  entries: DayEntry[];
}

/**
 * Celda del calendario mensual.
 * Cada celda representa un día de lunes a sábado.
 */
export interface CalendarCell {
  /** Fecha en formato YYYY-MM-DD */
  date: string;
  /** Día del mes (1-31) */
  day: number;
  /** ¿Es el día de hoy? */
  isToday: boolean;
  /** ¿Tiene minutos registrados? */
  hasEntry: boolean;
  /** Minutos registrados (0 si no hay entrada) */
  totalMinutes: number;
  /** ¿Pertenece al mes visualizado? (false = días de relleno) */
  isCurrentMonth: boolean;
  /** ¿Es domingo? (no editable en esta versión) */
  isSunday: boolean;
}

/** Semana del calendario (array de 6 celdas lun-sáb) */
export type CalendarWeek = CalendarCell[];

/** Mes completo del calendario (array de semanas) */
export interface CalendarMonth {
  year: number;
  month: number; // 1-12
  weeks: CalendarWeek[];
}

// ─── Estado del contexto ──────────────────────────────────────────────────────

export interface FieldServiceState {
  /** Datos cargados en memoria (fuente de verdad en runtime) */
  store: FieldServiceStore | null;
  /** ¿Está cargando el store inicial? */
  loading: boolean;
  /** Error de inicialización, si existe */
  error: string | null;
  /** ¿Se ejecutó una purga automática en esta sesión? */
  purgeExecutedThisSession: boolean;
}

// ─── DTO de input ─────────────────────────────────────────────────────────────

/** Datos para guardar o actualizar un día */
export interface SaveDayInput {
  date: string; // YYYY-MM-DD
  hours: number; // ≥ 0, entero o decimal
  minutes: number; // 0-59, entero
}
