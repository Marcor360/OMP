import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';
import {
  SPECIAL_CIRCUIT_OVERSEER_KEY,
  buildAssignedUserIdsFromSections,
  clearMeetingNotificationMarkers,
  normalizeMeetingSectionsFromDoc,
  resolveMeetingDate,
  resolveMeetingType,
  toFirestoreSectionsPayload,
} from './modules/meetings/meeting-sections.js';

type UserRole = 'admin' | 'supervisor' | 'user';

type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
};

type SetMeetingPublicationStatusPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  publicationStatus?: unknown;
};

type SetMeetingPublicationStatusResult = {
  ok: boolean;
  publicationStatus: 'draft' | 'published';
  assignedUserIds: string[];
  errors: string[];
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') {
    return 'admin';
  }
  if (normalized === 'supervisor') {
    return 'supervisor';
  }
  if (normalized === 'user' || normalized === 'usuario') {
    return 'user';
  }

  return undefined;
};

const normalizeIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') {
    return data.isActive;
  }

  if (typeof data.active === 'boolean') {
    return data.active;
  }

  const status = normalizeText(data.status)?.toLowerCase();
  if (status === 'active' || status === 'activo') {
    return true;
  }
  if (
    status === 'inactive' ||
    status === 'inactivo' ||
    status === 'suspended' ||
    status === 'suspendido'
  ) {
    return false;
  }

  return false;
};

const comparableText = (value: unknown): string => {
  const normalized = normalizeText(value) ?? '';
  return normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const WEEKEND_SECTION_PATTERN = /^(publicTalk|weekendAssignments)(?:__(\d+))?$/;

type WeekendSlot = 'publicTalk' | 'weekendAssignments';

const toWeekendSlot = (sectionKey: string, sectionTitle: string): { slot: WeekendSlot; index: number } | null => {
  const byKey = sectionKey.match(WEEKEND_SECTION_PATTERN);
  if (byKey) {
    const rawIndex = byKey[2] ? Number(byKey[2]) - 1 : 0;
    return {
      slot: byKey[1] as WeekendSlot,
      index: Number.isFinite(rawIndex) && rawIndex >= 0 ? rawIndex : 0,
    };
  }

  const title = comparableText(sectionTitle);
  if (title.includes('discurso publico')) {
    return { slot: 'publicTalk', index: 0 };
  }
  if (title.includes('atalaya')) {
    return { slot: 'weekendAssignments', index: 0 };
  }

  return null;
};

const findWeekendAssignment = (
  assignments: ReturnType<typeof normalizeMeetingSectionsFromDoc>[number]['assignments'],
  keyword: 'discursante' | 'conductor' | 'lector'
) =>
  assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    return title.includes(keyword);
  });

const findWeekendThemeAssignment = (
  assignments: ReturnType<typeof normalizeMeetingSectionsFromDoc>[number]['assignments'],
  conductorKey?: string,
  readerKey?: string
) => {
  const explicit = assignments.find((assignment) => {
    const title = comparableText(assignment.title);
    const key = comparableText(assignment.assignmentKey);
    return title.includes('tema') || key.includes('theme') || key.includes('tema');
  });
  if (explicit) return explicit;

  return assignments.find(
    (assignment) =>
      assignment.assignmentKey !== conductorKey &&
      assignment.assignmentKey !== readerKey &&
      assignment.assignmentScope !== 'internal'
  );
};

const isRegisteredAssigneeInCongregation = (
  assignee: ReturnType<typeof normalizeMeetingSectionsFromDoc>[number]['assignments'][number]['assignees'][number] | undefined,
  activeUsersById: Map<string, { isActive: boolean; congregationId: string }>,
  congregationId: string
): boolean => {
  const userId = normalizeText(assignee?.assigneeUserId);
  if (!userId) return false;
  const profile = activeUsersById.get(userId);
  if (!profile) return false;
  return profile.isActive && profile.congregationId === congregationId;
};

const parsePayload = (
  payload: SetMeetingPublicationStatusPayload
): {
  congregationId: string;
  meetingId: string;
  publicationStatus: 'draft' | 'published';
} => {
  const congregationId = normalizeText(payload.congregationId);
  const meetingId = normalizeText(payload.meetingId);
  const publicationStatus = payload.publicationStatus;

  if (!congregationId || !meetingId) {
    throw new HttpsError(
      'invalid-argument',
      'Se requiere congregationId y meetingId.'
    );
  }

  if (publicationStatus !== 'draft' && publicationStatus !== 'published') {
    throw new HttpsError(
      'invalid-argument',
      'publicationStatus invalido.'
    );
  }

  return {
    congregationId,
    meetingId,
    publicationStatus,
  };
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError(
      'permission-denied',
      'No existe perfil del usuario autenticado.'
    );
  }

  const data = snap.data() as Record<string, unknown>;

  const role = normalizeRole(data.role);
  const congregationId = normalizeText(data.congregationId);
  const isActive = normalizeIsActive(data);

  if (!role || !congregationId) {
    throw new HttpsError(
      'permission-denied',
      'Perfil de usuario invalido.'
    );
  }

  return {
    role,
    congregationId,
    isActive,
  };
};

const getActiveCongregationUsersMap = async (
  congregationId: string
): Promise<Map<string, { isActive: boolean; congregationId: string }>> => {
  const snap = await adminDb
    .collection('users')
    .where('congregationId', '==', congregationId)
    .where('isActive', '==', true)
    .get();

  const map = new Map<string, { isActive: boolean; congregationId: string }>();

  snap.docs.forEach((docSnap) => {
    map.set(docSnap.id, {
      isActive: true,
      congregationId,
    });
  });

  return map;
};

const validateMeetingForPublish = async (params: {
  congregationId: string;
  meetingData: Record<string, unknown>;
}): Promise<{ errors: string[]; assignedUserIds: string[]; sections: ReturnType<typeof normalizeMeetingSectionsFromDoc> }> => {
  const errors: string[] = [];

  const meetingDate = resolveMeetingDate(params.meetingData);
  if (!meetingDate) {
    errors.push('La reunion debe tener una fecha valida.');
  }

  const meetingType = resolveMeetingType(params.meetingData);
  if (meetingType !== 'midweek' && meetingType !== 'weekend') {
    errors.push('La reunion debe tener un tipo valido.');
  }

  const sections = normalizeMeetingSectionsFromDoc(params.meetingData);

  if (sections.length === 0) {
    errors.push('La reunion debe incluir al menos una seccion.');
  }

  const activeUsersById = await getActiveCongregationUsersMap(params.congregationId);

  sections
    .filter((section) => section.isEnabled)
    .forEach((section) => {
      section.assignments.forEach((assignment) => {
        if (!normalizeText(assignment.title)) {
          errors.push(
            `La asignacion en la seccion "${section.title}" tiene titulo vacio.`
          );
        }

        if (assignment.assignmentScope !== 'internal') {
          return;
        }

        assignment.assignees.forEach((assignee) => {
          if (assignee.assigneeType === 'registeredUser') {
            const userId = normalizeText(assignee.assigneeUserId);
            const snapshotName = normalizeText(assignee.assigneeNameSnapshot);

            if (!userId) {
              if (!snapshotName) {
                return;
              }

              errors.push(
                `La asignacion "${assignment.title}" usa un nombre manual en una asignacion interna.`
              );
              return;
            }

            const profile = activeUsersById.get(userId);
            if (!profile || !profile.isActive || profile.congregationId !== params.congregationId) {
              errors.push(
                `El usuario asignado en "${assignment.title}" no existe, esta inactivo o pertenece a otra congregacion.`
              );
            }

            return;
          }

          if (assignee.assigneeType === 'specialExternalRole') {
            if (assignee.specialRoleKey !== SPECIAL_CIRCUIT_OVERSEER_KEY) {
              errors.push(
                `La asignacion "${assignment.title}" tiene un rol especial invalido.`
              );
            }
            return;
          }

          const name = normalizeText(assignee.assigneeNameSnapshot);
          if (name) {
            errors.push(
              `La asignacion interna "${assignment.title}" no permite nombres manuales.`
            );
          }
        });
      });
    });

  if (meetingType === 'weekend') {
    const buckets = new Map<
      number,
      {
        publicTalk?: ReturnType<typeof normalizeMeetingSectionsFromDoc>[number];
        watchtower?: ReturnType<typeof normalizeMeetingSectionsFromDoc>[number];
      }
    >();

    sections
      .filter((section) => section.isEnabled)
      .forEach((section) => {
        const slot = toWeekendSlot(section.sectionKey, section.title);
        if (!slot) return;

        const current = buckets.get(slot.index) ?? {};
        if (slot.slot === 'publicTalk') current.publicTalk = section;
        if (slot.slot === 'weekendAssignments') current.watchtower = section;
        buckets.set(slot.index, current);
      });

    if (buckets.size === 0) {
      errors.push('La reunion de fin de semana no tiene sesiones validas.');
    }

    Array.from(buckets.keys())
      .sort((left, right) => left - right)
      .forEach((sessionIndex) => {
        const label = `Sesion ${sessionIndex + 1}`;
        const bucket = buckets.get(sessionIndex) ?? {};
        const publicTalk = bucket.publicTalk;
        const watchtower = bucket.watchtower;

        if (!publicTalk) {
          errors.push(`${label}: Falta seccion de Discurso Publico.`);
        }

        if (!watchtower) {
          errors.push(`${label}: Falta seccion de Estudio de La Atalaya.`);
        }

        if (publicTalk) {
          const speakerAssignment = findWeekendAssignment(publicTalk.assignments, 'discursante');
          const discourseAssignment =
            publicTalk.assignments.find(
              (assignment) => assignment.assignmentKey !== speakerAssignment?.assignmentKey
            ) ?? publicTalk.assignments[0];

          if (!discourseAssignment || !normalizeText(discourseAssignment.title)) {
            errors.push(`${label}: El nombre del discurso publico es obligatorio.`);
          }

          const speakerAssignee = speakerAssignment?.assignees[0];

          if (!speakerAssignment || !speakerAssignee) {
            errors.push(`${label}: Debes asignar quien dara el discurso publico.`);
          } else if (speakerAssignee.assigneeType === 'registeredUser') {
            if (
              !isRegisteredAssigneeInCongregation(
                speakerAssignee,
                activeUsersById,
                params.congregationId
              )
            ) {
              errors.push(
                `${label}: El discursante debe ser un usuario activo de la congregacion.`
              );
            }
          } else if (speakerAssignee.assigneeType === 'informational') {
            if (!normalizeText(speakerAssignee.assigneeNameSnapshot)) {
              errors.push(`${label}: El nombre manual del discursante es obligatorio.`);
            }
          } else {
            errors.push(`${label}: El discursante debe ser manual o usuario del sistema.`);
          }
        }

        if (watchtower) {
          const conductorAssignment = findWeekendAssignment(watchtower.assignments, 'conductor');
          const readerAssignment = findWeekendAssignment(watchtower.assignments, 'lector');
          const themeAssignment = findWeekendThemeAssignment(
            watchtower.assignments,
            conductorAssignment?.assignmentKey,
            readerAssignment?.assignmentKey
          );

          if (!themeAssignment || !normalizeText(themeAssignment.title)) {
            errors.push(`${label}: El tema del Estudio de La Atalaya es obligatorio.`);
          }

          const conductorAssignee = conductorAssignment?.assignees[0];
          if (!conductorAssignment || !conductorAssignee) {
            errors.push(`${label}: Debes asignar conductor del Estudio de La Atalaya.`);
          } else if (conductorAssignee.assigneeType !== 'registeredUser') {
            errors.push(`${label}: El conductor debe ser usuario del sistema.`);
          } else if (
            !isRegisteredAssigneeInCongregation(
              conductorAssignee,
              activeUsersById,
              params.congregationId
            )
          ) {
            errors.push(`${label}: El conductor debe ser usuario activo de la congregacion.`);
          }

          const readerAssignee = readerAssignment?.assignees[0];
          if (!readerAssignment || !readerAssignee) {
            errors.push(`${label}: Debes asignar lector del Estudio de La Atalaya.`);
          } else if (readerAssignee.assigneeType !== 'registeredUser') {
            errors.push(`${label}: El lector debe ser usuario del sistema.`);
          } else if (
            !isRegisteredAssigneeInCongregation(
              readerAssignee,
              activeUsersById,
              params.congregationId
            )
          ) {
            errors.push(`${label}: El lector debe ser usuario activo de la congregacion.`);
          }
        }
      });
  }

  return {
    errors: Array.from(new Set(errors)),
    assignedUserIds: buildAssignedUserIdsFromSections(sections),
    sections,
  };
};

export const setMeetingPublicationStatus = onCall(
  { region: 'us-central1' },
  async (request): Promise<SetMeetingPublicationStatusResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const parsed = parsePayload(request.data as SetMeetingPublicationStatusPayload);
    const requester = await getRequesterProfile(request.auth.uid);

    if (!requester.isActive) {
      throw new HttpsError('permission-denied', 'Tu usuario esta inactivo.');
    }

    if (requester.role !== 'admin' && requester.role !== 'supervisor') {
      throw new HttpsError(
        'permission-denied',
        'Solo admin y supervisor pueden publicar reuniones.'
      );
    }

    if (requester.congregationId !== parsed.congregationId) {
      throw new HttpsError(
        'permission-denied',
        'No puedes modificar reuniones de otra congregacion.'
      );
    }

    const meetingRef = adminDb
      .collection('congregations')
      .doc(parsed.congregationId)
      .collection('meetings')
      .doc(parsed.meetingId);

    const meetingSnap = await meetingRef.get();

    if (!meetingSnap.exists) {
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    const meetingData = meetingSnap.data() as Record<string, unknown>;

    if (parsed.publicationStatus === 'draft') {
      const sections = normalizeMeetingSectionsFromDoc(meetingData);
      const cleanedSections = clearMeetingNotificationMarkers(sections);

      await meetingRef.update({
        publicationStatus: 'draft',
        publishedAt: null,
        sections: toFirestoreSectionsPayload(cleanedSections),
        assignedUserIds: buildAssignedUserIdsFromSections(cleanedSections),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid,
      });

      return {
        ok: true,
        publicationStatus: 'draft',
        assignedUserIds: buildAssignedUserIdsFromSections(cleanedSections),
        errors: [],
      };
    }

    const validation = await validateMeetingForPublish({
      congregationId: parsed.congregationId,
      meetingData,
    });

    if (validation.errors.length > 0) {
      return {
        ok: false,
        publicationStatus: 'published',
        assignedUserIds: validation.assignedUserIds,
        errors: validation.errors,
      };
    }

    const meetingDate = resolveMeetingDate(meetingData);
    const updatePayload: Record<string, unknown> = {
      publicationStatus: 'published',
      meetingDate: meetingDate ?? Timestamp.now(),
      sections: toFirestoreSectionsPayload(validation.sections),
      assignedUserIds: validation.assignedUserIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };

    if (meetingData.publishedAt instanceof Timestamp) {
      updatePayload.publishedAt = meetingData.publishedAt;
    } else {
      updatePayload.publishedAt = FieldValue.serverTimestamp();
    }

    await meetingRef.update(updatePayload);

    return {
      ok: true,
      publicationStatus: 'published',
      assignedUserIds: validation.assignedUserIds,
      errors: [],
    };
  }
);
