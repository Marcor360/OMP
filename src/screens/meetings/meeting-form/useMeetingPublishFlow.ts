import { Timestamp } from 'firebase/firestore';

import {
  OUTGOING_TALK_BLOCK_MESSAGE,
} from '@/src/modules/assignments/utils/outgoing-talks';
import { setMeetingPublicationStatus } from '@/src/services/meetings/meeting-publish-service';
import { syncMeetingCleaningAssignmentsByManager } from '@/src/services/meetings/manager-meetings-service';
import { validateMeetingBeforePublish } from '@/src/services/meetings/meeting-program-utils';
import { createMeeting, updateMeeting } from '@/src/services/meetings/meetings-service';
import { validateWeekendSessionsForPublish, WeekendMeetingSessionDraft } from '@/src/services/meetings/weekend-meeting-adapter';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { UpdateMeetingDTO } from '@/src/types/meeting';
import { MeetingProgramSection, MeetingProgramType } from '@/src/types/meeting/program';
import { formatFirestoreError } from '@/src/utils/errors/errors';

import {
  CleaningSelectionMode,
  DEFAULT_TITLE_BY_TYPE,
  FormStepKey,
  Mode,
  SaveIntent,
  buildMeetingPayload,
  normalizeText,
} from './meeting-form.mapper';
import {
  MeetingFormErrors,
  validateMidweekAssignmentTitles,
  validateMidweekParticipantInputs,
} from './meeting-form.validators';

export const useMeetingPublishFlow = ({
  mode,
  id,
  congregationId,
  uid,
  authUid,
  authEmail,
  appUserDisplayName,
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
  validateTopLevel,
  setMidweekAssignmentErrors,
  setCurrentStep,
  setSavingIntent,
  setSaveError,
  showPanelErrors,
  clearPanelErrors,
  scrollToTop,
  replaceRoute,
}: {
  mode: Mode;
  id?: string;
  congregationId: string | null;
  uid: string | null;
  authUid?: string | null;
  authEmail?: string | null;
  appUserDisplayName?: string | null;
  isReviewStep: boolean;
  meetingType: MeetingProgramType;
  title: string;
  description: string;
  selectedWeekLabel: string;
  status: UpdateMeetingDTO['status'];
  location: string;
  meetingUrl: string;
  notes: string;
  effectiveSections: MeetingProgramSection[];
  sections: MeetingProgramSection[];
  weekendSessions: WeekendMeetingSessionDraft[];
  availableUsers: ActiveCongregationUser[];
  blockedOutgoingTalkUserIds: Set<string>;
  cleaningSelectionMode: CleaningSelectionMode;
  selectedCleaningGroups: { id: string; name: string }[];
  resolvedMeetingDate: Date;
  validateTopLevel: () => {
    errors: MeetingFormErrors;
    isValid: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  setMidweekAssignmentErrors: (errors: ReturnType<typeof validateMidweekAssignmentTitles>['assignmentErrors']) => void;
  setCurrentStep: (step: FormStepKey) => void;
  setSavingIntent: (intent: SaveIntent | null) => void;
  setSaveError: (message: string | null) => void;
  showPanelErrors: (messages: string[]) => void;
  clearPanelErrors: () => void;
  scrollToTop: () => void;
  replaceRoute: (href: string) => void;
}) => {
  const persistMeeting = async (intent: SaveIntent): Promise<string | null> => {
    if (!congregationId) {
      showPanelErrors(['No se encontro la congregacion del usuario actual.']);
      return null;
    }

    const validation = validateTopLevel();
    if (!validation.isValid || !validation.startDate || !validation.endDate) {
      showPanelErrors(['Corrige los campos marcados antes de guardar.']);
      setCurrentStep('basic');
      return null;
    }

    const actorUid = normalizeText(authUid ?? uid ?? '');
    if (!actorUid) {
      showPanelErrors(['Tu sesion no tiene un UID valido para guardar. Cierra sesion e inicia nuevamente.']);
      return null;
    }

    if (meetingType === 'midweek') {
      const titleValidation = validateMidweekAssignmentTitles(sections);
      setMidweekAssignmentErrors(titleValidation.assignmentErrors);
      if (titleValidation.errors.length > 0) {
        showPanelErrors(titleValidation.errors);
        setCurrentStep('program');
        return null;
      }
    } else {
      setMidweekAssignmentErrors({});
    }

    const payload = buildMeetingPayload({
      startDate: validation.startDate,
      endDate: validation.endDate,
      actorUid,
      resolvedMeetingDate,
      title,
      description,
      meetingType,
      selectedWeekLabel,
      status: status ?? 'scheduled',
      location,
      meetingUrl,
      notes,
      effectiveSections,
      cleaningSelectionMode,
      selectedCleaningGroups,
    });
    const blockedAssignedUsers = new Set(
      (payload.sections ?? [])
        .flatMap((section) => section.assignments)
        .flatMap((assignment) => assignment.assignees)
        .map((assignee) => assignee.assigneeUserId)
        .filter((candidate): candidate is string => Boolean(candidate))
        .filter((candidate) => blockedOutgoingTalkUserIds.has(candidate))
    );

    if (blockedAssignedUsers.size > 0) {
      const blockedErrors = Array.from(blockedAssignedUsers).map((userId) => {
        const name = availableUsers.find((item) => item.uid === userId)?.displayName ?? userId;
        return `${name}: ${OUTGOING_TALK_BLOCK_MESSAGE}.`;
      });
      showPanelErrors(blockedErrors);
      return null;
    }

    if (intent === 'published') {
      if (meetingType === 'midweek') {
        const midweekParticipantErrors = validateMidweekParticipantInputs({
          sections,
          availableUsers,
          blockedOutgoingTalkUserIds,
        });
        if (midweekParticipantErrors.length > 0) {
          showPanelErrors(midweekParticipantErrors);
          setCurrentStep('program');
          return null;
        }
      }

      if (meetingType === 'weekend') {
        const weekendValidationErrors = validateWeekendSessionsForPublish(
          weekendSessions,
          availableUsers
        );
        const weekendBlockedErrors = weekendSessions.flatMap((session, index) => {
          const blockedNames = [
            session.publicTalk.speaker.userId,
            session.watchtowerStudy.conductor.userId,
            session.watchtowerStudy.reader.userId,
          ]
            .filter((candidate): candidate is string => Boolean(candidate))
            .filter((candidate) => blockedOutgoingTalkUserIds.has(candidate))
            .map((candidate) => availableUsers.find((item) => item.uid === candidate)?.displayName ?? candidate);

          return blockedNames.map(
            (name) => `Sesion ${index + 1}: ${name} - ${OUTGOING_TALK_BLOCK_MESSAGE}.`
          );
        });

        if (weekendValidationErrors.length > 0 || weekendBlockedErrors.length > 0) {
          const allErrors = [...weekendValidationErrors, ...weekendBlockedErrors];
          showPanelErrors(allErrors);
          setCurrentStep('program');
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
        showPanelErrors(publishValidation.errors);
        return null;
      }

      clearPanelErrors();
    }

    if (mode === 'create') {
      return createMeeting(
        congregationId,
        payload,
        actorUid,
        appUserDisplayName ?? authEmail ?? 'Usuario'
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
    if (intent === 'published' && !isReviewStep) {
      clearPanelErrors();
      setCurrentStep('review');
      requestAnimationFrame(scrollToTop);
      return;
    }

    setSavingIntent(intent);
    setSaveError(null);

    try {
      const meetingId = await persistMeeting(intent);
      if (!meetingId || !congregationId) {
        setSaveError('No se pudo guardar la reunion. Revisa los campos e intenta nuevamente.');
        scrollToTop();
        return;
      }

      await syncMeetingCleaningAssignmentsByManager({
        congregationId,
        meetingId,
        mode: cleaningSelectionMode,
        groups: selectedCleaningGroups.map((group) => ({ id: group.id, name: group.name })),
        meetingTitle: normalizeText(title) ?? DEFAULT_TITLE_BY_TYPE[meetingType],
        meetingDate: Timestamp.fromDate(resolvedMeetingDate),
        assignedByName: appUserDisplayName ?? authEmail ?? 'Usuario',
      });

      if (intent === 'draft') {
        if (mode === 'edit') {
          await setMeetingPublicationStatus({
            congregationId,
            meetingId,
            publicationStatus: 'draft',
          });
        }

        replaceRoute('/(protected)/meetings/manage');
        return;
      }

      const publishResult = await setMeetingPublicationStatus({
        congregationId,
        meetingId,
        publicationStatus: 'published',
      });

      if (!publishResult.ok) {
        showPanelErrors(publishResult.errors);

        if (mode === 'create') {
          replaceRoute(`/(protected)/meetings/edit/${meetingId}`);
        }

        return;
      }

      replaceRoute('/(protected)/meetings/manage');
    } catch (requestError) {
      const message = formatFirestoreError(requestError);
      setSaveError(message);
      showPanelErrors([message]);
    } finally {
      setSavingIntent(null);
    }
  };

  return { handleSave };
};
