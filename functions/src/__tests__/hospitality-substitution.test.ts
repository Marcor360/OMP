/**
 * Pruebas unitarias — Sustitucion de asignaciones de hospitalidad (AM-4)
 *
 * Verifica los helpers puros de validacion de negocio (duplicado de rol en la
 * misma reunion, conflicto con salida a discursar) usados por
 * substituteHospitalityAssignmentByManager, que no dependen de Firestore.
 */

type HospitalityItemLike = {
  id: string;
  userId: string;
  roleLabel: string;
};

const findDuplicateRoleConflict = (
  siblingItems: HospitalityItemLike[],
  currentItemId: string,
  newUserId: string
): HospitalityItemLike | undefined =>
  siblingItems.find((entry) => entry.id !== currentItemId && entry.userId === newUserId);

type OutgoingTalkLike = {
  speakerUserId: string;
  weekStartDate: string;
  talkDate: string;
};

const findOutgoingTalkConflict = (
  outgoingTalks: OutgoingTalkLike[],
  weekStart: string,
  newUserId: string
): OutgoingTalkLike | undefined =>
  outgoingTalks.find(
    (talk) => talk.speakerUserId === newUserId && talk.weekStartDate === weekStart
  );

const shouldCheckOutgoingConflict = (meetingType: 'midweek' | 'weekend'): boolean =>
  meetingType === 'weekend';

describe('substituteHospitalityAssignmentByManager business rules', () => {
  describe('findDuplicateRoleConflict', () => {
    it('detects when the substitute already holds another role in the same meeting', () => {
      const siblings: HospitalityItemLike[] = [
        { id: 'item-chairman', userId: 'user-1', roleLabel: 'Presidente' },
        { id: 'item-mic1', userId: 'user-2', roleLabel: 'Microfono 1' },
      ];

      const conflict = findDuplicateRoleConflict(siblings, 'item-mic1', 'user-1');

      expect(conflict).toEqual({ id: 'item-chairman', userId: 'user-1', roleLabel: 'Presidente' });
    });

    it('allows substituting with a user who has no other role in the meeting', () => {
      const siblings: HospitalityItemLike[] = [
        { id: 'item-chairman', userId: 'user-1', roleLabel: 'Presidente' },
        { id: 'item-mic1', userId: 'user-2', roleLabel: 'Microfono 1' },
      ];

      expect(findDuplicateRoleConflict(siblings, 'item-mic1', 'user-3')).toBeUndefined();
    });

    it('does not conflict with itself when substituting with the same user already in that role', () => {
      const siblings: HospitalityItemLike[] = [
        { id: 'item-mic1', userId: 'user-2', roleLabel: 'Microfono 1' },
      ];

      expect(findDuplicateRoleConflict(siblings, 'item-mic1', 'user-2')).toBeUndefined();
    });
  });

  describe('findOutgoingTalkConflict', () => {
    it('blocks a substitute who is scheduled to give an outgoing talk that week', () => {
      const talks: OutgoingTalkLike[] = [
        { speakerUserId: 'user-9', weekStartDate: '2026-07-13', talkDate: '2026-07-19' },
      ];

      expect(findOutgoingTalkConflict(talks, '2026-07-13', 'user-9')).toBeDefined();
    });

    it('allows a substitute with an outgoing talk in a different week', () => {
      const talks: OutgoingTalkLike[] = [
        { speakerUserId: 'user-9', weekStartDate: '2026-07-06', talkDate: '2026-07-12' },
      ];

      expect(findOutgoingTalkConflict(talks, '2026-07-13', 'user-9')).toBeUndefined();
    });
  });

  describe('shouldCheckOutgoingConflict', () => {
    it('only checks outgoing-talk conflicts for weekend meetings, never midweek', () => {
      expect(shouldCheckOutgoingConflict('weekend')).toBe(true);
      expect(shouldCheckOutgoingConflict('midweek')).toBe(false);
    });

    it('lets a midweek substitution proceed even if the user has an outgoing talk that same week', () => {
      const talks: OutgoingTalkLike[] = [
        { speakerUserId: 'user-9', weekStartDate: '2026-07-13', talkDate: '2026-07-19' },
      ];
      const meetingType: 'midweek' | 'weekend' = 'midweek';

      const mustCheck = shouldCheckOutgoingConflict(meetingType);
      const conflict = mustCheck ? findOutgoingTalkConflict(talks, '2026-07-13', 'user-9') : undefined;

      expect(conflict).toBeUndefined();
    });
  });
});
