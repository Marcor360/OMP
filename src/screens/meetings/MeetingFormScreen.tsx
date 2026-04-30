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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { AssignmentCardEditorErrors } from '@/src/components/meetings/midweek/AssignmentCardEditor';
import { MidweekSectionEditor } from '@/src/components/meetings/midweek/MidweekSectionEditor';
import { WeekendSessionsEditor } from '@/src/components/meetings/weekend/WeekendSessionsEditor';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { useMeetingsManagementPermission } from '@/src/hooks/use-meetings-management-permission';
import { setMeetingPublicationStatus } from '@/src/services/meetings/meeting-publish-service';
import { syncMeetingCleaningAssignmentsByManager } from '@/src/services/meetings/manager-meetings-service';
import {
  buildMeetingProgramFromMeeting,
  validateMeetingBeforePublish,
} from '@/src/services/meetings/meeting-program-utils';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import {
  WeekendMeetingSessionDraft,
  buildWeekendSectionsFromSessions,
  createEmptyWeekendMeetingSession,
  extractWeekendSessionsFromSections,
  validateWeekendSessionsForPublish,
} from '@/src/services/meetings/weekend-meeting-adapter';
import { resolveMeetingTemplate } from '@/src/services/meetings/meeting-template';
import {
  createMeeting,
  getMeetingById,
  updateMeeting,
} from '@/src/services/meetings/meetings-service';
import {
  ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingCleaningAssignmentMode,
  MeetingStatus,
  MEETING_STATUS_LABELS,
  MEETING_TYPE_LABELS,
  UpdateMeetingDTO,
} from '@/src/types/meeting';
import {
  MeetingProgramAssignment,
  MeetingProgramSection,
  MeetingProgramType,
  createDefaultSectionsForMeetingType,
  moveMeetingSection,
} from '@/src/types/meeting/program';
import {
  MidweekAssignment,
  MidweekMeetingSection,
  ParticipantAssignment,
} from '@/src/types/midweek-meeting';
import { formatWeekLabel, getWeekStart, moveWeek } from '@/src/utils/dates/week-range';
import { formatFirestoreError } from '@/src/utils/errors/errors';

type Mode = 'create' | 'edit';
type SaveIntent = 'draft' | 'published';
type WeekendMeetingDay = 'saturday' | 'sunday';
type MidweekMeetingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
type CleaningSelectionMode = MeetingCleaningAssignmentMode;

interface MeetingFormErrors {
  title?: string;
}

interface MarkerState {
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

const STATUS_OPTIONS: MeetingStatus[] = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const TYPE_OPTIONS: MeetingProgramType[] = ['midweek', 'weekend'];

const DEFAULT_TITLE_BY_TYPE: Record<MeetingProgramType, string> = {
  midweek: 'Reunion Vida y Ministerio Cristianos',
  weekend: 'Reunion del fin de semana',
};

const WEEKEND_MEETING_DAY_LABELS: Record<WeekendMeetingDay, string> = {
  saturday: 'Sabado',
  sunday: 'Domingo',
};

const MIDWEEK_MEETING_DAY_LABELS: Record<MidweekMeetingDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
};

const MIDWEEK_MEETING_DAY_OPTIONS: { value: MidweekMeetingDay; offset: number }[] = [
  { value: 'monday', offset: 0 },
  { value: 'tuesday', offset: 1 },
  { value: 'wednesday', offset: 2 },
  { value: 'thursday', offset: 3 },
  { value: 'friday', offset: 4 },
];

const pad = (value: number): string => String(value).padStart(2, '0');

const formatDateInput = (value: Date): string => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const normalizeText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeUrl = (value: string): string | undefined => {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const toDateFromDateLike = (value?: Timestamp | Date): Date => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const isSameCalendarDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const inferWeekendMeetingDay = (
  meetingDate: Date,
  range: { startDate: Date; endDate: Date }
): WeekendMeetingDay => {
  if (isSameCalendarDay(meetingDate, range.endDate) || meetingDate.getDay() === 0) {
    return 'sunday';
  }

  return 'saturday';
};

const inferMidweekMeetingDay = (
  meetingDate: Date,
  range: { startDate: Date }
): MidweekMeetingDay => {
  const meetingDateStart = new Date(meetingDate);
  meetingDateStart.setHours(0, 0, 0, 0);

  const rangeStart = new Date(range.startDate);
  rangeStart.setHours(0, 0, 0, 0);

  const millisPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((meetingDateStart.getTime() - rangeStart.getTime()) / millisPerDay);
  const normalizedOffset = Math.min(4, Math.max(0, diffDays));

  const option = MIDWEEK_MEETING_DAY_OPTIONS.find((item) => item.offset === normalizedOffset);
  return option?.value ?? 'monday';
};

const sectionMarkerMap = (section: MeetingProgramSection): Map<string, MarkerState> => {
  const map = new Map<string, MarkerState>();
  section.assignments.forEach((assignment) => {
    assignment.assignees.forEach((assignee) => {
      map.set(`${assignment.assignmentKey}::${assignee.id}`, {
        publishNotificationSentAt: assignee.publishNotificationSentAt,
        reminderSentAt: assignee.reminderSentAt,
      });
    });
  });
  return map;
};

const programAssignmentToEditorAssignment = (assignment: MeetingProgramAssignment): MidweekAssignment => ({
  id: assignment.assignmentKey,
  sectionId: assignment.sectionKey as MidweekAssignment['sectionId'],
  order: 0,
  title: assignment.title,
  theme: assignment.roleLabel,
  durationMinutes: assignment.durationMinutes,
  notes: undefined,
  roomKey: undefined,
  startTime: undefined,
  endTime: undefined,
  assignmentScope: assignment.assignmentScope,
  participants: assignment.assignees.map((assignee) => {
    if (assignee.assigneeType === 'registeredUser') {
      return {
        id: assignee.id,
        mode: 'user',
        userId: assignee.assigneeUserId,
        displayName: assignee.assigneeNameSnapshot ?? '',
        specialRoleKey: undefined,
        roleLabel: undefined,
        gender: undefined,
        isAssistant: false,
      } as ParticipantAssignment;
    }

    return {
      id: assignee.id,
      mode: 'manual',
      userId: undefined,
      displayName: assignee.assigneeNameSnapshot ?? '',
      specialRoleKey: undefined,
      roleLabel: undefined,
      gender: undefined,
      isAssistant: false,
    } as ParticipantAssignment;
  }),
  isOptional: false,
  assignmentType: undefined,
  allowCircuitOverseerOption: false,
});

const programSectionToEditorSection = (section: MeetingProgramSection): MidweekMeetingSection => ({
  id: section.sectionKey as MidweekMeetingSection['id'],
  title: section.title,
  order: section.order,
  sectionType: section.sectionType,
  isRequired: section.isRequired,
  isEnabled: section.isEnabled,
  colorToken: section.colorToken,
  items: section.assignments.map((assignment, index) => ({
    ...programAssignmentToEditorAssignment(assignment),
    order: index,
  })),
});
const editorParticipantToProgramAssignee = (
  participant: ParticipantAssignment,
  assignmentKey: string,
  markers: Map<string, MarkerState>
): MeetingProgramAssignment['assignees'][number] => {
  const marker = markers.get(`${assignmentKey}::${participant.id}`);

  if (participant.mode === 'user') {
    return {
      id: participant.id,
      assigneeType: 'registeredUser',
      assigneeUserId: normalizeText(participant.userId ?? ''),
      assigneeNameSnapshot: normalizeText(participant.displayName),
      specialRoleKey: undefined,
      publishNotificationSentAt: marker?.publishNotificationSentAt,
      reminderSentAt: marker?.reminderSentAt,
    };
  }

  return {
    id: participant.id,
    assigneeType: 'informational',
    assigneeUserId: undefined,
    assigneeNameSnapshot: normalizeText(participant.displayName),
    specialRoleKey: undefined,
    publishNotificationSentAt: marker?.publishNotificationSentAt,
    reminderSentAt: marker?.reminderSentAt,
  };
};

const editorSectionToProgramSection = (
  editorSection: MidweekMeetingSection,
  currentSection: MeetingProgramSection
): MeetingProgramSection => {
  const markers = sectionMarkerMap(currentSection);

  return {
    sectionKey: currentSection.sectionKey,
    title: editorSection.title,
    order: currentSection.order,
    sectionType: currentSection.sectionType,
    isRequired: currentSection.isRequired,
    isEnabled: editorSection.isEnabled !== false,
    colorToken: currentSection.colorToken,
    assignments: editorSection.items.map((assignment, index) => {
      const participants =
        editorSection.id === 'livingAsChristians'
          ? assignment.participants.slice(0, 2)
          : assignment.participants;

      return {
        assignmentKey: assignment.id,
        sectionKey: currentSection.sectionKey,
        title: assignment.title,
        roleLabel: normalizeText(assignment.theme ?? ''),
        assignmentScope: assignment.assignmentScope ?? 'internal',
        assignees: participants.map((participant) =>
          editorParticipantToProgramAssignee(participant, assignment.id, markers)
        ),
        roomKey: undefined,
        startTime: undefined,
        endTime: undefined,
        durationMinutes: assignment.durationMinutes,
        allowCircuitOverseerOption: false,
        notes: undefined,
      };
    }),
  };
};

const inferProgramTypeFromMeeting = (meeting: Meeting): MeetingProgramType =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

export function MeetingFormScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id?: string; type?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { appUser } = useUser();
  const { canManage, congregationId, uid, loading: loadingPermissions } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const mode: Mode = id ? 'edit' : 'create';
  const initialType: MeetingProgramType = typeParam === 'midweek' ? 'midweek' : 'weekend';
  const initialWeekStart = getWeekStart(new Date());

  const [title, setTitle] = useState(DEFAULT_TITLE_BY_TYPE[initialType]);
  const [description, setDescription] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingProgramType>(initialType);
  const [weekendMeetingDay, setWeekendMeetingDay] = useState<WeekendMeetingDay>(
    'sunday'
  );
  const [midweekMeetingDay, setMidweekMeetingDay] = useState<MidweekMeetingDay>(
    'monday'
  );
  const [status, setStatus] = useState<MeetingStatus>('scheduled');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(initialWeekStart);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [sections, setSections] = useState<MeetingProgramSection[]>(() =>
    createDefaultSectionsForMeetingType(initialType)
  );
  const [weekendSessions, setWeekendSessions] = useState<WeekendMeetingSessionDraft[]>(() =>
    initialType === 'weekend'
      ? extractWeekendSessionsFromSections(createDefaultSectionsForMeetingType('weekend'))
      : [createEmptyWeekendMeetingSession(0)]
  );
  const [availableUsers, setAvailableUsers] = useState<ActiveCongregationUser[]>([]);
  const [cleaningGroups, setCleaningGroups] = useState<CleaningGroup[]>([]);
  const [cleaningSelectionMode, setCleaningSelectionMode] = useState<CleaningSelectionMode>('none');
  const [selectedCleaningGroupIds, setSelectedCleaningGroupIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<MeetingFormErrors>({});
  const [midweekAssignmentErrors, setMidweekAssignmentErrors] = useState<
    Record<string, AssignmentCardEditorErrors>
  >({});
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [savingIntent, setSavingIntent] = useState<SaveIntent | null>(null);

  useEffect(() => {
    if (loadingPermissions) return;
    if (!canManage || !congregationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(mode === 'edit');

        const usersPromise = getActiveCongregationUsers(congregationId);
        const cleaningGroupsPromise = getCleaningGroups(congregationId);
        const meetingPromise = mode === 'edit' && id ? getMeetingById(congregationId, id) : Promise.resolve(null);
        const [users, loadedCleaningGroups, meeting] = await Promise.all([
          usersPromise,
          cleaningGroupsPromise,
          meetingPromise,
        ]);

        if (cancelled) return;
        setAvailableUsers(users);
        setCleaningGroups(loadedCleaningGroups.filter((group) => group.isActive));

        if (meeting && mode === 'edit') {
          setTitle(meeting.title);
          setDescription(meeting.description ?? '');
          const inferredMeetingType = inferProgramTypeFromMeeting(meeting);
          setMeetingType(inferredMeetingType);
          setStatus(meeting.status);
          const parsedStart = toDateFromDateLike(meeting.startDate);
          const parsedWeekStart = getWeekStart(parsedStart);
          setSelectedWeekStart(parsedWeekStart);

          if (inferredMeetingType === 'weekend') {
            const weekendRange = resolveMeetingTemplate('weekend').getMeetingDateRange(parsedWeekStart);
            const parsedMeetingDate = toDateFromDateLike(meeting.meetingDate ?? meeting.startDate);
            setWeekendMeetingDay(inferWeekendMeetingDay(parsedMeetingDate, weekendRange));
          } else {
            const midweekRange = resolveMeetingTemplate('midweek').getMeetingDateRange(parsedWeekStart);
            const parsedMeetingDate = toDateFromDateLike(meeting.meetingDate ?? meeting.startDate);
            setMidweekMeetingDay(inferMidweekMeetingDay(parsedMeetingDate, midweekRange));
          }

          setLocation(meeting.location ?? '');
          setMeetingUrl(meeting.meetingUrl ?? '');
          setNotes(meeting.notes ?? '');
          setCleaningSelectionMode(meeting.cleaningAssignmentMode ?? 'none');
          setSelectedCleaningGroupIds(meeting.cleaningGroupIds ?? []);
          const normalizedSections = buildMeetingProgramFromMeeting(meeting);
          setSections(normalizedSections);
          setWeekendSessions(extractWeekendSessionsFromSections(normalizedSections));
        }
      } catch (requestError) {
        if (!cancelled) {
          Alert.alert('Error', formatFirestoreError(requestError));
          router.back();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [canManage, congregationId, id, loadingPermissions, mode, router]);

  const missingTemplateSections = useMemo(() => {
    if (meetingType === 'weekend') return [];
    const defaults = createDefaultSectionsForMeetingType(meetingType);
    return defaults.filter((candidate) => !sections.some((current) => current.sectionKey === candidate.sectionKey));
  }, [meetingType, sections]);

  const selectedCleaningGroups = useMemo(() => {
    if (cleaningSelectionMode === 'none') return [];
    if (cleaningSelectionMode === 'all') return cleaningGroups;

    const selectedIds = new Set(selectedCleaningGroupIds);
    return cleaningGroups.filter((group) => selectedIds.has(group.id));
  }, [cleaningGroups, cleaningSelectionMode, selectedCleaningGroupIds]);

  const toggleCleaningGroup = (groupId: string) => {
    setSelectedCleaningGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId]
    );
  };

  const effectiveSections = useMemo<MeetingProgramSection[]>(() => {
    if (meetingType === 'weekend') {
      return buildWeekendSectionsFromSessions({
        sessions: weekendSessions,
        activeUsers: availableUsers,
      });
    }

    return sections
      .map((section, sectionIndex) => ({ ...section, order: sectionIndex }))
      .sort((left, right) => left.order - right.order);
  }, [availableUsers, meetingType, sections, weekendSessions]);

  const selectedWeekEnd = useMemo(() => {
    const next = new Date(selectedWeekStart);
    next.setDate(next.getDate() + 6);
    return next;
  }, [selectedWeekStart]);

  const activeMeetingTemplate = useMemo(
    () => resolveMeetingTemplate(meetingType),
    [meetingType]
  );

  const resolvedMeetingDateRange = useMemo(
    () => activeMeetingTemplate.getMeetingDateRange(selectedWeekStart),
    [activeMeetingTemplate, selectedWeekStart]
  );

  const selectedWeekendMeetingDate = useMemo(() => {
    const selectedDate = new Date(resolvedMeetingDateRange.startDate);

    if (weekendMeetingDay === 'sunday') {
      selectedDate.setDate(selectedDate.getDate() + 1);
    }

    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate;
  }, [resolvedMeetingDateRange.startDate, weekendMeetingDay]);

  const selectedMidweekMeetingDate = useMemo(() => {
    const selectedDate = new Date(resolvedMeetingDateRange.startDate);
    const option = MIDWEEK_MEETING_DAY_OPTIONS.find((item) => item.value === midweekMeetingDay);

    if (option) {
      selectedDate.setDate(selectedDate.getDate() + option.offset);
    }

    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate;
  }, [midweekMeetingDay, resolvedMeetingDateRange.startDate]);

  const resolvedMeetingDate = useMemo(() => {
    if (meetingType === 'weekend') {
      return selectedWeekendMeetingDate;
    }

    return selectedMidweekMeetingDate;
  }, [meetingType, selectedMidweekMeetingDate, selectedWeekendMeetingDate]);

  const selectedWeekLabel = useMemo(
    () => formatWeekLabel(selectedWeekStart, selectedWeekEnd),
    [selectedWeekEnd, selectedWeekStart]
  );

  const canGoToPreviousWeek = useMemo(() => {
    if (mode === 'edit') return true;

    const previousWeekStart = moveWeek(selectedWeekStart, -1);
    const previousRange = activeMeetingTemplate.getMeetingDateRange(previousWeekStart);
    return previousRange.endDate >= getTodayStart();
  }, [activeMeetingTemplate, mode, selectedWeekStart]);

  const shiftWeek = (offset: number) => {
    if (!canManage) return;
    setSelectedWeekStart((current) => {
      const next = moveWeek(current, offset);

      if (mode === 'create') {
        const nextRange = activeMeetingTemplate.getMeetingDateRange(next);
        if (nextRange.endDate < getTodayStart()) {
          return current;
        }
      }

      return next;
    });
  };

  const goToCurrentWeek = () => {
    if (!canManage) return;
    setSelectedWeekStart(getWeekStart(new Date()));
  };

  const validateTopLevel = (): { isValid: boolean; startDate?: Date; endDate?: Date } => {
    const nextErrors: MeetingFormErrors = {};

    if (!normalizeText(title)) {
      nextErrors.title = 'El titulo es obligatorio.';
    }

    setErrors(nextErrors);

    return {
      isValid: Object.keys(nextErrors).length === 0,
      startDate: resolvedMeetingDateRange.startDate,
      endDate: resolvedMeetingDateRange.endDate,
    };
  };

  const setTypeForCreate = (nextType: MeetingProgramType) => {
    if (mode === 'edit') return;
    const defaults = createDefaultSectionsForMeetingType(nextType);
    setMeetingType(nextType);
    setWeekendMeetingDay('sunday');
    setMidweekMeetingDay('monday');
    setTitle(DEFAULT_TITLE_BY_TYPE[nextType]);
    setSections(defaults);
    setWeekendSessions(
      nextType === 'weekend'
        ? extractWeekendSessionsFromSections(defaults)
        : [createEmptyWeekendMeetingSession(0)]
    );
  };

  const updateSection = (
    sectionKey: string,
    updater: (section: MeetingProgramSection) => MeetingProgramSection
  ) => {
    setSections((current) => {
      const next = current.map((section) =>
        section.sectionKey === sectionKey ? updater(section) : section
      );

      return next
        .map((section, sectionIndex) => ({ ...section, order: sectionIndex }))
        .sort((left, right) => left.order - right.order);
    });
  };

  const validateMidweekParticipantInputs = (): string[] => {
    const errorsBuffer: string[] = [];
    const usersById = new Set(availableUsers.map((user) => user.uid));

    sections.forEach((section) => {
      if (section.isEnabled === false) {
        return;
      }

      const editorSection = programSectionToEditorSection(section);

      editorSection.items.forEach((assignment, assignmentIndex) => {
        const assignmentLabel = `${editorSection.title} - Parte ${assignmentIndex + 1}`;
        const participants =
          editorSection.id === 'livingAsChristians'
            ? assignment.participants.slice(0, 2)
            : assignment.participants;

        participants.forEach((participant, participantIndex) => {
          if (participant.mode === 'user') {
            const userId = normalizeText(participant.userId ?? '');
            if (!userId) {
              errorsBuffer.push(
                `${assignmentLabel}: Falta seleccionar usuario en participante ${participantIndex + 1}.`
              );
              return;
            }

            if (!usersById.has(userId)) {
              errorsBuffer.push(
                `${assignmentLabel}: El usuario del participante ${participantIndex + 1} no existe o esta inactivo.`
              );
            }
            return;
          }

          const manualName = normalizeText(participant.displayName);
          if (!manualName) {
            errorsBuffer.push(
              `${assignmentLabel}: El nombre manual del participante ${participantIndex + 1} es obligatorio.`
            );
          }
        });

        if (editorSection.id === 'livingAsChristians' && assignment.participants.length > 2) {
          errorsBuffer.push(`${assignmentLabel}: Solo se permiten dos participantes.`);
        }
      });
    });

    return Array.from(new Set(errorsBuffer));
  };

  const validateMidweekAssignmentTitles = (): string[] => {
    const errorsBuffer: string[] = [];
    const nextAssignmentErrors: Record<string, AssignmentCardEditorErrors> = {};

    sections.forEach((section) => {
      if (section.isEnabled === false) {
        return;
      }

      section.assignments.forEach((assignment, assignmentIndex) => {
        if (normalizeText(assignment.title)) {
          return;
        }

        nextAssignmentErrors[assignment.assignmentKey] = {
          ...nextAssignmentErrors[assignment.assignmentKey],
          title: 'El titulo de la parte es obligatorio.',
        };
        errorsBuffer.push(
          `${section.title || 'Seccion sin titulo'} - Parte ${assignmentIndex + 1}: falta el titulo.`
        );
      });
    });

    setMidweekAssignmentErrors(nextAssignmentErrors);
    return Array.from(new Set(errorsBuffer));
  };

  const buildPayload = (startDate: Date, endDate: Date, actorUid: string): CreateMeetingDTO => {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    const meetingDateTimestamp = Timestamp.fromDate(resolvedMeetingDate);

    return {
      title: normalizeText(title) ?? DEFAULT_TITLE_BY_TYPE[meetingType],
      description: normalizeText(description),
      type: meetingType,
      meetingCategory: meetingType,
      weekLabel: meetingType === 'midweek' ? selectedWeekLabel : undefined,
      status,
      publicationStatus: 'draft',
      startDate: startTimestamp,
      endDate: endTimestamp,
      meetingDate: meetingDateTimestamp,
      location: normalizeText(location),
      meetingUrl: normalizeUrl(meetingUrl),
      notes: normalizeText(notes),
      sections: effectiveSections,
      cleaningAssignmentMode: cleaningSelectionMode,
      cleaningGroupIds: selectedCleaningGroups.map((group) => group.id),
      cleaningGroupNames: selectedCleaningGroups.map((group) => group.name),
      attendees: [actorUid],
      createdBy: actorUid,
      updatedBy: actorUid,
    };
  };

  const persistMeeting = async (intent: SaveIntent): Promise<string | null> => {
    if (!congregationId) {
      Alert.alert('Error', 'No se encontro la congregacion del usuario actual.');
      return null;
    }

    const validation = validateTopLevel();
    if (!validation.isValid || !validation.startDate || !validation.endDate) {
      Alert.alert('Validacion', 'Corrige los campos marcados antes de guardar.');
      return null;
    }

    const actorUid = normalizeText(user?.uid ?? uid ?? '');
    if (!actorUid) {
      Alert.alert('Error', 'Tu sesion no tiene un UID valido para guardar. Cierra sesion e inicia nuevamente.');
      return null;
    }

    if (meetingType === 'midweek') {
      const titleErrors = validateMidweekAssignmentTitles();
      if (titleErrors.length > 0) {
        setPublishErrors(titleErrors);
        Alert.alert('Validacion', titleErrors.join('\n'));
        return null;
      }
    } else {
      setMidweekAssignmentErrors({});
    }

    const payload = buildPayload(validation.startDate, validation.endDate, actorUid);

    if (intent === 'published') {
      if (meetingType === 'midweek') {
        const midweekParticipantErrors = validateMidweekParticipantInputs();
        if (midweekParticipantErrors.length > 0) {
          setPublishErrors(midweekParticipantErrors);
          Alert.alert('No se puede publicar', midweekParticipantErrors.join('\n'));
          return null;
        }
      }

      if (meetingType === 'weekend') {
        const weekendValidationErrors = validateWeekendSessionsForPublish(
          weekendSessions,
          availableUsers
        );

        if (weekendValidationErrors.length > 0) {
          setPublishErrors(weekendValidationErrors);
          Alert.alert('No se puede publicar', weekendValidationErrors.join('\n'));
          return null;
        }
      }

      const publishValidation = validateMeetingBeforePublish({
        meetingType,
        congregationId,
        meetingDate: payload.meetingDate,
        sections: payload.sections ?? [],
        activeUsers: availableUsers,
      });

      if (!publishValidation.isValid) {
        setPublishErrors(publishValidation.errors);
        Alert.alert('No se puede publicar', publishValidation.errors.join('\n'));
        return null;
      }

      setPublishErrors([]);
    }

    if (mode === 'create') {
      return createMeeting(
        congregationId,
        payload,
        actorUid,
        appUser?.displayName ?? user?.email ?? 'Usuario'
      );
    }

    if (!id) {
      return null;
    }

    const updatePayload: UpdateMeetingDTO = { ...payload, updatedBy: actorUid };
    await updateMeeting(congregationId, id, updatePayload);
    return id;
  };

  const handleSave = async (intent: SaveIntent) => {
    setSavingIntent(intent);
    setSaveError(null);

    try {
      const meetingId = await persistMeeting(intent);
      if (!meetingId || !congregationId) {
        setSaveError('No se pudo guardar la reunion. Revisa los campos e intenta nuevamente.');
        return;
      }

      await syncMeetingCleaningAssignmentsByManager({
        congregationId,
        meetingId,
        mode: cleaningSelectionMode,
        groups: selectedCleaningGroups.map((group) => ({ id: group.id, name: group.name })),
        meetingTitle: normalizeText(title) ?? DEFAULT_TITLE_BY_TYPE[meetingType],
        meetingDate: Timestamp.fromDate(resolvedMeetingDate),
        assignedByName: appUser?.displayName ?? user?.email ?? 'Usuario',
      });

      if (intent === 'draft') {
        if (mode === 'edit') {
          await setMeetingPublicationStatus({
            congregationId,
            meetingId,
            publicationStatus: 'draft',
          });
        }

        router.replace('/meetings/manage' as never);
        return;
      }

      const publishResult = await setMeetingPublicationStatus({
        congregationId,
        meetingId,
        publicationStatus: 'published',
      });

      if (!publishResult.ok) {
        setPublishErrors(publishResult.errors);
        Alert.alert('Publicacion bloqueada', publishResult.errors.join('\n'));

        if (mode === 'create') {
          router.replace(`/meetings/edit/${meetingId}` as never);
        }

        return;
      }

      router.replace('/meetings/manage' as never);
    } catch (requestError) {
      const message = formatFirestoreError(requestError);
      setSaveError(message);
      Alert.alert('Error', message);
    } finally {
      setSavingIntent(null);
    }
  };

  if (loading || loadingPermissions) {
    return <LoadingState message="Cargando formulario de reuniones..." />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva reunion' : 'Editar reunion'} showBack />

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <View style={styles.block}>
          <Field label="Titulo *" error={errors.title}>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={title}
              onChangeText={setTitle}
              editable={canManage}
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          <Field label="Descripcion">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              editable={canManage}
              multiline
              placeholderTextColor={colors.textDisabled}
            />
          </Field>

          <Field label="Tipo de reunion">
            <View style={styles.chips}>
              {TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, meetingType === option && styles.chipActive, mode === 'edit' && styles.dim]}
                  onPress={() => setTypeForCreate(option)}
                  disabled={!canManage || mode === 'edit'}
                >
                  <ThemedText style={[styles.chipText, meetingType === option && styles.chipTextActive]}>
                    {MEETING_TYPE_LABELS[option]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <View style={styles.row}>
            <View style={styles.col}>
              <Field label="Semana">
                <View style={styles.weekSelectorRow}>
                  <TouchableOpacity
                    style={styles.weekNavButton}
                    onPress={() => shiftWeek(-1)}
                    disabled={!canManage || !canGoToPreviousWeek}
                  >
                    <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.weekCurrentButton}
                    onPress={goToCurrentWeek}
                    disabled={!canManage}
                  >
                    <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                    <ThemedText style={styles.weekCurrentText}>{selectedWeekLabel}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.weekNavButton}
                    onPress={() => shiftWeek(1)}
                    disabled={!canManage}
                  >
                    <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.weekHint}>
                  {activeMeetingTemplate.getUiConfig().weekHint}
                </ThemedText>
              </Field>
            </View>
          </View>

          <Field label="Rango de reunion (automatico)">
            <View style={styles.autoRangeBox}>
              <ThemedText style={styles.autoRangeText}>
                {formatDateInput(resolvedMeetingDateRange.startDate)} al {formatDateInput(resolvedMeetingDateRange.endDate)}
              </ThemedText>
            </View>
          </Field>

          {meetingType === 'weekend' ? (
            <Field label="Dia de reunion (fin de semana)">
              <View style={styles.chips}>
                {(['saturday', 'sunday'] as const).map((dayOption) => {
                  const optionDate =
                    dayOption === 'saturday'
                      ? resolvedMeetingDateRange.startDate
                      : resolvedMeetingDateRange.endDate;

                  return (
                    <TouchableOpacity
                      key={dayOption}
                      style={[
                        styles.chip,
                        weekendMeetingDay === dayOption && styles.chipActive,
                      ]}
                      onPress={() => setWeekendMeetingDay(dayOption)}
                      disabled={!canManage}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          weekendMeetingDay === dayOption && styles.chipTextActive,
                        ]}
                      >
                        {WEEKEND_MEETING_DAY_LABELS[dayOption]} {formatDateInput(optionDate)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ThemedText style={styles.weekHint}>
                Fecha seleccionada: {WEEKEND_MEETING_DAY_LABELS[weekendMeetingDay]} {formatDateInput(selectedWeekendMeetingDate)}
              </ThemedText>
            </Field>
          ) : null}

          {meetingType === 'midweek' ? (
            <Field label="Dia de reunion (entre semana)">
              <View style={styles.chips}>
                {MIDWEEK_MEETING_DAY_OPTIONS.map((dayOption) => {
                  const optionDate = new Date(resolvedMeetingDateRange.startDate);
                  optionDate.setDate(optionDate.getDate() + dayOption.offset);

                  return (
                    <TouchableOpacity
                      key={dayOption.value}
                      style={[
                        styles.chip,
                        midweekMeetingDay === dayOption.value && styles.chipActive,
                      ]}
                      onPress={() => setMidweekMeetingDay(dayOption.value)}
                      disabled={!canManage}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          midweekMeetingDay === dayOption.value && styles.chipTextActive,
                        ]}
                      >
                        {MIDWEEK_MEETING_DAY_LABELS[dayOption.value]} {formatDateInput(optionDate)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <ThemedText style={styles.weekHint}>
                Fecha seleccionada: {MIDWEEK_MEETING_DAY_LABELS[midweekMeetingDay]} {formatDateInput(selectedMidweekMeetingDate)}
              </ThemedText>
            </Field>
          ) : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <Field label="Lugar">
                <TextInput style={styles.input} value={location} onChangeText={setLocation} editable={canManage} placeholderTextColor={colors.textDisabled} />
              </Field>
            </View>
            <View style={styles.col}>
              <Field label="Enlace">
                <TextInput style={styles.input} value={meetingUrl} onChangeText={setMeetingUrl} editable={canManage} autoCapitalize="none" keyboardType="url" placeholderTextColor={colors.textDisabled} />
              </Field>
            </View>
          </View>

          <Field label="Estado operativo">
            <View style={styles.chips}>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity key={option} style={[styles.chip, status === option && styles.chipActive]} onPress={() => setStatus(option)} disabled={!canManage}>
                  <ThemedText style={[styles.chipText, status === option && styles.chipTextActive]}>
                    {MEETING_STATUS_LABELS[option]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="Grupo que toca limpieza">
            <View style={styles.chips}>
              {(['none', 'selected', 'all'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    cleaningSelectionMode === option && styles.chipActive,
                  ]}
                  onPress={() => setCleaningSelectionMode(option)}
                  disabled={!canManage}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      cleaningSelectionMode === option && styles.chipTextActive,
                    ]}
                  >
                    {option === 'none'
                      ? 'Sin limpieza'
                      : option === 'all'
                        ? 'Limpieza general'
                        : 'Elegir grupos'}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {cleaningGroups.length === 0 ? (
              <ThemedText style={styles.weekHint}>
                Crea grupos activos desde la pestana de Limpieza para poder asignarlos.
              </ThemedText>
            ) : null}

            {cleaningSelectionMode === 'selected' ? (
              <View style={styles.cleaningGroupGrid}>
                {cleaningGroups.map((group) => {
                  const isSelected = selectedCleaningGroupIds.includes(group.id);

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.cleaningGroupChip,
                        isSelected && styles.cleaningGroupChipActive,
                      ]}
                      onPress={() => toggleCleaningGroup(group.id)}
                      disabled={!canManage}
                    >
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={isSelected ? colors.onPrimary : colors.textMuted}
                      />
                      <ThemedText
                        style={[
                          styles.cleaningGroupText,
                          isSelected && styles.cleaningGroupTextActive,
                        ]}
                      >
                        {group.name}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {cleaningSelectionMode === 'all' && cleaningGroups.length > 0 ? (
              <ThemedText style={styles.weekHint}>
                Se avisara a todos los grupos activos de limpieza.
              </ThemedText>
            ) : null}
          </Field>
        </View>
        <View style={styles.block}>
          <ThemedText style={styles.sectionTitle}>
            {meetingType === 'weekend' ? 'Programa de fin de semana' : 'Secciones'}
          </ThemedText>

          {meetingType === 'weekend' ? (
            <WeekendSessionsEditor
              sessions={weekendSessions}
              users={availableUsers}
              disabled={!canManage}
              onChange={setWeekendSessions}
            />
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <TouchableOpacity style={styles.addButton} onPress={() => {
                  const key = `dynamic-${Date.now().toString(36)}`;
                  const dynamicSection: MeetingProgramSection = {
                    sectionKey: key,
                    title: 'Seccion dinamica',
                    order: sections.length,
                    sectionType: 'dynamic',
                    isRequired: false,
                    isEnabled: true,
                    assignments: [],
                  };
                  setSections((current) => [...current, dynamicSection].map((section, index) => ({ ...section, order: index })));
                }} disabled={!canManage}>
                  <Ionicons name="add" size={14} color={colors.onPrimary} />
                  <ThemedText style={styles.addButtonText}>Dinamica</ThemedText>
                </TouchableOpacity>
              </View>

              {missingTemplateSections.length > 0 ? (
                <View style={styles.chips}>
                  {missingTemplateSections.map((template) => (
                    <TouchableOpacity
                      key={template.sectionKey}
                      style={styles.templateChip}
                      onPress={() => {
                        setSections((current) => [...current, { ...template, order: current.length }]);
                      }}
                      disabled={!canManage}
                    >
                      <ThemedText style={styles.templateChipText}>{template.title}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {sections.map((section, index) => {
                const editorSection = programSectionToEditorSection(section);

                return (
                  <View key={section.sectionKey} style={styles.sectionWrap}>
                    <View style={styles.sectionTopRow}>
                      <TextInput
                        style={styles.sectionInput}
                        value={section.title}
                        onChangeText={(nextTitle) => updateSection(section.sectionKey, (current) => ({ ...current, title: nextTitle }))}
                        editable={canManage}
                        placeholderTextColor={colors.textDisabled}
                      />

                      <View style={styles.iconRow}>
                        <TouchableOpacity style={[styles.iconBtn, index === 0 && styles.dim]} onPress={() => setSections((current) => moveMeetingSection(current, index, index - 1))} disabled={!canManage || index === 0}>
                          <Ionicons name="arrow-up-outline" size={15} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconBtn, index === sections.length - 1 && styles.dim]} onPress={() => setSections((current) => moveMeetingSection(current, index, index + 1))} disabled={!canManage || index === sections.length - 1}>
                          <Ionicons name="arrow-down-outline" size={15} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => updateSection(section.sectionKey, (current) => ({ ...current, isEnabled: !current.isEnabled }))} disabled={!canManage || section.isRequired === true}>
                          <Ionicons name={section.isEnabled ? 'eye-outline' : 'eye-off-outline'} size={15} color={section.isEnabled ? colors.primary : colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => setSections((current) => current.filter((item) => item.sectionKey !== section.sectionKey).map((item, itemIndex) => ({ ...item, order: itemIndex })))} disabled={!canManage || section.isRequired === true}>
                          <Ionicons name="trash-outline" size={15} color={section.isRequired ? colors.textDisabled : colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <MidweekSectionEditor
                      section={editorSection}
                      users={availableUsers}
                      disabled={!canManage || section.isEnabled === false}
                      errors={midweekAssignmentErrors}
                      onChange={(nextEditorSection) => {
                        setMidweekAssignmentErrors((current) => {
                          let changed = false;
                          const nextErrors = { ...current };

                          nextEditorSection.items.forEach((assignment) => {
                            if (normalizeText(assignment.title) && nextErrors[assignment.id]?.title) {
                              const rest = { ...nextErrors[assignment.id] };
                              delete rest.title;
                              changed = true;
                              if (Object.keys(rest).length > 0) {
                                nextErrors[assignment.id] = rest;
                              } else {
                                delete nextErrors[assignment.id];
                              }
                            }
                          });

                          return changed ? nextErrors : current;
                        });

                        updateSection(section.sectionKey, (currentSection) =>
                          editorSectionToProgramSection(nextEditorSection, currentSection)
                        );
                      }}
                    />
                  </View>
                );
              })}
            </>
          )}
        </View>

        <Field label="Notas generales">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={notes}
            onChangeText={setNotes}
            editable={canManage}
            multiline
            placeholderTextColor={colors.textDisabled}
          />
        </Field>

        {publishErrors.length > 0 ? (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorBoxTitle}>No se puede publicar:</ThemedText>
            {publishErrors.map((item) => (
              <ThemedText key={item} style={styles.errorBoxItem}>- {item}</ThemedText>
            ))}
          </View>
        ) : null}

        {saveError ? (
          <View style={styles.errorBox}>
            <ThemedText style={styles.errorBoxTitle}>No se pudo guardar:</ThemedText>
            <ThemedText style={styles.errorBoxItem}>- {saveError}</ThemedText>
          </View>
        ) : null}

        <View style={styles.row}>
          <TouchableOpacity style={[styles.secondaryAction, Boolean(savingIntent) && styles.dim]} onPress={() => handleSave('draft')} disabled={Boolean(savingIntent) || !canManage}>
            {savingIntent === 'draft' ? <ActivityIndicator size="small" color={colors.primary} /> : <ThemedText style={styles.secondaryText}>Guardar borrador</ThemedText>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryAction, Boolean(savingIntent) && styles.dim]} onPress={() => handleSave('published')} disabled={Boolean(savingIntent) || !canManage}>
            {savingIntent === 'published' ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <ThemedText style={styles.primaryText}>Guardar y publicar</ThemedText>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
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
    form: { padding: 16, gap: 14, paddingBottom: 28 },
    block: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: colors.surface },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    addButton: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    addButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
    field: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.backgroundLight, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9 },
    autoRangeBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.backgroundLight, paddingHorizontal: 10, paddingVertical: 9 },
    autoRangeText: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
    inputError: { borderColor: colors.error },
    multiline: { minHeight: 84, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    weekSelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    weekNavButton: {
      width: 34,
      height: 34,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekCurrentButton: {
      flex: 1,
      minHeight: 34,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      borderRadius: 8,
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    weekCurrentText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    weekHint: { fontSize: 11, color: colors.textMuted },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    chipTextActive: { color: colors.onPrimary },
    cleaningGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cleaningGroupChip: { minHeight: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
    cleaningGroupChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    cleaningGroupText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
    cleaningGroupTextActive: { color: colors.onPrimary },
    sectionWrap: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, backgroundColor: colors.backgroundLight },
    sectionTopRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    sectionInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, color: colors.textPrimary, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
    iconRow: { flexDirection: 'row', gap: 4 },
    iconBtn: { width: 30, height: 30, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    templateChip: { borderWidth: 1, borderColor: colors.info + '66', borderRadius: 999, backgroundColor: colors.infoLight, paddingHorizontal: 10, paddingVertical: 6 },
    templateChipText: { color: colors.infoDark, fontSize: 12, fontWeight: '700' },
    errorText: { color: colors.error, fontSize: 12 },
    errorBox: { borderWidth: 1, borderColor: colors.error + '55', borderRadius: 10, backgroundColor: colors.error + '15', padding: 10, gap: 4 },
    errorBoxTitle: { color: colors.error, fontSize: 12, fontWeight: '800' },
    errorBoxItem: { color: colors.error, fontSize: 12 },
    secondaryAction: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '12', minHeight: 44 },
    secondaryText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
    primaryAction: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, minHeight: 44 },
    primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 13 },
    dim: { opacity: 0.55 },
  });
