/**
 * Pruebas unitarias — Resumen de dashboard
 *
 * Verifica el conteo de scheduledMeetings por publicationStatus,
 * replicando el filtro puro usado en refreshDashboardSummary.
 */

type MeetingDoc = { data: () => Record<string, unknown> };

const countScheduledMeetings = (docs: MeetingDoc[]): number =>
  docs.filter((docSnap) => docSnap.data().publicationStatus === 'published').length;

const meetingDoc = (data: Record<string, unknown>): MeetingDoc => ({ data: () => data });

describe('countScheduledMeetings (dashboard-summary)', () => {
  it('cuenta las reuniones publicadas', () => {
    const docs = [meetingDoc({ publicationStatus: 'published' })];
    expect(countScheduledMeetings(docs)).toBe(1);
  });

  it('no cuenta reuniones en borrador', () => {
    const docs = [meetingDoc({ publicationStatus: 'draft' })];
    expect(countScheduledMeetings(docs)).toBe(0);
  });

  it('no cuenta reuniones en espera de asignaciones', () => {
    const docs = [meetingDoc({ publicationStatus: 'awaiting_assignments' })];
    expect(countScheduledMeetings(docs)).toBe(0);
  });

  it('cuenta solo las publicadas dentro de un conjunto mixto', () => {
    const docs = [
      meetingDoc({ publicationStatus: 'published' }),
      meetingDoc({ publicationStatus: 'draft' }),
      meetingDoc({ publicationStatus: 'awaiting_assignments' }),
      meetingDoc({ publicationStatus: 'published' }),
    ];
    expect(countScheduledMeetings(docs)).toBe(2);
  });
});
