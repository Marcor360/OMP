import {
  AssignmentNotificationContext,
  MeetingType,
  NotificationCategory,
  ResolvedAssignmentUsers,
} from './notification.types.js';

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => isString(item));
};

const normalizeCategory = (value: unknown): NotificationCategory | null => {
  if (value === 'platform' || value === 'cleaning' || value === 'hospitality') {
    return value;
  }

  if (value === 'midweek' || value === 'weekend') {
    return 'platform';
  }

  return null;
};

const normalizeMeetingType = (value: unknown): MeetingType => {
  if (value === 'midweek' || value === 'weekend') {
    return value;
  }

  return null;
};

const normalizeDateValue = (value: unknown): string | null => {
  if (isString(value)) {
    return value.trim();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const parsed = (value as { toDate: () => Date }).toDate();

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
};

const parseAssignmentsArray = (rawAssignments: unknown): ResolvedAssignmentUsers => {
  const userIds = new Set<string>();
  const roleByUserId = new Map<string, string>();

  if (!Array.isArray(rawAssignments)) {
    return { userIds, roleByUserId };
  }

  rawAssignments.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;

    const assignment = entry as Record<string, unknown>;
    const userId = isString(assignment.userId) ? assignment.userId.trim() : null;
    const role = isString(assignment.role) ? assignment.role.trim() : null;

    if (!userId) return;

    userIds.add(userId);

    if (role && !roleByUserId.has(userId)) {
      roleByUserId.set(userId, role);
    }
  });

  return { userIds, roleByUserId };
};

const parseAssignedUsers = (rawAssignedUsers: unknown): string[] => {
  if (!Array.isArray(rawAssignedUsers)) return [];

  return rawAssignedUsers
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      const userId = (entry as Record<string, unknown>).userId;
      if (!isString(userId)) return null;

      return userId.trim();
    })
    .filter((item): item is string => Boolean(item));
};

const dedupeSet = (input: Iterable<string>): Set<string> => {
  const output = new Set<string>();

  for (const value of input) {
    if (isString(value)) {
      output.add(value.trim());
    }
  }

  return output;
};

export const resolveNotificationCategory = (
  data: Record<string, unknown>
): NotificationCategory | null => {
  const explicit = normalizeCategory(data.category);
  if (explicit) return explicit;

  if (isString(data.cleaningGroupId)) {
    return 'cleaning';
  }

  if (Array.isArray(data.hospitalityUserIds) && data.hospitalityUserIds.length > 0) {
    return 'hospitality';
  }

  if (Array.isArray(data.assignments) || isString(data.assignedToUid) || Array.isArray(data.assignedUsers)) {
    return 'platform';
  }

  const meetingType = normalizeMeetingType(data.meetingType ?? data.type);
  if (meetingType) return 'platform';

  return null;
};

export const resolveMeetingType = (data: Record<string, unknown>): MeetingType => {
  const explicit = normalizeMeetingType(data.meetingType);
  if (explicit) return explicit;

  const fallback = normalizeMeetingType(data.type);
  if (fallback) return fallback;

  const normalizedCategory = normalizeCategory(data.category);

  if (normalizedCategory === 'platform') {
    return 'weekend';
  }

  return null;
};

export const resolveAssignmentDate = (data: Record<string, unknown>): string | null => {
  return (
    normalizeDateValue(data.date) ??
    normalizeDateValue(data.dueDate) ??
    normalizeDateValue(data.startDate) ??
    null
  );
};

export const resolveSentBy = (data: Record<string, unknown>): string | null => {
  if (isString(data.updatedBy)) return data.updatedBy.trim();
  if (isString(data.createdBy)) return data.createdBy.trim();
  return null;
};

export const resolveCongregationId = (
  data: Record<string, unknown>,
  params: Record<string, string | undefined>
): string | null => {
  if (isString(data.congregationId)) {
    return data.congregationId.trim();
  }

  if (isString(params.congregationId)) {
    return params.congregationId.trim();
  }

  return null;
};

export const resolveAssignmentContext = (params: {
  assignmentId: string;
  data: Record<string, unknown>;
  pathParams: Record<string, string | undefined>;
}): AssignmentNotificationContext | null => {
  const category = resolveNotificationCategory(params.data);

  if (!category) {
    return null;
  }

  return {
    assignmentId: params.assignmentId,
    meetingId: isString(params.pathParams.meetingId) ?
      params.pathParams.meetingId.trim() :
      null,
    category,
    congregationId: resolveCongregationId(params.data, params.pathParams),
    date: resolveAssignmentDate(params.data),
    meetingType: resolveMeetingType(params.data),
    sentBy: resolveSentBy(params.data),
  };
};

export const resolveDirectAssignedUsers = (
  data: Record<string, unknown>,
  category: NotificationCategory
): ResolvedAssignmentUsers => {
  const roleByUserId = new Map<string, string>();

  if (category === 'hospitality') {
    return {
      userIds: dedupeSet(asStringArray(data.hospitalityUserIds)),
      roleByUserId,
    };
  }

  if (category === 'platform') {
    const fromAssignments = parseAssignmentsArray(data.assignments);
    const fromAssignedUsers = parseAssignedUsers(data.assignedUsers);
    const fromAssignedTo = isString(data.assignedToUid) ? [data.assignedToUid.trim()] : [];

    const merged = dedupeSet([
      ...fromAssignments.userIds,
      ...fromAssignedUsers,
      ...fromAssignedTo,
    ]);

    return {
      userIds: merged,
      roleByUserId: fromAssignments.roleByUserId,
    };
  }

  return {
    userIds: new Set<string>(),
    roleByUserId,
  };
};

export const buildNotificationMessage = (params: {
  category: NotificationCategory;
  date: string | null;
  meetingType: MeetingType;
}): { title: string; body: string } => {
  const safeDate = params.date ?? 'sin fecha';

  if (params.category === 'cleaning') {
    return {
      title: 'Nueva asignacion',
      body: `Se te asigno limpieza para la fecha ${safeDate}.`,
    };
  }

  if (params.category === 'hospitality') {
    return {
      title: 'Nueva asignacion',
      body: `Se te asigno hospitalidad para la fecha ${safeDate}.`,
    };
  }

  if (params.meetingType === 'midweek') {
    return {
      title: 'Nueva asignacion',
      body: `Se te asigno una participacion en plataforma entre semana para la fecha ${safeDate}.`,
    };
  }

  if (params.meetingType === 'weekend') {
    return {
      title: 'Nueva asignacion',
      body: `Se te asigno una participacion en plataforma fin de semana para la fecha ${safeDate}.`,
    };
  }

  return {
    title: 'Nueva asignacion',
    body: `Se te asigno una participacion en plataforma para la fecha ${safeDate}.`,
  };
};

export const diffNewUserIds = (
  beforeUserIds: Set<string>,
  afterUserIds: Set<string>
): string[] => {
  const output: string[] = [];

  afterUserIds.forEach((uid) => {
    if (!beforeUserIds.has(uid)) {
      output.push(uid);
    }
  });

  return output;
};

export const sanitizeRoleLabel = (role: string | undefined): string | null => {
  if (!role) return null;
  const trimmed = role.trim();
  return trimmed.length > 0 ? trimmed : null;
};
