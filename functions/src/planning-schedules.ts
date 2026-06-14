import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';

type UserRole = 'admin' | 'supervisor' | 'user';
type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: { position?: string; department?: string }[];
  permissions?: Record<string, Record<string, boolean> | undefined>;
};

type PublishSchedulePayload = {
  congregationId?: unknown;
  scheduleId?: unknown;
  syncMeetings?: unknown;
};

type HospitalityMeetingType = 'midweek' | 'weekend';
type HospitalityRoleKey =
  | 'microphoneOne'
  | 'microphoneTwo'
  | 'attendantDoor'
  | 'attendantAuditorium'
  | 'watchtowerReader'
  | 'midweekBibleStudyReader'
  | 'audioVideo';

type HospitalityScheduleItem = {
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  roleKey: HospitalityRoleKey;
  roleLabel: string;
  userId: string;
  userNameSnapshot: string;
};

type FirestoreRecord = Record<string, unknown>;

const HOSPITALITY_SECTION_KEY = 'hospitalityMicrophones';

const HOSPITALITY_ROLE_LABELS: Record<HospitalityRoleKey, string> = {
  microphoneOne: 'Microfono 1',
  microphoneTwo: 'Microfono 2',
  attendantDoor: 'Acomodador de puerta',
  attendantAuditorium: 'Acomodador de auditorio',
  watchtowerReader: 'Lector del Estudio de la Atalaya',
  midweekBibleStudyReader: 'Lector del Estudio Biblico',
  audioVideo: 'Audio y video',
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeComparableText = (value: unknown): string =>
  (normalizeText(value) ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parsePayload = (raw: unknown): { congregationId: string; scheduleId: string; syncMeetings: boolean } => {
  const data = raw as PublishSchedulePayload;
  const congregationId = normalizeText(data?.congregationId);
  const scheduleId = normalizeText(data?.scheduleId);

  if (!congregationId || !scheduleId) {
    throw new HttpsError('invalid-argument', 'congregationId y scheduleId son obligatorios.');
  }

  return {
    congregationId,
    scheduleId,
    syncMeetings: data.syncMeetings === true,
  };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (value === 'administrador') return 'admin';
  if (value === 'usuario') return 'user';
  return undefined;
};

const resolveIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (data.status === 'active') return true;
  return false;
};

const toServiceAssignments = (value: unknown): { position?: string; department?: string }[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      position: normalizeText(item.position),
      department: normalizeText(item.department),
    }));
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data() as Record<string, unknown>;
  const role = normalizeRole(data.role) ?? 'user';
  const congregationId = normalizeText(data.congregationId);

  if (!congregationId || !resolveIsActive(data)) {
    throw new HttpsError('permission-denied', 'Perfil de usuario invalido o inactivo.');
  }

  return {
    role,
    isActive: true,
    congregationId,
    displayName: normalizeText(data.displayName),
    email: normalizeText(data.email),
    servicePosition: normalizeText(data.servicePosition),
    serviceDepartment: normalizeText(data.serviceDepartment),
    serviceAssignments: toServiceAssignments(data.serviceAssignments),
    permissions: asRecord(data.permissions) as RequesterProfile['permissions'],
  };
};

const hasServiceAssignment = (
  requester: RequesterProfile,
  position: string,
  department: string
): boolean =>
  (
    requester.servicePosition === position &&
    requester.serviceDepartment === department
  ) ||
  requester.serviceAssignments?.some(
    (assignment) => assignment.position === position && assignment.department === department
  ) === true;

const hasPermission = (
  requester: RequesterProfile,
  department: string,
  action: string
): boolean => {
  const permissions = requester.permissions?.[department];
  return permissions?.[action] === true || (action !== 'manage' && permissions?.manage === true);
};

const assertCleaningManager = (requester: RequesterProfile, congregationId: string): void => {
  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar otra congregacion.');
  }

  if (
    requester.role !== 'admin' &&
    !hasPermission(requester, 'limpieza', 'manage') &&
    !(hasPermission(requester, 'limpieza', 'create') && hasPermission(requester, 'limpieza', 'edit')) &&
    !hasServiceAssignment(requester, 'encargado', 'limpieza')
  ) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar limpieza.');
  }
};

const assertHospitalityManager = (requester: RequesterProfile, congregationId: string): void => {
  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar otra congregacion.');
  }

  if (
    requester.role !== 'admin' &&
    !hasPermission(requester, 'acomodadores_microfonos', 'manage') &&
    !(hasPermission(requester, 'acomodadores_microfonos', 'create') && hasPermission(requester, 'acomodadores_microfonos', 'edit')) &&
    !hasServiceAssignment(requester, 'encargado', 'acomodadores_microfonos') &&
    !hasServiceAssignment(requester, 'auxiliar', 'acomodadores_microfonos')
  ) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar acomodadores y microfonos.');
  }
};

const parseDateKey = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const dayRange = (dateKey: string): { start: Timestamp; end: Timestamp } => {
  const start = parseDateKey(dateKey);
  if (!start) {
    throw new HttpsError('invalid-argument', 'Fecha de schedule invalida.');
  }

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
};

const rangesOverlap = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean => leftStart <= rightEnd && rightStart <= leftEnd;

const assertNoPublishedOverlap = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
  startDate: string;
  endDate: string;
}): Promise<void> => {
  const snap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .where('status', '==', 'published')
    .get();

  const conflict = snap.docs.find((doc) => {
    if (doc.id === params.scheduleId) return false;
    const data = doc.data() as Record<string, unknown>;
    const startDate = normalizeText(data.startDate);
    const endDate = normalizeText(data.endDate);
    return Boolean(startDate && endDate && rangesOverlap(params.startDate, params.endDate, startDate, endDate));
  });

  if (conflict) {
    throw new HttpsError('already-exists', 'Ya existe una lista publicada que se traslapa con ese rango.');
  }
};

const getScheduleForPublish = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
}): Promise<Record<string, unknown>> => {
  const ref = adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .doc(params.scheduleId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Lista no encontrada.');
  }

  const data = snap.data() as Record<string, unknown>;
  if (normalizeText(data.congregationId) !== params.congregationId) {
    throw new HttpsError('permission-denied', 'La lista no pertenece a esta congregacion.');
  }

  const startDate = normalizeText(data.startDate);
  const endDate = normalizeText(data.endDate);
  if (!startDate || !endDate) {
    throw new HttpsError('failed-precondition', 'La lista no tiene rango valido.');
  }

  await assertNoPublishedOverlap({
    congregationId: params.congregationId,
    collectionName: params.collectionName,
    scheduleId: params.scheduleId,
    startDate,
    endDate,
  });

  return data;
};

const publishSchedule = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
  requesterUid: string;
}): Promise<Record<string, unknown>> => {
  const data = await getScheduleForPublish(params);
  await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .doc(params.scheduleId)
    .update({
      status: 'published',
      updatedBy: params.requesterUid,
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: FieldValue.serverTimestamp(),
    });

  return data;
};

const toMeetingKind = (value: unknown): 'midweek' | 'weekend' =>
  value === 'midweek' ? 'midweek' : 'weekend';

const syncCleaningScheduleToMeetings = async (params: {
  congregationId: string;
  scheduleId: string;
  requesterUid: string;
  requesterName: string;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const itemsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('cleaningSchedules')
    .doc(params.scheduleId)
    .collection('items')
    .where('status', '==', 'scheduled')
    .get();

  let syncedMeetings = 0;
  let missingMeetings = 0;

  for (const itemDoc of itemsSnap.docs) {
    const item = itemDoc.data() as Record<string, unknown>;
    const meetingDate = normalizeText(item.meetingDate);
    const cleaningGroupId = normalizeText(item.cleaningGroupId);
    const cleaningGroupName = normalizeText(item.cleaningGroupName);

    if (!meetingDate || !cleaningGroupId || !cleaningGroupName) {
      continue;
    }

    const range = dayRange(meetingDate);
    const meetingType = toMeetingKind(item.meetingType);
    const meetingsSnap = await adminDb
      .collection('congregations')
      .doc(params.congregationId)
      .collection('meetings')
      .where('meetingDate', '>=', range.start)
      .where('meetingDate', '<=', range.end)
      .limit(10)
      .get();
    const meetingDoc = meetingsSnap.docs.find((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const category = normalizeText(data.meetingCategory);
      const type = normalizeText(data.type);
      return meetingType === 'midweek'
        ? category === 'midweek' || type === 'midweek'
        : category === 'weekend' || type !== 'midweek';
    });

    if (!meetingDoc) {
      missingMeetings += 1;
      continue;
    }

    const meetingRef = meetingDoc.ref;
    const meetingData = meetingDoc.data() as Record<string, unknown>;
    const meetingTitle = normalizeText(meetingData.title) ?? 'Reunion';
    const assignmentsRef = meetingRef.collection('assignments');
    const assignmentId = `cleaning-${cleaningGroupId}`;
    const batch = adminDb.batch();

    batch.set(
      assignmentsRef.doc(assignmentId),
      {
        congregationId: params.congregationId,
        meetingId: meetingDoc.id,
        source: 'meeting-cleaning',
        category: 'cleaning',
        type: 'cleaning',
        title: `Limpieza - ${cleaningGroupName}`,
        description: meetingTitle,
        notes: meetingTitle,
        priority: 'medium',
        cleaningGroupId,
        cleaningGroupName,
        assignedToUid: cleaningGroupId,
        assignedToName: cleaningGroupName,
        assignedByUid: params.requesterUid,
        assignedByName: params.requesterName,
        createdBy: params.requesterUid,
        updatedBy: params.requesterUid,
        dueDate: range.start,
        date: range.start,
        status: 'pending',
        assignedUsers: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batch.update(meetingRef, {
      cleaningAssignmentMode: 'selected',
      cleaningGroupIds: [cleaningGroupId],
      cleaningGroupNames: [cleaningGroupName],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.requesterUid,
    });

    await batch.commit();
    syncedMeetings += 1;
  }

  return { syncedMeetings, missingMeetings };
};

const isHospitalityRoleKey = (value: unknown): value is HospitalityRoleKey =>
  value === 'microphoneOne' ||
  value === 'microphoneTwo' ||
  value === 'attendantDoor' ||
  value === 'attendantAuditorium' ||
  value === 'watchtowerReader' ||
  value === 'midweekBibleStudyReader' ||
  value === 'audioVideo';

const normalizeHospitalityItem = (value: FirestoreRecord): HospitalityScheduleItem | null => {
  const meetingDate = normalizeText(value.meetingDate);
  const meetingType = value.meetingType === 'midweek' ? 'midweek' : value.meetingType === 'weekend' ? 'weekend' : undefined;
  const roleKey = isHospitalityRoleKey(value.roleKey) ? value.roleKey : undefined;
  const userId = normalizeText(value.userId);
  const userNameSnapshot = normalizeText(value.userNameSnapshot);

  if (!meetingDate || !meetingType || !roleKey || !userId || !userNameSnapshot) {
    return null;
  }

  return {
    meetingDate,
    meetingType,
    roleKey,
    roleLabel: normalizeText(value.roleLabel) ?? HOSPITALITY_ROLE_LABELS[roleKey],
    userId,
    userNameSnapshot,
  };
};

const isReaderRole = (roleKey: HospitalityRoleKey): boolean =>
  roleKey === 'watchtowerReader' || roleKey === 'midweekBibleStudyReader';

const createHospitalityAssignee = (item: HospitalityScheduleItem): FirestoreRecord => ({
  id: `${item.roleKey}-${item.userId}`,
  assigneeType: 'registeredUser',
  assigneeUserId: item.userId,
  assigneeNameSnapshot: item.userNameSnapshot,
});

const markHospitalityAssignment = (assignment: FirestoreRecord): FirestoreRecord => ({
  ...assignment,
  controlledBy: 'hospitalityMicrophones',
  lockedFromMeetingEditor: true,
  sourceModule: 'hospitalityMicrophones',
});

const createHospitalityAssignment = (item: HospitalityScheduleItem): FirestoreRecord =>
  markHospitalityAssignment({
    assignmentKey: `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`,
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: HOSPITALITY_ROLE_LABELS[item.roleKey] ?? item.roleLabel,
    roleLabel: item.roleLabel || HOSPITALITY_ROLE_LABELS[item.roleKey],
    assignmentScope: 'internal',
    assignees: [createHospitalityAssignee(item)],
  });

const isControlledReaderAssignment = (sectionKey: string, assignment: FirestoreRecord): boolean => {
  const roleLabel = normalizeComparableText(assignment.roleLabel);
  const title = normalizeComparableText(assignment.title);

  if (sectionKey === 'livingAsChristians') {
    return roleLabel === 'lector' && title === 'lector';
  }

  if (sectionKey.startsWith('weekendAssignments')) {
    return roleLabel === 'lector' && title.includes('lector del estudio');
  }

  return false;
};

const withSectionOrder = (sections: FirestoreRecord[]): FirestoreRecord[] =>
  sections.map((section, index) => ({ ...section, order: index }));

const getSectionAssignments = (section: FirestoreRecord): FirestoreRecord[] =>
  Array.isArray(section.assignments)
    ? section.assignments.filter((item): item is FirestoreRecord => item !== null && typeof item === 'object')
    : [];

const applyReaderItemsToSections = (
  sections: FirestoreRecord[],
  items: HospitalityScheduleItem[],
  meetingType: HospitalityMeetingType
): FirestoreRecord[] => {
  const targetRole =
    meetingType === 'midweek' ? 'midweekBibleStudyReader' : 'watchtowerReader';
  const item = items.find((candidate) => candidate.roleKey === targetRole);
  if (!item) return sections;

  return sections.map((section) => {
    const sectionKey = normalizeText(section.sectionKey) ?? '';
    return {
      ...section,
      assignments: getSectionAssignments(section).map((assignment) => {
        if (!isControlledReaderAssignment(sectionKey, assignment)) {
          return assignment;
        }

        const existingAssignee = Array.isArray(assignment.assignees)
          ? assignment.assignees.find((assignee) => assignee && typeof assignee === 'object') as FirestoreRecord | undefined
          : undefined;

        return markHospitalityAssignment({
          ...assignment,
          assignees: [
            {
              ...createHospitalityAssignee(item),
              publishNotificationSentAt: existingAssignee?.publishNotificationSentAt,
              reminderSentAt: existingAssignee?.reminderSentAt,
            },
          ],
        });
      }),
    };
  });
};

const upsertHospitalitySection = (
  sections: FirestoreRecord[],
  items: HospitalityScheduleItem[]
): FirestoreRecord[] => {
  const nonReaderItems = items.filter((item) => !isReaderRole(item.roleKey));
  if (nonReaderItems.length === 0) return sections;

  const existingIndex = sections.findIndex((section) => section.sectionKey === HOSPITALITY_SECTION_KEY);
  const existingSection = existingIndex >= 0 ? sections[existingIndex] : undefined;
  const controlledKeys = new Set(
    nonReaderItems.map((item) => `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`)
  );
  const existingAssignments = existingSection
    ? getSectionAssignments(existingSection).filter(
        (assignment) => !controlledKeys.has(normalizeText(assignment.assignmentKey) ?? '')
      )
    : [];
  const controlledAssignments = nonReaderItems.map((item) => createHospitalityAssignment(item));
  const nextSection: FirestoreRecord = {
    ...(existingSection ?? {}),
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: 'Acomodadores y Microfonos',
    order:
      typeof existingSection?.order === 'number' && Number.isFinite(existingSection.order)
        ? existingSection.order
        : sections.length,
    sectionType: 'dynamic',
    isRequired: false,
    isEnabled: true,
    colorToken: 'teal',
    assignments: [...existingAssignments, ...controlledAssignments],
  };

  if (existingIndex < 0) {
    return withSectionOrder([...sections, nextSection]);
  }

  return withSectionOrder(
    sections.map((section, index) => (index === existingIndex ? nextSection : section))
  );
};

const collectAssignedUserIdsFromSections = (sections: FirestoreRecord[]): string[] => {
  const ids = new Set<string>();

  sections.forEach((section) => {
    if (section.isEnabled === false) return;

    getSectionAssignments(section).forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      const assignees = Array.isArray(assignment.assignees) ? assignment.assignees : [];
      assignees.forEach((rawAssignee) => {
        if (!rawAssignee || typeof rawAssignee !== 'object') return;
        const assignee = rawAssignee as FirestoreRecord;
        if (assignee.assigneeType !== 'registeredUser') return;
        const userId = normalizeText(assignee.assigneeUserId);
        if (userId) ids.add(userId);
      });
    });
  });

  return Array.from(ids);
};

const getMeetingSections = (meetingData: FirestoreRecord): FirestoreRecord[] => {
  const rawSections = Array.isArray(meetingData.sections)
    ? meetingData.sections
    : Array.isArray(meetingData.midweekSections)
      ? meetingData.midweekSections
      : [];

  return rawSections
    .filter((section): section is FirestoreRecord => section !== null && typeof section === 'object')
    .sort((left, right) => {
      const leftOrder = typeof left.order === 'number' && Number.isFinite(left.order) ? left.order : 0;
      const rightOrder = typeof right.order === 'number' && Number.isFinite(right.order) ? right.order : 0;
      return leftOrder - rightOrder;
    })
    .map((section, index) => ({ ...section, order: index }));
};

const applyHospitalityItemsToMeetingSections = (
  meetingData: FirestoreRecord,
  items: HospitalityScheduleItem[],
  meetingType: HospitalityMeetingType
): FirestoreRecord[] => {
  let sections = getMeetingSections(meetingData);
  sections = applyReaderItemsToSections(sections, items, meetingType);
  sections = upsertHospitalitySection(sections, items);
  return sections;
};

const groupHospitalityItemsByMeeting = (
  items: HospitalityScheduleItem[]
): Map<string, HospitalityScheduleItem[]> => {
  const grouped = new Map<string, HospitalityScheduleItem[]>();

  items.forEach((item) => {
    const key = `${item.meetingDate}::${item.meetingType}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return grouped;
};

const findMeetingForScheduleItem = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
}) => {
  const range = dayRange(params.meetingDate);
  const meetingsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings')
    .where('meetingDate', '>=', range.start)
    .where('meetingDate', '<=', range.end)
    .limit(10)
    .get();

  return meetingsSnap.docs.find((doc) => {
    const data = doc.data() as FirestoreRecord;
    const category = normalizeText(data.meetingCategory);
    const type = normalizeText(data.type);
    return params.meetingType === 'midweek'
      ? category === 'midweek' || type === 'midweek'
      : category === 'weekend' || type !== 'midweek';
  });
};

const syncHospitalityScheduleToMeetings = async (params: {
  congregationId: string;
  scheduleId: string;
  requesterUid: string;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const itemsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('hospitalitySchedules')
    .doc(params.scheduleId)
    .collection('items')
    .where('status', '==', 'scheduled')
    .get();

  const items = itemsSnap.docs
    .map((itemDoc) => normalizeHospitalityItem(itemDoc.data() as FirestoreRecord))
    .filter((item): item is HospitalityScheduleItem => item !== null);
  const grouped = groupHospitalityItemsByMeeting(items);
  let syncedMeetings = 0;
  let missingMeetings = 0;

  for (const groupedItems of grouped.values()) {
    const firstItem = groupedItems[0];
    const meetingDoc = await findMeetingForScheduleItem({
      congregationId: params.congregationId,
      meetingDate: firstItem.meetingDate,
      meetingType: firstItem.meetingType,
    });

    if (!meetingDoc) {
      missingMeetings += 1;
      continue;
    }

    const meetingData = meetingDoc.data() as FirestoreRecord;
    const sections = applyHospitalityItemsToMeetingSections(
      meetingData,
      groupedItems,
      firstItem.meetingType
    );

    await meetingDoc.ref.update({
      sections,
      assignedUserIds: collectAssignedUserIdsFromSections(sections),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.requesterUid,
    });
    syncedMeetings += 1;
  }

  return { syncedMeetings, missingMeetings };
};

export const publishCleaningScheduleByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true; syncedMeetings: number; missingMeetings: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data);
    const requester = await getRequesterProfile(request.auth.uid);
    assertCleaningManager(requester, payload.congregationId);

    await publishSchedule({
      congregationId: payload.congregationId,
      collectionName: 'cleaningSchedules',
      scheduleId: payload.scheduleId,
      requesterUid: request.auth.uid,
    });

    const syncResult = payload.syncMeetings
      ? await syncCleaningScheduleToMeetings({
          congregationId: payload.congregationId,
          scheduleId: payload.scheduleId,
          requesterUid: request.auth.uid,
          requesterName: requester.displayName ?? requester.email ?? 'Usuario',
        })
      : { syncedMeetings: 0, missingMeetings: 0 };

    return { ok: true, ...syncResult };
  }
);

export const publishHospitalityScheduleByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true; syncedMeetings: number; missingMeetings: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data);
    const requester = await getRequesterProfile(request.auth.uid);
    assertHospitalityManager(requester, payload.congregationId);

    await publishSchedule({
      congregationId: payload.congregationId,
      collectionName: 'hospitalitySchedules',
      scheduleId: payload.scheduleId,
      requesterUid: request.auth.uid,
    });

    const syncResult = payload.syncMeetings
      ? await syncHospitalityScheduleToMeetings({
          congregationId: payload.congregationId,
          scheduleId: payload.scheduleId,
          requesterUid: request.auth.uid,
        })
      : { syncedMeetings: 0, missingMeetings: 0 };

    return { ok: true, ...syncResult };
  }
);
