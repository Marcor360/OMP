import type { MeetingProgramSection } from '@/src/types/meeting/program';

export type SectionChoice = 'draft' | 'server';

const comparableFields = new Set(['publishNotificationSentAt', 'reminderSentAt', 'order']);

const compare = (section: MeetingProgramSection | undefined) => JSON.stringify(section, (key, value: unknown) => {
  if (comparableFields.has(key)) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
});

export const compareMeetingSections = (
  baseline: MeetingProgramSection[],
  draft: MeetingProgramSection[],
  server: MeetingProgramSection[],
) => {
  const old = new Map(baseline.map((section) => [section.sectionKey, section]));
  const mine = new Map(draft.map((section) => [section.sectionKey, section]));
  const current = new Map(server.map((section) => [section.sectionKey, section]));
  return Array.from(new Set([...current.keys(), ...mine.keys(), ...old.keys()])).map((key) => {
    const original = compare(old.get(key));
    const draftSection = mine.get(key);
    const serverSection = current.get(key);
    const draftContent = compare(draftSection);
    const serverContent = compare(serverSection);
    return {
      key, draft: draftSection, server: serverSection,
      different: draftContent !== serverContent,
      mineChanged: draftContent !== original,
      conflict: draftContent !== original && serverContent !== original && draftContent !== serverContent,
    };
  });
};

export const mergeMeetingSections = (
  comparison: ReturnType<typeof compareMeetingSections>,
  choices: Record<string, SectionChoice>,
): MeetingProgramSection[] | undefined => {
  if (comparison.some((row) => row.conflict && !choices[row.key])) return undefined;
  return comparison.flatMap((row) => {
    const choice = row.conflict ? choices[row.key] : row.mineChanged ? 'draft' : 'server';
    const section = choice === 'draft' ? row.draft : row.server;
    return section ? [section] : [];
  }).map((section, order) => ({ ...section, order }));
};
