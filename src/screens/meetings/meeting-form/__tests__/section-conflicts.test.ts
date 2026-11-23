import type { MeetingProgramSection } from '@/src/types/meeting/program';
import { compareMeetingSections, mergeMeetingSections } from '../section-conflicts';

const section = (sectionKey: string, title: string): MeetingProgramSection => ({
  sectionKey, title, order: 0, sectionType: 'dynamic', isEnabled: true, assignments: [],
});

it('retains independent changes and waits for a choice on an overlapping edit', () => {
  const base = [section('mine', 'Before'), section('server', 'Before'), section('both', 'Before')];
  const comparison = compareMeetingSections(
    base,
    [section('mine', 'Kept draft'), base[1], section('both', 'Draft conflict')],
    [base[0], section('server', 'Kept server'), section('both', 'Server conflict')],
  );
  expect(mergeMeetingSections(comparison, {})).toBeUndefined();
  expect(mergeMeetingSections(comparison, { both: 'server' })?.map((item) => item.title))
    .toEqual(['Kept draft', 'Kept server', 'Server conflict']);
});
