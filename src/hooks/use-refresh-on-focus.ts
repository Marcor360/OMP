/**
 * Hook: useRefreshOnFocus
 *
 * Calls a refresh callback when:
 * 1) The screen gets focus (tab/screen navigation).
 * 2) The app returns to foreground, if enabled.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Minimum time between automatic foreground refreshes (2 minutes). */
const FOREGROUND_COOLDOWN_MS = 2 * 60 * 1000;

interface UseRefreshOnFocusOptions {
  /** When false, do not refresh on app foreground. */
  refreshOnAppActive?: boolean;
  /** When false, refreshes on first focus too. */
  skipInitialFocus?: boolean;
}

/**
 * @param onRefresh Callback to execute on focus or foreground.
 * @param enabled When false, no automatic refresh is executed.
 * @param options Additional behavior flags.
 */
export function useRefreshOnFocus(
  onRefresh: () => void,
  enabled = true,
  options?: UseRefreshOnFocusOptions
): void {
  const lastRefreshAt = useRef<number>(0);
  const mountedRef = useRef(false);

  const refreshOnAppActive = options?.refreshOnAppActive ?? true;
  const skipInitialFocus = options?.skipInitialFocus ?? true;

  // Refresh on focus. By default skips first focus, configurable via options.
  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        if (skipInitialFocus) return;
      }

      if (!enabled) return;

      onRefresh();
      lastRefreshAt.current = Date.now();
    }, [enabled, onRefresh, skipInitialFocus])
  );

  // Optional refresh when app returns to foreground.
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (!enabled) return;
      if (!refreshOnAppActive) return;

      const now = Date.now();
      if (now - lastRefreshAt.current < FOREGROUND_COOLDOWN_MS) return;

      onRefresh();
      lastRefreshAt.current = now;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [enabled, onRefresh, refreshOnAppActive]);
}
