import { en } from '@/src/i18n/locales/en';

export const hi = {
  ...en,
  common: {
    ...en.common,
    loading: 'Loading...',
  },
  settings: {
    ...en.settings,
    title: 'Settings',
  },
  'settings.app.language': 'Bhasha',
  'language.title': 'Bhasha',
  'language.option.es': 'Spanish',
  'language.option.en': 'English',
  'language.option.fr': 'French',
  'language.option.ar': 'Arabic',
  'language.option.hi': 'Hindi',
  'language.option.zh': 'Mandarin Chinese',
  'language.description': 'Select your preferred app language.',
  'language.info': 'Language updated.',
  'language.onboarding.title': 'Choose your language',
  'language.onboarding.subtitle':
    'Select the app language before continuing.',
  'language.onboarding.continue': 'Continue',
} as const;

export type HiTranslations = typeof hi;
