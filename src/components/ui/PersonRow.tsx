import React, { memo } from 'react';
import { ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/src/components/ui/Avatar';
import { ListRow } from '@/src/components/ui/ListRow';
import { useOptionalI18n } from '@/src/i18n/index';
import { HitSlop, useAppColors } from '@/src/styles';

type PersonSelection = 'none' | 'checked' | 'unchecked' | 'locked';

interface PersonRowProps {
  name: string;
  /** Segunda linea: email, departamento, rol de asignacion, estado. */
  subtitle?: string;
  /** Icono pequeno antes del subtitulo. */
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  /** Color de acento del avatar y del subtitulo cuando es un estado. */
  tone?: string;
  badges?: React.ReactNode;
  /** Estado de seleccion; renderiza el control derecho estandar. */
  selection?: PersonSelection;
  /** Accion destructiva a la derecha (quitar del grupo, etc.). */
  onRemove?: () => void;
  removing?: boolean;
  /** Navega al detalle; renderiza chevron si no hay selection ni onRemove. */
  onPress?: () => void;
  disabled?: boolean;
  dense?: boolean;
}

function PersonRowBase({
  name,
  subtitle,
  subtitleIcon,
  tone,
  badges,
  selection = 'none',
  onRemove,
  removing = false,
  onPress,
  disabled = false,
  dense = false,
}: PersonRowProps) {
  const colors = useAppColors();
  const i18n = useOptionalI18n();

  const meta = subtitleIcon ? (
    <Ionicons name={subtitleIcon} size={12} color={tone ?? colors.textMuted} />
  ) : null;

  let trailing: React.ReactNode = null;

  if (selection === 'checked') {
    trailing = <Ionicons name="checkbox" size={22} color={colors.primary} />;
  } else if (selection === 'unchecked') {
    trailing = <Ionicons name="square-outline" size={22} color={colors.textMuted} />;
  } else if (selection === 'locked') {
    trailing = <Ionicons name="lock-closed-outline" size={20} color={colors.textDisabled} />;
  } else if (onRemove) {
    trailing = removing ? (
      <ActivityIndicator size="small" color={colors.error} />
    ) : (
      <TouchableOpacity
        onPress={onRemove}
        hitSlop={HitSlop}
        accessibilityRole="button"
        accessibilityLabel={i18n?.t('common.removePersonA11y', { name }) ?? `Quitar a ${name}`}
      >
        <Ionicons name="remove-circle-outline" size={22} color={colors.error} />
      </TouchableOpacity>
    );
  } else if (onPress) {
    trailing = <Ionicons name="chevron-forward" size={20} color={colors.textDisabled} />;
  }

  const accessibilityState =
    selection === 'checked' || selection === 'unchecked'
      ? { checked: selection === 'checked' }
      : undefined;

  return (
    <ListRow
      leading={<Avatar name={name} tone={tone} size={dense ? 'sm' : 'md'} />}
      title={name}
      subtitle={subtitle}
      meta={meta}
      badges={badges}
      trailing={trailing}
      onPress={onPress}
      disabled={disabled}
      dense={dense}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={accessibilityState}
    />
  );
}

export const PersonRow = memo(PersonRowBase);
export type { PersonRowProps, PersonSelection };
