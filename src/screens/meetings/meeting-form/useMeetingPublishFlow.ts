import { Timestamp } from 'firebase/firestore';

import { syncMeetingCleaningAssignmentsByManager } from '@/src/services/meetings/manager-meetings-service';
import { createMeeting, updateMeeting } from '@/src/services/meetings/meetings-service';
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
import { MeetingFormErrors } from './meeting-form.validators';

type MeetingPublishFlowProps = {
  mode: Mode;
  id?: string;
  congregationId: string | null;
  uid: string | null;
  authUid?: string | null;
  authEmail?: string | null;
  appUserDisplayName?: string | null;
  meetingType: MeetingProgramType;
  title: string;
  description: string;
  selectedWeekLabel: string;
  location: string;
  meetingUrl: string;
  notes: string;
  effectiveSections: MeetingProgramSection[];
  cleaningSelectionMode: CleaningSelectionMode;
  selectedCleaningGroups: { id: string; name: string }[];
  resolvedMeetingDate: Date;
  savingIntent: SaveIntent | null;
  validateTopLevel: () => {
    errors: MeetingFormErrors;
    isValid: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  setCurrentStep: (step: FormStepKey) => void;
  setSavingIntent: (intent: SaveIntent | null) => void;
  setSaveError: (message: string | null) => void;
  showPanelErrors: (messages: string[]) => void;
  clearPanelErrors: () => void;
  scrollToTop: () => void;
  replaceRoute: (href: string) => void;
};

export const useMeetingPublishFlow = ({
  mode,
  id,
  congregationId,
  uid,
  authUid,
  authEmail,
  appUserDisplayName,
  meetingType,
  title,
  description,
  selectedWeekLabel,
  location,
  meetingUrl,
  notes,
  effectiveSections,
  cleaningSelectionMode,
  selectedCleaningGroups,
  resolvedMeetingDate,
  savingIntent,
  validateTopLevel,
  setCurrentStep,
  setSavingIntent,
  setSaveError,
  showPanelErrors,
  clearPanelErrors,
  scrollToTop,
  replaceRoute,
}: MeetingPublishFlowProps) => {
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
      showPanelErrors([
        'Tu sesion no tiene un UID valido para guardar. Cierra sesion e inicia nuevamente.',
      ]);
      return null;
    }

    const payload = buildMeetingPayload({
      mode,
      intent,
      startDate: validation.startDate,
      endDate: validation.endDate,
      actorUid,
      resolvedMeetingDate,
      title,
      description,
      meetingType,
      selectedWeekLabel,
      location,
      meetingUrl,
      notes,
      effectiveSections,
      cleaningSelectionMode,
      selectedCleaningGroups,
    });

    if (mode === 'create') {
      return createMeeting(
        congregationId,
        payload,
        actorUid,
        appUserDisplayName ?? authEmail ?? 'Usuario'
      );
    }

    if (!id) return null;

    const updatePayload: UpdateMeetingDTO = { ...payload, updatedBy: actorUid };
    await updateMeeting(congregationId, id, updatePayload);
    return id;
  };

  const handleSave = async (intent: SaveIntent) => {
    if (savingIntent !== null) return;

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

      clearPanelErrors();
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
