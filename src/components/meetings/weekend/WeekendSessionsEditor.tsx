import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import {
  WeekendMeetingSessionDraft,
  WeekendSpeakerMode,
  createEmptyWeekendMeetingSession,
} from '@/src/services/meetings/weekend-meeting-adapter';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface WeekendSessionsEditorProps {
  sessions: WeekendMeetingSessionDraft[];
  users: ActiveCongregationUser[];
  disabled?: boolean;
  onChange: (sessions: WeekendMeetingSessionDraft[]) => void;
}

interface UserSelectFieldProps {
  label: string;
  valueUserId?: string;
  valueLabel?: string;
  users: ActiveCongregationUser[];
  disabled?: boolean;
  placeholder: string;
  onSelect: (user: ActiveCongregationUser) => void;
}

function UserSelectField({
  label,
  valueUserId,
  valueLabel,
  users,
  disabled,
  placeholder,
  onSelect,
}: UserSelectFieldProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [expanded, setExpanded] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.uid === valueUserId),
    [users, valueUserId]
  );

  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity
        style={styles.userButton}
        onPress={() => setExpanded((current) => !current)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <ThemedText style={styles.userButtonText} numberOfLines={1}>
          {selectedUser?.displayName ?? valueLabel ?? placeholder}
        </ThemedText>
        <Ionicons
          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.userListWrap}>
          {users.length === 0 ? (
            <ThemedText style={styles.emptyUsers}>No hay usuarios activos en esta congregacion.</ThemedText>
          ) : (
            <ScrollView nestedScrollEnabled style={styles.userList}>
              {users.map((user) => {
                const isSelected = user.uid === valueUserId;
                return (
                  <TouchableOpacity
                    key={user.uid}
                    style={[styles.userOption, isSelected && styles.userOptionSelected]}
                    onPress={() => {
                      onSelect(user);
                      setExpanded(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <ThemedText
                      style={[styles.userOptionText, isSelected && styles.userOptionTextSelected]}
                    >
                      {user.displayName}
                    </ThemedText>
                    {user.email ? <ThemedText style={styles.userOptionEmail}>{user.email}</ThemedText> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function WeekendSessionsEditor({
  sessions,
  users,
  disabled,
  onChange,
}: WeekendSessionsEditorProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const safeSessions =
    Array.isArray(sessions) && sessions.length > 0 ? sessions : [createEmptyWeekendMeetingSession(0)];

  const updateSession = (
    sessionId: string,
    updater: (session: WeekendMeetingSessionDraft) => WeekendMeetingSessionDraft
  ) => {
    onChange(
      safeSessions.map((session) => (session.id === sessionId ? updater(session) : session))
    );
  };

  const addSession = () => {
    onChange([...safeSessions, createEmptyWeekendMeetingSession(safeSessions.length)]);
  };

  const removeSession = (sessionId: string) => {
    if (safeSessions.length <= 1) return;
    onChange(safeSessions.filter((session) => session.id !== sessionId));
  };

  const setSpeakerMode = (
    session: WeekendMeetingSessionDraft,
    mode: WeekendSpeakerMode
  ): WeekendMeetingSessionDraft => {
    if (session.publicTalk.speaker.mode === mode) return session;

    return {
      ...session,
      publicTalk: {
        ...session.publicTalk,
        speaker: {
          ...session.publicTalk.speaker,
          mode,
          manualName: mode === 'manual' ? session.publicTalk.speaker.manualName : '',
          userId: mode === 'user' ? session.publicTalk.speaker.userId : '',
        },
      },
    };
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.title}>Sesion de fin de semana</ThemedText>
        <TouchableOpacity
          style={styles.addSessionButton}
          onPress={addSession}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Ionicons name="add-outline" size={15} color={colors.onPrimary} />
          <ThemedText style={styles.addSessionButtonText}>Agregar sesion</ThemedText>
        </TouchableOpacity>
      </View>

      {safeSessions.map((session, index) => (
        <View key={session.id} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <ThemedText style={styles.sessionTitle}>Sesion {index + 1}</ThemedText>
            {safeSessions.length > 1 ? (
              <TouchableOpacity
                style={styles.removeSessionButton}
                onPress={() => removeSession(session.id)}
                disabled={disabled}
              >
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <ThemedText style={styles.removeSessionText}>Quitar</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.blockTitle}>Discurso Publico</ThemedText>

            <View style={styles.fieldWrap}>
              <ThemedText style={styles.label}>Nombre del discurso *</ThemedText>
              <TextInput
                style={styles.input}
                value={session.publicTalk.discourseTitle}
                onChangeText={(nextValue) =>
                  updateSession(session.id, (current) => ({
                    ...current,
                    publicTalk: { ...current.publicTalk, discourseTitle: nextValue },
                  }))
                }
                editable={!disabled}
                placeholder="Nombre del discurso"
                placeholderTextColor={colors.textDisabled}
              />
            </View>

            <View style={styles.fieldWrap}>
              <ThemedText style={styles.label}>Quien lo dara *</ThemedText>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    session.publicTalk.speaker.mode === 'manual' && styles.modeChipActive,
                  ]}
                  onPress={() => updateSession(session.id, (current) => setSpeakerMode(current, 'manual'))}
                  disabled={disabled}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[
                      styles.modeText,
                      session.publicTalk.speaker.mode === 'manual' && styles.modeTextActive,
                    ]}
                  >
                    Manual
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    session.publicTalk.speaker.mode === 'user' && styles.modeChipActive,
                  ]}
                  onPress={() => updateSession(session.id, (current) => setSpeakerMode(current, 'user'))}
                  disabled={disabled}
                  activeOpacity={0.8}
                >
                  <ThemedText
                    style={[
                      styles.modeText,
                      session.publicTalk.speaker.mode === 'user' && styles.modeTextActive,
                    ]}
                  >
                    Usuario del sistema
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {session.publicTalk.speaker.mode === 'manual' ? (
              <View style={styles.fieldWrap}>
                <ThemedText style={styles.label}>Nombre manual *</ThemedText>
                <TextInput
                  style={styles.input}
                  value={session.publicTalk.speaker.manualName}
                  onChangeText={(nextValue) =>
                    updateSession(session.id, (current) => ({
                      ...current,
                      publicTalk: {
                        ...current.publicTalk,
                        speaker: {
                          ...current.publicTalk.speaker,
                          manualName: nextValue,
                          userId: '',
                          assigneeNameSnapshot: nextValue,
                        },
                      },
                    }))
                  }
                  editable={!disabled}
                  placeholder="Nombre del discursante"
                  placeholderTextColor={colors.textDisabled}
                />
              </View>
            ) : (
              <UserSelectField
                label="Usuario del sistema *"
                valueUserId={session.publicTalk.speaker.userId}
                valueLabel={session.publicTalk.speaker.assigneeNameSnapshot}
                users={users}
                disabled={disabled}
                placeholder="Seleccionar discursante"
                onSelect={(user) =>
                  updateSession(session.id, (current) => ({
                    ...current,
                    publicTalk: {
                      ...current.publicTalk,
                      speaker: {
                        ...current.publicTalk.speaker,
                        userId: user.uid,
                        manualName: '',
                        assigneeNameSnapshot: user.displayName,
                      },
                    },
                  }))
                }
              />
            )}
          </View>

          <View style={styles.block}>
            <ThemedText style={styles.blockTitle}>Estudio de La Atalaya</ThemedText>

            <View style={styles.fieldWrap}>
              <ThemedText style={styles.label}>Tema del estudio *</ThemedText>
              <TextInput
                style={styles.input}
                value={session.watchtowerStudy.theme}
                onChangeText={(nextValue) =>
                  updateSession(session.id, (current) => ({
                    ...current,
                    watchtowerStudy: { ...current.watchtowerStudy, theme: nextValue },
                  }))
                }
                editable={!disabled}
                placeholder="Tema del estudio"
                placeholderTextColor={colors.textDisabled}
              />
            </View>

            <UserSelectField
              label="Conductor *"
              valueUserId={session.watchtowerStudy.conductor.userId}
              valueLabel={session.watchtowerStudy.conductor.assigneeNameSnapshot}
              users={users}
              disabled={disabled}
              placeholder="Seleccionar conductor"
              onSelect={(user) =>
                updateSession(session.id, (current) => ({
                  ...current,
                  watchtowerStudy: {
                    ...current.watchtowerStudy,
                    conductor: {
                      ...current.watchtowerStudy.conductor,
                      userId: user.uid,
                      assigneeNameSnapshot: user.displayName,
                    },
                  },
                }))
              }
            />

            <UserSelectField
              label="Lector *"
              valueUserId={session.watchtowerStudy.reader.userId}
              valueLabel={session.watchtowerStudy.reader.assigneeNameSnapshot}
              users={users}
              disabled={disabled}
              placeholder="Seleccionar lector"
              onSelect={(user) =>
                updateSession(session.id, (current) => ({
                  ...current,
                  watchtowerStudy: {
                    ...current.watchtowerStudy,
                    reader: {
                      ...current.watchtowerStudy.reader,
                      userId: user.uid,
                      assigneeNameSnapshot: user.displayName,
                    },
                  },
                }))
              }
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: { gap: 12 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      flexWrap: 'wrap',
    },
    title: { fontSize: 16, fontWeight: '800', color: colors.textSecondary },
    addSessionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    addSessionButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
    sessionCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 12,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sessionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
    removeSessionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
    removeSessionText: { color: colors.error, fontSize: 12, fontWeight: '700' },
    block: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      padding: 10,
      gap: 10,
    },
    blockTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
    fieldWrap: { gap: 6 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      color: colors.textPrimary,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    modeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    modeChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    modeText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    modeTextActive: { color: colors.onPrimary },
    userButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    userButtonText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    userListWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    userList: { maxHeight: 220 },
    userOption: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    userOptionSelected: { backgroundColor: colors.primary + '22' },
    userOptionText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    userOptionTextSelected: { color: colors.primary },
    userOptionEmail: { fontSize: 12, color: colors.textMuted },
    emptyUsers: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: colors.textMuted },
  });
