/**
 * Contexto del Módulo: Contador de Horas de Predicación.
 *
 * - Hidrata AsyncStorage al montarse y cada vez que cambia el uid autenticado
 *   (aislamiento por usuario en dispositivos compartidos, ver field-service-storage.ts).
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

import { useUser } from '@/src/context/user-context';
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
import { createLogger } from '@/src/utils/logger';

const log = createLogger('field-service-context');

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
  const { appUser } = useUser();
  const uid = appUser?.uid ?? null;

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

  /**
   * uid actualmente hidratado en storeRef/state. Se usa para que las
   * acciones (saveDay, removeDay, submitMonthlyReport) siempre escriban
   * bajo el namespace del usuario correcto, incluso si el uid cambia
   * mientras el provider sigue montado.
   */
  const hydratedUidRef = useRef<string | null>(null);
  const hydrationRequestRef = useRef(0);

  /** Carga el store desde AsyncStorage (namespaced por uid) y aplica auto-purge si corresponde */
  const hydrate = useCallback(async (targetUid: string) => {
    const requestId = ++hydrationRequestRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { store, purgeExecuted } = await loadStore(targetUid);
      if (requestId !== hydrationRequestRef.current) return;
      // Actualizar refs ANTES de setState para que cualquier acción
      // disparada sincrónicamente vea el store y el uid correctos desde ya.
      storeRef.current = store;
      hydratedUidRef.current = targetUid;
      setState({
        store,
        loading: false,
        error: null,
        purgeExecutedThisSession: purgeExecuted,
      });
    } catch (err) {
      if (requestId !== hydrationRequestRef.current) return;
      log.error('[FieldServiceContext] Error hidratando:', err);
      setState({
        store: null,
        loading: false,
        error: 'No se pudo cargar el contador de horas.',
        purgeExecutedThisSession: false,
      });
    }
  }, []);

  // Re-hidrata cada vez que cambia el uid autenticado (login/logout/switch de
  // usuario en el mismo dispositivo), y evita re-hidratar el mismo uid dos
  // veces (p. ej. doble efecto de React Strict Mode en desarrollo).
  useEffect(() => {
    if (uid === hydratedUidRef.current) return;

    if (!uid) {
      hydrationRequestRef.current += 1;
      hydratedUidRef.current = null;
      storeRef.current = null;
      setState({ store: null, loading: true, error: null, purgeExecutedThisSession: false });
      return;
    }

    void hydrate(uid);
  }, [uid, hydrate]);

  /** Guarda un día y actualiza el store en memoria (upsert) */
  const handleSaveDay = useCallback(
    async (input: SaveDayInput) => {
      const currentStore = storeRef.current;
      const currentUid = hydratedUidRef.current;
      if (!currentStore || !currentUid || currentUid !== uid) {
        log.warn('[FieldServiceContext] saveDay llamado antes de hidratación.');
        return;
      }
      try {
        const updated = await storageSaveDay(currentUid, currentStore, input);
        // Actualizar ref sincrónicamente PRIMERO
        storeRef.current = updated;
        setState((prev) => ({ ...prev, store: updated }));
      } catch (err) {
        log.error('[FieldServiceContext] Error guardando día:', err);
      }
    },
    [uid]
  );

  /** Elimina la entrada de un día y actualiza el store en memoria */
  const handleRemoveDay = useCallback(async (date: string) => {
    const currentStore = storeRef.current;
    const currentUid = hydratedUidRef.current;
    if (!currentStore || !currentUid || currentUid !== uid) {
      log.warn('[FieldServiceContext] removeDay llamado antes de hidratación.');
      return;
    }
    try {
      const updated = await storageRemoveDay(currentUid, currentStore, date);
      // Actualizar ref sincrónicamente PRIMERO
      storeRef.current = updated;
      setState((prev) => ({ ...prev, store: updated }));
    } catch (err) {
      log.error('[FieldServiceContext] Error eliminando día:', err);
    }
  }, [uid]);

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
    const currentUid = hydratedUidRef.current;
    if (!currentStore || !currentUid || currentUid !== uid) {
      return {
        ok: false,
        reason: 'OUTSIDE_WINDOW',
        message: 'El módulo aún no está listo. Intenta nuevamente.',
        status: fallbackStatus,
      };
    }

    try {
      const { store: updated, result } = await storageSubmitMonthlyReport(
        currentUid,
        currentStore
      );
      if (result.ok) {
        storeRef.current = updated;
        setState((prev) => ({ ...prev, store: updated }));
      }
      return result;
    } catch (err) {
      log.error('[FieldServiceContext] Error enviando informe mensual:', err);
      return {
        ok: false,
        reason: 'OUTSIDE_WINDOW',
        message: 'No se pudo enviar el informe mensual. Intenta nuevamente.',
        status: fallbackStatus,
      };
    }
  }, [uid]);

  const reload = useCallback(async () => {
    if (!uid) return;
    await hydrate(uid);
  }, [uid, hydrate]);

  const visibleState = hydratedUidRef.current === uid
    ? state
    : { store: null, loading: true, error: null, purgeExecutedThisSession: false };

  const value: FieldServiceContextValue = {
    ...visibleState,
    saveDay: handleSaveDay,
    removeDay: handleRemoveDay,
    submitMonthlyReport: handleSubmitMonthlyReport,
    reload,
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
