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

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import {
  createAssignment,
  createCleaningGroupAssignment,
  getAssignmentById,
  updateAssignment,
} from '@/src/services/assignments/assignments-service';
import { getAllMeetings } from '@/src/services/meetings/meetings-service';
import { getAllUsers } from '@/src/services/users/users-service';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AssignmentPriority, UpdateAssignmentDTO } from '@/src/types/assignment';
import { Meeting } from '@/src/types/meeting';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';
type AssignmentTargetMode = 'person' | 'cleaningGroup';
type PersonAssignmentMode = 'user' | 'manual';

type FormErrors = {
  title?: string;
  dueDate?: string;
  meetingId?: string;
  assignedTo?: string;
  manualAssigneeName?: string;
  cleaningGroupId?: string;
};

const PRESET_ASSIGNMENT_TITLES = [
  'Limpieza general',
  'Hospitalidad',
  'Limpieza',
  'Capitan de predicacion',
] as const;

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const startOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const sameCalendarDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const formatDateLabel = (value: Date): string =>
  `${value.getDate()} ${MONTH_NAMES[value.getMonth()].toLowerCase()} ${value.getFullYear()}`;

const normalizeManualId = (value: string): string =>
  `manual:${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

const resolveCategoryFromTitle = (value: string): 'platform' | 'cleaning' | 'hospitality' | undefined => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('limpieza')) return 'cleaning';
  if (normalized.includes('hospitalidad')) return 'hospitality';
  return 'platform';
};

export function AssignmentFormScreen() {
  const { id, meetingId: meetingIdParam } = useLocalSearchParams<{ id?: string; meetingId?: string }>();
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const { user } = useAuth();
  const { appUser, congregationId, isAdminOrSupervisor, loadingProfile, profileError } = useUser();

  const mode: Mode = id ? 'edit' : 'create';
  const today = useMemo(() => startOfDay(new Date()), []);

  const [title, setTitle] = useState<string>(PRESET_ASSIGNMENT_TITLES[0]);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AssignmentPriority>('medium');
  const [targetMode, setTargetMode] = useState<AssignmentTargetMode>('person');
  const [personAssignmentMode, setPersonAssignmentMode] = useState<PersonAssignmentMode>('user');
  const [assignedToName, setAssignedToName] = useState('');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [manualAssigneeName, setManualAssigneeName] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<Date>(today);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cleaningGroupId, setCleaningGroupId] = useState('');
  const [cleaningGroups, setCleaningGroups] = useState<CleaningGroup[]>([]);

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
        const cleaningGroupsPromise =
          isAdminOrSupervisor
            ? getCleaningGroups(congregationId)
            : Promise.resolve<CleaningGroup[]>([]);
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

        const [meetingDocs, cleaningGroupDocs, usersDocs, assignmentDoc] = await Promise.all([
          meetingsPromise,
          cleaningGroupsPromise,
          usersPromise,
          assignmentPromise,
        ]);

        setMeetings(meetingDocs);
        setCleaningGroups(cleaningGroupDocs.filter((group) => group.isActive));
        const activeUsers = usersDocs.filter((item) => item.isActive);
        setUsers(activeUsers);

        if (mode === 'create') {
          if (meetingDocs[0]) {
            setMeetingId(meetingDocs[0].id);
          }
          if (cleaningGroupDocs[0]) {
            setCleaningGroupId(cleaningGroupDocs[0].id);
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
        if (assignmentDoc.assignedToUid?.startsWith('manual:')) {
          setPersonAssignmentMode('manual');
          setManualAssigneeName(assignmentDoc.assignedToName ?? '');
        }
        const parsedDueDate = assignmentDoc.dueDate?.toDate?.();
        const safeDueDate = parsedDueDate && parsedDueDate >= today ? startOfDay(parsedDueDate) : today;
        setSelectedDueDate(safeDueDate);
        setVisibleMonth(new Date(safeDueDate.getFullYear(), safeDueDate.getMonth(), 1));
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
    today,
    user?.uid,
  ]);

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      title: validateRequired(title, 'El titulo'),
      dueDate:
        selectedDueDate < today
          ? 'Selecciona una fecha de hoy en adelante.'
          : undefined,
      meetingId:
        targetMode === 'person'
          ? validateRequired(meetingId, 'La reunion')
          : undefined,
      assignedTo:
        mode === 'create' && targetMode === 'person' && personAssignmentMode === 'user'
          ? validateRequired(assignedToUid, 'La persona asignada')
          : undefined,
      manualAssigneeName:
        mode === 'create' && targetMode === 'person' && personAssignmentMode === 'manual'
          ? validateRequired(manualAssigneeName, 'El nombre manual')
          : undefined,
      cleaningGroupId:
        mode === 'create' && targetMode === 'cleaningGroup'
          ? validateRequired(cleaningGroupId, 'El grupo o familia de aseo')
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
      const dueDate = Timestamp.fromDate(selectedDueDate);
      const selectedCategory = resolveCategoryFromTitle(title);

      if (mode === 'create') {
        if (targetMode === 'cleaningGroup') {
          const selectedGroup = cleaningGroups.find((group) => group.id === cleaningGroupId);

          if (!selectedGroup) {
            Alert.alert('Error', 'Selecciona un grupo o familia de aseo.');
            setSaving(false);
            return;
          }

          await createCleaningGroupAssignment(
            congregationId,
            {
              title,
              description,
              priority,
              cleaningGroupId: selectedGroup.id,
              cleaningGroupName: selectedGroup.name,
              dueDate,
            },
            user?.uid ?? '',
            appUser?.displayName ?? user?.email ?? 'Sistema'
          );
        } else {
          const manualName = manualAssigneeName.trim();
          const finalAssignedToUid =
            personAssignmentMode === 'manual'
              ? normalizeManualId(manualName)
              : assignedToUid || (user?.uid ?? '');
          const finalAssignedToName =
            personAssignmentMode === 'manual'
              ? manualName
              : assignedToName || (appUser?.displayName ?? 'Sin asignar');

          await createAssignment(
            congregationId,
            meetingId,
            {
              title,
              description,
              priority,
              category: selectedCategory,
              assignedToUid: finalAssignedToUid,
              assignedToName: finalAssignedToName,
              dueDate,
              meetingId,
            },
            user?.uid ?? '',
            appUser?.displayName ?? user?.email ?? 'Sistema'
          );
        }

        Alert.alert('Exito', 'Asignacion creada correctamente.');
      } else if (id) {
        const payload: UpdateAssignmentDTO = {
          title,
          description,
          priority,
          dueDate,
          assignedToUid:
            personAssignmentMode === 'manual'
              ? normalizeManualId(manualAssigneeName)
              : assignedToUid,
          assignedToName:
            personAssignmentMode === 'manual'
              ? manualAssigneeName.trim()
              : assignedToName,
        };
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

  const canEditForm = isAdminOrSupervisor;
  const hasAssignableUsers = mode !== 'create' || users.length > 0;
  const hasCleaningGroups = mode !== 'create' || cleaningGroups.length > 0;
  const canSave =
    isAdminOrSupervisor &&
    (targetMode === 'cleaningGroup'
      ? hasCleaningGroups
      : meetings.length > 0 && (personAssignmentMode === 'manual' || hasAssignableUsers));
  const noMeetings = meetings.length === 0;
  const noAssignableUsers =
    mode === 'create' &&
    isAdminOrSupervisor &&
    users.length === 0 &&
    personAssignmentMode === 'user';
  const noCleaningGroups =
    mode === 'create' &&
    isAdminOrSupervisor &&
    targetMode === 'cleaningGroup' &&
    cleaningGroups.length === 0;
  const visibleMonthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const visibleMonthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const calendarLeadingBlanks = visibleMonthStart.getDay();
  const calendarDays = Array.from({ length: visibleMonthEnd.getDate() }, (_, index) => {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
    return startOfDay(date);
  });
  const canGoPreviousMonth =
    visibleMonth.getFullYear() > today.getFullYear() ||
    (visibleMonth.getFullYear() === today.getFullYear() &&
      visibleMonth.getMonth() > today.getMonth());

  const moveCalendarMonth = (offset: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      if (
        next.getFullYear() < today.getFullYear() ||
        (next.getFullYear() === today.getFullYear() && next.getMonth() < today.getMonth())
      ) {
        return current;
      }
      return next;
    });
  };

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva asignacion' : 'Editar asignacion'} showBack />
      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {targetMode === 'person' && noMeetings ? (
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

        {noCleaningGroups ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              Crea primero un grupo o familia de aseo para asignarle esta tarea.
            </ThemedText>
          </View>
        ) : null}

        {mode === 'create' ? (
          <Field label="Tipo de asignacion">
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, targetMode === 'person' && styles.chipActive]}
                onPress={() => setTargetMode('person')}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    targetMode === 'person' && styles.chipTextActive,
                  ]}
                >
                  Reunion / persona
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, targetMode === 'cleaningGroup' && styles.chipActive]}
                onPress={() => setTargetMode('cleaningGroup')}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    targetMode === 'cleaningGroup' && styles.chipTextActive,
                  ]}
                >
                  Aseo grupo/familia
                </ThemedText>
              </TouchableOpacity>
            </View>
          </Field>
        ) : null}

        <Field label="Titulo *" error={errors.title}>
          <View style={styles.chipRow}>
            {PRESET_ASSIGNMENT_TITLES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, title === item && styles.chipActive]}
                onPress={() => setTitle(item)}
                activeOpacity={0.8}
                disabled={!canEditForm}
              >
                <ThemedText style={[styles.chipText, title === item && styles.chipTextActive]}>
                  {item}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
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

        <Field label="Dia que toca *" error={errors.dueDate}>
          <View style={styles.calendarBox}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={[styles.calendarNavButton, !canGoPreviousMonth && styles.disabled]}
                onPress={() => moveCalendarMonth(-1)}
                disabled={!canGoPreviousMonth || !canEditForm}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
              <ThemedText style={styles.calendarTitle}>
                {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </ThemedText>
              <TouchableOpacity
                style={styles.calendarNavButton}
                onPress={() => moveCalendarMonth(1)}
                disabled={!canEditForm}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarGrid}>
              {WEEKDAY_LABELS.map((item) => (
                <ThemedText key={item} style={styles.weekdayText}>
                  {item}
                </ThemedText>
              ))}
              {Array.from({ length: calendarLeadingBlanks }).map((_, index) => (
                <View key={`blank-${index}`} style={styles.calendarDay} />
              ))}
              {calendarDays.map((date) => {
                const disabledDate = date < today;
                const selected = sameCalendarDay(date, selectedDueDate);

                return (
                  <TouchableOpacity
                    key={date.toISOString()}
                    style={[
                      styles.calendarDay,
                      selected && styles.calendarDaySelected,
                      disabledDate && styles.calendarDayDisabled,
                    ]}
                    onPress={() => setSelectedDueDate(date)}
                    disabled={disabledDate || !canEditForm}
                    activeOpacity={0.8}
                  >
                    <ThemedText
                      style={[
                        styles.calendarDayText,
                        selected && styles.calendarDayTextSelected,
                        disabledDate && styles.calendarDayTextDisabled,
                      ]}
                    >
                      {date.getDate()}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <ThemedText style={styles.hintText}>Seleccionado: {formatDateLabel(selectedDueDate)}</ThemedText>
        </Field>

        {targetMode === 'person' || mode === 'edit' ? (
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
        ) : (
          <Field label="Grupo o familia de aseo *" error={errors.cleaningGroupId}>
            <View style={styles.chipRow}>
              {cleaningGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.chip, cleaningGroupId === group.id && styles.chipActive]}
                  onPress={() => setCleaningGroupId(group.id)}
                  activeOpacity={0.8}
                  disabled={!canEditForm}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      cleaningGroupId === group.id && styles.chipTextActive,
                    ]}
                  >
                    {group.groupType === 'family' ? 'Familia: ' : 'Grupo: '}
                    {group.name}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            <ThemedText style={styles.hintText}>
              Se notificara a todos los integrantes del grupo seleccionado.
            </ThemedText>
          </Field>
        )}

        {mode === 'create' && isAdminOrSupervisor && targetMode === 'person' && (
          <Field label="Asignar a (usuarios de la congregacion)" error={errors.assignedTo}>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, personAssignmentMode === 'user' && styles.chipActive]}
                onPress={() => setPersonAssignmentMode('user')}
                activeOpacity={0.8}
                disabled={!canEditForm}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    personAssignmentMode === 'user' && styles.chipTextActive,
                  ]}
                >
                  Usuario
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, personAssignmentMode === 'manual' && styles.chipActive]}
                onPress={() => {
                  setPersonAssignmentMode('manual');
                  setIsUserDropdownOpen(false);
                }}
                activeOpacity={0.8}
                disabled={!canEditForm}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    personAssignmentMode === 'manual' && styles.chipTextActive,
                  ]}
                >
                  Manual
                </ThemedText>
              </TouchableOpacity>
            </View>

            {personAssignmentMode === 'manual' ? (
              <>
                <TextInput
                  style={[styles.input, errors.manualAssigneeName && styles.inputError]}
                  value={manualAssigneeName}
                  onChangeText={(value) => {
                    setManualAssigneeName(value);
                    setAssignedToName(value);
                    setAssignedToUid(value.trim() ? normalizeManualId(value) : '');
                  }}
                  placeholder="Nombre de la persona"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEditForm}
                />
                {errors.manualAssigneeName ? (
                  <ThemedText style={styles.errorText}>{errors.manualAssigneeName}</ThemedText>
                ) : null}
                <ThemedText style={styles.hintText}>
                  La opcion manual guarda el nombre en la asignacion; no envia push directo si no existe usuario.
                </ThemedText>
              </>
            ) : (
              <>
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
              </>
            )}
          </Field>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (saving || !canSave) && styles.disabled]}
          onPress={handleSave}
          disabled={saving || !canSave}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
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
    chipTextActive: { color: colors.onPrimary },
    calendarBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 10,
      gap: 10,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    calendarNavButton: {
      width: 34,
      height: 34,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
    },
    calendarTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    weekdayText: {
      width: 38,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    calendarDay: {
      width: 38,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    calendarDaySelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    calendarDayDisabled: {
      opacity: 0.35,
    },
    calendarDayText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    calendarDayTextSelected: {
      color: colors.onPrimary,
    },
    calendarDayTextDisabled: {
      color: colors.textDisabled,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    saveButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
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
