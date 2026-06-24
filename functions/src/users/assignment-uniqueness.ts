import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { USERS_QUERY_PAGE_SIZE } from './constants.js';
import {
  buildServiceAssignmentLabel,
  normalizeText,
  parseLegacyAssignmentLabel,
  parseServiceAssignments,
  parseServiceDepartment,
  parseServicePosition,
} from './parsers.js';
import type { ServiceAssignment } from './types.js';

export const shouldValidateAssignmentUniqueness = (
  assignment: ServiceAssignment,
  isActive: boolean
): boolean => {
  if (!isActive) return false;
  return (
    assignment.position === 'coordinador' ||
    assignment.position === 'secretario' ||
    (assignment.position === 'encargado' && Boolean(assignment.department))
  );
};

export const listCongregationUserDocs = async (params: {
  congregationId: string;
  activeOnly?: boolean;
}): Promise<QueryDocumentSnapshot[]> => {
  const db = getFirestore();
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection('users')
      .where('congregationId', '==', params.congregationId)
      .orderBy('__name__')
      .limit(USERS_QUERY_PAGE_SIZE);

    if (params.activeOnly) {
      query = db
        .collection('users')
        .where('congregationId', '==', params.congregationId)
        .where('isActive', '==', true)
        .orderBy('__name__')
        .limit(USERS_QUERY_PAGE_SIZE);
    }

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    docs.push(...snap.docs);

    if (snap.size < USERS_QUERY_PAGE_SIZE) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return docs;
};

export const assertAssignmentUniqueness = async (params: {
  congregationId: string;
  assignments: ServiceAssignment[];
  excludeUid?: string;
  isActive: boolean;
}): Promise<void> => {
  const { congregationId, assignments, excludeUid, isActive } = params;
  const targetAssignments = assignments.filter((assignment) =>
    shouldValidateAssignmentUniqueness(assignment, isActive)
  );
  if (targetAssignments.length === 0) {
    return;
  }

  const docs = await listCongregationUserDocs({
    congregationId,
    activeOnly: true,
  });

  for (const assignment of targetAssignments) {
    const owner = docs.find((doc) => {
      if (doc.id === excludeUid) return false;
      const data = doc.data() as Record<string, unknown>;
      const legacy = parseLegacyAssignmentLabel(normalizeText(data.department));
      const currentAssignments = parseServiceAssignments(
        data.serviceAssignments,
        (data.role === 'admin' || data.role === 'supervisor' || data.role === 'user') ? data.role : 'user',
        {
          position: parseServicePosition(data.servicePosition) ?? legacy.position,
          department: parseServiceDepartment(data.serviceDepartment) ?? legacy.department,
        }
      );
      return currentAssignments.some((current) => {
        if (assignment.position === 'coordinador' || assignment.position === 'secretario') {
          return current.position === assignment.position;
        }

        return (
          assignment.position === 'encargado' &&
          current.position === 'encargado' &&
          current.department === assignment.department
        );
      });
    });

    if (!owner) continue;

    if (assignment.position === 'coordinador') {
      throw new HttpsError('already-exists', 'Ya existe un Coordinador activo en esta congregacion.');
    }

    if (assignment.position === 'secretario') {
      throw new HttpsError('already-exists', 'Ya existe un Secretario activo en esta congregacion.');
    }

    if (assignment.position === 'encargado' && assignment.department) {
      const label = buildServiceAssignmentLabel('encargado', assignment.department);
      throw new HttpsError('already-exists', `Ya existe un ${label} activo en esta congregacion.`);
    }

    throw new HttpsError('already-exists', 'Esta funcion congregacional ya esta ocupada.');
  }
};
