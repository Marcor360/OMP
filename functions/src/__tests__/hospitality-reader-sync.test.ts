/**
 * Pruebas unitarias — Sincronizacion del lector en el sync de hospitalidad
 *
 * Cubre la causa raiz reportada: las reuniones creadas por
 * ensurePlanningMeetingsByManager nacen con sections: [] (sin el slot nativo
 * "Lector" que trae la plantilla normal), asi que applyReaderItemsToSections
 * no encontraba donde colocarlo y el lector se descartaba en silencio.
 * Ahora, si no hay slot nativo, el lector debe autosuficientarse dentro de la
 * seccion hospitalityMicrophones; si el slot nativo si existe, debe rellenarlo
 * sin duplicarse en hospitalityMicrophones.
 */

import {
  applyHospitalityItemsToMeetingSections,
  collectAssignedUserIdsFromSections,
} from '../planning-schedules.js';

type FirestoreRecord = Record<string, unknown>;

const midweekReaderItem = {
  meetingDate: '2026-07-27',
  meetingType: 'midweek' as const,
  roleKey: 'midweekBibleStudyReader' as const,
  roleLabel: 'Lector del Estudio Biblico',
  userId: 'reader-uid',
  userNameSnapshot: 'Juan Lector',
};

const weekendReaderItem = {
  meetingDate: '2026-08-02',
  meetingType: 'weekend' as const,
  roleKey: 'watchtowerReader' as const,
  roleLabel: 'Lector del Estudio de la Atalaya',
  userId: 'reader-uid',
  userNameSnapshot: 'Juan Lector',
};

const chairmanItem = {
  meetingDate: '2026-07-27',
  meetingType: 'midweek' as const,
  roleKey: 'chairman' as const,
  roleLabel: 'Presidente',
  userId: 'chairman-uid',
  userNameSnapshot: 'Pedro Presidente',
};

const microphoneItem = {
  meetingDate: '2026-08-02',
  meetingType: 'weekend' as const,
  roleKey: 'microphoneOne' as const,
  roleLabel: 'Microfono 1',
  userId: 'mic-uid',
  userNameSnapshot: 'Ana Microfono',
};

const findSection = (sections: FirestoreRecord[], sectionKey: string): FirestoreRecord | undefined =>
  sections.find((section) => section.sectionKey === sectionKey);

const getAssignments = (section: FirestoreRecord | undefined): FirestoreRecord[] =>
  Array.isArray(section?.assignments) ? (section!.assignments as FirestoreRecord[]) : [];

describe('applyHospitalityItemsToMeetingSections — sincronizacion del lector', () => {
  it('coloca al lector dentro de hospitalityMicrophones cuando la reunion nace con sections: []', () => {
    const meetingData: FirestoreRecord = { sections: [] };

    const sections = applyHospitalityItemsToMeetingSections(
      meetingData,
      [chairmanItem, midweekReaderItem],
      'midweek'
    );

    const hospitalitySection = findSection(sections, 'hospitalityMicrophones');
    expect(hospitalitySection).toBeDefined();
    expect(hospitalitySection?.title).toBe('Micrófonos, Acomodadores y Lectores');

    const assignments = getAssignments(hospitalitySection);
    const readerAssignment = assignments.find(
      (assignment) => assignment.assignmentKey === 'hospitalityMicrophones-midweekBibleStudyReader'
    );
    expect(readerAssignment).toBeDefined();
    const readerAssignees = readerAssignment?.assignees as FirestoreRecord[];
    expect(readerAssignees?.[0]?.assigneeUserId).toBe('reader-uid');

    expect(collectAssignedUserIdsFromSections(sections)).toEqual(
      expect.arrayContaining(['chairman-uid', 'reader-uid'])
    );
  });

  it('rellena el slot nativo "Lector" (midweek) sin duplicarlo en hospitalityMicrophones', () => {
    const meetingData: FirestoreRecord = {
      sections: [
        {
          sectionKey: 'livingAsChristians',
          title: 'NUESTRA VIDA CRISTIANA',
          order: 0,
          sectionType: 'predefined',
          isRequired: true,
          isEnabled: true,
          assignments: [
            {
              assignmentKey: 'living-reader',
              sectionKey: 'livingAsChristians',
              title: 'Lector',
              roleLabel: 'Lector',
              assignmentScope: 'internal',
              assignees: [{ id: 'a1', assigneeType: 'registeredUser', assigneeUserId: undefined, assigneeNameSnapshot: '' }],
            },
          ],
        },
      ],
    };

    const sections = applyHospitalityItemsToMeetingSections(
      meetingData,
      [chairmanItem, midweekReaderItem],
      'midweek'
    );

    const nativeSection = findSection(sections, 'livingAsChristians');
    const nativeReaderAssignment = getAssignments(nativeSection).find(
      (assignment) => assignment.assignmentKey === 'living-reader'
    );
    expect(nativeReaderAssignment).toBeDefined();
    expect(nativeReaderAssignment?.lockedFromMeetingEditor).toBe(true);
    expect(nativeReaderAssignment?.controlledBy).toBe('hospitalityMicrophones');
    const nativeAssignees = nativeReaderAssignment?.assignees as FirestoreRecord[];
    expect(nativeAssignees?.[0]?.assigneeUserId).toBe('reader-uid');

    const hospitalitySection = findSection(sections, 'hospitalityMicrophones');
    const hospitalityAssignmentKeys = getAssignments(hospitalitySection).map(
      (assignment) => assignment.assignmentKey
    );
    expect(hospitalityAssignmentKeys).not.toContain('hospitalityMicrophones-midweekBibleStudyReader');
    expect(hospitalityAssignmentKeys).toContain('hospitalityMicrophones-chairman');

    expect(collectAssignedUserIdsFromSections(sections)).toEqual(
      expect.arrayContaining(['chairman-uid', 'reader-uid'])
    );
  });

  it('rellena el slot nativo "Lector del Estudio" (weekend) sin duplicarlo en hospitalityMicrophones', () => {
    const meetingData: FirestoreRecord = {
      sections: [
        {
          sectionKey: 'weekendAssignments',
          title: 'ESTUDIO DE LA ATALAYA',
          order: 0,
          sectionType: 'predefined',
          isRequired: true,
          isEnabled: true,
          assignments: [
            {
              assignmentKey: 'weekend-reader',
              sectionKey: 'weekendAssignments',
              title: 'Lector del Estudio de la Atalaya',
              roleLabel: 'Lector',
              assignmentScope: 'internal',
              assignees: [{ id: 'a1', assigneeType: 'registeredUser', assigneeUserId: undefined, assigneeNameSnapshot: '' }],
            },
          ],
        },
      ],
    };

    const sections = applyHospitalityItemsToMeetingSections(
      meetingData,
      [microphoneItem, weekendReaderItem],
      'weekend'
    );

    const nativeSection = findSection(sections, 'weekendAssignments');
    const nativeReaderAssignment = getAssignments(nativeSection).find(
      (assignment) => assignment.assignmentKey === 'weekend-reader'
    );
    expect(nativeReaderAssignment).toBeDefined();
    const nativeAssignees = nativeReaderAssignment?.assignees as FirestoreRecord[];
    expect(nativeAssignees?.[0]?.assigneeUserId).toBe('reader-uid');

    const hospitalitySection = findSection(sections, 'hospitalityMicrophones');
    const hospitalityAssignmentKeys = getAssignments(hospitalitySection).map(
      (assignment) => assignment.assignmentKey
    );
    expect(hospitalityAssignmentKeys).not.toContain('hospitalityMicrophones-watchtowerReader');
    expect(hospitalityAssignmentKeys).toContain('hospitalityMicrophones-microphoneOne');

    expect(collectAssignedUserIdsFromSections(sections)).toEqual(
      expect.arrayContaining(['mic-uid', 'reader-uid'])
    );
  });
});
