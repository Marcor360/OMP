import type { SupportedLanguage } from '@/src/i18n/index';

const LOCALE_TAGS: Record<SupportedLanguage, string> = {
  es: 'es-MX', // default locale
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar',
  hi: 'hi-IN',
  zh: 'zh-CN',
};

let activeLocale = LOCALE_TAGS.es;

export function getLocaleForLanguage(language: SupportedLanguage): string {
  return LOCALE_TAGS[language] ?? LOCALE_TAGS.es;
}

export function setActiveLocale(language: SupportedLanguage): void {
  activeLocale = getLocaleForLanguage(language);
}

export function getActiveLocale(): string {
  return activeLocale;
}
