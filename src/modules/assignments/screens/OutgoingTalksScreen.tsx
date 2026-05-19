import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/src/i18n/index';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  cancelOutgoingTalkByManager,
  completeOutgoingTalkByManager,
  createOutgoingTalkByManager,
  subscribeToOutgoingTalks,
  updateOutgoingTalkByManager,
} from '@/src/modules/assignments/services/outgoing-talks.service';
import {
  OutgoingTalk,
  OutgoingTalkStatus,
} from '@/src/modules/assignments/types/outgoing-talks.types';
import {
  canBeOutgoingSpeaker,
  isWeekendDateKey,
  resolveOutgoingTalkWeekRange,
} from '@/src/modules/assignments/utils/outgoing-talks';
import { getAllUsers } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AppUser } from '@/src/types/user';
import { canManageOutgoingTalks } from '@/src/utils/permissions/permissions';

type FormErrors = {
  speakerUserId?: string;
  destinationCongregationName?: string;
  talkDate?: string;
  talkTime?: string;
  duplicate?: string;
};

const getStatusLabel = (status: OutgoingTalkStatus, t: any): string => {
  if (status === 'scheduled') return t('assignments.statusScheduled');
  if (status === 'cancelled') return t('assignments.statusCancelled');
  return t('assignments.statusCompleted');
};

const initialDate = (): string => {
  const next = new Date();
  const day = next.getDay();
  const offset = day === 0 ? 0 : day < 6 ? 6 - day : 0;
  next.setDate(next.getDate() + offset);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};

export function OutgoingTalksScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const { t } = useI18n();

  const [talks, setTalks] = useState<OutgoingTalk[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [speakerExpanded, setSpeakerExpanded] = useState(false);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [editingTalk, setEditingTalk] = useState<OutgoingTalk | null>(null);
  const [speakerUserId, setSpeakerUserId] = useState('');
  const [destinationCongregationName, setDestinationCongregationName] = useState('');
  const [talkDate, setTalkDate] = useState(initialDate);
  const [talkTime, setTalkTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<OutgoingTalkStatus>('scheduled');
  const [errors, setErrors] = useState<FormErrors>({});

  const canManage = canManageOutgoingTalks(appUser);

  useEffect(() => {
    if (loadingProfile) return;
    if (!congregationId || !canManage) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const unsubscribe = subscribeToOutgoingTalks(
      congregationId,
      (items) => {
        if (!cancelled) {
          setTalks(items);
          setLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setLoading(false);
        }
      }
    );

    void getAllUsers(congregationId, { forceServer: true })
      .then((items) => {
        if (!cancelled) {
          setUsers(items);
          setUsersError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setUsersError(t('assignments.errorLoadUsers'));
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [canManage, congregationId, loadingProfile]);

  const eligibleSpeakers = useMemo(
    () =>
      users.filter((user) => {
        const normalizedUser = {
          ...user,
          isElder: user.isElder === true || user.privileges?.isElder === true,
          isMinisterialServant:
            user.isMinisterialServant === true ||
            user.privileges?.isMinisterialServant === true,
        };
        return canBeOutgoingSpeaker(normalizedUser, congregationId ?? '');
      }),
    [congregationId, users]
  );

  const filteredEligibleSpeakers = useMemo(() => {
    const query = speakerSearch.trim().toLowerCase();
    if (!query) return eligibleSpeakers;

    return eligibleSpeakers.filter((user) => (
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    ));
  }, [eligibleSpeakers, speakerSearch]);

  const selectedSpeaker = useMemo(
    () => eligibleSpeakers.find((user) => user.uid === speakerUserId),
    [eligibleSpeakers, speakerUserId]
  );

  const resetForm = () => {
    setEditingTalk(null);
    setSpeakerUserId('');
    setDestinationCongregationName('');
    setTalkDate(initialDate());
    setTalkTime('10:00');
    setNotes('');
    setStatus('scheduled');
    setErrors({});
    setSpeakerExpanded(false);
    setSpeakerSearch('');
  };

  const startEdit = (talk: OutgoingTalk) => {
    setEditingTalk(talk);
    setSpeakerUserId(talk.speakerUserId);
    setDestinationCongregationName(talk.destinationCongregationName);
    setTalkDate(talk.talkDate);
    setTalkTime(talk.talkTime);
    setNotes(talk.notes ?? '');
    setStatus(talk.status);
    setErrors({});
    setSpeakerExpanded(false);
    setSpeakerSearch('');
  };

  const validate = (): boolean => {
    const selectedSpeaker = eligibleSpeakers.find((user) => user.uid === speakerUserId);
    const week = resolveOutgoingTalkWeekRange(talkDate);
    const duplicate = talks.some((talk) => (
      talk.id !== editingTalk?.id &&
      talk.status === 'scheduled' &&
      status === 'scheduled' &&
      talk.speakerUserId === speakerUserId &&
      talk.weekStartDate === week.weekStartDate
    ));

    const nextErrors: FormErrors = {
      speakerUserId: !speakerUserId
        ? t('assignments.errorSpeakerRequired')
        : !selectedSpeaker
          ? t('assignments.errorSpeakerRole')
          : undefined,
      destinationCongregationName:
        destinationCongregationName.trim().length === 0
          ? t('assignments.errorDestCongRequired')
          : undefined,
      talkDate:
        talkDate.trim().length === 0
          ? t('assignments.errorDateRequired')
          : !isWeekendDateKey(talkDate)
            ? t('assignments.errorDateWeekend')
            : undefined,
      talkTime: talkTime.trim().length === 0 ? t('assignments.errorTimeRequired') : undefined,
      duplicate: duplicate
        ? t('assignments.errorDuplicate')
        : undefined,
    };

    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSave = async () => {
    if (!congregationId || !canManage) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        congregationId,
        outgoingTalkId: editingTalk?.id,
        speakerUserId,
        destinationCongregationName: destinationCongregationName.trim(),
        talkDate,
        talkTime: talkTime.trim(),
        notes: notes.trim() || undefined,
        status,
      };

      if (editingTalk) {
        await updateOutgoingTalkByManager(payload);
        Alert.alert(t('common.success'), t('assignments.successUpdate'));
      } else {
        await createOutgoingTalkByManager(payload);
        Alert.alert(t('common.success'), t('assignments.successRegister'));
      }
      resetForm();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('assignments.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (talk: OutgoingTalk, nextStatus: 'cancelled' | 'completed') => {
    if (!congregationId || !canManage) return;
    try {
      const payload = {
        congregationId,
        outgoingTalkId: talk.id,
        speakerUserId: talk.speakerUserId,
        destinationCongregationName: talk.destinationCongregationName,
        talkDate: talk.talkDate,
        talkTime: talk.talkTime,
      };

      if (nextStatus === 'cancelled') {
        await cancelOutgoingTalkByManager(payload);
      } else {
        await completeOutgoingTalkByManager(payload);
      }
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('assignments.errorUpdate'));
    }
  };

  if (loadingProfile || loading) {
    return <LoadingState message={t('assignments.loadingOutgoing')} />;
  }

  if (!congregationId) {
    return <ErrorState message={profileError ?? t('assignments.noActiveCongregation')} />;
  }

  if (!canManage) {
    return (
      <ScreenContainer scrollable={false} padded={false}>
        <PageHeader title={t('assignments.outgoingTalksTitle')} showBack />
        <View style={styles.form}>
          <View style={styles.notice}>
            <ThemedText style={styles.noticeText}>
              {t('assignments.noPermissionManage')}
            </ThemedText>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('assignments.outgoingTalksTitle')} subtitle={t('assignments.assignmentsSubtitle')} showBack />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {editingTalk ? t('assignments.editOutgoingTalk') : t('assignments.registerOutgoingTalk')}
            </ThemedText>
            {editingTalk ? (
              <TouchableOpacity style={styles.iconButton} onPress={resetForm}>
                <Ionicons name="close-outline" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Field label={t('assignments.speakerLabel')} error={errors.speakerUserId}>
            <TouchableOpacity
              style={[styles.selectTrigger, errors.speakerUserId && styles.inputError]}
              onPress={() => {
                setSpeakerExpanded((current) => !current);
                setSpeakerSearch('');
              }}
              activeOpacity={0.8}
            >
              <ThemedText
                style={selectedSpeaker ? styles.selectText : styles.selectPlaceholder}
                numberOfLines={1}
              >
                {selectedSpeaker?.displayName ?? t('assignments.selectElderMs')}
              </ThemedText>
              <Ionicons
                name={speakerExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {speakerExpanded ? (
              <View style={styles.dropdown}>
                <TextInput
                  style={styles.input}
                  value={speakerSearch}
                  onChangeText={setSpeakerSearch}
                  placeholder={t('assignments.searchNameEmail')}
                  placeholderTextColor={colors.textDisabled}
                />
                <ScrollView
                  style={styles.dropdownList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredEligibleSpeakers.map((user) => {
                    const selected = speakerUserId === user.uid;
                    return (
                      <TouchableOpacity
                        key={user.uid}
                        style={[styles.userOption, selected && styles.userOptionSelected]}
                        onPress={() => {
                          setSpeakerUserId(user.uid);
                          setSpeakerExpanded(false);
                          setSpeakerSearch('');
                          setErrors((current) => ({ ...current, speakerUserId: undefined }));
                        }}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={[styles.userOptionName, selected && styles.userOptionNameSelected]}>
                          {user.displayName}
                        </ThemedText>
                        <ThemedText style={styles.userOptionEmail}>{user.email}</ThemedText>
                        <ThemedText style={styles.userOptionMeta}>
                          {user.isElder || user.privileges?.isElder
                            ? t('assignments.elder')
                            : t('assignments.ms')}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  {filteredEligibleSpeakers.length === 0 ? (
                    <ThemedText style={styles.emptyDropdownText}>
                      {t('assignments.noActiveEldersMs')}
                    </ThemedText>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            {usersError ? <ThemedText style={styles.errorText}>{usersError}</ThemedText> : null}
            {eligibleSpeakers.length === 0 && !usersError ? (
              <ThemedText style={styles.hintText}>
                {t('assignments.noEldersMsHint')}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.hintText}>
              {t('assignments.adminRoleHint')}
            </ThemedText>
          </Field>

          <Field label={t('assignments.destCongLabel')} error={errors.destinationCongregationName}>
            <TextInput
              style={[styles.input, errors.destinationCongregationName && styles.inputError]}
              value={destinationCongregationName}
              onChangeText={setDestinationCongregationName}
              placeholder={t('assignments.destCongPlaceholder')}
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          <View style={styles.row}>
            <View style={styles.col}>
              <Field label={t('assignments.dateLabel')} error={errors.talkDate}>
                <TextInput
                  style={[styles.input, errors.talkDate && styles.inputError]}
                  value={talkDate}
                  onChangeText={setTalkDate}
                  placeholder="2026-05-09"
                  placeholderTextColor={colors.textDisabled}
                />
              </Field>
            </View>
            <View style={styles.col}>
              <Field label={t('assignments.timeLabel')} error={errors.talkTime}>
                <TextInput
                  style={[styles.input, errors.talkTime && styles.inputError]}
                  value={talkTime}
                  onChangeText={setTalkTime}
                  placeholder="10:00"
                  placeholderTextColor={colors.textDisabled}
                />
              </Field>
            </View>
          </View>

          <Field label={t('assignments.notesLabel')}>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder={t('assignments.optional')}
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          {editingTalk ? (
            <Field label={t('assignments.statusLabel')}>
              <View style={styles.chips}>
                {(['scheduled', 'cancelled', 'completed'] as OutgoingTalkStatus[]).map((option) => {
                  const selected = status === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setStatus(option)}
                    >
                      <ThemedText style={[styles.chipText, selected && styles.chipTextActive]}>
                        {getStatusLabel(option, t)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>
          ) : null}

          {errors.duplicate ? <ThemedText style={styles.errorText}>{errors.duplicate}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <ThemedText style={styles.primaryText}>
                {editingTalk ? t('assignments.saveChanges') : t('assignments.registerOutgoingTalk')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('assignments.scheduledTalks')}</ThemedText>
          {talks.length === 0 ? (
            <ThemedText style={styles.hintText}>{t('assignments.noTalks')}</ThemedText>
          ) : (
            <View style={styles.list}>
              {talks.map((talk) => (
                <View key={talk.id} style={styles.talkCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardText}>
                      <ThemedText style={styles.cardTitle}>{talk.speakerName}</ThemedText>
                      <ThemedText style={styles.cardSubtitle}>
                        {talk.destinationCongregationName} - {talk.talkDate} {talk.talkTime}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.statusText}>{getStatusLabel(talk.status, t)}</ThemedText>
                  </View>
                  {talk.notes ? <ThemedText style={styles.hintText}>{talk.notes}</ThemedText> : null}
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => startEdit(talk)}>
                      <ThemedText style={styles.secondaryText}>{t('assignments.editBtn')}</ThemedText>
                    </TouchableOpacity>
                    {talk.status === 'scheduled' ? (
                      <>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => void updateStatus(talk, 'cancelled')}
                        >
                          <ThemedText style={styles.secondaryText}>{t('assignments.cancelBtn')}</ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => void updateStatus(talk, 'completed')}
                        >
                          <ThemedText style={styles.secondaryText}>{t('assignments.completeBtn')}</ThemedText>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    form: { padding: 16, gap: 14, paddingBottom: 32 },
    section: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 12,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '800' },
    field: { gap: 6 },
    label: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 9,
      fontSize: 14,
    },
    inputError: { borderColor: colors.error },
    textarea: { minHeight: 84, textAlignVertical: 'top' },
    selectTrigger: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectText: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    selectPlaceholder: { flex: 1, color: colors.textDisabled, fontSize: 14 },
    dropdown: { gap: 8 },
    dropdownList: {
      maxHeight: 240,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
    },
    userOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 2,
    },
    userOptionSelected: { backgroundColor: colors.primary + '20' },
    userOptionName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    userOptionNameSelected: { color: colors.primary },
    userOptionEmail: { color: colors.textMuted, fontSize: 12 },
    userOptionMeta: { color: colors.primary, fontSize: 11, fontWeight: '800' },
    emptyDropdownText: { padding: 12, color: colors.textMuted, fontSize: 12 },
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    chipTextActive: { color: colors.onPrimary },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      padding: 13,
      alignItems: 'center',
    },
    primaryText: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary + '66',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: colors.primary + '10',
    },
    secondaryText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.6 },
    hintText: { color: colors.textMuted, fontSize: 12 },
    errorText: { color: colors.error, fontSize: 12 },
    notice: {
      borderWidth: 1,
      borderColor: colors.warning + '66',
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
    },
    noticeText: { color: colors.warning, fontSize: 13, fontWeight: '700' },
    list: { gap: 10 },
    talkCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      padding: 10,
      gap: 10,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    cardText: { flex: 1, gap: 2 },
    cardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
    cardSubtitle: { color: colors.textMuted, fontSize: 12 },
    statusText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
