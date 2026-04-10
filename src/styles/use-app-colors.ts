import { getAppColors } from '@/src/styles/app-colors';
import { useColorScheme } from '@/src/hooks/use-color-scheme';

export function useAppColors() {
  const colorScheme = useColorScheme() ?? 'light';
  return getAppColors(colorScheme);
}