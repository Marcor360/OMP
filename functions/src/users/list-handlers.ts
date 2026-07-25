import { getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { listCongregationUserDocs } from './assignment-uniqueness.js';
import { assertCanListUsers, getRequesterProfile } from './authorization.js';
import { getVisibleListedUsers, isActiveUserListRecord, sanitizeOrgChartUserForList, sanitizeUserForList, sortListedUsers } from './list-sanitizers.js';
import { parseListUsersPayload } from './parsers.js';
import type { ListUsersPagePayload, ListUsersPageResult, ListUsersResult } from './types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const parsePagePayload = (value: unknown): Required<Pick<ListUsersPagePayload, 'activeOnly' | 'pageSize' | 'includeTotal'>> & { cursor?: string } => {
  if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    throw new HttpsError('invalid-argument', 'Solicitud invalida.');
  }

  const source = (value ?? {}) as Record<string, unknown>;
  const requestedSize = typeof source.pageSize === 'number' && Number.isInteger(source.pageSize)
    ? source.pageSize
    : DEFAULT_PAGE_SIZE;
  const cursor = typeof source.cursor === 'string' && source.cursor.trim().length > 0
    ? source.cursor.trim()
    : undefined;

  if (requestedSize < 1 || requestedSize > MAX_PAGE_SIZE || (cursor && cursor.length > 128)) {
    throw new HttpsError('invalid-argument', 'Parametros de paginacion invalidos.');
  }

  return {
    activeOnly: source.activeOnly === true,
    pageSize: requestedSize,
    includeTotal: source.includeTotal === true,
    cursor,
  };
};

export const listUsersForCurrentCongregation = onCall(
  { region: 'us-central1' },
  async (request): Promise<ListUsersResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertCanListUsers(requester);

    const payload = parseListUsersPayload(request.data);
    const docs = await listCongregationUserDocs({
      congregationId: requester.congregationId,
      activeOnly: payload.activeOnly,
    });
    const users = getVisibleListedUsers(
      docs
        .map((doc) => sanitizeUserForList(doc.id, doc.data()))
        .filter((user) => !payload.activeOnly || isActiveUserListRecord(user))
    );

    return { users };
  }
);

export const listUsersPageForCurrentCongregation = onCall(
  { region: 'us-central1' },
  async (request): Promise<ListUsersPageResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertCanListUsers(requester);
    const payload = parsePagePayload(request.data);
    const db = getFirestore();
    let lastDoc: QueryDocumentSnapshot | undefined;

    if (payload.cursor) {
      const cursorSnap = await db.collection('users').doc(payload.cursor).get();
      if (!cursorSnap.exists || cursorSnap.data()?.congregationId !== requester.congregationId) {
        throw new HttpsError('invalid-argument', 'Cursor de paginacion invalido.');
      }
      lastDoc = cursorSnap as QueryDocumentSnapshot;
    }

    const queryLimit = payload.pageSize + 1;
    let usersQuery = db
      .collection('users')
      .where('congregationId', '==', requester.congregationId)
      .orderBy('__name__')
      .limit(queryLimit);

    if (payload.activeOnly) {
      usersQuery = db
        .collection('users')
        .where('congregationId', '==', requester.congregationId)
        .where('isActive', '==', true)
        .orderBy('__name__')
        .limit(queryLimit);
    }
    if (lastDoc) usersQuery = usersQuery.startAfter(lastDoc);

    const snap = await usersQuery.get();
    const pageDocs = snap.docs.slice(0, payload.pageSize);
    const visibleUsers = getVisibleListedUsers(
      pageDocs
        .map((doc) => sanitizeUserForList(doc.id, doc.data()))
        .filter((user) => !payload.activeOnly || isActiveUserListRecord(user))
    );
    const pageLastDoc = pageDocs[pageDocs.length - 1];

    let total: number | null = null;
    if (payload.includeTotal) {
      const summarySnap = await db
        .collection('dashboardSummary')
        .doc(requester.congregationId)
        .get();
      const metrics = summarySnap.data()?.metrics as Record<string, unknown> | undefined;
      const candidate = payload.activeOnly ? metrics?.activeUsers : metrics?.totalUsers;
      total = typeof candidate === 'number' && Number.isFinite(candidate)
        ? Math.max(0, candidate)
        : null;
    }

    return {
      users: sortListedUsers(visibleUsers),
      cursor: pageLastDoc?.id ?? null,
      hasMore: snap.size > payload.pageSize,
      total,
    };
  }
);

export const listOrgChartUsersForCurrentCongregation = onCall(
  { region: 'us-central1' },
  async (request): Promise<ListUsersResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    const docs = await listCongregationUserDocs({
      congregationId: requester.congregationId,
      activeOnly: true,
    });
    const users = sortListedUsers(
      docs
        .map((doc) => sanitizeOrgChartUserForList(doc.id, doc.data()))
        .filter(isActiveUserListRecord)
    );

    return { users };
  }
);
