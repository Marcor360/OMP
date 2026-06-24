import {
  createDefaultSectionsForMeetingType,
  getMeetingProgramTypeDefinition,
  MEETING_PROGRAM_TYPES,
  MIDWEEK_REQUIRED_SECTION_KEYS,
  MIDWEEK_SECTION_TEMPLATES,
  normalizeMeetingSections,
  WEEKEND_REQUIRED_SECTION_KEYS,
  WEEKEND_SECTION_TEMPLATES,
  type MeetingProgramType,
} from '../program';

jest.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {},
}));

describe('meeting program type registry', () => {
  it('resolves midweek definitions by reference', () => {
    const definition = getMeetingProgramTypeDefinition('midweek');

    expect(definition.type).toBe('midweek');
    expect(definition.sectionTemplates).toBe(MIDWEEK_SECTION_TEMPLATES);
    expect(definition.requiredSectionKeys).toBe(MIDWEEK_REQUIRED_SECTION_KEYS);
  });

  it('resolves weekend definitions by reference', () => {
    const definition = getMeetingProgramTypeDefinition('weekend');

    expect(definition.type).toBe('weekend');
    expect(definition.sectionTemplates).toBe(WEEKEND_SECTION_TEMPLATES);
    expect(definition.requiredSectionKeys).toBe(WEEKEND_REQUIRED_SECTION_KEYS);
  });

  it('exposes the supported meeting program types', () => {
    expect(MEETING_PROGRAM_TYPES).toEqual(['midweek', 'weekend']);
  });

  it('keeps midweek default section key parity', () => {
    expect(createDefaultSectionsForMeetingType('midweek').map((section) => section.sectionKey))
      .toMatchInlineSnapshot(`
[
  "treasuresOfTheBible",
  "applyYourselfToTheFieldMinistry",
  "livingAsChristians",
]
`);
  });

  it('keeps weekend default section key parity', () => {
    expect(createDefaultSectionsForMeetingType('weekend').map((section) => section.sectionKey))
      .toMatchInlineSnapshot(`
[
  "publicTalk",
  "weekendAssignments",
]
`);
  });

  it.each<{
    meetingType: MeetingProgramType;
    missingRequiredSectionKey: string;
  }>([
    {
      meetingType: 'midweek',
      missingRequiredSectionKey: MIDWEEK_REQUIRED_SECTION_KEYS[0],
    },
    {
      meetingType: 'weekend',
      missingRequiredSectionKey: WEEKEND_REQUIRED_SECTION_KEYS[0],
    },
  ])(
    're-includes missing required sections for $meetingType meetings',
    ({ meetingType, missingRequiredSectionKey }) => {
      const input = createDefaultSectionsForMeetingType(meetingType).filter(
        (section) => section.sectionKey !== missingRequiredSectionKey
      );

      const result = normalizeMeetingSections(input, meetingType);

      expect(result.map((section) => section.sectionKey)).toContain(missingRequiredSectionKey);
    }
  );
});
