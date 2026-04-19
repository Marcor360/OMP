import { Timestamp } from 'firebase/firestore';

export type MeetingProgramType = 'midweek' | 'weekend';
export type MeetingPublicationStatus = 'draft' | 'published';

export type MeetingSectionType = 'predefined' | 'dynamic' | 'special';
export type MeetingAssignmentScope = 'internal' | 'informational';

export type MeetingAssigneeType =
  | 'registeredUser'
  | 'specialExternalRole'
  | 'informational';

export type MeetingSpecialRoleKey = 'circuitOverseer';

export const SPECIAL_CIRCUIT_OVERSEER_KEY: MeetingSpecialRoleKey = 'circuitOverseer';

export const MEETING_SPECIAL_ROLE_LABELS: Record<MeetingSpecialRoleKey, string> = {
  circuitOverseer: 'Superintendente de circuito',
};

export type MeetingColorToken =
  | 'blue'
  | 'indigo'
  | 'orange'
  | 'red'
  | 'green'
  | 'teal'
  | 'dark';

export interface MeetingAssignmentAssignee {
  id: string;
  assigneeType: MeetingAssigneeType;
  assigneeUserId?: string;
  assigneeNameSnapshot?: string;
  specialRoleKey?: MeetingSpecialRoleKey;
  externalCongregationName?: string;
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

export interface MeetingProgramAssignment {
  assignmentKey: string;
  sectionKey: string;
  title: string;
  roleLabel?: string;
  assignmentScope: MeetingAssignmentScope;
  assignees: MeetingAssignmentAssignee[];
  roomKey?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  allowCircuitOverseerOption?: boolean;
  notes?: string;
}

export interface MeetingProgramSection {
  sectionKey: string;
  title: string;
  order: number;
  sectionType: MeetingSectionType;
  isRequired?: boolean;
  isEnabled: boolean;
  colorToken?: MeetingColorToken;
  assignments: MeetingProgramAssignment[];
}

type SectionTemplate = {
  sectionKey: string;
  title: string;
  sectionType: MeetingSectionType;
  isRequired?: boolean;
  isEnabled: boolean;
  colorToken?: MeetingColorToken;
  assignmentTemplates: {
    title: string;
    roleLabel?: string;
    assignmentScope: MeetingAssignmentScope;
    allowCircuitOverseerOption?: boolean;
  }[];
};

export const MIDWEEK_REQUIRED_SECTION_KEYS = [
  'treasuresOfTheBible',
  'applyYourselfToTheFieldMinistry',
  'livingAsChristians',
] as const;

export const WEEKEND_REQUIRED_SECTION_KEYS = [
  'publicTalk',
  'weekendAssignments',
] as const;

const MIDWEEK_SECTION_TEMPLATES: SectionTemplate[] = [
  {
    sectionKey: 'treasuresOfTheBible',
    title: 'TESOROS DE LA BIBLIA',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'blue',
    assignmentTemplates: [
      { title: 'Punto 1', assignmentScope: 'internal' },
      { title: 'Punto 2', assignmentScope: 'internal' },
      { title: 'Lectura de la Biblia', assignmentScope: 'internal' },
    ],
  },
  {
    sectionKey: 'applyYourselfToTheFieldMinistry',
    title: 'SEAMOS MEJORES MAESTROS',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'orange',
    assignmentTemplates: [
      { title: 'Parte 1', assignmentScope: 'internal' },
      { title: 'Parte 2', assignmentScope: 'internal' },
      { title: 'Parte 3', assignmentScope: 'internal' },
    ],
  },
  {
    sectionKey: 'livingAsChristians',
    title: 'NUESTRA VIDA CRISTIANA',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'red',
    assignmentTemplates: [
      { title: 'Parte principal', assignmentScope: 'internal' },
      {
        title: 'Estudio biblico de la congregacion',
        roleLabel: 'Conductor',
        assignmentScope: 'internal',
      },
      { title: 'Lector', roleLabel: 'Lector', assignmentScope: 'internal' },
    ],
  },
];

const WEEKEND_SECTION_TEMPLATES: SectionTemplate[] = [
  {
    sectionKey: 'publicTalk',
    title: 'DISCURSO PUBLICO',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'blue',
    assignmentTemplates: [
      { title: 'Titulo del discurso', assignmentScope: 'informational' },
      {
        title: 'Discursante',
        roleLabel: 'Discursante',
        assignmentScope: 'informational',
      },
      { title: 'Congregacion', assignmentScope: 'informational' },
    ],
  },
  {
    sectionKey: 'weekendAssignments',
    title: 'ESTUDIO DE LA ATALAYA',
    sectionType: 'predefined',
    isRequired: true,
    isEnabled: true,
    colorToken: 'indigo',
    assignmentTemplates: [
      {
        title: 'Conductor del Estudio de la Atalaya',
        roleLabel: 'Conductor',
        assignmentScope: 'internal',
      },
      { title: 'Lector del Estudio de la Atalaya', roleLabel: 'Lector', assignmentScope: 'internal' },
    ],
  },
];

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const localId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

export const createEmptyMeetingAssignee = (
  type: MeetingAssigneeType = 'registeredUser'
): MeetingAssignmentAssignee => ({
  id: localId('asg-user'),
  assigneeType: type,
  assigneeUserId: undefined,
  assigneeNameSnapshot: '',
  specialRoleKey: undefined,
  externalCongregationName: undefined,
  publishNotificationSentAt: undefined,
  reminderSentAt: undefined,
});

export const createEmptyMeetingAssignment = (
  sectionKey: string,
  order: number,
  input?: Partial<MeetingProgramAssignment>
): MeetingProgramAssignment => {
  const scope = input?.assignmentScope ?? 'internal';

  return {
    assignmentKey: input?.assignmentKey ?? localId('asg'),
    sectionKey,
    title: input?.title ?? '',
    roleLabel: input?.roleLabel,
    assignmentScope: scope,
    assignees:
      input?.assignees && input.assignees.length > 0
        ? input.assignees
        : [createEmptyMeetingAssignee(scope === 'internal' ? 'registeredUser' : 'informational')],
    roomKey: input?.roomKey,
    startTime: input?.startTime,
    endTime: input?.endTime,
    durationMinutes: input?.durationMinutes,
    allowCircuitOverseerOption: input?.allowCircuitOverseerOption,
    notes: input?.notes,
  };
};

const createSectionFromTemplate = (
  template: SectionTemplate,
  order: number
): MeetingProgramSection => ({
  sectionKey: template.sectionKey,
  title: template.title,
  order,
  sectionType: template.sectionType,
  isRequired: template.isRequired,
  isEnabled: template.isEnabled,
  colorToken: template.colorToken,
  assignments: template.assignmentTemplates.map((assignmentTemplate, assignmentIndex) =>
    createEmptyMeetingAssignment(template.sectionKey, assignmentIndex, assignmentTemplate)
  ),
});

export const createDefaultSectionsForMeetingType = (
  meetingType: MeetingProgramType
): MeetingProgramSection[] => {
  const templates =
    meetingType === 'midweek' ? MIDWEEK_SECTION_TEMPLATES : WEEKEND_SECTION_TEMPLATES;

  return templates.map((template, index) => createSectionFromTemplate(template, index));
};

const normalizeAssignee = (value: unknown, fallbackOrder: number): MeetingAssignmentAssignee => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const assigneeType =
    raw.assigneeType === 'registeredUser' ||
    raw.assigneeType === 'specialExternalRole' ||
    raw.assigneeType === 'informational'
      ? raw.assigneeType
      : 'registeredUser';

  const publishNotificationSentAt =
    raw.publishNotificationSentAt instanceof Timestamp ? raw.publishNotificationSentAt : undefined;
  const reminderSentAt = raw.reminderSentAt instanceof Timestamp ? raw.reminderSentAt : undefined;

  return {
    id: normalizeText(raw.id) ?? localId(`asg-user-${fallbackOrder}`),
    assigneeType,
    assigneeUserId: normalizeText(raw.assigneeUserId),
    assigneeNameSnapshot: normalizeText(raw.assigneeNameSnapshot) ?? '',
    specialRoleKey:
      raw.specialRoleKey === SPECIAL_CIRCUIT_OVERSEER_KEY ? SPECIAL_CIRCUIT_OVERSEER_KEY : undefined,
    externalCongregationName: normalizeText(raw.externalCongregationName),
    publishNotificationSentAt,
    reminderSentAt,
  };
};

const normalizeAssignment = (
  sectionKey: string,
  value: unknown,
  fallbackOrder: number
): MeetingProgramAssignment => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  const assignmentScope =
    raw.assignmentScope === 'internal' || raw.assignmentScope === 'informational'
      ? raw.assignmentScope
      : 'internal';

  const assigneesRaw = Array.isArray(raw.assignees) ? raw.assignees : [];
  const assignees =
    assigneesRaw.length > 0
      ? assigneesRaw.map((assignee, assigneeIndex) => normalizeAssignee(assignee, assigneeIndex))
      : [createEmptyMeetingAssignee(assignmentScope === 'internal' ? 'registeredUser' : 'informational')];

  return {
    assignmentKey: normalizeText(raw.assignmentKey) ?? localId(`asg-${fallbackOrder}`),
    sectionKey,
    title: normalizeText(raw.title) ?? '',
    roleLabel: normalizeText(raw.roleLabel),
    assignmentScope,
    assignees,
    roomKey: normalizeText(raw.roomKey),
    startTime: normalizeText(raw.startTime),
    endTime: normalizeText(raw.endTime),
    durationMinutes:
      typeof raw.durationMinutes === 'number' && Number.isFinite(raw.durationMinutes)
        ? raw.durationMinutes
        : undefined,
    allowCircuitOverseerOption: raw.allowCircuitOverseerOption === true,
    notes: normalizeText(raw.notes),
  };
};

export const normalizeMeetingSections = (
  input: unknown,
  meetingType: MeetingProgramType
): MeetingProgramSection[] => {
  const fallback = createDefaultSectionsForMeetingType(meetingType);

  if (!Array.isArray(input)) {
    return fallback;
  }

  const normalized = input
    .map((section, sectionIndex) => {
      const raw =
        typeof section === 'object' && section !== null
          ? (section as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const sectionKey = normalizeText(raw.sectionKey) ?? localId(`section-${sectionIndex}`);
      const assignmentsRaw = Array.isArray(raw.assignments) ? raw.assignments : [];

      return {
        sectionKey,
        title: normalizeText(raw.title) ?? `Seccion ${sectionIndex + 1}`,
        order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : sectionIndex,
        sectionType:
          raw.sectionType === 'predefined' || raw.sectionType === 'dynamic' || raw.sectionType === 'special'
            ? raw.sectionType
            : 'dynamic',
        isRequired: raw.isRequired === true,
        isEnabled: raw.isEnabled !== false,
        colorToken:
          raw.colorToken === 'blue' ||
          raw.colorToken === 'indigo' ||
          raw.colorToken === 'orange' ||
          raw.colorToken === 'red' ||
          raw.colorToken === 'green' ||
          raw.colorToken === 'teal' ||
          raw.colorToken === 'dark'
            ? raw.colorToken
            : undefined,
        assignments: assignmentsRaw.map((assignment, assignmentIndex) =>
          normalizeAssignment(sectionKey, assignment, assignmentIndex)
        ),
      } as MeetingProgramSection;
    })
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({
      ...section,
      order: index,
      assignments: section.assignments.map((assignment) => ({
        ...assignment,
        sectionKey: section.sectionKey,
      })),
    }));

  const requiredSectionKeys =
    meetingType === 'midweek'
      ? new Set<string>(MIDWEEK_REQUIRED_SECTION_KEYS)
      : new Set<string>(WEEKEND_REQUIRED_SECTION_KEYS);

  const merged = [...normalized];

  fallback.forEach((section) => {
    if (requiredSectionKeys.has(section.sectionKey)) {
      const existing = merged.find((candidate) => candidate.sectionKey === section.sectionKey);
      if (!existing) {
        merged.push(section);
      }
    }
  });

  return merged
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));
};

export const collectAssignedUserIds = (sections: MeetingProgramSection[]): string[] => {
  const ids = new Set<string>();

  sections.forEach((section) => {
    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') {
        return;
      }

      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') {
          return;
        }

        const userId = normalizeText(assignee.assigneeUserId);
        if (userId) {
          ids.add(userId);
        }
      });
    });
  });

  return Array.from(ids);
};

export const buildMeetingSearchableText = (params: {
  title: string;
  description?: string;
  sections: MeetingProgramSection[];
}): string => {
  const parts: string[] = [params.title, params.description ?? ''];

  params.sections.forEach((section) => {
    parts.push(section.title);
    section.assignments.forEach((assignment) => {
      parts.push(assignment.title, assignment.roleLabel ?? '');
      assignment.assignees.forEach((assignee) => {
        parts.push(assignee.assigneeNameSnapshot ?? '');
      });
    });
  });

  return parts
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

export const addDynamicSection = (
  sections: MeetingProgramSection[],
  title = 'Nueva seccion'
): MeetingProgramSection[] => {
  const next: MeetingProgramSection = {
    sectionKey: localId('dynamic-section'),
    title,
    order: sections.length,
    sectionType: 'dynamic',
    isRequired: false,
    isEnabled: true,
    assignments: [createEmptyMeetingAssignment('dynamic', 0)],
  };

  return [...sections, next].map((section, index) => ({
    ...section,
    order: index,
  }));
};

export const moveMeetingSection = (
  sections: MeetingProgramSection[],
  fromIndex: number,
  toIndex: number
): MeetingProgramSection[] => {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sections.length ||
    toIndex >= sections.length ||
    fromIndex === toIndex
  ) {
    return sections;
  }

  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next.map((section, index) => ({ ...section, order: index }));
};
