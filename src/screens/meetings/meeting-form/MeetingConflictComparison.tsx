import { useState } from 'react';
import { Button, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import type { MeetingProgramSection } from '@/src/types/meeting/program';
import { compareMeetingSections, mergeMeetingSections, type SectionChoice } from './section-conflicts';

const summarize = (section: MeetingProgramSection | undefined) => section
  ? [section.title, ...section.assignments.map((assignment) => {
    const names = assignment.assignees
      .map((person) => person.assigneeNameSnapshot ?? person.assigneeUserId ?? person.externalCongregationName)
      .filter(Boolean);
    const schedule = [assignment.startTime, assignment.endTime].filter(Boolean).join('–');
    return [assignment.roleLabel, assignment.title, schedule, names.join(', '), assignment.notes].filter(Boolean).join(' · ');
  })].join('\n')
  : undefined;

export function MeetingConflictComparison({ baseline, draft, server, onApply }: {
  baseline: MeetingProgramSection[];
  draft: MeetingProgramSection[];
  server: MeetingProgramSection[];
  onApply?: (sections: MeetingProgramSection[]) => void;
}) {
  const { t } = useI18n();
  const [choices, setChoices] = useState<Record<string, SectionChoice>>(() => Object.create(null));
  const rows = compareMeetingSections(baseline, draft, server);
  const merged = mergeMeetingSections(rows, choices);
  const choose = (key: string, value: SectionChoice) => setChoices((previous) =>
    Object.assign(Object.create(null), previous, { [key]: value })
  );
  return (
    <View style={{ gap: 10 }}>
      <ThemedText type="defaultSemiBold">{t('meetings.conflictReview.title')}</ThemedText>
      {rows.every((row) => !row.different) ? <ThemedText>{t('meetings.conflictReview.noSectionChanges')}</ThemedText> : null}
      {rows.filter((row) => row.different).map((row) => (
        <View key={row.key} style={{ gap: 6 }}>
          <ThemedText type="defaultSemiBold">{row.draft?.title ?? row.server?.title ?? row.key}</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexGrow: 1, flexBasis: 160, gap: 4 }}>
              <ThemedText type="defaultSemiBold">{t('meetings.conflictReview.draft')}</ThemedText>
              <ThemedText>{summarize(row.draft) ?? t('meetings.conflictReview.sectionMissing')}</ThemedText>
              {row.draft?.isEnabled === false ? <ThemedText>{t('meetings.conflictReview.sectionDisabled')}</ThemedText> : null}
              {onApply && row.conflict ? <Button title={t('meetings.conflictReview.keepDraft')} disabled={choices[row.key] === 'draft'} onPress={() => choose(row.key, 'draft')} /> : null}
            </View>
            <View style={{ flexGrow: 1, flexBasis: 160, gap: 4 }}>
              <ThemedText type="defaultSemiBold">{t('meetings.conflictReview.current')}</ThemedText>
              <ThemedText>{summarize(row.server) ?? t('meetings.conflictReview.sectionMissing')}</ThemedText>
              {row.server?.isEnabled === false ? <ThemedText>{t('meetings.conflictReview.sectionDisabled')}</ThemedText> : null}
              {onApply && row.conflict ? <Button title={t('meetings.conflictReview.keepCurrent')} disabled={choices[row.key] === 'server'} onPress={() => choose(row.key, 'server')} /> : null}
            </View>
          </View>
        </View>
      ))}
      {onApply ? (
        <>
          <ThemedText>{t('meetings.conflictReview.applyHint')}</ThemedText>
          <Button title={t('meetings.conflictReview.apply')} disabled={!merged} onPress={() => { if (merged) onApply(merged); }} />
        </>
      ) : null}
    </View>
  );
}
