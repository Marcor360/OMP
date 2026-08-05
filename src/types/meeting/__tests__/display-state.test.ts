import { resolveMeetingDisplayState } from '@/src/types/meeting/display-state';
import type { MeetingPublicationStatus } from '@/src/types/meeting/publication-flow';

describe('resolveMeetingDisplayState', () => {
  it('mapea published a scheduled', () => {
    expect(resolveMeetingDisplayState('published')).toBe('scheduled');
  });

  it.each<MeetingPublicationStatus>(['draft', 'awaiting_assignments'])(
    'mapea %s a in_progress',
    (publicationStatus) => {
      expect(resolveMeetingDisplayState(publicationStatus)).toBe('in_progress');
    }
  );

  it('mapea undefined a in_progress', () => {
    expect(resolveMeetingDisplayState(undefined)).toBe('in_progress');
  });
});
