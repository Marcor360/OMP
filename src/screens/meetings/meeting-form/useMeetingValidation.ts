import { useMemo } from 'react';

import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { MeetingProgramSection } from '@/src/types/meeting/program';
import { moveWeek } from '@/src/utils/dates/week-range';

import { Mode, collectBlockedAssignedUserNames, getTodayStart } from './meeting-form.mapper';
import {
  collectControlledFieldLabels,
  collectMissingAssignmentLabels,
  validateMeetingTopLevel,
} from './meeting-form.validators';

export const useMeetingValidation = ({
  title,
  mode,
  selectedWeekStart,
  activeMeetingTemplate,
  resolvedMeetingDateRange,
  effectiveSections,
  blockedOutgoingTalkUserIds,
  availableUsers,
}: {
  title: string;
  mode: Mode;
  selectedWeekStart: Date;
  activeMeetingTemplate: {
    getMeetingDateRange: (weekStart: Date) => { startDate: Date; endDate: Date };
  };
  resolvedMeetingDateRange: { startDate: Date; endDate: Date };
  effectiveSections: MeetingProgramSection[];
  blockedOutgoingTalkUserIds: Set<string>;
  availableUsers: ActiveCongregationUser[];
}) => {
  const missingAssignmentLabels = useMemo(
    () => collectMissingAssignmentLabels(effectiveSections),
    [effectiveSections]
  );

  const blockedAssignedUserNames = useMemo(
    () => collectBlockedAssignedUserNames(effectiveSections, blockedOutgoingTalkUserIds, availableUsers),
    [availableUsers, blockedOutgoingTalkUserIds, effectiveSections]
  );

  const controlledFieldLabels = useMemo(
    () => collectControlledFieldLabels(effectiveSections),
    [effectiveSections]
  );

  const canGoToPreviousWeek = useMemo(() => {
    if (mode === 'edit') return true;

    const previousWeekStart = moveWeek(selectedWeekStart, -1);
    const previousRange = activeMeetingTemplate.getMeetingDateRange(previousWeekStart);
    return previousRange.endDate >= getTodayStart();
  }, [activeMeetingTemplate, mode, selectedWeekStart]);

  const validateTopLevel = () => {
    const errors = validateMeetingTopLevel(title);

    return {
      errors,
      isValid: Object.keys(errors).length === 0,
      startDate: resolvedMeetingDateRange.startDate,
      endDate: resolvedMeetingDateRange.endDate,
    };
  };

  return {
    missingAssignmentLabels,
    blockedAssignedUserNames,
    controlledFieldLabels,
    canGoToPreviousWeek,
    validateTopLevel,
  };
};
