import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  PreachingReportFormValues,
  PreachingReportSubmission,
} from '@/src/types/preaching-report.types';
import { AppUser, isPioneer } from '@/src/types/user';

interface PreachingReportModalProps {
  visible: boolean;
  user: AppUser;
  monthName: string;
  congregationName: string;
  existingReport?: PreachingReportSubmission | null;
  suggestedMinutes?: number | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: PreachingReportFormValues) => Promise<void>;
}

const parseIntegerField = (value: string): number | null => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const parseHoursField = (value: string): number | null => {
  if (value.trim() === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
};

export function PreachingReportModal({
  visible,
  user,
  monthName,
  congregationName,
  existingReport,
  suggestedMinutes = null,
  saving = false,
  onClose,
  onSubmit,
}: PreachingReportModalProps) {
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const userIsPioneer = isPioneer(user);

  const [participated, setParticipated] = useState(existingReport?.participated ?? false);
  const [bibleStudies, setBibleStudies] = useState(String(existingReport?.bibleStudies ?? 0));
  const [returnVisits, setReturnVisits] = useState(String(existingReport?.returnVisits ?? 0));
  const [comments, setComments] = useState(existingReport?.comments ?? '');
  const [hours, setHours] = useState(String(existingReport?.hours ?? 0));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setParticipated(existingReport?.participated ?? false);
    setBibleStudies(String(existingReport?.bibleStudies ?? 0));
    setReturnVisits(String(existingReport?.returnVisits ?? 0));
    setComments(existingReport?.comments ?? '');
    setHours(String(existingReport?.hours ?? 0));
    setError(null);
  }, [existingReport, visible]);

  const handleSubmit = async () => {
    const normalizedBibleStudies = parseIntegerField(bibleStudies);
    const normalizedReturnVisits = parseIntegerField(returnVisits);
    const normalizedHours = parseHoursField(hours);

    if (normalizedBibleStudies === null) {
      setError(t('preachingReport.validationBibleStudies'));
      return;
    }

    if (normalizedReturnVisits === null) {
      setError(t('preachingReport.validationReturnVisits'));
      return;
    }

    if (userIsPioneer && normalizedHours === null) {
      setError(t('preachingReport.validationHours'));
      return;
    }

    setError(null);

    await onSubmit({
      participated,
      bibleStudies: normalizedBibleStudies,
      returnVisits: normalizedReturnVisits,
      comments,
      hours: userIsPioneer ? normalizedHours : null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <ThemedText style={styles.title}>{t('preachingReport.modalTitle')}</ThemedText>
              <ThemedText style={styles.subtitle}>{monthName}</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={t('preachingReport.closeModal')}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.metaBox}>
            <Ionicons name="home-outline" size={16} color={colors.textMuted} />
            <ThemedText style={styles.metaText} numberOfLines={1}>
              {congregationName}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setParticipated((value) => !value)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: participated }}
            accessibilityLabel={t('preachingReport.participated')}
          >
            <View style={[styles.checkbox, participated && styles.checkboxChecked]}>
              {participated ? (
                <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
              ) : null}
            </View>
            <ThemedText style={styles.checkboxLabel}>
              {t('preachingReport.participated')}
            </ThemedText>
          </TouchableOpacity>

          <Field label={t('preachingReport.bibleStudies')}>
            <TextInput
              style={styles.input}
              value={bibleStudies}
              onChangeText={setBibleStudies}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          <Field label={t('preachingReport.returnVisits')}>
            <TextInput
              style={styles.input}
              value={returnVisits}
              onChangeText={setReturnVisits}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          <Field label={t('preachingReport.comments')}>
            <TextInput
              style={[styles.input, styles.commentsInput]}
              value={comments}
              onChangeText={setComments}
              placeholder={t('preachingReport.optional')}
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={500}
            />
          </Field>

          {userIsPioneer ? (
            <Field label={t('preachingReport.totalHours')}>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textDisabled}
              />
              {typeof suggestedMinutes === 'number' && suggestedMinutes > 0 ? (
                <View style={styles.suggestionRow}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <ThemedText style={styles.suggestionText}>
                    {t('fieldService.counterSuggestion', {
                      hours: formatMinutes(suggestedMinutes),
                    })}
                  </ThemedText>
                  <TouchableOpacity
                    style={styles.useSuggestionButton}
                    onPress={() =>
                      setHours(String(Math.round((suggestedMinutes / 60) * 100) / 100))
                    }
                  >
                    <ThemedText style={styles.useSuggestionText}>
                      {t('fieldService.useSuggestedHours')}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              ) : null}
            </Field>
          ) : null}

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color={colors.onPrimary} />
                <ThemedText style={styles.submitButtonText}>
                  {t('preachingReport.submit')}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: 18,
    },
    modal: {
      backgroundColor: colors.backgroundLight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    metaBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
    },
    metaText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkboxLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
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
    commentsInput: {
      minHeight: 82,
      textAlignVertical: 'top',
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    suggestionText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    useSuggestionButton: {
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    useSuggestionText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '600',
    },
    submitButton: {
      minHeight: 48,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    submitButtonDisabled: {
      opacity: 0.65,
    },
    submitButtonText: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
  });
