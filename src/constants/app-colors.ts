/** Paleta de colores centralizada para toda la app */
export const AppColors = {
  // Primarios
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#3b82f6',

  // Secundarios
  secondary: '#7c3aed',
  secondaryLight: '#8b5cf6',

  // Acento
  accent: '#0ea5e9',

  // Fondos
  backgroundDark: '#0f172a',
  backgroundMedium: '#1e293b',
  backgroundLight: '#334155',

  // Superficies (tarjetas, modales)
  surface: '#1e293b',
  surfaceRaised: '#263348',
  surfaceBorder: '#334155',

  // Texto
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  textDisabled: '#64748b',

  // Estados
  success: '#10b981',
  successLight: '#d1fae5',
  successDark: '#059669',

  warning: '#f59e0b',
  warningLight: '#fef3c7',
  warningDark: '#d97706',

  error: '#ef4444',
  errorLight: '#fee2e2',
  errorDark: '#dc2626',

  info: '#0ea5e9',
  infoLight: '#e0f2fe',
  infoDark: '#0284c7',

  // Roles
  roleAdmin: '#7c3aed',
  roleSupervisor: '#0ea5e9',
  roleUser: '#10b981',

  // Prioridades
  priorityLow: '#6b7280',
  priorityMedium: '#f59e0b',
  priorityHigh: '#ef4444',
  priorityCritical: '#7c3aed',

  // Bordes y separadores
  border: '#334155',
  divider: '#1e293b',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Tab bar
  tabActive: '#2563eb',
  tabInactive: '#64748b',
  tabBar: '#111827',
} as const;

export type AppColor = keyof typeof AppColors;
