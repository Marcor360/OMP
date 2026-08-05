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
import { DatePickerModal } from '@/src/components/forms/DatePickerModal';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import {
  createAssignment,
  createCleaningGroupAssignment,
  getAssignmentById,
  updateAssignment,
} from '@/src/services/assignments/assignments-service';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { getAllUsers } from '@/src/services/users/users-service';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import { getScheduledOutgoingTalksForWeek } from '@/src/modules/assignments/services/outgoing-talks.service';
import {
  OUTGOING_TALK_BLOCK_MESSAGE,
  getBlockedOutgoingTalkUserIds,
} from '@/src/modules/assignments/utils/outgoing-talks';
import { OutgoingTalk } from '@/src/modules/assignments/types/outgoing-talks.types';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AssignmentPriority, UpdateAssignmentDTO } from '@/src/types/assignment';
import { Meeting, MEETING_PUBLICATION_STATUS_LABELS } from '@/src/types/meeting';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { formatDateKey, parseDateKey } from '@/src/utils/dates/date-key';
import {
  getOperationalDateBounds,
  getOperationalWindow,
} from '@/src/utils/dates/operational-window';
import { canManageAssignments } from '@/src/utils/permissions/permissions';
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

const startOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

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
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const { t } = useI18n();
  const canManage = canManageAssignments(appUser);

  const mode: Mode = id ? 'edit' : 'create';
  const today = useMemo(() => startOfDay(new Date()), []);
  const operationalBounds = useMemo(() => getOperationalDateBounds(), []);

  const [title, setTitle] = useState<string>(PRESET_ASSIGNMENT_TITLES[0]);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AssignmentPriority>('medium');
  const [targetMode, setTargetMode] = useState<AssignmentTargetMode>('person');
  const [personAssignmentMode, setPersonAssignmentMode] = useState<PersonAssignmentMode>('user');
  const [assignedToName, setAssignedToName] = useState('');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [manualAssigneeName, setManualAssigneeName] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<Date>(today);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [outgoingTalks, setOutgoingTalks] = useState<OutgoingTalk[]>([]);
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
        const { start, end } = getOperationalWindow();
        const meetingsPromise = getMeetingsByWeek(congregationId, start, end, {
          includeMidweek: true,
          publicationStatus: 'all',
        });
        const cleaningGroupsPromise =
          canManage
            ? getCleaningGroups(congregationId)
            : Promise.resolve<CleaningGroup[]>([]);
        const usersPromise =
          canManage
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

        const assignableMeetings = meetingDocs.filter(
          (meeting) =>
            meeting.publicationStatus === 'awaiting_assignments' ||
            meeting.publicationStatus === 'published'
        );
        setMeetings(assignableMeetings);
        setCleaningGroups(cleaningGroupDocs.filter((group) => group.isActive));
        const activeUsers = usersDocs.filter((item) => item.isActive);
        setUsers(activeUsers);

        if (mode === 'create') {
          if (assignableMeetings[0]) {
            setMeetingId(assignableMeetings[0].id);
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
    canManage,
    loadingProfile,
    meetingIdParam,
    mode,
    router,
    today,
    user?.uid,
  ]);

  useEffect(() => {
    if (!congregationId) {
      setOutgoingTalks([]);
      return;
    }

    let cancelled = false;
    void getScheduledOutgoingTalksForWeek(congregationId, selectedDueDate)
      .then((items) => {
        if (!cancelled) setOutgoingTalks(items);
      })
      .catch(() => {
        if (!cancelled) setOutgoingTalks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, selectedDueDate]);

  const blockedOutgoingTalkUserIds = useMemo(
    () => getBlockedOutgoingTalkUserIds(selectedDueDate, outgoingTalks),
    [outgoingTalks, selectedDueDate]
  );

  const validate = (): boolean => {
    const nextErrors: FormErrors = {
      title: validateRequired(title, 'El titulo'),
      dueDate:
        selectedDueDate < today
          ? 'Selecciona una fecha de hoy en adelante.'
          : formatDateKey(selectedDueDate) > operationalBounds.maxDate
            ? t('assignments.errorDateOutOfWindow')
          : undefined,
      meetingId: validateRequired(meetingId, 'La reunion'),
      assignedTo:
        targetMode === 'person' && personAssignmentMode === 'user'
          ? validateRequired(assignedToUid, 'La persona asignada') ??
            (blockedOutgoingTalkUserIds.has(assignedToUid) ? OUTGOING_TALK_BLOCK_MESSAGE : undefined)
          : undefined,
      manualAssigneeName:
        mode === 'create' && targetMode === 'person' && personAssignmentMode === 'manual'
          ? validateRequired(manualAssigneeName, 'El nombre manual')
          : undefined,
      cleaningGroupId:
        mode === 'create' && targetMode === 'cleaningGroup'
          ? validateRequired(cleaningGroupId, 'El grupo o familia de aseo') ??
            (
              cleaningGroups
                .find((group) => group.id === cleaningGroupId)
                ?.memberIds.some((memberId) => blockedOutgoingTalkUserIds.has(memberId))
                ? OUTGOING_TALK_BLOCK_MESSAGE
                : undefined
            )
          : undefined,
    };

    setErrors(nextErrors);
    return !hasErrors(nextErrors as Record<string, string | undefined>);
  };

  const handleSave = async () => {
    if (!canManage) {
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
            meetingId,
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
    if (blockedOutgoingTalkUserIds.has(selectedUser.uid)) return;
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

  if (!canManage) {
    return (
      <ScreenContainer scrollable={false} padded={false}>
        <PageHeader title={mode === 'create' ? 'Nueva asignacion' : 'Editar asignacion'} showBack />
        <View style={styles.form}>
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              No tienes permisos para crear o editar asignaciones.
            </ThemedText>
            <ThemedText style={styles.hintText}>
              Esta accion solo esta disponible para quienes tienen permiso de asignaciones.
            </ThemedText>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const canEditForm = canManage;
  const hasAssignableUsers = mode !== 'create' || users.length > 0;
  const hasCleaningGroups = mode !== 'create' || cleaningGroups.length > 0;
  const canSave =
    canManage &&
    meetings.length > 0 &&
    (targetMode === 'cleaningGroup'
      ? hasCleaningGroups
      : meetings.length > 0 && (personAssignmentMode === 'manual' || hasAssignableUsers));
  const noMeetings = meetings.length === 0;
  const noAssignableUsers =
    mode === 'create' &&
    canManage &&
    users.length === 0 &&
    personAssignmentMode === 'user';
  const noCleaningGroups =
    mode === 'create' &&
    canManage &&
    targetMode === 'cleaningGroup' &&
    cleaningGroups.length === 0;
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
            <ThemedText style={styles.permissionText}>{t('assignments.noReadyMeetingsTitle')}</ThemedText>
            <ThemedText style={styles.hintText}>{t('assignments.noReadyMeetingsDescription')}</ThemedText>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => router.push('/(protected)/meetings/manage' as never)}
            >
              <ThemedText style={styles.chipText}>{t('assignments.goToMeetings')}</ThemedText>
            </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.selectTrigger}
            onPress={() => setDatePickerVisible(true)}
            disabled={!canEditForm}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.selectTriggerText}>
              {formatDateLabel(selectedDueDate)}
            </ThemedText>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.hintText}>Seleccionado: {formatDateLabel(selectedDueDate)}</ThemedText>
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
                    {meeting.title} · {MEETING_PUBLICATION_STATUS_LABELS[meeting.publicationStatus ?? 'draft']}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            {mode === 'edit' ? <ThemedText style={styles.hintText}>La reunion vinculada no se puede cambiar.</ThemedText> : null}
        </Field>

        {targetMode === 'cleaningGroup' && mode === 'create' ? (
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
        ) : null}

        {mode === 'create' && canManage && targetMode === 'person' && (
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
                    const isBlocked = blockedOutgoingTalkUserIds.has(item.uid);
                    return (
                      <TouchableOpacity
                        key={item.uid}
                        style={[
                          styles.userItem,
                          selected && styles.userItemSelected,
                          isBlocked && styles.userItemDisabled,
                          isLast && styles.userItemLast,
                        ]}
                        onPress={() => selectAssignee(item)}
                        activeOpacity={0.8}
                        disabled={!canEditForm || isBlocked}
                      >
                        <View style={styles.userInfo}>
                          <ThemedText style={[styles.userName, isBlocked && styles.userItemDisabledText]}>
                            {item.displayName}
                          </ThemedText>
                          <ThemedText style={styles.userEmail}>{item.email}</ThemedText>
                          {isBlocked ? (
                            <ThemedText style={styles.userBlockedText}>
                              {OUTGOING_TALK_BLOCK_MESSAGE}
                            </ThemedText>
                          ) : null}
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
      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={formatDateKey(selectedDueDate)}
        minDate={operationalBounds.minDate}
        maxDate={operationalBounds.maxDate}
        onSelectDate={(date) => {
          const parsedDate = parseDateKey(date);
          if (parsedDate) setSelectedDueDate(startOfDay(parsedDate));
        }}
        onClose={() => setDatePickerVisible(false)}
      />
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
    userItemDisabled: {
      opacity: 0.5,
    },
    userItemDisabledText: {
      color: colors.textDisabled,
    },
    userBlockedText: {
      fontSize: 11,
      color: colors.warning,
      fontWeight: '700',
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
