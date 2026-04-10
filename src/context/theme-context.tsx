import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

const STORAGE_KEY = '@omp/theme-mode';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeModeContextValue {
  themeMode: ThemeMode;
  colorScheme: ResolvedTheme;
  isDarkMode: boolean;
  isReady: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleThemeMode: () => Promise<void>;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useSystemColorScheme();

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadThemeMode = async () => {
      try {
        const storedThemeMode = await AsyncStorage.getItem(STORAGE_KEY);

        if (isMounted && isThemeMode(storedThemeMode)) {
          setThemeModeState(storedThemeMode);
        }
      } catch {
        // Keep default mode when storage read fails.
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    loadThemeMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const colorScheme: ResolvedTheme =
    themeMode === 'system' ? (systemColorScheme ?? 'light') : themeMode;

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore persistence errors and keep in-memory theme mode.
    }
  }, []);

  const toggleThemeMode = useCallback(async () => {
    const nextMode: ThemeMode = colorScheme === 'dark' ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [colorScheme, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      colorScheme,
      isDarkMode: colorScheme === 'dark',
      isReady,
      setThemeMode,
      toggleThemeMode,
    }),
    [themeMode, colorScheme, isReady, setThemeMode, toggleThemeMode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de ThemeModeProvider');
  }

  return context;
}

export function useOptionalAppTheme() {
  return useContext(ThemeModeContext);
}