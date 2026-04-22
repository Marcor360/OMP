import { en } from '@/src/i18n/locales/en';

export const fr = {
  ...en,
  common: {
    ...en.common,
    loading: 'Chargement...',
  },
  settings: {
    ...en.settings,
    title: 'Parametres',
  },
  'settings.app.language': 'Langue',
  'theme.title': 'Theme',
  'theme.option.light': 'Clair',
  'theme.option.dark': 'Sombre',
  'language.title': 'Langue',
  'language.option.es': 'Espagnol',
  'language.option.en': 'Anglais',
  'language.option.fr': 'Francais',
  'language.option.ar': 'Arabe',
  'language.option.hi': 'Hindi',
  'language.option.zh': 'Chinois mandarin',
  'language.description': "Selectionnez la langue de l'interface de l'application.",
  'language.info': 'La langue a ete mise a jour.',
  'language.onboarding.title': 'Choisissez votre langue',
  'language.onboarding.subtitle':
    "Selectionnez la langue de l'application avant de continuer.",
  'language.onboarding.continue': 'Continuer',
} as const;

export type FrTranslations = typeof fr;
