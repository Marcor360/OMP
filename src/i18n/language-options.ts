import type { AppTranslationKey, SupportedLanguage } from '@/src/i18n/index';

export type LanguageOption = {
  code: SupportedLanguage;
  nativeName: string;
  labelKey: AppTranslationKey;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'es', nativeName: 'Espanol', labelKey: 'language.option.es' },
  { code: 'en', nativeName: 'English', labelKey: 'language.option.en' },
  { code: 'fr', nativeName: 'Francais', labelKey: 'language.option.fr' },
  { code: 'ar', nativeName: 'Arabic', labelKey: 'language.option.ar' },
  { code: 'hi', nativeName: 'Hindi', labelKey: 'language.option.hi' },
  { code: 'zh', nativeName: 'Mandarin Chinese', labelKey: 'language.option.zh' },
];

export const LANGUAGE_DISPLAY_NAME: Record<SupportedLanguage, string> = {
  es: 'Espanol',
  en: 'English',
  fr: 'Francais',
  ar: 'Arabic',
  hi: 'Hindi',
  zh: 'Mandarin Chinese',
};
