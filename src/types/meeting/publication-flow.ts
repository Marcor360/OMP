export type MeetingPublicationStatus = 'draft' | 'awaiting_assignments' | 'published';

export const MEETING_PUBLICATION_FLOW: Record<
  MeetingPublicationStatus,
  MeetingPublicationStatus[]
> = {
  draft: ['awaiting_assignments'],
  awaiting_assignments: ['published'],
  published: ['awaiting_assignments'],
};

export const canTransitionPublicationStatus = (
  from: MeetingPublicationStatus,
  to: MeetingPublicationStatus
): boolean => from === to || MEETING_PUBLICATION_FLOW[from].includes(to);
