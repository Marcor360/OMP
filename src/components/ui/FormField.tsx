import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Spacing, Typography, useAppColors } from '@/src/styles';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

function FormFieldBase({ label, error, required = false, hint, children }: FormFieldProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>
        {label}
        {required ? <ThemedText style={styles.required}> *</ThemedText> : null}
      </ThemedText>
      {children}
      {error ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : hint ? (
        <ThemedText style={styles.hint}>{hint}</ThemedText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: Spacing.xs,
      marginBottom: Spacing.md,
    },
    label: {
      ...Typography.rowSubtitle,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    required: {
      color: colors.error,
    },
    hint: {
      ...Typography.meta,
      color: colors.textMuted,
    },
    error: {
      ...Typography.meta,
      color: colors.error,
    },
  });

export const FormField = memo(FormFieldBase);
export type { FormFieldProps };
