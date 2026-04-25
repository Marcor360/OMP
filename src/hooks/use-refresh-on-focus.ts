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

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const refreshOnAppActiveRef = useRef(options?.refreshOnAppActive ?? true);
  refreshOnAppActiveRef.current = options?.refreshOnAppActive ?? true;
  const skipInitialFocusRef = useRef(options?.skipInitialFocus ?? true);
  skipInitialFocusRef.current = options?.skipInitialFocus ?? true;

  // Refresh on focus. By default skips first focus, configurable via options.
  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        if (skipInitialFocusRef.current) return;
      }

      if (!enabledRef.current) return;

      onRefreshRef.current();
      lastRefreshAt.current = Date.now();
    }, [])
  );

  // Optional refresh when app returns to foreground.
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next !== 'active') return;
      if (!enabledRef.current) return;
      if (!refreshOnAppActiveRef.current) return;

      const now = Date.now();
      if (now - lastRefreshAt.current < FOREGROUND_COOLDOWN_MS) return;

      onRefreshRef.current();
      lastRefreshAt.current = now;
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, []);
}
