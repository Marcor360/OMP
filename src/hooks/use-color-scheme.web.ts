import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useOptionalAppTheme } from '@/src/context/theme-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const appTheme = useOptionalAppTheme();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (appTheme) {
    return appTheme.colorScheme;
  }

  if (hasHydrated) {
    return colorScheme ?? 'light';
  }

  return 'light';
}
