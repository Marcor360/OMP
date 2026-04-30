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

// Simplified translation key type for compatibility
export type AppTranslationKey =
  | 'common.loading' | 'common.error' | 'common.cancel' | 'common.save' | 'common.delete' | 'common.edit' | 'common.view' | 'common.close' | 'common.back' | 'common.confirm' | 'common.yes' | 'common.no'
  | 'tabs.home' | 'tabs.meetings' | 'tabs.assignments' | 'tabs.users' | 'tabs.cleaning' | 'tabs.profile' | 'tabs.settings'
  | 'settings.title'
  | 'settings.section.account' | 'settings.section.administration' | 'settings.section.organization' | 'settings.section.application' | 'settings.section.legal'
  | 'settings.section.devicePermissions'
  | 'settings.account.fullName' | 'settings.account.email' | 'settings.account.role'
  | 'settings.admin.userManagement' | 'settings.admin.meetingManagement' | 'settings.admin.assignmentManagement' | 'settings.admin.cleaningGroups' | 'settings.admin.hospitalityGroups' | 'settings.admin.notifications'
  | 'settings.organization.meetingCalendar' | 'settings.organization.myAssignments' | 'settings.organization.upcomingResponsibilities' | 'settings.organization.assignmentHistory'
  | 'settings.app.theme' | 'settings.app.language' | 'settings.app.version'
  | 'settings.legal.terms' | 'settings.legal.privacy' | 'settings.legal.about'
  | 'settings.screen.theme' | 'settings.screen.language' | 'settings.screen.about'
  | 'theme.title' | 'theme.option.system' | 'theme.option.light' | 'theme.option.dark' | 'theme.description'
  | 'language.title' | 'language.option.es' | 'language.option.en' | 'language.option.fr' | 'language.option.ar' | 'language.option.hi' | 'language.option.zh' | 'language.description' | 'language.info' | 'language.onboarding.title' | 'language.onboarding.subtitle' | 'language.onboarding.continue'
  | 'meetings.management.title' | 'meetings.management.subtitle' | 'meetings.management.loading' | 'meetings.management.noCongregation'
  | 'meetings.management.action.newWeekend' | 'meetings.management.action.newMidweek'
  | 'meetings.management.filter.all' | 'meetings.management.filter.draft' | 'meetings.management.filter.published'
  | 'meetings.management.row.view' | 'meetings.management.row.edit' | 'meetings.management.row.publish' | 'meetings.management.row.unpublish' | 'meetings.management.row.delete'
  | 'meetings.management.alert.validation' | 'meetings.management.alert.success' | 'meetings.management.alert.published' | 'meetings.management.alert.sentToDraft'
  | 'meetings.management.alert.deleteTitle' | 'meetings.management.alert.deleteMessage' | 'meetings.management.alert.deleted'
  | 'meetings.management.empty.title' | 'meetings.management.empty.description'
  | 'meetings.list.loading' | 'meetings.list.noCongregation' | 'meetings.list.publishedCount' | 'meetings.list.manage' | 'meetings.list.empty.title' | 'meetings.list.empty.description'
  | 'meeting.type.internal' | 'meeting.type.external' | 'meeting.type.review' | 'meeting.type.training' | 'meeting.type.midweek' | 'meeting.type.weekend'
  | 'meeting.status.pending' | 'meeting.status.scheduled' | 'meeting.status.in_progress' | 'meeting.status.completed' | 'meeting.status.cancelled'
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
  hasCompletedLanguageOnboarding: boolean;
  completeLanguageOnboarding: () => Promise<void>;
  t: (key: AppTranslationKey) => string;
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
    (key: AppTranslationKey): string => {
      let value = (translations[language] as any)[key];
      if (value === undefined) {
        value = getNestedValue(translations[language], key);
      }

      if (typeof value === 'string') {
        return value;
      }

      // Fallback to Spanish if translation missing in current language
      if (language !== 'es') {
        let fallbackValue = (translations.es as any)[key];
        if (fallbackValue === undefined) {
          fallbackValue = getNestedValue(translations.es, key);
        }
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
