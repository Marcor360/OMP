/**
 * Servicio de almacenamiento local del módulo: Contador de Horas de Predicación.
 *
 * - 100% local. Sin Firebase. Sin sincronización remota.
 * - Almacena en AsyncStorage bajo la clave STORAGE_KEY.
 * - Implementa limpieza automática SEMESTRAL (cada 6 meses).
 * - Maneja primera ejecución, archivo inexistente y datos corruptos.
 * - Todas las operaciones son seguras y no lanzan excepciones sin capturar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DayEntry,
  FieldServiceStore,
  SaveDayInput,
} from '@/src/modules/field-service/types/field-service.types';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Clave única en AsyncStorage. No colisiona con @cleaning_groups ni @cleaning_assignable_users. */
const STORAGE_KEY = '@field_service_v1';

/** Cantidad de meses para la política de limpieza automática semestral */
const AUTO_PURGE_MONTHS = 6;

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

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Lee el store desde AsyncStorage.
 * - Si no existe: crea y devuelve un store vacío (primera ejecución).
 * - Si está corrupto: devuelve un store vacío (recuperación segura).
 * - Si ya pasaron 6 meses desde lastAutoPurgeAt: ejecuta la purga antes de devolver.
 *
 * @returns { store, purgeExecuted }
 */
export async function loadStore(): Promise<{
  store: FieldServiceStore;
  purgeExecuted: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      // Primera ejecución
      const fresh = createEmptyStore();
      await saveStoreRaw(fresh);
      return { store: fresh, purgeExecuted: false };
    }

    let parsed: FieldServiceStore;
    try {
      parsed = JSON.parse(raw) as FieldServiceStore;
    } catch {
      // Archivo corrupto → recuperación segura
      console.warn('[FieldService] Store corrupto detectado. Reiniciando...');
      const fresh = createEmptyStore();
      await saveStoreRaw(fresh);
      return { store: fresh, purgeExecuted: false };
    }

    // Validar estructura básica (migración futura si version > 1)
    if (parsed.version !== 1 || !parsed.entries || !parsed.meta) {
      console.warn('[FieldService] Versión o estructura inválida. Reiniciando...');
      const fresh = createEmptyStore();
      await saveStoreRaw(fresh);
      return { store: fresh, purgeExecuted: false };
    }

    // ─── Política de limpieza automática semestral ────────────────────────────
    // Documentación: Esta purga es SEMESTRAL y LOCAL.
    // Se ejecuta en la primera inicialización del módulo posterior al umbral de 6 meses.
    // No depende de red, Firebase, cron ni procesos en servidor.
    if (shouldAutoPurge(parsed.meta.lastAutoPurgeAt)) {
      console.info('[FieldService] Auto-purge semestral ejecutada.');
      const purged: FieldServiceStore = {
        version: 1,
        entries: {},
        meta: {
          lastAutoPurgeAt: new Date().toISOString(),
        },
      };
      await saveStoreRaw(purged);
      return { store: purged, purgeExecuted: true };
    }

    return { store: parsed, purgeExecuted: false };
  } catch (err) {
    console.error('[FieldService] Error inesperado al cargar store:', err);
    const fresh = createEmptyStore();
    return { store: fresh, purgeExecuted: false };
  }
}

/** Persiste el store completo en AsyncStorage */
async function saveStoreRaw(store: FieldServiceStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('[FieldService] Error guardando store:', err);
  }
}

/**
 * Guarda o actualiza la entrada de un día específico.
 * Garantiza upsert: si ya existe ese día, lo sobreescribe (no duplica).
 *
 * @param store - Store actual en memoria
 * @param input - Fecha y tiempo a guardar
 * @returns Nuevo store actualizado (inmutable)
 */
export async function saveDay(
  store: FieldServiceStore,
  input: SaveDayInput
): Promise<FieldServiceStore> {
  const totalMinutes = clampMinutes(
    Math.floor(input.hours) * 60 + Math.floor(input.minutes)
  );

  const now = new Date().toISOString();
  const existing = store.entries[input.date];

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

  await saveStoreRaw(updated);
  return updated;
}

/**
 * Elimina la entrada de un día específico.
 * Si el día no existe, no hace nada.
 *
 * @returns Nuevo store sin la entrada del día
 */
export async function removeDay(
  store: FieldServiceStore,
  date: string
): Promise<FieldServiceStore> {
  if (!store.entries[date]) return store;

  const entries = { ...store.entries };
  delete entries[date];

  const updated: FieldServiceStore = { ...store, entries };
  await saveStoreRaw(updated);
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
