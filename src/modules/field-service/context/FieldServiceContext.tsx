/**
 * Contexto del Módulo: Contador de Horas de Predicación.
 *
 * - Hidrata AsyncStorage al montarse (una sola lectura).
 * - Ejecuta auto-purge semestral si corresponde.
 * - Mantiene el store en memoria como fuente de verdad en runtime.
 * - Expone acciones limpias: saveDay, removeDay.
 * - Sin Firebase. Sin efectos secundarios remotos.
 *
 * Diseño de storeRef:
 *   storeRef se actualiza SINCRÓNICAMENTE en cada acción, ANTES de llamar
 *   a setState. Esto garantiza que acciones consecutivas rápidas lean
 *   siempre el store más reciente, evitando race conditions.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  getCurrentMonthlyReportWindow,
  loadStore,
  saveDay as storageSaveDay,
  removeDay as storageRemoveDay,
  submitMonthlyReport as storageSubmitMonthlyReport,
} from '@/src/modules/field-service/services/field-service-storage';
import type {
  FieldServiceState,
  FieldServiceStore,
  SaveDayInput,
  SubmitMonthlyReportResult,
} from '@/src/modules/field-service/types/field-service.types';

// ─── Tipos del contexto ───────────────────────────────────────────────────────

interface FieldServiceContextValue extends FieldServiceState {
  /** Guarda o actualiza las horas de un día (upsert garantizado) */
  saveDay: (input: SaveDayInput) => Promise<void>;
  /** Elimina el registro de un día */
  removeDay: (date: string) => Promise<void>;
  /** Envía el informe mensual (una sola vez por mes dentro de ventana) */
  submitMonthlyReport: () => Promise<SubmitMonthlyReportResult>;
  /** Fuerza recarga desde AsyncStorage */
  reload: () => Promise<void>;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

const FieldServiceContext = createContext<FieldServiceContextValue | undefined>(
  undefined
);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const FieldServiceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<FieldServiceState>({
    store: null,
    loading: true,
    error: null,
    purgeExecutedThisSession: false,
  });

  /**
   * storeRef es la fuente de verdad para callbacks async.
   * Se actualiza SINCRÓNICAMENTE antes de cada setState para evitar
   * que operaciones rápidas consecutivas lean un store desactualizado.
   */
  const storeRef = useRef<FieldServiceStore | null>(null);

  // Evita doble hidratación en React Strict Mode
  const hydrated = useRef(false);

  /** Carga el store desde AsyncStorage y aplica auto-purge si corresponde */
  const hydrate = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { store, purgeExecuted } = await loadStore();
      // Actualizar ref ANTES de setState para que cualquier acción
      // disparada sincrónicamente vea el store correcto desde ya.
      storeRef.current = store;
      setState({
        store,
        loading: false,
        error: null,
        purgeExecutedThisSession: purgeExecuted,
      });
    } catch (err) {
      console.error('[FieldServiceContext] Error hidratando:', err);
      setState({
        store: null,
        loading: false,
        error: 'No se pudo cargar el contador de horas.',
        purgeExecutedThisSession: false,
      });
    }
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void hydrate();
  }, [hydrate]);

  /** Guarda un día y actualiza el store en memoria (upsert) */
  const handleSaveDay = useCallback(async (input: SaveDayInput) => {
    const currentStore = storeRef.current;
    if (!currentStore) {
      console.warn('[FieldServiceContext] saveDay llamado antes de hidratación.');
      return;
    }
    try {
      const updated = await storageSaveDay(currentStore, input);
      // Actualizar ref sincrónicamente PRIMERO
      storeRef.current = updated;
      setState((prev) => ({ ...prev, store: updated }));
    } catch (err) {
      console.error('[FieldServiceContext] Error guardando día:', err);
    }
  }, []);

  /** Elimina la entrada de un día y actualiza el store en memoria */
  const handleRemoveDay = useCallback(async (date: string) => {
    const currentStore = storeRef.current;
    if (!currentStore) {
      console.warn('[FieldServiceContext] removeDay llamado antes de hidratación.');
      return;
    }
    try {
      const updated = await storageRemoveDay(currentStore, date);
      // Actualizar ref sincrónicamente PRIMERO
      storeRef.current = updated;
      setState((prev) => ({ ...prev, store: updated }));
    } catch (err) {
      console.error('[FieldServiceContext] Error eliminando día:', err);
    }
  }, []);

  /** Envía informe mensual y persiste el estado */
  const handleSubmitMonthlyReport = useCallback(async (): Promise<SubmitMonthlyReportResult> => {
    const fallbackWindow = getCurrentMonthlyReportWindow();
    const fallbackStatus = {
      window: fallbackWindow,
      alreadySent: false,
      sentReport: null,
      canSubmit: false,
      reason: 'OUTSIDE_WINDOW' as const,
    };

    const currentStore = storeRef.current;
    if (!currentStore) {
      return {
        ok: false,
        reason: 'OUTSIDE_WINDOW',
        message: 'El módulo aún no está listo. Intenta nuevamente.',
        status: fallbackStatus,
      };
    }

    try {
      const { store: updated, result } = await storageSubmitMonthlyReport(currentStore);
      if (result.ok) {
        storeRef.current = updated;
        setState((prev) => ({ ...prev, store: updated }));
      }
      return result;
    } catch (err) {
      console.error('[FieldServiceContext] Error enviando informe mensual:', err);
      return {
        ok: false,
        reason: 'OUTSIDE_WINDOW',
        message: 'No se pudo enviar el informe mensual. Intenta nuevamente.',
        status: fallbackStatus,
      };
    }
  }, []);

  const value: FieldServiceContextValue = {
    ...state,
    saveDay: handleSaveDay,
    removeDay: handleRemoveDay,
    submitMonthlyReport: handleSubmitMonthlyReport,
    reload: hydrate,
  };

  return (
    <FieldServiceContext.Provider value={value}>
      {children}
    </FieldServiceContext.Provider>
  );
};

// ─── Hook de consumo ──────────────────────────────────────────────────────────

export function useFieldServiceContext(): FieldServiceContextValue {
  const ctx = useContext(FieldServiceContext);
  if (!ctx) {
    throw new Error(
      'useFieldServiceContext debe usarse dentro de un <FieldServiceProvider>'
    );
  }
  return ctx;
}
