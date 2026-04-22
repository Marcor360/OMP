/**
 * Hook: useRefreshOnFocus
 *
 * Dispara un callback de refresco en dos situaciones:
 * 1. Cuando la pantalla recibe el foco (navegación entre tabs/pantallas).
 * 2. Cuando la app vuelve al primer plano (AppState 'active'), con un
 *    mínimo de FOREGROUND_COOLDOWN_MS entre refresco automáticos para
 *    no hacer lecturas excesivas a Firebase.
 *
 * Uso:
 *   useRefreshOnFocus(() => loadData(false));
 *
 * El refresco por foco usa forceServer=false (caché local de Firebase SDK primero).
 * El pull-to-refresh manual sigue usando forceServer=true para forzar la red.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Tiempo mínimo entre refrescos automáticos por foreground (2 minutos) */
const FOREGROUND_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * @param onRefresh - Función a llamar al enfocar o volver a primer plano.
 *                    Debe ser estable (useCallback) para evitar bucles.
 * @param enabled   - Si es false, no se dispara ningún refresco (por ejemplo
 *                    mientras hay una carga inicial en curso). Default: true.
 */
export function useRefreshOnFocus(
  onRefresh: () => void,
  enabled = true
): void {
  const lastRefreshAt = useRef<number>(0);
  const mountedRef = useRef(false);

  // ── Refresco por foco de pantalla ──────────────────────────────────────────
  // useFocusEffect se llama cada vez que esta pantalla recibe el foco.
  // No se llama en el primer render (se omite el montaje inicial para no
  // duplicar la carga que ya hace el useEffect de cada pantalla).
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      // Saltar el primer foco (montaje inicial — ya carga por su propio useEffect)
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }

      onRefresh();
      lastRefreshAt.current = Date.now();
    }, [enabled, onRefresh])
  );

  // ── Refresco por foreground (app vuelve de background) ────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;

      const now = Date.now();
      if (now - lastRefreshAt.current < FOREGROUND_COOLDOWN_MS) return;

      onRefresh();
      lastRefreshAt.current = now;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [enabled, onRefresh]);
}
