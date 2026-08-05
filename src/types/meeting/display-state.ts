import { MeetingPublicationStatus } from '@/src/types/meeting/publication-flow';

export type MeetingDisplayState = 'in_progress' | 'scheduled';

export const MEETING_DISPLAY_STATE_LABELS: Record<MeetingDisplayState, string> = {
  in_progress: 'En progreso',
  scheduled: 'Programada',
};

export const resolveMeetingDisplayState = (
  publicationStatus: MeetingPublicationStatus | undefined
): MeetingDisplayState => (publicationStatus === 'published' ? 'scheduled' : 'in_progress');
