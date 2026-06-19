import { useState } from 'react';

import { AssignmentCardEditorErrors } from '@/src/components/meetings/midweek/AssignmentCardEditor';
import { OutgoingTalk } from '@/src/modules/assignments/types/outgoing-talks.types';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import {
  WeekendMeetingSessionDraft,
  createEmptyWeekendMeetingSession,
  extractWeekendSessionsFromSections,
} from '@/src/services/meetings/weekend-meeting-adapter';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { MeetingStatus } from '@/src/types/meeting';
import {
  MeetingProgramSection,
  MeetingProgramType,
  createDefaultSectionsForMeetingType,
} from '@/src/types/meeting/program';

import {
  CleaningSelectionMode,
  DEFAULT_TITLE_BY_TYPE,
  FormStepKey,
  MeetingConflictNotice,
  MidweekMeetingDay,
  Mode,
  SaveIntent,
  WeekendMeetingDay,
} from './meeting-form.mapper';
import { MeetingFormErrors, PublishPanelItem } from './meeting-form.validators';

export const useMeetingFormState = ({
  mode,
  initialType,
  initialWeekStart,
}: {
  mode: Mode;
  initialType: MeetingProgramType;
  initialWeekStart: Date;
}) => {
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
  const [outgoingTalks, setOutgoingTalks] = useState<OutgoingTalk[]>([]);
  const [cleaningGroups, setCleaningGroups] = useState<CleaningGroup[]>([]);
  const [cleaningSelectionMode, setCleaningSelectionMode] = useState<CleaningSelectionMode>('none');
  const [selectedCleaningGroupIds, setSelectedCleaningGroupIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<MeetingFormErrors>({});
  const [midweekAssignmentErrors, setMidweekAssignmentErrors] = useState<
    Record<string, AssignmentCardEditorErrors>
  >({});
  const [publishErrors, setPublishErrors] = useState<PublishPanelItem[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<FormStepKey>('date');
  const [duplicateMeetingHint, setDuplicateMeetingHint] = useState<MeetingConflictNotice | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [savingIntent, setSavingIntent] = useState<SaveIntent | null>(null);

  return {
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
  };
};
