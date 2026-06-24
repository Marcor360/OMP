import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { listCongregationUserDocs } from './assignment-uniqueness.js';
import { assertCanListUsers, getRequesterProfile } from './authorization.js';
import { isActiveUserListRecord, sanitizeOrgChartUserForList, sanitizeUserForList, sortListedUsers } from './list-sanitizers.js';
import { parseListUsersPayload } from './parsers.js';
import type { ListUsersResult } from './types.js';

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
    const users = sortListedUsers(
      docs
        .map((doc) => sanitizeUserForList(doc.id, doc.data()))
        .filter((user) => !payload.activeOnly || isActiveUserListRecord(user))
    );

    return { users };
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
