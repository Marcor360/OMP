/**
 * Servicio de almacenamiento local del módulo: Contador de Horas de Predicación.
 *
 * - 100% local. Sin Firebase. Sin sincronización remota.
 * - Almacena en AsyncStorage bajo una clave namespaced por uid (ver getStorageKey),
 *   para aislar los datos de cada usuario en dispositivos compartidos.
 * - Implementa limpieza automática SEMESTRAL (cada 6 meses).
 * - Maneja primera ejecución, archivo inexistente y datos corruptos.
 * - Todas las operaciones son seguras y no lanzan excepciones sin capturar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DayEntry,
  FieldServiceStore,
  MonthlyReportRecord,
  MonthlyReportStatus,
  MonthlyReportWindow,
  SaveDayInput,
  SubmitMonthlyReportResult,
} from '@/src/modules/field-service/types/field-service.types';
import { createLogger } from '@/src/utils/logger';

// ─── Constantes ───────────────────────────────────────────────────────────────

/**
 * Prefijo de clave en AsyncStorage. No colisiona con @cleaning_groups ni
 * @cleaning_assignable_users.
 *
 * Namespaced por uid (getStorageKey) para que cada usuario tenga su propio store
 * en un mismo dispositivo compartido. La clave vieja sin uid (`@field_service_v1`
 * a secas) queda deprecada; session-cleanup.ts la purga una vez por logout para
 * no arrastrar datos huérfanos de antes de este cambio.
 */
const STORAGE_KEY_PREFIX = '@field_service_v1';

/** Construye la clave de AsyncStorage aislada para un usuario específico. */
const getStorageKey = (uid: string): string => `${STORAGE_KEY_PREFIX}:${uid}`;

/** Cantidad de meses para la política de limpieza automática semestral */
const AUTO_PURGE_MONTHS = 6;
const log = createLogger('field-service-storage');

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Devuelve la fecha local en formato YYYY-MM-DD */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Crea un store vacío y limpio para primera ejecución */
function createEmptyStore(): FieldServiceStore {
  return {
    version: 1,
    entries: {},
    meta: {
      lastAutoPurgeAt: new Date().toISOString(),
      monthlyReports: {},
    },
  };
}

/** Garantiza compatibilidad con stores antiguos sin monthlyReports */
function normalizeStore(store: FieldServiceStore): FieldServiceStore {
  const monthlyReports =
    store.meta.monthlyReports &&
    typeof store.meta.monthlyReports === 'object' &&
    !Array.isArray(store.meta.monthlyReports)
      ? store.meta.monthlyReports
      : {};
  return {
    ...store,
    meta: {
      ...store.meta,
      monthlyReports,
    },
  };
}

/**
 * Verifica si deben pasar AUTO_PURGE_MONTHS meses desde lastAutoPurgeAt.
 * Usa fecha local del dispositivo, no UTC.
 */
function shouldAutoPurge(lastAutoPurgeAt: string | null): boolean {
  if (!lastAutoPurgeAt) return false;

  const last = new Date(lastAutoPurgeAt);
  const threshold = new Date(last);
  threshold.setMonth(threshold.getMonth() + AUTO_PURGE_MONTHS);

  return new Date() >= threshold;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toStartOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Calcula la ventana de envío para el informe del mes anterior.
 * - Si el mes reportado tiene 30 días: ventana de 2 días (1-2 del mes actual).
 * - Si el mes reportado tiene 31 días: ventana de 3 días (1-3 del mes actual).
 * - Otros casos (febrero): 2 días.
 */
export function getCurrentMonthlyReportWindow(
  referenceDate: Date = new Date()
): MonthlyReportWindow {
  const now = toStartOfDay(referenceDate);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const targetMonthDate = new Date(currentYear, currentMonth - 2, 1);
  const targetYear = targetMonthDate.getFullYear();
  const targetMonth = targetMonthDate.getMonth() + 1;
  const targetMonthKey = toMonthKey(targetYear, targetMonth);
  const targetMonthDays = getDaysInMonth(targetYear, targetMonth);
  const graceDays: 2 | 3 = targetMonthDays === 31 ? 3 : 2;

  const windowStartDate = new Date(currentYear, currentMonth - 1, 1);
  const windowEndDate = new Date(currentYear, currentMonth - 1, graceDays);
  windowEndDate.setHours(23, 59, 59, 999);

  return {
    targetYear,
    targetMonth,
    targetMonthKey,
    periodStart: `${targetMonthKey}-01`,
    periodEnd: `${targetMonthKey}-${pad2(targetMonthDays)}`,
    windowStart: toLocalDateString(windowStartDate),
    windowEnd: toLocalDateString(windowEndDate),
    graceDays,
    isWithinWindow: now >= windowStartDate && now <= windowEndDate,
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Lee el store desde AsyncStorage, aislado para el usuario dado.
 * - Si no existe: crea y devuelve un store vacío (primera ejecución).
 * - Si está corrupto: devuelve un store vacío (recuperación segura).
 * - Si ya pasaron 6 meses desde lastAutoPurgeAt: ejecuta la purga antes de devolver.
 *
 * @param uid - uid del usuario autenticado; aísla el store de otros usuarios
 *   del mismo dispositivo.
 * @returns { store, purgeExecuted }
 */
export async function loadStore(uid: string): Promise<{
  store: FieldServiceStore;
  purgeExecuted: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(uid));

    if (!raw) {
      // Primera ejecución
      const fresh = createEmptyStore();
      await saveStoreRaw(uid, fresh);
      return { store: fresh, purgeExecuted: false };
    }

    let parsed: FieldServiceStore;
    try {
      parsed = JSON.parse(raw) as FieldServiceStore;
    } catch {
      // Archivo corrupto → recuperación segura
      log.warn('[FieldService] Store corrupto detectado. Reiniciando...');
      const fresh = createEmptyStore();
      await saveStoreRaw(uid, fresh);
      return { store: fresh, purgeExecuted: false };
    }

    // Validar estructura básica (migración futura si version > 1)
    if (parsed.version !== 1 || !parsed.entries || !parsed.meta) {
      log.warn('[FieldService] Versión o estructura inválida. Reiniciando...');
      const fresh = createEmptyStore();
      await saveStoreRaw(uid, fresh);
      return { store: fresh, purgeExecuted: false };
    }

    const normalized = normalizeStore(parsed);
    const requiresMigrationSave =
      !parsed.meta.monthlyReports ||
      parsed.meta.monthlyReports !== normalized.meta.monthlyReports;

    // ─── Política de limpieza automática semestral ────────────────────────────
    // Documentación: Esta purga es SEMESTRAL y LOCAL.
    // Se ejecuta en la primera inicialización del módulo posterior al umbral de 6 meses.
    // No depende de red, Firebase, cron ni procesos en servidor.
    if (shouldAutoPurge(normalized.meta.lastAutoPurgeAt)) {
      log.info('[FieldService] Auto-purge semestral ejecutada.');
      const purged: FieldServiceStore = {
        version: 1,
        entries: {},
        meta: {
          lastAutoPurgeAt: new Date().toISOString(),
          monthlyReports: normalized.meta.monthlyReports ?? {},
        },
      };
      await saveStoreRaw(uid, purged);
      return { store: purged, purgeExecuted: true };
    }

    if (requiresMigrationSave) {
      await saveStoreRaw(uid, normalized);
    }

    return { store: normalized, purgeExecuted: false };
  } catch (err) {
    log.error('[FieldService] Error inesperado al cargar store:', err);
    const fresh = createEmptyStore();
    return { store: fresh, purgeExecuted: false };
  }
}

/** Persiste el store completo en AsyncStorage, aislado para el usuario dado. */
async function saveStoreRaw(uid: string, store: FieldServiceStore): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(uid), JSON.stringify(store));
  } catch (err) {
    log.error('[FieldService] Error guardando store:', err);
  }
}

/**
 * Guarda o actualiza la entrada de un día específico.
 * Garantiza upsert: si ya existe ese día, puede reemplazar o sumar sin duplicar registros.
 *
 * @param uid - uid del usuario autenticado (aísla el store persistido)
 * @param store - Store actual en memoria
 * @param input - Fecha, tiempo y modo de guardado (replace/add)
 * @returns Nuevo store actualizado (inmutable)
 */
export async function saveDay(
  uid: string,
  store: FieldServiceStore,
  input: SaveDayInput
): Promise<FieldServiceStore> {
  const inputMinutes = clampMinutes(
    Math.floor(input.hours) * 60 + Math.floor(input.minutes)
  );

  const now = new Date().toISOString();
  const existing = store.entries[input.date];
  const mode = input.mode ?? 'replace';

  const totalMinutes = clampMinutes(
    mode === 'add'
      ? (existing?.totalMinutes ?? 0) + inputMinutes
      : inputMinutes
  );

  const newEntry: DayEntry = {
    date: input.date,
    totalMinutes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const updated: FieldServiceStore = {
    ...store,
    entries: {
      ...store.entries,
      [input.date]: newEntry,
    },
  };

  await saveStoreRaw(uid, updated);
  return updated;
}

/**
 * Obtiene el estado actual del informe mensual para el mes reportable.
 */
export function getMonthlyReportStatus(
  store: FieldServiceStore,
  referenceDate: Date = new Date()
): MonthlyReportStatus {
  const normalizedStore = normalizeStore(store);
  const window = getCurrentMonthlyReportWindow(referenceDate);
  const sentReport =
    normalizedStore.meta.monthlyReports[window.targetMonthKey] ?? null;
  const alreadySent = !!sentReport;
  const canSubmit = window.isWithinWindow && !alreadySent;

  return {
    window,
    alreadySent,
    sentReport,
    canSubmit,
    reason: alreadySent
      ? 'ALREADY_SENT'
      : window.isWithinWindow
        ? 'READY'
        : 'OUTSIDE_WINDOW',
  };
}

function buildMonthlyReportRecord(
  store: FieldServiceStore,
  window: MonthlyReportWindow
): MonthlyReportRecord {
  const monthEntries = getEntriesForMonth(store, window.targetYear, window.targetMonth);
  const totalMinutes = monthEntries.reduce((sum, entry) => sum + entry.totalMinutes, 0);

  return {
    monthKey: window.targetMonthKey,
    sentAt: new Date().toISOString(),
    totalMinutes,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    deadlineDate: window.windowEnd,
    graceDays: window.graceDays,
  };
}

function addMonthlyReport(
  store: FieldServiceStore,
  report: MonthlyReportRecord
): FieldServiceStore {
  return {
    ...store,
    meta: {
      ...store.meta,
      monthlyReports: {
        ...store.meta.monthlyReports,
        [report.monthKey]: report,
      },
    },
  };
}

/**
 * Refleja localmente un informe que ya fue enviado correctamente a la congregacion.
 * Es idempotente: un mes marcado previamente se conserva sin crear otro registro.
 */
export async function markMonthlyReportAsSent(uid: string, monthKey: string): Promise<void> {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match) throw new Error(`Mes de informe invalido: ${monthKey}.`);

  const { store } = await loadStore(uid);
  const normalizedStore = normalizeStore(store);

  if (normalizedStore.meta.monthlyReports[monthKey]) return;

  const targetYear = Number(match[1]);
  const targetMonth = Number(match[2]);
  const window = getCurrentMonthlyReportWindow(new Date(targetYear, targetMonth, 1));

  const report = buildMonthlyReportRecord(normalizedStore, window);
  await saveStoreRaw(uid, addMonthlyReport(normalizedStore, report));
}

/**
 * Marca como enviado el informe mensual del mes reportable actual.
 * Reglas:
 * - Solo se permite dentro de ventana.
 * - Solo un envío por mes (monthKey).
 */
export async function submitMonthlyReport(
  uid: string,
  store: FieldServiceStore,
  referenceDate: Date = new Date()
): Promise<{
  store: FieldServiceStore;
  result: SubmitMonthlyReportResult;
}> {
  const normalizedStore = normalizeStore(store);
  const status = getMonthlyReportStatus(normalizedStore, referenceDate);

  if (status.alreadySent) {
    return {
      store: normalizedStore,
      result: {
        ok: false,
        reason: 'ALREADY_SENT',
        message: 'El informe de este mes ya fue enviado.',
        status,
      },
    };
  }

  if (!status.window.isWithinWindow) {
    return {
      store: normalizedStore,
      result: {
        ok: false,
        reason: 'OUTSIDE_WINDOW',
        message:
          'La ventana de envío no está disponible. Solo puedes enviar durante los primeros días del mes.',
        status,
      },
    };
  }

  const report = buildMonthlyReportRecord(normalizedStore, status.window);
  const updated = addMonthlyReport(normalizedStore, report);

  await saveStoreRaw(uid, updated);

  return {
    store: updated,
    result: {
      ok: true,
      report,
    },
  };
}

/**
 * Elimina la entrada de un día específico.
 * Si el día no existe, no hace nada.
 *
 * @returns Nuevo store sin la entrada del día
 */
export async function removeDay(
  uid: string,
  store: FieldServiceStore,
  date: string
): Promise<FieldServiceStore> {
  if (!store.entries[date]) return store;

  const entries = { ...store.entries };
  delete entries[date];

  const updated: FieldServiceStore = { ...store, entries };
  await saveStoreRaw(uid, updated);
  return updated;
}

/**
 * Obtiene la entrada de un día específico o null si no existe.
 */
export function getEntryByDate(
  store: FieldServiceStore,
  date: string
): DayEntry | null {
  return store.entries[date] ?? null;
}

/**
 * Devuelve todos los registros de un mes dado.
 *
 * @param year - Año completo (e.g. 2025)
 * @param month - Mes base 1 (1-12)
 */
export function getEntriesForMonth(
  store: FieldServiceStore,
  year: number,
  month: number
): DayEntry[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return Object.values(store.entries).filter((e) => e.date.startsWith(prefix));
}

/**
 * Devuelve todos los registros de una semana lunes-sábado dada.
 *
 * @param weekDates - Array de strings YYYY-MM-DD (6 fechas: lun-sáb)
 */
export function getEntriesForWeek(
  store: FieldServiceStore,
  weekDates: string[]
): DayEntry[] {
  return weekDates
    .map((d) => store.entries[d])
    .filter((e): e is DayEntry => !!e);
}

// ─── Guardianes de validación ─────────────────────────────────────────────────

/**
 * Limita los minutos a un rango razonable (0-1440 = 24h máximo por día).
 */
function clampMinutes(minutes: number): number {
  if (isNaN(minutes) || !isFinite(minutes)) return 0;
  return Math.max(0, Math.min(1440, Math.floor(minutes)));
}
