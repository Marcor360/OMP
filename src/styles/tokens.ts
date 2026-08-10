import type { TextStyle } from 'react-native';

/** Escala de espaciado. Todo padding/margin/gap debe salir de aqui. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Radios de esquina. `pill` para chips y badges. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Escala tipografica. Consumir con spread: `...Typography.rowTitle`. */
export const Typography = {
  screenTitle: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  rowTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  rowSubtitle: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  meta: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
} as const satisfies Record<string, TextStyle>;

/** Diametro de avatar por tamano. */
export const AvatarSize = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 88,
} as const;

/** Geometria compartida de listas. */
export const ListLayout = {
  /** Altura minima tactil de una fila (accesibilidad). */
  rowMinHeight: 56,
  /** Inset del separador hairline, alineado con el texto tras un avatar `md`. */
  separatorInset: Spacing.lg + AvatarSize.md + Spacing.md,
  /** Separacion vertical entre tarjetas. */
  cardGap: 10,
  contentPaddingHorizontal: Spacing.lg,
  contentPaddingBottom: Spacing.xxl,
} as const;

export const HitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
