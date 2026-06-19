import React, { useEffect, useMemo, useRef } from 'react';
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
import { buildMeetingProgramFromMeeting } from '@/src/services/meetings/meeting-program-utils';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import {
  WeekendMeetingSessionDraft,
  buildWeekendSectionsFromSessions,
  createEmptyWeekendMeetingSession,
  extractWeekendSessionsFromSections,
} from '@/src/services/meetings/weekend-meeting-adapter';
import { getScheduledOutgoingTalksForWeek } from '@/src/modules/assignments/services/outgoing-talks.service';
import {
  OUTGOING_TALK_BLOCK_MESSAGE,
  getBlockedOutgoingTalkUserIds,
} from '@/src/modules/assignments/utils/outgoing-talks';
import { resolveMeetingTemplate } from '@/src/services/meetings/meeting-template';
import { getMeetingById, getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import {
  ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  MeetingStatus,
  MEETING_STATUS_LABELS,
  MEETING_TYPE_LABELS,
} from '@/src/types/meeting';
import {
  MeetingProgramSection,
  MeetingProgramType,
  createDefaultSectionsForMeetingType,
  moveMeetingSection,
} from '@/src/types/meeting/program';
import { formatWeekLabel, getWeekStart, moveWeek } from '@/src/utils/dates/week-range';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import {
  CleaningSelectionMode,
  DEFAULT_TITLE_BY_TYPE,
  FORM_STEPS,
  FormStepKey,
  MIDWEEK_MEETING_DAY_LABELS,
  MIDWEEK_MEETING_DAY_OPTIONS,
  MeetingConflictNotice,
  Mode,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  WEEKEND_MEETING_DAY_LABELS,
  WeekendMeetingDay,
  MidweekMeetingDay,
  editorSectionToProgramSection,
  formatDateInput,
  formatHumanDate,
  getDateFromMeetingValue,
  getTodayStart,
  inferMidweekMeetingDay,
  inferProgramTypeFromMeeting,
  inferWeekendMeetingDay,
  meetingMatchesProgramType,
  normalizeText,
  programSectionToEditorSection,
  toDateFromDateLike,
} from '@/src/screens/meetings/meeting-form/meeting-form.mapper';
import {
  MeetingFormErrors,
  PublishPanelItem,
  collectMissingAssignmentLabels,
  toPanelItems,
} from '@/src/screens/meetings/meeting-form/meeting-form.validators';
import { useMeetingFormState } from '@/src/screens/meetings/meeting-form/useMeetingFormState';
import { useMeetingPublishFlow } from '@/src/screens/meetings/meeting-form/useMeetingPublishFlow';
import { useMeetingValidation } from '@/src/screens/meetings/meeting-form/useMeetingValidation';

export function MeetingFormScreen() {
  const { id, type: typeParam } = useLocalSearchParams<{ id?: string; type?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { appUser } = useUser();
  const { canManage, congregationId, uid, loading: loadingPermissions } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const scrollRef = useRef<ScrollView | null>(null);

  const mode: Mode = id ? 'edit' : 'create';
  const initialType: MeetingProgramType = typeParam === 'midweek' ? 'midweek' : 'weekend';
  const initialWeekStart = getWeekStart(new Date());

  const {
    title,
    setTitle,
    description,
    setDescription,
    meetingType,
    setMeetingType,
    weekendMeetingDay,
    setWeekendMeetingDay,
    midweekMeetingDay,
    setMidweekMeetingDay,
    status,
    setStatus,
    selectedWeekStart,
    setSelectedWeekStart,
    location,
    setLocation,
    meetingUrl,
    setMeetingUrl,
    notes,
    setNotes,
    sections,
    setSections,
    weekendSessions,
    setWeekendSessions,
    availableUsers,
    setAvailableUsers,
    outgoingTalks,
    setOutgoingTalks,
    cleaningGroups,
    setCleaningGroups,
    cleaningSelectionMode,
    setCleaningSelectionMode,
    selectedCleaningGroupIds,
    setSelectedCleaningGroupIds,
    errors,
    setErrors,
    midweekAssignmentErrors,
    setMidweekAssignmentErrors,
    publishErrors,
    setPublishErrors,
    saveError,
    setSaveError,
    currentStep,
    setCurrentStep,
    duplicateMeetingHint,
    setDuplicateMeetingHint,
    checkingDuplicate,
    setCheckingDuplicate,
    loading,
    setLoading,
    savingIntent,
    setSavingIntent,
  } = useMeetingFormState({ mode, initialType, initialWeekStart });

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
  }, [
    canManage,
    congregationId,
    id,
    loadingPermissions,
    mode,
    router,
    setAvailableUsers,
    setCleaningGroups,
    setCleaningSelectionMode,
    setDescription,
    setLoading,
    setLocation,
    setMeetingType,
    setMeetingUrl,
    setMidweekMeetingDay,
    setNotes,
    setSections,
    setSelectedCleaningGroupIds,
    setSelectedWeekStart,
    setStatus,
    setTitle,
    setWeekendMeetingDay,
    setWeekendSessions,
  ]);

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

  useEffect(() => {
    if (!congregationId) {
      setOutgoingTalks([]);
      return;
    }

    let cancelled = false;
    void getScheduledOutgoingTalksForWeek(congregationId, resolvedMeetingDate)
      .then((items) => {
        if (!cancelled) setOutgoingTalks(items);
      })
      .catch(() => {
        if (!cancelled) setOutgoingTalks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, resolvedMeetingDate, setOutgoingTalks]);

  const blockedOutgoingTalkUserIds = useMemo(
    () => getBlockedOutgoingTalkUserIds(resolvedMeetingDate, outgoingTalks),
    [outgoingTalks, resolvedMeetingDate]
  );

  const selectedWeekLabel = useMemo(
    () => formatWeekLabel(selectedWeekStart, selectedWeekEnd),
    [selectedWeekEnd, selectedWeekStart]
  );

  useEffect(() => {
    if (!congregationId) {
      setDuplicateMeetingHint(null);
      return;
    }

    let cancelled = false;
    setCheckingDuplicate(true);

    void getMeetingsByWeek(congregationId, resolvedMeetingDateRange.startDate, resolvedMeetingDateRange.endDate, {
      includeMidweek: true,
      maxItems: 20,
      publicationStatus: 'all',
    })
      .then((meetings) => {
        if (cancelled) return;

        const conflict = meetings.find((meeting) => {
          if (id && meeting.id === id) return false;
          return meetingMatchesProgramType(meeting, meetingType);
        });

        if (!conflict) {
          setDuplicateMeetingHint(null);
          return;
        }

        const conflictDate =
          getDateFromMeetingValue(conflict.meetingDate) ??
          getDateFromMeetingValue(conflict.startDate) ??
          resolvedMeetingDate;

        setDuplicateMeetingHint({
          id: conflict.id,
          title: conflict.title,
          dateLabel: formatHumanDate(conflictDate),
        });
      })
      .catch(() => {
        if (!cancelled) setDuplicateMeetingHint(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingDuplicate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    congregationId,
    id,
    meetingType,
    resolvedMeetingDate,
    resolvedMeetingDateRange.endDate,
    resolvedMeetingDateRange.startDate,
    setCheckingDuplicate,
    setDuplicateMeetingHint,
  ]);

  const currentStepIndex = FORM_STEPS.findIndex((step) => step.key === currentStep);
  const isReviewStep = currentStep === 'review';
  const canGoBackStep = currentStepIndex > 0;
  const canGoNextStep = currentStepIndex < FORM_STEPS.length - 1;

  const {
    missingAssignmentLabels,
    blockedAssignedUserNames,
    controlledFieldLabels,
    canGoToPreviousWeek,
    validateTopLevel,
  } = useMeetingValidation({
    title,
    mode,
    selectedWeekStart,
    activeMeetingTemplate,
    resolvedMeetingDateRange,
    effectiveSections,
    blockedOutgoingTalkUserIds,
    availableUsers,
  });

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

  const showPanelErrors = (messages: string[]) => {
    setPublishErrors(toPanelItems(messages));
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const clearPanelErrors = () => {
    setPublishErrors([]);
    setSaveError(null);
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

  const { handleSave } = useMeetingPublishFlow({
    mode,
    id,
    congregationId,
    uid,
    authUid: user?.uid,
    authEmail: user?.email,
    appUserDisplayName: appUser?.displayName,
    isReviewStep,
    meetingType,
    title,
    description,
    selectedWeekLabel,
    status,
    location,
    meetingUrl,
    notes,
    effectiveSections,
    sections,
    weekendSessions,
    availableUsers,
    blockedOutgoingTalkUserIds,
    cleaningSelectionMode,
    selectedCleaningGroups,
    resolvedMeetingDate,
    validateTopLevel: () => {
      const validation = validateTopLevel();
      setErrors(validation.errors);
      return validation;
    },
    setMidweekAssignmentErrors,
    setCurrentStep,
    setSavingIntent,
    setSaveError,
    showPanelErrors,
    clearPanelErrors,
    scrollToTop: () => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    replaceRoute: (href) => {
      router.replace(href as never);
    },
  });

  if (loading || loadingPermissions) {
    return <LoadingState message="Cargando formulario de reuniones..." />;
  }

  const goToStep = (step: FormStepKey) => {
    clearPanelErrors();
    setCurrentStep(step);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const goToPreviousStep = () => {
    if (!canGoBackStep) return;
    goToStep(FORM_STEPS[currentStepIndex - 1].key);
  };

  const goToNextStep = () => {
    if (!canGoNextStep) return;
    goToStep(FORM_STEPS[currentStepIndex + 1].key);
  };

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva reunion' : 'Editar reunion'} showBack />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <MeetingStepIndicator currentStep={currentStep} />

        <MeetingPublishErrorsPanel errors={publishErrors} saveError={saveError} />

        {currentStep === 'date' ? (
          <MeetingDateStep
            mode={mode}
            meetingType={meetingType}
            selectedWeekLabel={selectedWeekLabel}
            activeWeekHint={activeMeetingTemplate.getUiConfig().weekHint}
            resolvedMeetingDateRange={resolvedMeetingDateRange}
            weekendMeetingDay={weekendMeetingDay}
            midweekMeetingDay={midweekMeetingDay}
            selectedWeekendMeetingDate={selectedWeekendMeetingDate}
            selectedMidweekMeetingDate={selectedMidweekMeetingDate}
            canManage={canManage}
            canGoToPreviousWeek={canGoToPreviousWeek}
            duplicateMeetingHint={duplicateMeetingHint}
            checkingDuplicate={checkingDuplicate}
            onTypeChange={setTypeForCreate}
            onShiftWeek={shiftWeek}
            onCurrentWeek={goToCurrentWeek}
            onWeekendDayChange={setWeekendMeetingDay}
            onMidweekDayChange={setMidweekMeetingDay}
          />
        ) : null}

        {currentStep === 'basic' ? (
          <MeetingBasicInfoStep
            title={title}
            description={description}
            location={location}
            meetingUrl={meetingUrl}
            status={status}
            notes={notes}
            errors={errors}
            canManage={canManage}
            onTitleChange={setTitle}
            onDescriptionChange={setDescription}
            onLocationChange={setLocation}
            onMeetingUrlChange={setMeetingUrl}
            onStatusChange={setStatus}
            onNotesChange={setNotes}
          />
        ) : null}

        {currentStep === 'program' ? (
          <MeetingProgramStep
            meetingType={meetingType}
            sections={sections}
            weekendSessions={weekendSessions}
            availableUsers={availableUsers}
            missingTemplateSections={missingTemplateSections}
            midweekAssignmentErrors={midweekAssignmentErrors}
            blockedOutgoingTalkUserIds={blockedOutgoingTalkUserIds}
            canManage={canManage}
            onSectionsChange={setSections}
            onWeekendSessionsChange={setWeekendSessions}
            onAssignmentErrorsChange={setMidweekAssignmentErrors}
            onUpdateSection={updateSection}
          />
        ) : null}

        {currentStep === 'cleaning' ? (
          <MeetingCleaningStep
            cleaningSelectionMode={cleaningSelectionMode}
            cleaningGroups={cleaningGroups}
            selectedCleaningGroupIds={selectedCleaningGroupIds}
            canManage={canManage}
            onSelectionModeChange={setCleaningSelectionMode}
            onToggleCleaningGroup={toggleCleaningGroup}
          />
        ) : null}

        {currentStep === 'review' ? (
          <MeetingReviewStep
            meetingType={meetingType}
            selectedWeekLabel={selectedWeekLabel}
            selectedMeetingDate={resolvedMeetingDate}
            location={location}
            meetingUrl={meetingUrl}
            selectedCleaningGroups={selectedCleaningGroups}
            cleaningSelectionMode={cleaningSelectionMode}
            effectiveSections={effectiveSections}
            missingAssignmentLabels={missingAssignmentLabels}
            blockedAssignedUserNames={blockedAssignedUserNames}
            controlledFieldLabels={controlledFieldLabels}
            duplicateMeetingHint={duplicateMeetingHint}
          />
        ) : null}

        <View style={styles.stepActions}>
          <TouchableOpacity
            style={[styles.navAction, !canGoBackStep && styles.dim]}
            onPress={goToPreviousStep}
            disabled={!canGoBackStep}
          >
            <Ionicons name="chevron-back-outline" size={16} color={colors.textPrimary} />
            <ThemedText style={styles.navActionText}>Atras</ThemedText>
          </TouchableOpacity>

          {canGoNextStep ? (
            <TouchableOpacity style={styles.navAction} onPress={goToNextStep}>
              <ThemedText style={styles.navActionText}>Siguiente</ThemedText>
              <Ionicons name="chevron-forward-outline" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={[styles.secondaryAction, Boolean(savingIntent) && styles.dim]} onPress={() => handleSave('draft')} disabled={Boolean(savingIntent) || !canManage}>
            {savingIntent === 'draft' ? <ActivityIndicator size="small" color={colors.primary} /> : <ThemedText style={styles.secondaryText}>Guardar borrador</ThemedText>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryAction, Boolean(savingIntent) && styles.dim]} onPress={() => handleSave('published')} disabled={Boolean(savingIntent) || !canManage}>
            {savingIntent === 'published' ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <ThemedText style={styles.primaryText}>
                {isReviewStep ? 'Confirmar publicacion' : 'Revisar y publicar'}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MeetingStepIndicator({ currentStep }: { currentStep: FormStepKey }) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const currentIndex = FORM_STEPS.findIndex((step) => step.key === currentStep);

  return (
    <View style={styles.stepper}>
      {FORM_STEPS.map((step, index) => {
        const isActive = step.key === currentStep;
        const isDone = index < currentIndex;

        return (
          <View
            key={step.key}
            style={[
              styles.stepPill,
              isActive && styles.stepPillActive,
              isDone && styles.stepPillDone,
            ]}
          >
            <View style={[styles.stepBadge, (isActive || isDone) && styles.stepBadgeActive]}>
              <ThemedText style={[styles.stepBadgeText, (isActive || isDone) && styles.stepBadgeTextActive]}>
                {index + 1}
              </ThemedText>
            </View>
            <View style={styles.stepTextWrap}>
              <ThemedText style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                {step.title}
              </ThemedText>
              <ThemedText style={styles.stepSubtitle}>{step.subtitle}</ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MeetingPublishErrorsPanel({
  errors,
  saveError,
}: {
  errors: PublishPanelItem[];
  saveError?: string | null;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const hasErrors = errors.length > 0 || Boolean(saveError);

  if (!hasErrors) {
    return null;
  }

  return (
    <View style={styles.errorBox}>
      <View style={styles.panelTitleRow}>
        <Ionicons name="alert-circle-outline" size={17} color={colors.error} />
        <ThemedText style={styles.errorBoxTitle}>Revisa esto antes de continuar</ThemedText>
      </View>
      {saveError ? <ThemedText style={styles.errorBoxItem}>- {saveError}</ThemedText> : null}
      {errors.map((item) => (
        <ThemedText key={item.id} style={styles.errorBoxItem}>- {item.message}</ThemedText>
      ))}
    </View>
  );
}

function MeetingDateStep({
  mode,
  meetingType,
  selectedWeekLabel,
  activeWeekHint,
  resolvedMeetingDateRange,
  weekendMeetingDay,
  midweekMeetingDay,
  selectedWeekendMeetingDate,
  selectedMidweekMeetingDate,
  canManage,
  canGoToPreviousWeek,
  duplicateMeetingHint,
  checkingDuplicate,
  onTypeChange,
  onShiftWeek,
  onCurrentWeek,
  onWeekendDayChange,
  onMidweekDayChange,
}: {
  mode: Mode;
  meetingType: MeetingProgramType;
  selectedWeekLabel: string;
  activeWeekHint: string;
  resolvedMeetingDateRange: { startDate: Date; endDate: Date };
  weekendMeetingDay: WeekendMeetingDay;
  midweekMeetingDay: MidweekMeetingDay;
  selectedWeekendMeetingDate: Date;
  selectedMidweekMeetingDate: Date;
  canManage: boolean;
  canGoToPreviousWeek: boolean;
  duplicateMeetingHint: MeetingConflictNotice | null;
  checkingDuplicate: boolean;
  onTypeChange: (type: MeetingProgramType) => void;
  onShiftWeek: (offset: number) => void;
  onCurrentWeek: () => void;
  onWeekendDayChange: (day: WeekendMeetingDay) => void;
  onMidweekDayChange: (day: MidweekMeetingDay) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.block}>
      <StepHeading
        title="Tipo de reunion y semana"
        subtitle="Primero define que se va a crear y el dia exacto de la reunion."
      />

      <Field label="Tipo de reunion">
        <View style={styles.chips}>
          {TYPE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, meetingType === option && styles.chipActive, mode === 'edit' && styles.dim]}
              onPress={() => onTypeChange(option)}
              disabled={!canManage || mode === 'edit'}
            >
              <ThemedText style={[styles.chipText, meetingType === option && styles.chipTextActive]}>
                {MEETING_TYPE_LABELS[option]}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      <Field label="Semana seleccionada">
        <View style={styles.weekSelectorRow}>
          <TouchableOpacity
            style={[styles.weekNavButton, !canGoToPreviousWeek && styles.dim]}
            onPress={() => onShiftWeek(-1)}
            disabled={!canManage || !canGoToPreviousWeek}
          >
            <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.weekCurrentButton}
            onPress={onCurrentWeek}
            disabled={!canManage}
          >
            <Ionicons name="calendar-outline" size={15} color={colors.primary} />
            <ThemedText style={styles.weekCurrentText}>{selectedWeekLabel}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={() => onShiftWeek(1)}
            disabled={!canManage}
          >
            <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.weekHint}>
          {activeWeekHint} {mode === 'create' ? 'Las semanas pasadas quedan deshabilitadas.' : ''}
        </ThemedText>
      </Field>

      <Field label="Rango automatico">
        <View style={styles.autoRangeBox}>
          <ThemedText style={styles.autoRangeText}>
            {formatDateInput(resolvedMeetingDateRange.startDate)} al {formatDateInput(resolvedMeetingDateRange.endDate)}
          </ThemedText>
        </View>
      </Field>

      {meetingType === 'weekend' ? (
        <Field label="Dia exacto">
          <View style={styles.chips}>
            {(['saturday', 'sunday'] as const).map((dayOption) => {
              const optionDate =
                dayOption === 'saturday'
                  ? resolvedMeetingDateRange.startDate
                  : resolvedMeetingDateRange.endDate;

              return (
                <TouchableOpacity
                  key={dayOption}
                  style={[styles.chip, weekendMeetingDay === dayOption && styles.chipActive]}
                  onPress={() => onWeekendDayChange(dayOption)}
                  disabled={!canManage}
                >
                  <ThemedText style={[styles.chipText, weekendMeetingDay === dayOption && styles.chipTextActive]}>
                    {WEEKEND_MEETING_DAY_LABELS[dayOption]} {formatDateInput(optionDate)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <SelectedDateBanner
            text={`${WEEKEND_MEETING_DAY_LABELS[weekendMeetingDay]} ${formatHumanDate(selectedWeekendMeetingDate)}`}
          />
        </Field>
      ) : (
        <Field label="Dia exacto">
          <View style={styles.chips}>
            {MIDWEEK_MEETING_DAY_OPTIONS.map((dayOption) => {
              const optionDate = new Date(resolvedMeetingDateRange.startDate);
              optionDate.setDate(optionDate.getDate() + dayOption.offset);

              return (
                <TouchableOpacity
                  key={dayOption.value}
                  style={[styles.chip, midweekMeetingDay === dayOption.value && styles.chipActive]}
                  onPress={() => onMidweekDayChange(dayOption.value)}
                  disabled={!canManage}
                >
                  <ThemedText style={[styles.chipText, midweekMeetingDay === dayOption.value && styles.chipTextActive]}>
                    {MIDWEEK_MEETING_DAY_LABELS[dayOption.value]} {formatDateInput(optionDate)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <SelectedDateBanner
            text={`${MIDWEEK_MEETING_DAY_LABELS[midweekMeetingDay]} ${formatHumanDate(selectedMidweekMeetingDate)}`}
          />
        </Field>
      )}

      {checkingDuplicate ? (
        <ThemedText style={styles.weekHint}>Revisando si ya hay una reunion en este rango...</ThemedText>
      ) : null}

      {duplicateMeetingHint ? (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.warningDark} />
          <ThemedText style={styles.warningText}>
            Ya existe una reunion de este tipo para el rango seleccionado: {duplicateMeetingHint.title} ({duplicateMeetingHint.dateLabel}).
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function MeetingBasicInfoStep({
  title,
  description,
  location,
  meetingUrl,
  status,
  notes,
  errors,
  canManage,
  onTitleChange,
  onDescriptionChange,
  onLocationChange,
  onMeetingUrlChange,
  onStatusChange,
  onNotesChange,
}: {
  title: string;
  description: string;
  location: string;
  meetingUrl: string;
  status: MeetingStatus;
  notes: string;
  errors: MeetingFormErrors;
  canManage: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onMeetingUrlChange: (value: string) => void;
  onStatusChange: (value: MeetingStatus) => void;
  onNotesChange: (value: string) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.block}>
      <StepHeading
        title="Datos basicos"
        subtitle="Completa la informacion que veran los publicadores."
      />

      <Field label="Titulo *" error={errors.title}>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          value={title}
          onChangeText={onTitleChange}
          editable={canManage}
          placeholderTextColor={colors.textDisabled}
        />
      </Field>

      <Field label="Descripcion">
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={onDescriptionChange}
          editable={canManage}
          multiline
          placeholderTextColor={colors.textDisabled}
        />
      </Field>

      <View style={styles.row}>
        <View style={styles.col}>
          <Field label="Lugar">
            <TextInput style={styles.input} value={location} onChangeText={onLocationChange} editable={canManage} placeholderTextColor={colors.textDisabled} />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Enlace">
            <TextInput style={styles.input} value={meetingUrl} onChangeText={onMeetingUrlChange} editable={canManage} autoCapitalize="none" keyboardType="url" placeholderTextColor={colors.textDisabled} />
          </Field>
        </View>
      </View>

      <Field label="Estado operativo">
        <View style={styles.chips}>
          {STATUS_OPTIONS.map((option) => (
            <TouchableOpacity key={option} style={[styles.chip, status === option && styles.chipActive]} onPress={() => onStatusChange(option)} disabled={!canManage}>
              <ThemedText style={[styles.chipText, status === option && styles.chipTextActive]}>
                {MEETING_STATUS_LABELS[option]}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      <Field label="Notas generales">
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={onNotesChange}
          editable={canManage}
          multiline
          placeholderTextColor={colors.textDisabled}
        />
      </Field>
    </View>
  );
}

function MeetingProgramStep({
  meetingType,
  sections,
  weekendSessions,
  availableUsers,
  missingTemplateSections,
  midweekAssignmentErrors,
  blockedOutgoingTalkUserIds,
  canManage,
  onSectionsChange,
  onWeekendSessionsChange,
  onAssignmentErrorsChange,
  onUpdateSection,
}: {
  meetingType: MeetingProgramType;
  sections: MeetingProgramSection[];
  weekendSessions: WeekendMeetingSessionDraft[];
  availableUsers: ActiveCongregationUser[];
  missingTemplateSections: MeetingProgramSection[];
  midweekAssignmentErrors: Record<string, AssignmentCardEditorErrors>;
  blockedOutgoingTalkUserIds: Set<string>;
  canManage: boolean;
  onSectionsChange: React.Dispatch<React.SetStateAction<MeetingProgramSection[]>>;
  onWeekendSessionsChange: (sessions: WeekendMeetingSessionDraft[]) => void;
  onAssignmentErrorsChange: React.Dispatch<React.SetStateAction<Record<string, AssignmentCardEditorErrors>>>;
  onUpdateSection: (sectionKey: string, updater: (section: MeetingProgramSection) => MeetingProgramSection) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.block}>
      <StepHeading
        title={meetingType === 'weekend' ? 'Programa de fin de semana' : 'Programa entre semana'}
        subtitle="Asigna las partes y deja visibles las secciones que se usaran."
      />

      {meetingType === 'weekend' ? (
        <>
          <ModuleHelp text="El lector de La Atalaya se controla desde Acomodadores y microfonos." />
          <WeekendSessionsEditor
            sessions={weekendSessions}
            users={availableUsers}
            disabled={!canManage}
            blockedUserIds={blockedOutgoingTalkUserIds}
            lockWatchtowerReader
            onChange={onWeekendSessionsChange}
          />
        </>
      ) : (
        <>
          <ModuleHelp text="Los lectores controlados por Acomodadores y microfonos se muestran bloqueados aqui." />
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
              onSectionsChange((current) => [...current, dynamicSection].map((section, index) => ({ ...section, order: index })));
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
                    onSectionsChange((current) => [...current, { ...template, order: current.length }]);
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
                    onChangeText={(nextTitle) => onUpdateSection(section.sectionKey, (current) => ({ ...current, title: nextTitle }))}
                    editable={canManage}
                    placeholderTextColor={colors.textDisabled}
                  />

                  <View style={styles.iconRow}>
                    <TouchableOpacity style={[styles.iconBtn, index === 0 && styles.dim]} onPress={() => onSectionsChange((current) => moveMeetingSection(current, index, index - 1))} disabled={!canManage || index === 0}>
                      <Ionicons name="arrow-up-outline" size={15} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, index === sections.length - 1 && styles.dim]} onPress={() => onSectionsChange((current) => moveMeetingSection(current, index, index + 1))} disabled={!canManage || index === sections.length - 1}>
                      <Ionicons name="arrow-down-outline" size={15} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => onUpdateSection(section.sectionKey, (current) => ({ ...current, isEnabled: !current.isEnabled }))} disabled={!canManage || section.isRequired === true}>
                      <Ionicons name={section.isEnabled ? 'eye-outline' : 'eye-off-outline'} size={15} color={section.isEnabled ? colors.primary : colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => onSectionsChange((current) => current.filter((item) => item.sectionKey !== section.sectionKey).map((item, itemIndex) => ({ ...item, order: itemIndex })))} disabled={!canManage || section.isRequired === true}>
                      <Ionicons name="trash-outline" size={15} color={section.isRequired ? colors.textDisabled : colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <MidweekSectionEditor
                  section={editorSection}
                  users={availableUsers}
                  disabled={!canManage || section.isEnabled === false}
                  errors={midweekAssignmentErrors}
                  blockedUserIds={blockedOutgoingTalkUserIds}
                  onChange={(nextEditorSection) => {
                    onAssignmentErrorsChange((current) => {
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

                    onUpdateSection(section.sectionKey, (currentSection) =>
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
  );
}

function MeetingCleaningStep({
  cleaningSelectionMode,
  cleaningGroups,
  selectedCleaningGroupIds,
  canManage,
  onSelectionModeChange,
  onToggleCleaningGroup,
}: {
  cleaningSelectionMode: CleaningSelectionMode;
  cleaningGroups: CleaningGroup[];
  selectedCleaningGroupIds: string[];
  canManage: boolean;
  onSelectionModeChange: (mode: CleaningSelectionMode) => void;
  onToggleCleaningGroup: (groupId: string) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.block}>
      <StepHeading
        title="Limpieza y modulos sincronizados"
        subtitle="Define si esta reunion dispara asignaciones de limpieza."
      />
      <ModuleHelp text="Este grupo viene desde la planificacion de Limpieza." />

      <Field label="Grupo que toca limpieza">
        <View style={styles.chips}>
          {(['none', 'selected', 'all'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, cleaningSelectionMode === option && styles.chipActive]}
              onPress={() => onSelectionModeChange(option)}
              disabled={!canManage}
            >
              <ThemedText style={[styles.chipText, cleaningSelectionMode === option && styles.chipTextActive]}>
                {option === 'none' ? 'Sin limpieza' : option === 'all' ? 'Limpieza general' : 'Elegir grupos'}
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
                  style={[styles.cleaningGroupChip, isSelected && styles.cleaningGroupChipActive]}
                  onPress={() => onToggleCleaningGroup(group.id)}
                  disabled={!canManage}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={isSelected ? colors.onPrimary : colors.textMuted}
                  />
                  <ThemedText style={[styles.cleaningGroupText, isSelected && styles.cleaningGroupTextActive]}>
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
  );
}

function MeetingReviewStep({
  meetingType,
  selectedWeekLabel,
  selectedMeetingDate,
  location,
  meetingUrl,
  selectedCleaningGroups,
  cleaningSelectionMode,
  effectiveSections,
  missingAssignmentLabels,
  blockedAssignedUserNames,
  controlledFieldLabels,
  duplicateMeetingHint,
}: {
  meetingType: MeetingProgramType;
  selectedWeekLabel: string;
  selectedMeetingDate: Date;
  location: string;
  meetingUrl: string;
  selectedCleaningGroups: CleaningGroup[];
  cleaningSelectionMode: CleaningSelectionMode;
  effectiveSections: MeetingProgramSection[];
  missingAssignmentLabels: string[];
  blockedAssignedUserNames: string[];
  controlledFieldLabels: string[];
  duplicateMeetingHint: MeetingConflictNotice | null;
}) {
  const styles = createStyles(useAppColors());
  const enabledSections = effectiveSections.filter((section) => section.isEnabled !== false);
  const completeSections = enabledSections.filter((section) =>
    !collectMissingAssignmentLabels([section]).length
  );
  const cleaningLabel =
    cleaningSelectionMode === 'none'
      ? 'Sin limpieza asignada'
      : selectedCleaningGroups.length > 0
        ? selectedCleaningGroups.map((group) => group.name).join(', ')
        : 'Pendiente de sincronizar desde Limpieza';

  return (
    <View style={styles.block}>
      <StepHeading
        title="Revision final"
        subtitle="Confirma el resumen antes de publicar."
      />

      <View style={styles.reviewGrid}>
        <ReviewItem label="Tipo" value={MEETING_TYPE_LABELS[meetingType]} />
        <ReviewItem label="Semana" value={selectedWeekLabel} />
        <ReviewItem label="Dia seleccionado" value={formatHumanDate(selectedMeetingDate)} />
        <ReviewItem label="Lugar" value={normalizeText(location) ?? 'Sin lugar'} />
        <ReviewItem label="Enlace" value={normalizeText(meetingUrl) ?? 'Sin enlace'} />
        <ReviewItem label="Limpieza asignada" value={cleaningLabel} />
      </View>

      {duplicateMeetingHint ? (
        <ReviewList
          title="Posible duplicado"
          items={[`Ya existe ${duplicateMeetingHint.title} para ${duplicateMeetingHint.dateLabel}.`]}
          tone="warning"
        />
      ) : null}

      <ReviewList
        title="Secciones completas"
        items={completeSections.map((section) => section.title)}
        emptyText="Todavia no hay secciones completas."
      />

      <ReviewList
        title="Asignaciones faltantes"
        items={missingAssignmentLabels}
        emptyText="No se detectan asignaciones faltantes."
        tone={missingAssignmentLabels.length > 0 ? 'warning' : 'success'}
      />

      <ReviewList
        title="Usuarios bloqueados por salida a discursar"
        items={blockedAssignedUserNames.map((name) => `${name}: ${OUTGOING_TALK_BLOCK_MESSAGE}.`)}
        emptyText="No hay usuarios bloqueados en esta reunion."
        tone={blockedAssignedUserNames.length > 0 ? 'warning' : 'success'}
      />

      <ReviewList
        title="Campos controlados por Acomodadores y microfonos"
        items={controlledFieldLabels}
        emptyText="No hay campos bloqueados por este modulo."
      />
    </View>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const styles = createStyles(useAppColors());
  return (
    <View style={styles.stepHeading}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.stepHeadingSubtitle}>{subtitle}</ThemedText>
    </View>
  );
}

function ModuleHelp({ text }: { text: string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.moduleHelp}>
      <Ionicons name="lock-closed-outline" size={16} color={colors.infoDark} />
      <ThemedText style={styles.moduleHelpText}>{text}</ThemedText>
    </View>
  );
}

function SelectedDateBanner({ text }: { text: string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.selectedDateBanner}>
      <Ionicons name="calendar-clear-outline" size={15} color={colors.primary} />
      <ThemedText style={styles.selectedDateText}>Fecha elegida: {text}</ThemedText>
    </View>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  const styles = createStyles(useAppColors());
  return (
    <View style={styles.reviewItem}>
      <ThemedText style={styles.reviewLabel}>{label}</ThemedText>
      <ThemedText style={styles.reviewValue}>{value}</ThemedText>
    </View>
  );
}

function ReviewList({
  title,
  items,
  emptyText,
  tone = 'neutral',
}: {
  title: string;
  items: string[];
  emptyText?: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const styles = createStyles(useAppColors());
  const content = items.length > 0 ? items : [emptyText ?? 'Sin elementos.'];

  return (
    <View style={[styles.reviewList, tone === 'warning' && styles.reviewListWarning, tone === 'success' && styles.reviewListSuccess]}>
      <ThemedText style={styles.reviewListTitle}>{title}</ThemedText>
      {content.map((item) => (
        <ThemedText key={item} style={styles.reviewListItem}>- {item}</ThemedText>
      ))}
    </View>
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
    stepper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stepPill: { flexGrow: 1, minWidth: 128, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 9, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
    stepPillActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    stepPillDone: { borderColor: colors.success, backgroundColor: colors.successLight },
    stepBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundLight },
    stepBadgeActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    stepBadgeText: { fontSize: 11, color: colors.textMuted, fontWeight: '800' },
    stepBadgeTextActive: { color: colors.onPrimary },
    stepTextWrap: { flex: 1, minWidth: 0 },
    stepTitle: { fontSize: 12, color: colors.textSecondary, fontWeight: '800' },
    stepTitleActive: { color: colors.primary },
    stepSubtitle: { fontSize: 10, color: colors.textMuted },
    stepHeading: { gap: 2 },
    stepHeadingSubtitle: { fontSize: 12, color: colors.textMuted },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
    addButton: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    addButtonText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
    field: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.backgroundLight, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9 },
    autoRangeBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.backgroundLight, paddingHorizontal: 10, paddingVertical: 9 },
    autoRangeText: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
    selectedDateBanner: { borderWidth: 1, borderColor: colors.primary + '44', borderRadius: 9, backgroundColor: colors.primary + '10', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectedDateText: { flex: 1, fontSize: 12, color: colors.primary, fontWeight: '800' },
    warningBox: { borderWidth: 1, borderColor: colors.warning + '55', borderRadius: 10, backgroundColor: colors.warningLight, padding: 10, gap: 8, flexDirection: 'row', alignItems: 'flex-start' },
    warningText: { flex: 1, color: colors.warningDark, fontSize: 12, fontWeight: '700' },
    moduleHelp: { borderWidth: 1, borderColor: colors.info + '44', borderRadius: 10, backgroundColor: colors.infoLight, padding: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
    moduleHelpText: { flex: 1, color: colors.infoDark, fontSize: 12, fontWeight: '700' },
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
    panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    errorBoxTitle: { color: colors.error, fontSize: 12, fontWeight: '800' },
    errorBoxItem: { color: colors.error, fontSize: 12 },
    stepActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    navAction: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    navActionText: { color: colors.textPrimary, fontWeight: '800', fontSize: 12 },
    reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    reviewItem: { flexGrow: 1, flexBasis: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.backgroundLight, padding: 10, gap: 4 },
    reviewLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
    reviewValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    reviewList: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.backgroundLight, padding: 10, gap: 5 },
    reviewListWarning: { borderColor: colors.warning + '55', backgroundColor: colors.warningLight },
    reviewListSuccess: { borderColor: colors.success + '55', backgroundColor: colors.successLight },
    reviewListTitle: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
    reviewListItem: { color: colors.textPrimary, fontSize: 12 },
    secondaryAction: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '12', minHeight: 44 },
    secondaryText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
    primaryAction: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, minHeight: 44 },
    primaryText: { color: colors.onPrimary, fontWeight: '800', fontSize: 13 },
    dim: { opacity: 0.55 },
  });
