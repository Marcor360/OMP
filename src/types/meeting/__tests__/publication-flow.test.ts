import {
  canTransitionPublicationStatus,
  type MeetingPublicationStatus,
} from '@/src/types/meeting/publication-flow';

describe('meeting publication flow', () => {
  it('permite unicamente las transiciones operativas', () => {
    expect(canTransitionPublicationStatus('draft', 'published')).toBe(false);
    expect(canTransitionPublicationStatus('draft', 'awaiting_assignments')).toBe(true);
    expect(canTransitionPublicationStatus('awaiting_assignments', 'published')).toBe(true);
    expect(canTransitionPublicationStatus('published', 'draft')).toBe(false);
  });

  it.each<MeetingPublicationStatus>(['draft', 'awaiting_assignments', 'published'])(
    'permite conservar el estado %s',
    (status) => {
      expect(canTransitionPublicationStatus(status, status)).toBe(true);
    }
  );
});
