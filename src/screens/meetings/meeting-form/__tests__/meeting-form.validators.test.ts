/* eslint-disable import/first */
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    private readonly mockDate: Date;

    constructor(mockDate: Date) {
      this.mockDate = mockDate;
    }

    static fromDate(mockDate: Date) {
      return new MockTimestamp(mockDate);
    }

    toDate() {
      return this.mockDate;
    }
  }

  return { Timestamp: MockTimestamp };
});

jest.mock('@/src/modules/assignments/utils/meeting-readers', () => ({
  isHospitalityMicrophonesControlledReader: () => false,
}));

import {
  collectControlledFieldLabels,
  collectMissingAssignmentLabels,
  toPanelItems,
  validateMeetingTopLevel,
} from '../meeting-form.validators';
import { MeetingProgramSection } from '@/src/types/meeting/program';

const buildSection = (overrides: Partial<MeetingProgramSection> = {}): MeetingProgramSection => ({
  sectionKey: 'section-1',
  title: 'Seccion',
  order: 0,
  sectionType: 'predefined',
  isRequired: true,
  isEnabled: true,
  assignments: [],
  ...overrides,
});

describe('meeting-form.validators', () => {
  it('keeps the existing top-level title validation behavior', () => {
    expect(validateMeetingTopLevel('   ')).toEqual({
      title: 'El titulo es obligatorio.',
    });
    expect(validateMeetingTopLevel('Reunion')).toEqual({});
  });

  it('normalizes publish panel messages and removes duplicates', () => {
    expect(toPanelItems([
      'La reunion debe tener tipo.',
      'La reunion debe tener tipo.',
      'La reunion debe incluir al menos una seccion.',
    ])).toEqual([
      {
        id: '0-Elige el tipo de reunion antes de publicar.',
        message: 'Elige el tipo de reunion antes de publicar.',
      },
      {
        id: '1-Agrega al menos una seccion al programa.',
        message: 'Agrega al menos una seccion al programa.',
      },
    ]);
  });

  it('collects missing assignment labels like the original form', () => {
    const sections = [
      buildSection(),
      buildSection({
        sectionKey: 'section-2',
        title: 'Discurso',
        assignments: [
          {
            assignmentKey: 'a1',
            sectionKey: 'section-2',
            title: '',
            assignmentScope: 'internal',
            assignees: [],
          },
        ],
      }),
    ];

    expect(collectMissingAssignmentLabels(sections)).toEqual([
      'Seccion: falta agregar al menos una parte.',
      'Discurso: falta el titulo de una parte.',
    ]);
  });

  it('collects locked fields using section and assignment labels', () => {
    expect(collectControlledFieldLabels([
      buildSection({
        title: 'Fin de semana',
        assignments: [
          {
            assignmentKey: 'reader',
            sectionKey: 'section-1',
            title: 'Lector',
            roleLabel: 'Lector de La Atalaya',
            assignmentScope: 'internal',
            lockedFromMeetingEditor: true,
            assignees: [],
          },
        ],
      }),
    ])).toEqual(['Fin de semana: Lector de La Atalaya']);
  });
});
