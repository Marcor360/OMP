import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { resolveColorScheme, useOptionalAppTheme } from '@/src/context/theme-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const appTheme = useOptionalAppTheme();
  // En SSR el snapshot es estable y claro; React vuelve a leer el snapshot
  // cliente durante la hidratación sin sincronizar estado derivado en un effect.
  const hasHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  const colorScheme = useRNColorScheme();

  if (appTheme) {
    return appTheme.colorScheme;
  }

  if (hasHydrated) {
    return resolveColorScheme(colorScheme);
  }

  return 'light';
}
