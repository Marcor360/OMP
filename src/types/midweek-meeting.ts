import { Timestamp } from 'firebase/firestore';

import { MeetingColorToken, MeetingSpecialRoleKey } from '@/src/types/meeting/program';

export type MidweekSectionId =
  | 'treasuresOfTheBible'
  | 'applyYourselfToTheFieldMinistry'
  | 'livingAsChristians'
  | 'publicTalk'
  | 'weekendAssignments'
  | 'tasks'
  | 'cleaningMaintenance'
  | 'zoom'
  | 'circuitOverseerVisit'
  | `dynamic-${string}`;

export type ParticipantAssignmentMode = 'user' | 'manual' | 'specialRole';

export type MidweekAssignmentType =
  | 'discourse'
  | 'reading'
  | 'demonstration'
  | 'video'
  | 'discussion'
  | 'song'
  | 'prayer'
  | 'chairman'
  | 'bible-reading'
  | 'treasures'
  | 'ministry'
  | 'living'
  | 'other';

export interface ParticipantAssignment {
  id: string;
  mode: ParticipantAssignmentMode;
  userId?: string;
  displayName: string;
  specialRoleKey?: MeetingSpecialRoleKey;
  roleLabel?: string;
  gender?: string;
  isAssistant?: boolean;
}

export interface MidweekAssignment {
  id: string;
  sectionId: MidweekSectionId;
  order: number;
  title: string;
  theme?: string;
  durationMinutes?: number;
  notes?: string;
  roomKey?: string;
  startTime?: string;
  endTime?: string;
  assignmentScope?: 'internal' | 'informational';
  participants: ParticipantAssignment[];
  isOptional?: boolean;
  assignmentType?: MidweekAssignmentType;
  allowCircuitOverseerOption?: boolean;
}

export interface MidweekMeetingSection {
  id: MidweekSectionId;
  title: string;
  order: number;
  sectionType?: 'predefined' | 'dynamic' | 'special';
  isRequired?: boolean;
  isEnabled?: boolean;
  colorToken?: MeetingColorToken;
  items: MidweekAssignment[];
}

export interface MidweekMeetingMetadata {
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
}

export interface MidweekMeetingFields extends MidweekMeetingMetadata {
  weekLabel: string;
  bibleReading: string;
  sections: MidweekMeetingSection[];
}

export interface MidweekMeetingDraft extends MidweekMeetingFields {
  title: string;
  description?: string;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate: Timestamp;
  endDate: Timestamp;
  location?: string;
  meetingUrl?: string;
}

type SectionTemplate = {
  id: MidweekSectionId;
  title: string;
  sectionType: 'predefined' | 'dynamic' | 'special';
  isRequired?: boolean;
  isEnabled?: boolean;
  colorToken?: MeetingColorToken;
  baseAssignments: {
    title: string;
    assignmentType?: MidweekAssignmentType;
    assignmentScope?: 'internal' | 'informational';
    allowCircuitOverseerOption?: boolean;
  }[];
};

const MIDWEEK_SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: 'treasuresOfTheBible',
    title: 'Tesoros de la Biblia',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'blue',
    baseAssignments: [
      { title: 'Tesoros de la Biblia', assignmentType: 'treasures' },
      { title: 'Busquemos perlas escondidas', assignmentType: 'discussion' },
      { title: 'Lectura de la Biblia', assignmentType: 'bible-reading' },
    ],
  },
  {
    id: 'applyYourselfToTheFieldMinistry',
    title: 'Seamos mejores maestros',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'orange',
    baseAssignments: [
      { title: 'Parte 1', assignmentType: 'ministry' },
      { title: 'Parte 2', assignmentType: 'ministry' },
      { title: 'Parte 3', assignmentType: 'ministry' },
    ],
  },
  {
    id: 'livingAsChristians',
    title: 'Nuestra vida cristiana',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'red',
    baseAssignments: [
      { title: 'Parte principal', assignmentType: 'living' },
      {
        title: 'Estudio biblico de la congregacion',
        assignmentType: 'discussion',
      },
    ],
  },
];

const localId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const createTemplateAssignment = (
  sectionId: MidweekSectionId,
  order: number,
  title: string,
  assignmentType?: MidweekAssignmentType,
  assignmentScope: 'internal' | 'informational' =
    assignmentType === 'song' ? 'informational' : 'internal',
  allowCircuitOverseerOption = false
): MidweekAssignment => ({
  id: localId('asg'),
  sectionId,
  order,
  title,
  theme: '',
  durationMinutes: undefined,
  notes: '',
  roomKey: undefined,
  startTime: undefined,
  endTime: undefined,
  assignmentScope,
  participants: [],
  assignmentType,
  allowCircuitOverseerOption,
});

export const createBaseMidweekSections = (): MidweekMeetingSection[] =>
  MIDWEEK_SECTION_TEMPLATES.map((section, sectionIndex) => ({
    id: section.id,
    title: section.title,
    order: sectionIndex,
    sectionType: section.sectionType,
    isRequired: section.isRequired,
    isEnabled: section.isEnabled,
    colorToken: section.colorToken,
    items: section.baseAssignments.map((assignment, assignmentIndex) =>
      createTemplateAssignment(
        section.id,
        assignmentIndex,
        assignment.title,
        assignment.assignmentType,
        assignment.assignmentScope,
        assignment.allowCircuitOverseerOption
      )
    ),
  }));

export const normalizeSectionOrder = (
  sections: MidweekMeetingSection[]
): MidweekMeetingSection[] =>
  sections
    .map((section, sectionIndex) => ({
      ...section,
      order: sectionIndex,
      sectionType: section.sectionType ?? 'dynamic',
      isEnabled: section.isEnabled !== false,
      items: section.items.map((item, assignmentIndex) => ({
        ...item,
        sectionId: section.id,
        order: assignmentIndex,
        participants: item.participants.map((participant) => ({
          ...participant,
          id: participant.id || localId('participant'),
          displayName: participant.displayName?.trim() ?? '',
          roleLabel: participant.roleLabel?.trim() || undefined,
          specialRoleKey: participant.specialRoleKey,
        })),
        roomKey: item.roomKey?.trim() || undefined,
        startTime: item.startTime?.trim() || undefined,
        endTime: item.endTime?.trim() || undefined,
        assignmentScope: item.assignmentScope ?? 'internal',
        allowCircuitOverseerOption: item.allowCircuitOverseerOption ?? false,
      })),
    }))
    .sort((a, b) => a.order - b.order);

export const toMidweekDateLabel = (date: Timestamp | Date): string => {
  const parsed = date instanceof Timestamp ? date.toDate() : date;

  return parsed.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const MIDWEEK_REQUIRED_SECTION_IDS: MidweekSectionId[] = [
  'treasuresOfTheBible',
  'applyYourselfToTheFieldMinistry',
  'livingAsChristians',
];

export const MIDWEEK_KNOWN_SECTION_IDS: MidweekSectionId[] = [
  ...MIDWEEK_REQUIRED_SECTION_IDS,
  'tasks',
  'cleaningMaintenance',
  'zoom',
  'circuitOverseerVisit',
];

export const MIDWEEK_SECTION_IDS = MIDWEEK_REQUIRED_SECTION_IDS;

export const MIDWEEK_SECTION_TITLES: Record<string, string> = {
  treasuresOfTheBible: 'Tesoros de la Biblia',
  applyYourselfToTheFieldMinistry: 'Seamos mejores maestros',
  livingAsChristians: 'Nuestra vida cristiana',
  publicTalk: 'Discurso publico',
  weekendAssignments: 'Asignaciones del fin de semana',
  tasks: 'Tareas',
  cleaningMaintenance: 'Limpieza y mantenimiento del salon',
  zoom: 'Zoom',
  circuitOverseerVisit: 'Visita del superintendente de circuito',
};

export const createMidweekMeetingTemplate = (
  now: Timestamp = Timestamp.now()
): MidweekMeetingDraft => {
  const startDate = now;
  const endDate = Timestamp.fromMillis(now.toMillis() + 90 * 60 * 1000);

  return {
    title: 'Reunion de entre semana',
    description: '',
    weekLabel: '',
    bibleReading: '',
    startDate,
    endDate,
    status: 'scheduled',
    location: '',
    meetingUrl: '',
    openingSong: '',
    openingPrayer: '',
    closingSong: '',
    closingPrayer: '',
    chairman: '',
    sections: createBaseMidweekSections(),
  };
};

export const createEmptyMidweekAssignment = (
  sectionId: MidweekSectionId,
  order: number
): MidweekAssignment =>
  createTemplateAssignment(sectionId, order, '', 'other', 'internal');

export const createEmptyParticipant = (): ParticipantAssignment => ({
  id: localId('participant'),
  mode: 'user',
  userId: undefined,
  displayName: '',
  specialRoleKey: undefined,
  roleLabel: '',
  gender: undefined,
  isAssistant: false,
});
