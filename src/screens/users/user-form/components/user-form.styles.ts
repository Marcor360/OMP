import { StyleSheet } from 'react-native';

import type { AppColors as AppColorSet } from '@/src/styles';

export const createUserFormStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    form: {
      padding: 16,
      gap: 20,
      paddingBottom: 32,
    },
    fieldWrap: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingLeft: 12,
      paddingRight: 8,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    eyeButton: {
      padding: 6,
    },
    inputReadOnly: {
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textMuted,
    },
    copyInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingLeft: 12,
      paddingRight: 8,
    },
    copyInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textMuted,
    },
    copyButton: {
      padding: 6,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    roleRow: {
      flexDirection: 'row',
      gap: 8,
    },
    departmentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    assignmentList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    assignmentPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '14',
      borderRadius: 999,
      paddingLeft: 12,
      paddingRight: 6,
      paddingVertical: 6,
    },
    assignmentPillText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    assignmentRemove: {
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    departmentChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    departmentChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    departmentChipDisabled: {
      opacity: 0.45,
      backgroundColor: colors.surfaceRaised,
    },
    departmentChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    departmentChipTextActive: {
      color: colors.onPrimary,
    },
    departmentChipTextDisabled: {
      color: colors.textDisabled,
    },
    addAssignmentButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '12',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
    },
    addAssignmentButtonDisabled: {
      opacity: 0.45,
    },
    addAssignmentText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    roleChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    roleChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    roleChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    roleChipTextActive: {
      color: colors.onPrimary,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 16,
    },
    permissionNotice: {
      borderWidth: 1,
      borderColor: colors.warning + '66',
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
    },
    permissionText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '600',
    },
    permissionGroups: {
      gap: 12,
    },
    permissionGroup: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      backgroundColor: colors.surface,
    },
    permissionGroupTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    permissionSummary: {
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      backgroundColor: colors.primary + '10',
      borderRadius: 8,
      padding: 10,
    },
    permissionSummaryText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    planNotice: {
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
      borderRadius: 10,
      padding: 12,
      gap: 4,
    },
    planTitle: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
  });

export type UserFormStyles = ReturnType<typeof createUserFormStyles>;
