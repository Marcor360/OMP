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

import { en } from '@/src/i18n/locales/en';
import { es } from '@/src/i18n/locales/es';

export type SupportedLanguage = 'es' | 'en';

const STORAGE_KEY = '@omp/language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'es';

const translations = {
  es,
  en,
} as const;

// Simplified translation key type for compatibility
export type AppTranslationKey =
  | 'common.loading' | 'common.error' | 'common.cancel' | 'common.save' | 'common.delete' | 'common.edit' | 'common.view' | 'common.close' | 'common.back' | 'common.confirm' | 'common.yes' | 'common.no'
  | 'settings.title'
  | 'settings.section.account' | 'settings.section.administration' | 'settings.section.organization' | 'settings.section.application' | 'settings.section.legal'
  | 'settings.account.fullName' | 'settings.account.email' | 'settings.account.role'
  | 'settings.admin.userManagement' | 'settings.admin.meetingManagement' | 'settings.admin.assignmentManagement' | 'settings.admin.cleaningGroups' | 'settings.admin.hospitalityGroups' | 'settings.admin.notifications'
  | 'settings.organization.meetingCalendar' | 'settings.organization.myAssignments' | 'settings.organization.upcomingResponsibilities' | 'settings.organization.assignmentHistory'
  | 'settings.app.theme' | 'settings.app.language' | 'settings.app.version'
  | 'settings.legal.terms' | 'settings.legal.privacy' | 'settings.legal.about'
  | 'theme.title' | 'theme.option.system' | 'theme.option.light' | 'theme.option.dark' | 'theme.description'
  | 'language.title' | 'language.option.es' | 'language.option.en' | 'language.description'
  | 'about.title' | 'about.description' | 'about.version' | 'about.build'
  | 'role.admin' | 'role.supervisor' | 'role.user'
  | 'permission.notifications.title' | 'permission.notifications.description' | 'permission.status.granted' | 'permission.status.denied' | 'permission.status.undetermined' | 'permission.status.unavailable' | 'permission.action.allow' | 'permission.action.openSettings'
  | 'operational.expired' | 'operational.current' | 'operational.upcoming' | 'operational.beyond';

function getNestedValue<T extends object>(obj: T, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: AppTranslationKey) => string;
  isReady: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const isSupportedLanguage = (value: string | null): value is SupportedLanguage =>
  value === 'es' || value === 'en';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLanguage = async () => {
      try {
        const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);

        if (isMounted && isSupportedLanguage(storedLanguage)) {
          setLanguageState(storedLanguage);
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
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore persistence errors, keep in-memory language
    }
  }, []);

  const t = useCallback(
    (key: AppTranslationKey): string => {
      const value = getNestedValue(translations[language], key);

      if (typeof value === 'string') {
        return value;
      }

      // Fallback to Spanish if translation missing in current language
      if (language !== 'es') {
        const fallbackValue = getNestedValue(translations.es, key);
        if (typeof fallbackValue === 'string') {
          return fallbackValue;
        }
      }

      // Return key as last resort
      return key;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      isReady,
    }),
    [language, setLanguage, t, isReady]
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
