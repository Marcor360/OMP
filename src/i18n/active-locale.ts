import type { SupportedLanguage } from '@/src/i18n/index';

const LOCALE_TAGS: Record<SupportedLanguage, string> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar',
  hi: 'hi-IN',
  zh: 'zh-CN',
};

let activeLocale = LOCALE_TAGS.es;

export function setActiveLocale(language: SupportedLanguage): void {
  activeLocale = LOCALE_TAGS[language] ?? LOCALE_TAGS.es;
}

export function getActiveLocale(): string {
  return activeLocale;
}
