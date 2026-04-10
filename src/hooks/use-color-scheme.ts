import { useColorScheme as useRNColorScheme } from 'react-native';

import { useOptionalAppTheme } from '@/src/context/theme-context';

export function useColorScheme() {
  const appTheme = useOptionalAppTheme();
  const systemColorScheme = useRNColorScheme() ?? 'light';

  return appTheme?.colorScheme ?? systemColorScheme;
}
