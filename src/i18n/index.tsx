/**
 * Sistema de internacionalización (i18n) mínimo para OMP
 *
 * Soporta:
 * - Español (es) e Inglés (en)
 * - Persistencia en AsyncStorage
 * - Contexto React para acceso global
 * - Fallback a español si la traducción falta
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ar } from '@/src/i18n/locales/ar';
import { en } from '@/src/i18n/locales/en';
import { es } from '@/src/i18n/locales/es';
import { fr } from '@/src/i18n/locales/fr';
import { hi } from '@/src/i18n/locales/hi';
import { zh } from '@/src/i18n/locales/zh';
import { setActiveLocale } from '@/src/i18n/active-locale';

export type SupportedLanguage = 'es' | 'en' | 'fr' | 'ar' | 'hi' | 'zh';

const LANGUAGE_STORAGE_KEY = '@omp/language';
const LANGUAGE_ONBOARDING_STORAGE_KEY = '@omp/language-onboarding-complete';
const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

const translations = {
  es,
  en,
  fr,
  ar,
  hi,
  zh,
} as const;

// Translation keys are intentionally open while the project migrates
// hardcoded interface text into the locale files.
export type AppTranslationKey = string;

function getNestedValue<T extends object>(obj: T, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

export interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  hasCompletedLanguageOnboarding: boolean;
  completeLanguageOnboarding: () => Promise<void>;
  t: (key: AppTranslationKey, vars?: Record<string, string | number>) => string;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const isSupportedLanguage = (value: string | null): value is SupportedLanguage =>
  value === 'es' || value === 'en' || value === 'fr' || value === 'ar' || value === 'hi' || value === 'zh';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [hasCompletedLanguageOnboarding, setHasCompletedLanguageOnboarding] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setActiveLocale(language);
  }, [language]);

  useEffect(() => {
    let isMounted = true;

    const loadLanguage = async () => {
      try {
        const [storedLanguage, storedOnboardingState] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(LANGUAGE_ONBOARDING_STORAGE_KEY),
        ]);

        if (isMounted && isSupportedLanguage(storedLanguage)) {
          setLanguageState(storedLanguage);
        }

        if (isMounted) {
          // Migration: if an old install already has saved language, skip onboarding.
          const shouldSkipOnboarding =
            storedOnboardingState === '1' || isSupportedLanguage(storedLanguage);
          setHasCompletedLanguageOnboarding(shouldSkipOnboarding);
        }
      } catch {
        // Keep default language on error
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    loadLanguage();

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);

    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignore persistence errors, keep in-memory language
    }
  }, []);

  const completeLanguageOnboarding = useCallback(async () => {
    setHasCompletedLanguageOnboarding(true);

    try {
      await AsyncStorage.setItem(LANGUAGE_ONBOARDING_STORAGE_KEY, '1');
    } catch {
      // Ignore persistence errors, keep in-memory state
    }
  }, []);

  const t = useCallback(
    (key: AppTranslationKey, vars?: Record<string, string | number>): string => {
      // Pluralization: if vars.count is provided, try key + '_plural' first when count != 1
      const resolveKey = (k: string): string | undefined => {
        let value = (translations[language] as Record<string, unknown>)[k];
        if (value === undefined) {
          value = getNestedValue(translations[language], k);
        }
        if (typeof value === 'string') return value;

        // Fallback to English
        if (language !== 'en') {
          let fallback = (translations.en as Record<string, unknown>)[k];
          if (fallback === undefined) {
            fallback = getNestedValue(translations.en, k);
          }
          if (typeof fallback === 'string') return fallback;
        }
        return undefined;
      };

      let resolved: string | undefined;

      if (vars && typeof vars.count === 'number' && vars.count !== 1) {
        resolved = resolveKey(key + '_plural') ?? resolveKey(key);
      } else {
        resolved = resolveKey(key);
      }

      if (resolved === undefined) {
        return key;
      }

      // Interpolate {{variable}} placeholders
      if (vars) {
        resolved = resolved.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
          const val = vars[varName];
          return val !== undefined ? String(val) : `{{${varName}}}`;
        });
      }

      return resolved;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      hasCompletedLanguageOnboarding,
      completeLanguageOnboarding,
      t,
      isReady,
    }),
    [language, setLanguage, hasCompletedLanguageOnboarding, completeLanguageOnboarding, t, isReady]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n debe usarse dentro de I18nProvider');
  }

  return context;
}

export function useOptionalI18n() {
  return useContext(I18nContext);
}

export { es, en };
export type { EsTranslations } from '@/src/i18n/locales/es';
export type { EnTranslations } from '@/src/i18n/locales/en';
