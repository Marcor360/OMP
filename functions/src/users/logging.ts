import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Role } from './types.js';

export const logCreateUserFailure = (
  error: unknown,
  context: {
    step: string;
    requesterUid?: string;
    congregationId?: string;
    role?: Role;
    raw?: unknown;
  }
) => {
  const httpsError = error instanceof HttpsError ? error : undefined;
  const raw = typeof context.raw === 'object' && context.raw !== null
    ? context.raw as Record<string, unknown>
    : undefined;
  const rawPermissions = typeof raw?.permissions === 'object' && raw.permissions !== null && !Array.isArray(raw.permissions)
    ? raw.permissions as Record<string, unknown>
    : undefined;
  const rawAssignments = Array.isArray(raw?.serviceAssignments)
    ? raw.serviceAssignments.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return { type: typeof item };
      }
      const assignment = item as Record<string, unknown>;
      return {
        position: assignment.position,
        department: assignment.department,
        keys: Object.keys(assignment),
      };
    })
    : undefined;

  logger.error('createUserByAdmin failed', {
    step: context.step,
    requesterUid: context.requesterUid,
    congregationId: context.congregationId,
    role: context.role,
    code: httpsError?.code,
    errorMessage: error instanceof Error ? error.message : String(error),
    payloadSummary: raw
      ? {
        keys: Object.keys(raw),
        role: raw.role,
        gender: raw.gender,
        servicePosition: raw.servicePosition,
        serviceDepartment: raw.serviceDepartment,
        serviceAssignments: rawAssignments,
        permissionDepartments: rawPermissions ? Object.keys(rawPermissions) : undefined,
      }
      : undefined,
  });
};
