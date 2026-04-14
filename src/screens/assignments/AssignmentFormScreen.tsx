import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { priorityColor } from '@/src/components/common/StatusBadge';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { createAssignment, getAssignmentById, updateAssignment } from '@/src/services/assignments/assignments-service';
import { getAllMeetings } from '@/src/services/meetings/meetings-service';
import { getAllUsers } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AssignmentPriority, ASSIGNMENT_PRIORITY_LABELS, UpdateAssignmentDTO } from '@/src/types/assignment';
import { Meeting } from '@/src/types/meeting';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';

type FormErrors = {
  title?: string;
  meetingId?: string;
  assignedTo?: string;
};

export function AssignmentFormScreen() {
  const { id, meetingId: meetingIdParam } = useLocalSearchParams<{ id?: string; meetingId?: string }>();
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const { user } = useAuth();
  const { appUser, congregationId, isAdminOrSupervisor, loadingProfile, profileError } = useUser();

  const mode: Mode = id ? 'edit' : 'create';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AssignmentPriority>('medium');
  const [assignedToName, setAssignedToName] = useState('');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const meetingsPromise = getAllMeetings(congregationId);
        const usersPromise =
          isAdminOrSupervisor
            ? getAllUsers(congregationId, { forceServer: true })
            : Promise.resolve<AppUser[]>([]);
        const assignmentPromise =
          mode === 'edit' && id
            ? getAssignmentById(
                congregationId,
                id,
                typeof meetingIdParam === 'string' ? meetingIdParam : undefined
              )
            : Promise.resolve(null);

        const [meetingDocs, usersDocs, assignmentDoc] = await Promise.all([
          meetingsPromise,
          usersPromise,
          assignmentPromise,
        ]);

        setMeetings(meetingDocs);
        const activeUsers = usersDocs.filter((item) => item.isActive);
        setUsers(activeUsers);

        if (mode === 'create') {
          if (meetingDocs[0]) {
            setMeetingId(meetingDocs[0].id);
          }

          const defaultAssignee =
            activeUsers.find((item) => item.uid === user?.uid) ?? activeUsers[0] ?? null;

          if (defaultAssignee) {
            setAssignedToUid(defaultAssignee.uid);
            setAssignedToName(defaultAssignee.displayName);
            setUserSearch(defaultAssignee.displayName);
          } else {
            setAssignedToUid('');
            setAssignedToName(appUser?.displayName ?? '');
            setUserSearch('');
          }
          return;
        }

        if (!assignmentDoc) {
          Alert.alert('Error', 'No se encontro la asignacion.');
          router.back();
          return;
        }

        setTitle(assignmentDoc.title);
        setDescription(assignmentDoc.description ?? '');
        setPriority(assignmentDoc.priority);
        setAssignedToName(assignmentDoc.assignedToName);
        setAssignedToUid(assignmentDoc.assignedToUid);
        setUserSearch(assignmentDoc.assignedToName ?? '');
        setMeetingId(assignmentDoc.meetingId ?? '');
      } catch (requestError) {
        Alert.alert('Error', formatFirestoreError(requestError));
        router.back();
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [
    appUser?.displayName,
    congregationId,
    id,
    isAdminOrSupervisor,
    loadingProfile,
    meetingIdParam,
    mode,
    router,
    user?.uid,
  ]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      title: validateRequired(title, 'El titulo'),
      meetingId: validateRequired(meetingId, 'La reunion'),
      assignedTo:
        mode === 'create'
          ? validateRequired(assignedToUid, 'La persona asignada')
          : undefined,
    };

    setErrors(nextErrors);
    return !hasErrors(nextErrors as Record<string, string | undefined>);
  };

  const handleSave = async () => {
    if (!isAdminOrSupervisor) {
      Alert.alert('Permisos insuficientes', 'No tienes permisos para crear o editar asignaciones.');
      return;
    }

    if (!congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      const dueDate = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

      if (mode === 'create') {
        await createAssignment(
          congregationId,
          meetingId,
          {
            title,
            description,
            priority,
            assignedToUid: assignedToUid || (user?.uid ?? ''),
            assignedToName: assignedToName || (appUser?.displayName ?? 'Sin asignar'),
            dueDate,
            meetingId,
          },
          user?.uid ?? '',
          appUser?.displayName ?? user?.email ?? 'Sistema'
        );

        Alert.alert('Exito', 'Asignacion creada correctamente.');
      } else if (id) {
        const payload: UpdateAssignmentDTO = { title, description, priority };
        await updateAssignment(congregationId, meetingId, id, payload);
        Alert.alert('Exito', 'Asignacion actualizada.');
      }

      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const sortedMeetings = useMemo(
    () => [...meetings].sort((a, b) => b.startDate.seconds - a.startDate.seconds),
    [meetings]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;

    return users.filter((item) => {
      const name = item.displayName.toLowerCase();
      const email = item.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [userSearch, users]);

  const selectAssignee = (selectedUser: AppUser) => {
    setAssignedToUid(selectedUser.uid);
    setAssignedToName(selectedUser.displayName);
    setUserSearch(selectedUser.displayName);
    setIsUserDropdownOpen(false);
    setErrors((current) => ({ ...current, assignedTo: undefined }));
  };

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen((current) => {
      const next = !current;
      if (next) {
        setUserSearch('');
      }
      return next;
    });
  };

  if (loading || loadingProfile) return <LoadingState />;

  if (!isAdminOrSupervisor) {
    return (
      <ScreenContainer scrollable={false} padded={false}>
        <PageHeader title={mode === 'create' ? 'Nueva asignacion' : 'Editar asignacion'} showBack />
        <View style={styles.form}>
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              No tienes permisos para crear o editar asignaciones.
            </ThemedText>
            <ThemedText style={styles.hintText}>
              Esta accion solo esta disponible para administradores y supervisores.
            </ThemedText>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const priorities: AssignmentPriority[] = ['low', 'medium', 'high', 'critical'];
  const canEditForm = isAdminOrSupervisor;
  const hasAssignableUsers = mode !== 'create' || users.length > 0;
  const canSave = isAdminOrSupervisor && meetings.length > 0 && hasAssignableUsers;
  const noMeetings = meetings.length === 0;
  const noAssignableUsers = mode === 'create' && isAdminOrSupervisor && users.length === 0;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva asignacion' : 'Editar asignacion'} showBack />
      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {noMeetings ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              Debes tener al menos una reunion en tu congregacion para crear asignaciones.
            </ThemedText>
          </View>
        ) : null}

        {noAssignableUsers ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              No hay usuarios activos en tu congregacion para asignar.
            </ThemedText>
          </View>
        ) : null}

        <Field label="Titulo *" error={errors.title}>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Preparar informe mensual"
            placeholderTextColor={colors.textDisabled}
            editable={canEditForm}
          />
        </Field>

        <Field label="Descripcion">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalles de la tarea..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={4}
            editable={canEditForm}
          />
        </Field>

        <Field label="Reunion *" error={errors.meetingId}>
          <View style={styles.chipRow}>
            {sortedMeetings.map((meeting) => (
              <TouchableOpacity
                key={meeting.id}
                style={[styles.chip, meetingId === meeting.id && styles.chipActive]}
                onPress={() => setMeetingId(meeting.id)}
                activeOpacity={0.8}
                disabled={!canEditForm || mode === 'edit'}
              >
                <ThemedText style={[styles.chipText, meetingId === meeting.id && styles.chipTextActive]}>
                  {meeting.title}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          {mode === 'edit' ? <ThemedText style={styles.hintText}>La reunion vinculada no se puede cambiar.</ThemedText> : null}
        </Field>

        <Field label="Prioridad">
          <View style={styles.chipRow}>
            {priorities.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.chip,
                  priority === item && {
                    backgroundColor: priorityColor[item],
                    borderColor: priorityColor[item],
                  },
                ]}
                onPress={() => setPriority(item)}
                activeOpacity={0.8}
                disabled={!canEditForm}
              >
                <ThemedText style={[styles.chipText, priority === item && styles.chipTextActive]}>
                  {ASSIGNMENT_PRIORITY_LABELS[item]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {mode === 'create' && isAdminOrSupervisor && (
          <Field label="Asignar a (usuarios de la congregacion)" error={errors.assignedTo}>
            <TouchableOpacity
              style={[styles.selectTrigger, errors.assignedTo && styles.inputError]}
              onPress={toggleUserDropdown}
              activeOpacity={0.8}
              disabled={!canEditForm}
            >
              <ThemedText style={assignedToUid ? styles.selectTriggerText : styles.selectPlaceholderText}>
                {assignedToUid ? assignedToName : 'Seleccionar usuario'}
              </ThemedText>
              <Ionicons
                name={isUserDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {isUserDropdownOpen ? (
              <View style={styles.userDropdownPanel}>
                <TextInput
                  style={styles.input}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Escribe nombre o correo"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEditForm}
                />

                <ScrollView
                  style={styles.userDropdownList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredUsers.map((item, index) => {
                    const selected = assignedToUid === item.uid;
                    const isLast = index === filteredUsers.length - 1;
                    return (
                      <TouchableOpacity
                        key={item.uid}
                        style={[
                          styles.userItem,
                          selected && styles.userItemSelected,
                          isLast && styles.userItemLast,
                        ]}
                        onPress={() => selectAssignee(item)}
                        activeOpacity={0.8}
                        disabled={!canEditForm}
                      >
                        <View style={styles.userInfo}>
                          <ThemedText style={styles.userName}>{item.displayName}</ThemedText>
                          <ThemedText style={styles.userEmail}>{item.email}</ThemedText>
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {isUserDropdownOpen && users.length > 0 && filteredUsers.length === 0 ? (
              <ThemedText style={styles.hintText}>No hay coincidencias para tu busqueda.</ThemedText>
            ) : null}

            {assignedToUid ? (
              <ThemedText style={styles.hintText}>Seleccionado: {assignedToName}</ThemedText>
            ) : null}
          </Field>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (saving || !canSave) && styles.disabled]}
          onPress={handleSave}
          disabled={saving || !canSave}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {mode === 'create' ? 'Crear asignacion' : 'Guardar cambios'}
            </ThemedText>
          )}
        </TouchableOpacity>
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
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    form: { padding: 16, gap: 20, paddingBottom: 32 },
    fieldWrap: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    textarea: { minHeight: 96, textAlignVertical: 'top' },
    inputError: { borderColor: colors.error },
    errorText: { color: colors.error, fontSize: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    chipTextActive: { color: '#fff' },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
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
    hintText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    userList: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      overflow: 'hidden',
    },
    selectTrigger: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    selectTriggerText: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    selectPlaceholderText: {
      flex: 1,
      fontSize: 15,
      color: colors.textDisabled,
    },
    userDropdownPanel: {
      marginTop: 8,
      gap: 8,
    },
    userDropdownList: {
      maxHeight: 220,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userItemLast: {
      borderBottomWidth: 0,
    },
    userItemSelected: {
      backgroundColor: colors.primary + '14',
    },
    userInfo: {
      flex: 1,
      gap: 2,
    },
    userName: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    userEmail: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
