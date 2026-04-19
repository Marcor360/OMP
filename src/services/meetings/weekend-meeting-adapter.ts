import { Timestamp } from 'firebase/firestore';

import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import {
  MeetingAssignmentAssignee,
  MeetingProgramSection,
  createEmptyMeetingAssignee,
} from '@/src/types/meeting/program';

export type WeekendSpeakerMode = 'manual' | 'user';

export interface WeekendSpeakerDraft {
  mode: WeekendSpeakerMode;
  manualName: string;
  userId: string;
  assigneeId: string;
  assigneeNameSnapshot?: string;
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

export interface WeekendRegisteredUserDraft {
  userId: string;
  assigneeId: string;
  assigneeNameSnapshot?: string;
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

export interface WeekendMeetingSessionDraft {
  id: string;
  publicTalk: {
    discourseTitle: string;
    discourseAssignmentKey: string;
    discourseAssigneeId: string;
    speakerAssignmentKey: string;
    speaker: WeekendSpeakerDraft;
  };
  watchtowerStudy: {
    theme: string;
    themeAssignmentKey: string;
    themeAssigneeId: string;
    conductorAssignmentKey: string;
    conductor: WeekendRegisteredUserDraft;
    readerAssignmentKey: string;
    reader: WeekendRegisteredUserDraft;
  };
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const comparableText = (value: unknown): string => {
  const text = normalizeText(value) ?? '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const localId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const createEmptySpeaker = (): WeekendSpeakerDraft => ({
  mode: 'manual',
  manualName: '',
  userId: '',
  assigneeId: localId('weekend-speaker-assignee'),
  assigneeNameSnapshot: undefined,
  publishNotificationSentAt: undefined,
  reminderSentAt: undefined,
});

const createEmptyRegisteredUser = (): WeekendRegisteredUserDraft => ({
  userId: '',
  assigneeId: localId('weekend-user-assignee'),
  assigneeNameSnapshot: undefined,
  publishNotificationSentAt: undefined,
  reminderSentAt: undefined,
});

export const createEmptyWeekendMeetingSession = (index = 0): WeekendMeetingSessionDraft => ({
  id: localId(`weekend-session-${index + 1}`),
  publicTalk: {
    discourseTitle: '',
    discourseAssignmentKey: localId('weekend-discourse-key'),
    discourseAssigneeId: localId('weekend-discourse-assignee'),
    speakerAssignmentKey: localId('weekend-speaker-key'),
    speaker: createEmptySpeaker(),
  },
  watchtowerStudy: {
    theme: '',
    themeAssignmentKey: localId('weekend-theme-key'),
    themeAssigneeId: localId('weekend-theme-assignee'),
    conductorAssignmentKey: localId('weekend-conductor-key'),
    conductor: createEmptyRegisteredUser(),
    readerAssignmentKey: localId('weekend-reader-key'),
    reader: createEmptyRegisteredUser(),
  },
});

const getFirstAssignee = (
  assignees: MeetingAssignmentAssignee[]
): MeetingAssignmentAssignee | undefined => assignees[0];

const toSpeakerDraft = (assignment: { assignees: MeetingAssignmentAssignee[] }): WeekendSpeakerDraft => {
  const assignee = getFirstAssignee(assignment.assignees);

  if (assignee?.assigneeType === 'registeredUser' && normalizeText(assignee.assigneeUserId)) {
    return {
      mode: 'user',
      manualName: '',
      userId: normalizeText(assignee.assigneeUserId) ?? '',
      assigneeId: normalizeText(assignee.id) ?? localId('weekend-speaker-assignee'),
      assigneeNameSnapshot: normalizeText(assignee.assigneeNameSnapshot),
      publishNotificationSentAt: assignee.publishNotificationSentAt,
      reminderSentAt: assignee.reminderSentAt,
    };
  }

  return {
    mode: 'manual',
    manualName: normalizeText(assignee?.assigneeNameSnapshot) ?? '',
    userId: '',
    assigneeId: normalizeText(assignee?.id) ?? localId('weekend-speaker-assignee'),
    assigneeNameSnapshot: normalizeText(assignee?.assigneeNameSnapshot),
    publishNotificationSentAt: assignee?.publishNotificationSentAt,
    reminderSentAt: assignee?.reminderSentAt,
  };
};

const toRegisteredUserDraft = (assignment: { assignees: MeetingAssignmentAssignee[] }): WeekendRegisteredUserDraft => {
  const assignee = getFirstAssignee(assignment.assignees);

  return {
    userId: normalizeText(assignee?.assigneeUserId) ?? '',
    assigneeId: normalizeText(assignee?.id) ?? localId('weekend-user-assignee'),
    assigneeNameSnapshot: normalizeText(assignee?.assigneeNameSnapshot),
    publishNotificationSentAt: assignee?.publishNotificationSentAt,
    reminderSentAt: assignee?.reminderSentAt,
  };
};

const SESSION_SECTION_PATTERN = /^(publicTalk|weekendAssignments)(?:__(\d+))?$/;

type SectionSlot = 'publicTalk' | 'weekendAssignments';

const toSectionSlot = (
  section: Pick<MeetingProgramSection, 'sectionKey' | 'title'>
): { slot: SectionSlot; index: number } | null => {
  const byKey = section.sectionKey.match(SESSION_SECTION_PATTERN);
  if (byKey) {
    const rawIndex = byKey[2] ? Number(byKey[2]) - 1 : 0;
    const safeIndex = Number.isFinite(rawIndex) && rawIndex >= 0 ? rawIndex : 0;
    return { slot: byKey[1] as SectionSlot, index: safeIndex };
  }

  const title = comparableText(section.title);
  if (title.includes('discurso publico')) {
    return { slot: 'publicTalk', index: 0 };
  }
  if (title.includes('atalaya')) {
    return { slot: 'weekendAssignments', index: 0 };
  }

  return null;
};

const findSpeakerAssignment = (section: MeetingProgramSection) => {
  const byTitle = section.assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    const role = comparableText(assignment.roleLabel);
    return title.includes('discursante') || role.includes('discursante');
  });

  if (byTitle) return byTitle;
  if (section.assignments.length > 1) return section.assignments[1];
  return section.assignments[0];
};

const findDiscourseAssignment = (
  section: MeetingProgramSection,
  speakerAssignmentKey?: string
) => {
  const explicit = section.assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    return title.includes('discurso') && !title.includes('discursante');
  });

  if (explicit) return explicit;

  return section.assignments.find((assignment) => assignment.assignmentKey !== speakerAssignmentKey);
};

const findWatchtowerAssignment = (
  section: MeetingProgramSection,
  keyword: 'conductor' | 'lector'
) => {
  const byTitle = section.assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    const role = comparableText(assignment.roleLabel);
    return title.includes(keyword) || role.includes(keyword);
  });

  if (byTitle) return byTitle;
  return undefined;
};

const findWatchtowerThemeAssignment = (
  section: MeetingProgramSection,
  conductorAssignmentKey?: string,
  readerAssignmentKey?: string
) => {
  const explicit = section.assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    const key = comparableText(assignment.assignmentKey);
    return title.includes('tema') || key.includes('theme') || key.includes('tema');
  });

  if (explicit) return explicit;

  return section.assignments.find(
    (assignment) =>
      assignment.assignmentKey !== conductorAssignmentKey &&
      assignment.assignmentKey !== readerAssignmentKey &&
      assignment.assignmentScope !== 'internal'
  );
};

const buildSessionFromSections = (params: {
  sessionIndex: number;
  publicTalkSection?: MeetingProgramSection;
  watchtowerSection?: MeetingProgramSection;
}): WeekendMeetingSessionDraft => {
  const fallback = createEmptyWeekendMeetingSession(params.sessionIndex);
  const publicTalkSection = params.publicTalkSection;
  const watchtowerSection = params.watchtowerSection;

  const speakerAssignment = publicTalkSection ? findSpeakerAssignment(publicTalkSection) : undefined;
  const discourseAssignment = publicTalkSection
    ? findDiscourseAssignment(publicTalkSection, speakerAssignment?.assignmentKey)
    : undefined;

  const conductorAssignment = watchtowerSection
    ? findWatchtowerAssignment(watchtowerSection, 'conductor')
    : undefined;
  const readerAssignment = watchtowerSection ? findWatchtowerAssignment(watchtowerSection, 'lector') : undefined;
  const themeAssignment = watchtowerSection
    ? findWatchtowerThemeAssignment(
        watchtowerSection,
        conductorAssignment?.assignmentKey,
        readerAssignment?.assignmentKey
      )
    : undefined;

  return {
    id: localId(`weekend-session-${params.sessionIndex + 1}`),
    publicTalk: {
      discourseTitle: normalizeText(discourseAssignment?.title) ?? '',
      discourseAssignmentKey:
        normalizeText(discourseAssignment?.assignmentKey) ?? fallback.publicTalk.discourseAssignmentKey,
      discourseAssigneeId:
        normalizeText(getFirstAssignee(discourseAssignment?.assignees ?? [])?.id) ??
        fallback.publicTalk.discourseAssigneeId,
      speakerAssignmentKey:
        normalizeText(speakerAssignment?.assignmentKey) ?? fallback.publicTalk.speakerAssignmentKey,
      speaker: speakerAssignment ? toSpeakerDraft(speakerAssignment) : fallback.publicTalk.speaker,
    },
    watchtowerStudy: {
      theme: normalizeText(themeAssignment?.title) ?? '',
      themeAssignmentKey: normalizeText(themeAssignment?.assignmentKey) ?? fallback.watchtowerStudy.themeAssignmentKey,
      themeAssigneeId:
        normalizeText(getFirstAssignee(themeAssignment?.assignees ?? [])?.id) ??
        fallback.watchtowerStudy.themeAssigneeId,
      conductorAssignmentKey:
        normalizeText(conductorAssignment?.assignmentKey) ?? fallback.watchtowerStudy.conductorAssignmentKey,
      conductor: conductorAssignment
        ? toRegisteredUserDraft(conductorAssignment)
        : fallback.watchtowerStudy.conductor,
      readerAssignmentKey:
        normalizeText(readerAssignment?.assignmentKey) ?? fallback.watchtowerStudy.readerAssignmentKey,
      reader: readerAssignment ? toRegisteredUserDraft(readerAssignment) : fallback.watchtowerStudy.reader,
    },
  };
};

export const extractWeekendSessionsFromSections = (
  sections: MeetingProgramSection[]
): WeekendMeetingSessionDraft[] => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [createEmptyWeekendMeetingSession(0)];
  }

  const buckets = new Map<number, { publicTalk?: MeetingProgramSection; watchtower?: MeetingProgramSection }>();

  sections
    .slice()
    .sort((left, right) => left.order - right.order)
    .forEach((section) => {
      const slot = toSectionSlot(section);
      if (!slot) return;

      const current = buckets.get(slot.index) ?? {};
      if (slot.slot === 'publicTalk') {
        current.publicTalk = section;
      } else {
        current.watchtower = section;
      }
      buckets.set(slot.index, current);
    });

  if (buckets.size === 0) {
    return [createEmptyWeekendMeetingSession(0)];
  }

  const indexes = Array.from(buckets.keys()).sort((left, right) => left - right);
  const sessions = indexes.map((index) => {
    const bucket = buckets.get(index);
    return buildSessionFromSections({
      sessionIndex: index,
      publicTalkSection: bucket?.publicTalk,
      watchtowerSection: bucket?.watchtower,
    });
  });

  return sessions.length > 0 ? sessions : [createEmptyWeekendMeetingSession(0)];
};

const buildInformationalAssignee = (
  id: string,
  name?: string
): MeetingAssignmentAssignee => ({
  id: normalizeText(id) ?? localId('weekend-assignee'),
  assigneeType: 'informational',
  assigneeUserId: undefined,
  assigneeNameSnapshot: normalizeText(name),
  specialRoleKey: undefined,
  externalCongregationName: undefined,
  publishNotificationSentAt: undefined,
  reminderSentAt: undefined,
});

const buildRegisteredAssignee = (params: {
  id: string;
  userId?: string;
  name?: string;
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}): MeetingAssignmentAssignee => ({
  id: normalizeText(params.id) ?? localId('weekend-assignee'),
  assigneeType: 'registeredUser',
  assigneeUserId: normalizeText(params.userId),
  assigneeNameSnapshot: normalizeText(params.name),
  specialRoleKey: undefined,
  externalCongregationName: undefined,
  publishNotificationSentAt: params.publishNotificationSentAt,
  reminderSentAt: params.reminderSentAt,
});

const resolveUserSnapshotName = (
  userId: string | undefined,
  usersById: Map<string, string>,
  fallback?: string
): string | undefined => {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return normalizeText(fallback);

  return normalizeText(usersById.get(normalizedUserId)) ?? normalizeText(fallback);
};

export const buildWeekendSectionsFromSessions = (params: {
  sessions: WeekendMeetingSessionDraft[];
  activeUsers?: ActiveCongregationUser[];
}): MeetingProgramSection[] => {
  const sourceSessions =
    Array.isArray(params.sessions) && params.sessions.length > 0
      ? params.sessions
      : [createEmptyWeekendMeetingSession(0)];

  const usersById = new Map<string, string>(
    (params.activeUsers ?? []).map((user) => [user.uid, user.displayName])
  );

  const sections: MeetingProgramSection[] = [];

  sourceSessions.forEach((session, sessionIndex) => {
    const publicTalkSectionKey = sessionIndex === 0 ? 'publicTalk' : `publicTalk__${sessionIndex + 1}`;
    const watchtowerSectionKey =
      sessionIndex === 0 ? 'weekendAssignments' : `weekendAssignments__${sessionIndex + 1}`;

    const speakerMode: WeekendSpeakerMode = session.publicTalk.speaker.mode === 'user' ? 'user' : 'manual';
    const speakerUserId = normalizeText(session.publicTalk.speaker.userId);
    const speakerManualName = normalizeText(session.publicTalk.speaker.manualName);
    const speakerSnapshot = resolveUserSnapshotName(
      speakerUserId,
      usersById,
      session.publicTalk.speaker.assigneeNameSnapshot
    );

    const speakerAssignee =
      speakerMode === 'user'
        ? buildRegisteredAssignee({
            id: session.publicTalk.speaker.assigneeId,
            userId: speakerUserId,
            name: speakerSnapshot,
            publishNotificationSentAt: session.publicTalk.speaker.publishNotificationSentAt,
            reminderSentAt: session.publicTalk.speaker.reminderSentAt,
          })
        : buildInformationalAssignee(session.publicTalk.speaker.assigneeId, speakerManualName);

    const discourseTitle = normalizeText(session.publicTalk.discourseTitle) ?? '';
    const watchtowerTheme = normalizeText(session.watchtowerStudy.theme) ?? '';

    const conductorSnapshot = resolveUserSnapshotName(
      session.watchtowerStudy.conductor.userId,
      usersById,
      session.watchtowerStudy.conductor.assigneeNameSnapshot
    );
    const readerSnapshot = resolveUserSnapshotName(
      session.watchtowerStudy.reader.userId,
      usersById,
      session.watchtowerStudy.reader.assigneeNameSnapshot
    );

    sections.push({
      sectionKey: publicTalkSectionKey,
      title: 'DISCURSO PUBLICO',
      order: sessionIndex * 2,
      sectionType: 'predefined',
      isRequired: true,
      isEnabled: true,
      colorToken: 'blue',
      assignments: [
        {
          assignmentKey:
            normalizeText(session.publicTalk.discourseAssignmentKey) ??
            `${publicTalkSectionKey}-discourseTitle`,
          sectionKey: publicTalkSectionKey,
          title: discourseTitle,
          roleLabel: undefined,
          assignmentScope: 'informational',
          assignees: [
            buildInformationalAssignee(
              session.publicTalk.discourseAssigneeId,
              undefined
            ),
          ],
          roomKey: undefined,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          allowCircuitOverseerOption: false,
          notes: undefined,
        },
        {
          assignmentKey:
            normalizeText(session.publicTalk.speakerAssignmentKey) ??
            `${publicTalkSectionKey}-speaker`,
          sectionKey: publicTalkSectionKey,
          title: 'Discursante',
          roleLabel: 'Discursante',
          assignmentScope: speakerMode === 'user' ? 'internal' : 'informational',
          assignees: [speakerAssignee],
          roomKey: undefined,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          allowCircuitOverseerOption: false,
          notes: undefined,
        },
      ],
    });

    sections.push({
      sectionKey: watchtowerSectionKey,
      title: 'ESTUDIO DE LA ATALAYA',
      order: sessionIndex * 2 + 1,
      sectionType: 'predefined',
      isRequired: true,
      isEnabled: true,
      colorToken: 'indigo',
      assignments: [
        {
          assignmentKey:
            normalizeText(session.watchtowerStudy.themeAssignmentKey) ??
            `${watchtowerSectionKey}-theme`,
          sectionKey: watchtowerSectionKey,
          title: watchtowerTheme,
          roleLabel: undefined,
          assignmentScope: 'informational',
          assignees: [
            buildInformationalAssignee(
              session.watchtowerStudy.themeAssigneeId,
              undefined
            ),
          ],
          roomKey: undefined,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          allowCircuitOverseerOption: false,
          notes: undefined,
        },
        {
          assignmentKey:
            normalizeText(session.watchtowerStudy.conductorAssignmentKey) ??
            `${watchtowerSectionKey}-conductor`,
          sectionKey: watchtowerSectionKey,
          title: 'Conductor del Estudio de La Atalaya',
          roleLabel: 'Conductor',
          assignmentScope: 'internal',
          assignees: [
            buildRegisteredAssignee({
              id: session.watchtowerStudy.conductor.assigneeId,
              userId: session.watchtowerStudy.conductor.userId,
              name: conductorSnapshot,
              publishNotificationSentAt: session.watchtowerStudy.conductor.publishNotificationSentAt,
              reminderSentAt: session.watchtowerStudy.conductor.reminderSentAt,
            }),
          ],
          roomKey: undefined,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          allowCircuitOverseerOption: false,
          notes: undefined,
        },
        {
          assignmentKey:
            normalizeText(session.watchtowerStudy.readerAssignmentKey) ??
            `${watchtowerSectionKey}-reader`,
          sectionKey: watchtowerSectionKey,
          title: 'Lector del Estudio de La Atalaya',
          roleLabel: 'Lector',
          assignmentScope: 'internal',
          assignees: [
            buildRegisteredAssignee({
              id: session.watchtowerStudy.reader.assigneeId,
              userId: session.watchtowerStudy.reader.userId,
              name: readerSnapshot,
              publishNotificationSentAt: session.watchtowerStudy.reader.publishNotificationSentAt,
              reminderSentAt: session.watchtowerStudy.reader.reminderSentAt,
            }),
          ],
          roomKey: undefined,
          startTime: undefined,
          endTime: undefined,
          durationMinutes: undefined,
          allowCircuitOverseerOption: false,
          notes: undefined,
        },
      ],
    });
  });

  return sections
    .map((section, sectionIndex) => ({
      ...section,
      order: sectionIndex,
      assignments: section.assignments.map((assignment) => ({
        ...assignment,
        assignees:
          assignment.assignees.length > 0 ? assignment.assignees : [createEmptyMeetingAssignee('informational')],
      })),
    }))
    .sort((left, right) => left.order - right.order);
};

const isKnownActiveUser = (userId: string | undefined, usersById: Map<string, string>): boolean => {
  const normalized = normalizeText(userId);
  if (!normalized) return false;
  return usersById.has(normalized);
};

export const validateWeekendSessionsForPublish = (
  sessions: WeekendMeetingSessionDraft[],
  activeUsers: ActiveCongregationUser[]
): string[] => {
  const errors: string[] = [];
  const usersById = new Map(activeUsers.map((user) => [user.uid, user.displayName]));

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return ['La reunion de fin de semana debe incluir al menos una sesion.'];
  }

  sessions.forEach((session, index) => {
    const sessionLabel = `Sesion ${index + 1}`;

    if (!normalizeText(session.publicTalk.discourseTitle)) {
      errors.push(`${sessionLabel}: El nombre del discurso publico es obligatorio.`);
    }

    if (session.publicTalk.speaker.mode !== 'manual' && session.publicTalk.speaker.mode !== 'user') {
      errors.push(`${sessionLabel}: Debes elegir modo de asignacion para el discurso publico.`);
    } else if (session.publicTalk.speaker.mode === 'manual') {
      if (!normalizeText(session.publicTalk.speaker.manualName)) {
        errors.push(`${sessionLabel}: El nombre manual del discursante es obligatorio.`);
      }
    } else {
      if (!normalizeText(session.publicTalk.speaker.userId)) {
        errors.push(`${sessionLabel}: Debes seleccionar un usuario para el discursante.`);
      } else if (!isKnownActiveUser(session.publicTalk.speaker.userId, usersById)) {
        errors.push(
          `${sessionLabel}: El usuario del discursante no existe, esta inactivo o pertenece a otra congregacion.`
        );
      }
    }

    if (!normalizeText(session.watchtowerStudy.theme)) {
      errors.push(`${sessionLabel}: El tema del Estudio de La Atalaya es obligatorio.`);
    }

    if (!normalizeText(session.watchtowerStudy.conductor.userId)) {
      errors.push(`${sessionLabel}: Debes seleccionar conductor del Estudio de La Atalaya.`);
    } else if (!isKnownActiveUser(session.watchtowerStudy.conductor.userId, usersById)) {
      errors.push(
        `${sessionLabel}: El conductor seleccionado no existe, esta inactivo o pertenece a otra congregacion.`
      );
    }

    if (!normalizeText(session.watchtowerStudy.reader.userId)) {
      errors.push(`${sessionLabel}: Debes seleccionar lector del Estudio de La Atalaya.`);
    } else if (!isKnownActiveUser(session.watchtowerStudy.reader.userId, usersById)) {
      errors.push(
        `${sessionLabel}: El lector seleccionado no existe, esta inactivo o pertenece a otra congregacion.`
      );
    }
  });

  return errors;
};

export const getWeekendSpeakerDisplayName = (speaker: WeekendSpeakerDraft): string => {
  if (speaker.mode === 'user') {
    return normalizeText(speaker.assigneeNameSnapshot) ?? normalizeText(speaker.userId) ?? 'Sin asignar';
  }

  return normalizeText(speaker.manualName) ?? 'Sin asignar';
};

export const getWeekendRegisteredDisplayName = (user: WeekendRegisteredUserDraft): string =>
  normalizeText(user.assigneeNameSnapshot) ?? normalizeText(user.userId) ?? 'Sin asignar';
