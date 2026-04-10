import { Appearance } from 'react-native';

import { BrandPalette } from '@/src/styles/palette';

const light = {
  primary: BrandPalette.primaryBlue,
  primaryDark: '#1D4ED8',
  primaryLight: '#3B82F6',

  secondary: '#374151',
  secondaryLight: '#4B5563',

  accent: '#60A5FA',

  backgroundDark: BrandPalette.lightBackground,
  backgroundMedium: '#EEF2FF',
  backgroundLight: BrandPalette.white,

  surface: BrandPalette.white,
  surfaceRaised: '#F3F4F6',
  surfaceBorder: '#E5E7EB',

  textPrimary: BrandPalette.darkGray,
  textSecondary: '#374151',
  textMuted: BrandPalette.mediumGray,
  textDisabled: '#9CA3AF',

  success: '#16A34A',
  successLight: '#DCFCE7',
  successDark: '#166534',

  warning: '#D97706',
  warningLight: '#FEF3C7',
  warningDark: '#92400E',

  error: '#DC2626',
  errorLight: '#FEE2E2',
  errorDark: '#991B1B',

  info: '#2563EB',
  infoLight: '#DBEAFE',
  infoDark: '#1E40AF',

  roleAdmin: '#1E40AF',
  roleSupervisor: '#0284C7',
  roleUser: '#16A34A',

  priorityLow: BrandPalette.mediumGray,
  priorityMedium: '#D97706',
  priorityHigh: '#DC2626',
  priorityCritical: '#7C3AED',

  border: '#E5E7EB',
  divider: '#E5E7EB',

  overlay: 'rgba(17, 24, 39, 0.55)',

  tabActive: BrandPalette.primaryBlue,
  tabInactive: BrandPalette.mediumGray,
  tabBar: BrandPalette.white,
} as const;

const dark = {
  primary: '#60A5FA',
  primaryDark: BrandPalette.primaryBlue,
  primaryLight: '#93C5FD',

  secondary: '#D1D5DB',
  secondaryLight: '#9CA3AF',

  accent: '#93C5FD',

  backgroundDark: '#030712',
  backgroundMedium: '#0B1220',
  backgroundLight: BrandPalette.darkGray,

  surface: BrandPalette.darkGray,
  surfaceRaised: '#1F2937',
  surfaceBorder: '#374151',

  textPrimary: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',

  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.2)',
  successDark: '#15803D',

  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.2)',
  warningDark: '#D97706',

  error: '#F87171',
  errorLight: 'rgba(248, 113, 113, 0.2)',
  errorDark: '#B91C1C',

  info: '#60A5FA',
  infoLight: 'rgba(96, 165, 250, 0.2)',
  infoDark: '#2563EB',

  roleAdmin: '#93C5FD',
  roleSupervisor: '#67E8F9',
  roleUser: '#86EFAC',

  priorityLow: '#9CA3AF',
  priorityMedium: '#F59E0B',
  priorityHigh: '#F87171',
  priorityCritical: '#A78BFA',

  border: '#374151',
  divider: '#1F2937',

  overlay: 'rgba(0, 0, 0, 0.7)',

  tabActive: '#93C5FD',
  tabInactive: '#6B7280',
  tabBar: '#0F172A',
} as const;

export const AppColorSchemes = {
  light,
  dark,
} as const;

export type AppColorSchemeName = keyof typeof AppColorSchemes;
export type AppColors = (typeof AppColorSchemes)[AppColorSchemeName];

export function getAppColors(scheme: AppColorSchemeName): AppColors {
  return AppColorSchemes[scheme];
}

const currentScheme = Appearance.getColorScheme() ?? 'light';
export const AppColors = getAppColors(currentScheme);

export type AppColor = keyof AppColors;