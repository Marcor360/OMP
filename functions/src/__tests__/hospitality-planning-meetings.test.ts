/**
 * Pruebas unitarias — ensurePlanningMeetingsByManager y sincronizacion de
 * reuniones de hospitalidad (R2.A / R2.B)
 *
 * Igual que el resto de functions/src/__tests__, prueba los helpers puros
 * exportados de planning-schedules.ts en vez de mockear el Admin SDK: este
 * repo no mockea Firestore en ninguna prueba de functions/.
 */

import { Timestamp } from 'firebase-admin/firestore';

import {
  buildPlanningMeetingCandidates,
  buildPlanningMeetingSkeleton,
  classifyMeetingKind,
  hospitalityScheduleItemDocId,
  isPreferredMeetingMatch,
  planningMeetingDocId,
  reconcilePlanningMeetingCandidates,
} from '../planning-schedules.js';

// ─── Espejo minimo de validMeetingData (rules_src/11-meetings-validation.rules) ──
// No importa el .rules (no es TS); replica solo lo necesario para verificar que
// el esqueleto generado por buildPlanningMeetingSkeleton pasaria esa validacion,
// no solo el tipo TS.

const ALLOWED_MEETING_KEYS = new Set([
  'congregationId', 'type', 'meetingCategory', 'title', 'description', 'date',
  'status', 'publicationStatus', 'weekLabel', 'bibleReading', 'startDate',
  'endDate', 'meetingDate', 'publishedAt', 'location', 'meetingUrl',
  'zoomMeetingId', 'zoomPasscode', 'organizerUid', 'organizerName', 'attendees',
  'attendeeNames', 'assignedUserIds', 'cleaningAssignmentMode',
  'cleaningGroupIds', 'cleaningGroupNames', 'searchableText', 'notes',
  'openingSong', 'openingPrayer', 'middleSong', 'closingSong', 'closingPrayer',
  'chairman', 'sections', 'midweekSections', 'createdBy', 'updatedBy',
  'createdAt', 'updatedAt',
]);
const REQUIRED_MEETING_KEYS = ['type', 'title', 'startDate', 'endDate', 'meetingDate'];
const VALID_MEETING_TYPES = ['midweek', 'weekend', 'internal', 'external', 'review', 'training', 'cleaning', 'hospitality'];

// Los sentinelas FieldValue.serverTimestamp() se resuelven a timestamps reales
// al escribir; para esta prueba de forma los tratamos como validos igual que
// Firestore lo haria en request.resource.data.
const isTimestampLike = (value: unknown): boolean =>
  value instanceof Timestamp ||
  (typeof value === 'object' && value !== null && '_methodName' in (value as Record<string, unknown>));

function assertSatisfiesValidMeetingData(data: Record<string, unknown>): void {
  const keys = Object.keys(data);
  const unknownKeys = keys.filter((key) => !ALLOWED_MEETING_KEYS.has(key));
  expect(unknownKeys).toEqual([]);

  const missingKeys = REQUIRED_MEETING_KEYS.filter((key) => !keys.includes(key));
  expect(missingKeys).toEqual([]);

  expect(VALID_MEETING_TYPES).toContain(data.type);
  expect(typeof data.title).toBe('string');
  expect((data.title as string).length).toBeGreaterThan(0);
  expect(isTimestampLike(data.startDate)).toBe(true);
  expect(isTimestampLike(data.endDate)).toBe(true);
  expect(isTimestampLike(data.meetingDate)).toBe(true);

  if ('status' in data) {
    expect(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']).toContain(data.status);
  }
  if ('meetingCategory' in data) {
    expect(['general', 'midweek', 'weekend']).toContain(data.meetingCategory);
  }
  if ('publicationStatus' in data) {
    expect(['draft', 'awaiting_assignments', 'published']).toContain(data.publicationStatus);
  }
  if ('assignedUserIds' in data) {
    expect(Array.isArray(data.assignedUserIds)).toBe(true);
  }
  if ('sections' in data) {
    expect(Array.isArray(data.sections)).toBe(true);
  }
}

describe('buildPlanningMeetingSkeleton', () => {
  it('genera un esqueleto midweek que satisface validMeetingData', () => {
    const skeleton = buildPlanningMeetingSkeleton({
      dateKey: '2026-09-02',
      meetingType: 'midweek',
      requesterUid: 'manager-uid',
    });

    assertSatisfiesValidMeetingData(skeleton);
    expect(skeleton.type).toBe('midweek');
    expect(skeleton.meetingCategory).toBe('midweek');
    expect(skeleton.publicationStatus).toBe('awaiting_assignments');
  });

  it('genera un esqueleto weekend que satisface validMeetingData', () => {
    const skeleton = buildPlanningMeetingSkeleton({
      dateKey: '2026-09-06',
      meetingType: 'weekend',
      requesterUid: 'manager-uid',
    });

    assertSatisfiesValidMeetingData(skeleton);
    expect(skeleton.type).toBe('weekend');
    expect(skeleton.meetingCategory).toBe('weekend');
  });

  it('no incluye el campo origin (no esta en allowedMeetingKeys)', () => {
    const skeleton = buildPlanningMeetingSkeleton({
      dateKey: '2026-09-02',
      meetingType: 'midweek',
      requesterUid: 'manager-uid',
    });

    expect('origin' in skeleton).toBe(false);
  });

  it('fija meetingDate a las 00:00 del dia y startDate <= endDate', () => {
    const skeleton = buildPlanningMeetingSkeleton({
      dateKey: '2026-09-02',
      meetingType: 'midweek',
      requesterUid: 'manager-uid',
    });

    const meetingDate = skeleton.meetingDate as Timestamp;
    const startDate = skeleton.startDate as Timestamp;
    const endDate = skeleton.endDate as Timestamp;
    const local = meetingDate.toDate();
    expect(local.getHours()).toBe(0);
    expect(local.getMinutes()).toBe(0);
    expect(startDate.toMillis()).toBeLessThanOrEqual(endDate.toMillis());
  });
});

describe('planningMeetingDocId', () => {
  it('es idempotente por construccion', () => {
    expect(planningMeetingDocId('2026-09-02', 'midweek')).toBe('planning-2026-09-02-midweek');
    expect(planningMeetingDocId('2026-09-02', 'midweek')).toBe(planningMeetingDocId('2026-09-02', 'midweek'));
  });
});

describe('buildPlanningMeetingCandidates + reconcilePlanningMeetingCandidates', () => {
  // Miercoles=midweekDay 3, Sabado=weekendDay 6 (getDay(): 0=domingo).
  const fourWeekRange = {
    startDate: new Date(2026, 7, 3), // lunes 3 de agosto de 2026
    endDate: new Date(2026, 7, 30), // domingo 30 de agosto de 2026 (4 semanas)
    midweekDay: 3,
    weekendDay: 6,
  };

  it('genera 4 candidatos midweek y 4 weekend para un rango de 4 semanas', () => {
    const candidates = buildPlanningMeetingCandidates(fourWeekRange);
    expect(candidates.filter((c) => c.meetingType === 'midweek')).toHaveLength(4);
    expect(candidates.filter((c) => c.meetingType === 'weekend')).toHaveLength(4);
  });

  it('sin reuniones previas: createdMidweek=4, createdWeekend=4, existing=0', () => {
    const candidates = buildPlanningMeetingCandidates(fourWeekRange);
    const result = reconcilePlanningMeetingCandidates(candidates, new Set());

    expect(result.createdMidweek).toBe(4);
    expect(result.createdWeekend).toBe(4);
    expect(result.existing).toBe(0);
    expect(result.toCreate).toHaveLength(8);
  });

  it('idempotencia: segunda invocacion con las 8 reuniones ya creadas -> created 0/0, existing 8', () => {
    const candidates = buildPlanningMeetingCandidates(fourWeekRange);
    const existingKeys = new Set(candidates.map((c) => `${c.dateKey}::${c.meetingType}`));
    const result = reconcilePlanningMeetingCandidates(candidates, existingKeys);

    expect(result.createdMidweek).toBe(0);
    expect(result.createdWeekend).toBe(0);
    expect(result.existing).toBe(8);
    expect(result.toCreate).toHaveLength(0);
  });

  it('reconoce parcialmente: algunas fechas ya tienen reunion, otras no', () => {
    const candidates = buildPlanningMeetingCandidates(fourWeekRange);
    const partialExisting = new Set([`${candidates[0].dateKey}::${candidates[0].meetingType}`]);
    const result = reconcilePlanningMeetingCandidates(candidates, partialExisting);

    expect(result.existing).toBe(1);
    expect(result.toCreate).toHaveLength(7);
  });
});

describe('classifyMeetingKind', () => {
  it('clasifica por meetingCategory cuando esta presente', () => {
    expect(classifyMeetingKind({ meetingCategory: 'midweek', type: 'internal' })).toBe('midweek');
    expect(classifyMeetingKind({ meetingCategory: 'weekend', type: 'internal' })).toBe('weekend');
  });

  it('clasifica por type cuando no hay meetingCategory reconocible', () => {
    expect(classifyMeetingKind({ type: 'midweek' })).toBe('midweek');
    expect(classifyMeetingKind({ type: 'weekend' })).toBe('weekend');
  });

  it('NO clasifica reuniones especiales como weekend (regresion H11)', () => {
    expect(classifyMeetingKind({ type: 'training' })).toBeNull();
    expect(classifyMeetingKind({ type: 'external' })).toBeNull();
    expect(classifyMeetingKind({ type: 'review' })).toBeNull();
    expect(classifyMeetingKind({})).toBeNull();
  });

  it('dos reuniones el mismo dia (weekend + especial): solo la weekend clasifica', () => {
    const weekendMeeting = { id: 'meeting-weekend', type: 'weekend', meetingCategory: 'weekend' };
    const specialMeeting = { id: 'meeting-assembly', type: 'external' };
    const sameDayDocs = [weekendMeeting, specialMeeting];

    const matches = sameDayDocs.filter((doc) => classifyMeetingKind(doc) === 'weekend');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('meeting-weekend');
  });
});

describe('isPreferredMeetingMatch', () => {
  const requestedDateRange = {
    start: Timestamp.fromDate(new Date(2026, 7, 3, 0, 0, 0, 0)),
    end: Timestamp.fromDate(new Date(2026, 7, 3, 23, 59, 59, 999)),
  };

  it('acepta un meetingId cuya fecha y tipo coinciden (evita la query de rango)', () => {
    const data = {
      type: 'midweek',
      meetingCategory: 'midweek',
      meetingDate: Timestamp.fromDate(new Date(2026, 7, 3, 0, 0, 0, 0)),
    };

    expect(isPreferredMeetingMatch({ data, requestedDateRange, meetingType: 'midweek' })).toBe(true);
  });

  it('rechaza un meetingId cuya fecha ya no coincide (reunion movida)', () => {
    const data = {
      type: 'midweek',
      meetingCategory: 'midweek',
      meetingDate: Timestamp.fromDate(new Date(2026, 7, 4, 0, 0, 0, 0)),
    };

    expect(isPreferredMeetingMatch({ data, requestedDateRange, meetingType: 'midweek' })).toBe(false);
  });

  it('rechaza un meetingId cuyo tipo ya no coincide', () => {
    const data = {
      type: 'weekend',
      meetingCategory: 'weekend',
      meetingDate: Timestamp.fromDate(new Date(2026, 7, 3, 0, 0, 0, 0)),
    };

    expect(isPreferredMeetingMatch({ data, requestedDateRange, meetingType: 'midweek' })).toBe(false);
  });

  it('rechaza cuando meetingDate no es un Timestamp', () => {
    const data = { type: 'midweek', meetingCategory: 'midweek', meetingDate: '2026-08-03' };
    expect(isPreferredMeetingMatch({ data, requestedDateRange, meetingType: 'midweek' })).toBe(false);
  });
});

describe('hospitalityScheduleItemDocId', () => {
  it('se deriva de meetingId + roleKey, sin colisionar entre dos reuniones el mismo dia', () => {
    const idA = hospitalityScheduleItemDocId('meeting-weekend-am', 'chairman');
    const idB = hospitalityScheduleItemDocId('meeting-weekend-pm', 'chairman');
    expect(idA).not.toBe(idB);
    expect(idA).toBe('meeting-weekend-am-chairman');
  });
});
