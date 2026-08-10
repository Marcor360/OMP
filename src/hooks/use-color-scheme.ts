import { useColorScheme as useRNColorScheme } from 'react-native';

import { resolveColorScheme, useOptionalAppTheme } from '@/src/context/theme-context';

export function useColorScheme() {
  const appTheme = useOptionalAppTheme();
  const systemColorScheme = resolveColorScheme(useRNColorScheme());

  return appTheme?.colorScheme ?? systemColorScheme;
}
