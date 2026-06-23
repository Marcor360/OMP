import {
  deleteDoc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import {
  userDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import type { UserRepository } from '@/src/services/repositories/ports/user-repository.port';
import {
  getDocumentCacheFirst,
  invalidateCacheEntry,
} from '@/src/services/repositories/firestore-cache-first';
import {
  clearSessionCacheByPrefix,
  getSessionCachedValue,
  runSingleFlight,
  setSessionCachedValue,
} from '@/src/services/repositories/session-cache';
import {
  isIncompleteProfile,
  normalizeUser,
} from '@/src/services/users/user.mapper';
import type { AppUser } from '@/src/types/user';
import { createLogger } from '@/src/utils/logger';
import { isSystemPrincipalUser } from '@/src/utils/users/user-protection';

const log = createLogger('users-service');

const USER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const USERS_QUERY_CACHE_TTL_MS = 60 * 1000;
const USERS_QUERY_PAGE_SIZE = 200;

type ListUsersForCurrentCongregationPayload = {
  activeOnly?: boolean;
};

type ListUsersForCurrentCongregationResult = {
  users?: (Record<string, unknown> & { uid?: string })[];
};

const sortUsers = (items: AppUser[]): AppUser[] => {
  return [...items].sort((a, b) => {
    const left = String(a.displayName || a.email || a.uid || '').toLowerCase();
    const right = String(b.displayName || b.email || b.uid || '').toLowerCase();
    return left.localeCompare(right, 'es');
  });
};

const canonicalUserKey = (user: AppUser): string => {
  const email = user.email.trim().toLowerCase();
  return email || `uid:${user.uid}`;
};

const preferUserRecord = (current: AppUser, candidate: AppUser): AppUser => {
  if (candidate.isActive !== current.isActive) {
    return candidate.isActive ? candidate : current;
  }

  const currentHasService = (current.serviceAssignments?.length ?? 0) > 0 || Boolean(current.department);
  const candidateHasService = (candidate.serviceAssignments?.length ?? 0) > 0 || Boolean(candidate.department);
  if (candidateHasService !== currentHasService) {
    return candidateHasService ? candidate : current;
  }

  return current;
};

const dedupeUsersByEmail = (items: AppUser[]): AppUser[] => {
  const byKey = new Map<string, AppUser>();

  items.forEach((user) => {
    const key = canonicalUserKey(user);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferUserRecord(existing, user) : user);
  });

  return Array.from(byKey.values());
};

const listUsersForCurrentCongregation = async (
  payload: ListUsersForCurrentCongregationPayload
): Promise<AppUser[]> => {
  const callable = httpsCallable<
    ListUsersForCurrentCongregationPayload,
    ListUsersForCurrentCongregationResult
  >(functions, 'listUsersForCurrentCongregation');
  const result = await callable(payload);
  const users = Array.isArray(result.data?.users) ? result.data.users : [];

  return sortUsers(
    dedupeUsersByEmail(
      users
        .map((user) => normalizeUser(typeof user.uid === 'string' ? user.uid : '', user))
        .filter((user) => user.uid.length > 0)
        .filter((user) => !isSystemPrincipalUser(user))
    )
  );
};

const shouldFallbackToFirestoreList = (error: unknown): boolean =>
  isFirebaseErrorCode(error, 'unimplemented') ||
  isFirebaseErrorCode(error, 'not-found') ||
  isFirebaseErrorCode(error, 'internal') ||
  isFirebaseErrorCode(error, 'unavailable') ||
  isFirebaseErrorCode(error, 'deadline-exceeded');

const listUsersForCongregationFromFirestore = async (
  congregationId: string,
  options?: { activeOnly?: boolean }
): Promise<AppUser[]> => {
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    const constraints = [
      where('congregationId', '==', congregationId),
      ...(options?.activeOnly ? [where('isActive', '==', true)] : []),
      orderBy(documentId()),
      ...(lastDoc ? [startAfter(lastDoc)] : []),
      limit(USERS_QUERY_PAGE_SIZE),
    ];
    const snap = await getDocs(firestoreQuery(usersCollectionRef(), ...constraints));
    docs.push(...snap.docs);

    if (snap.size < USERS_QUERY_PAGE_SIZE) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return sortUsers(
    dedupeUsersByEmail(
      docs
        .map((doc) => normalizeUser(doc.id, doc.data() as Record<string, unknown>))
        .filter((user) => !options?.activeOnly || user.isActive)
        .filter((user) => !isSystemPrincipalUser(user))
    )
  );
};

const getUsersForCurrentCongregationCached = async (
  congregationId: string,
  options?: { forceServer?: boolean; activeOnly?: boolean }
): Promise<AppUser[]> => {
  const activeKey = options?.activeOnly ? 'active' : 'all';
  const cacheKey = `query:users/congregation/${congregationId}/${activeKey}`;
  const requestKey = `request:${cacheKey}`;

  if (!options?.forceServer) {
    const cached = getSessionCachedValue<AppUser[]>(cacheKey, USERS_QUERY_CACHE_TTL_MS);
    if (cached !== undefined) {
      return cached;
    }
  }

  return runSingleFlight(requestKey, async () => {
    let users: AppUser[];

    try {
      users = await listUsersForCurrentCongregation({
        activeOnly: options?.activeOnly,
      });
    } catch (error) {
      if (!shouldFallbackToFirestoreList(error)) {
        throw error;
      }

      log.warn('listUsersForCurrentCongregation failed; falling back to Firestore query.', error);
      users = await listUsersForCongregationFromFirestore(congregationId, {
        activeOnly: options?.activeOnly,
      });
    }

    setSessionCachedValue(cacheKey, users);
    return users;
  });
};

const invalidateUsersCache = (uid: string): void => {
  invalidateCacheEntry(`users/${uid}`);
  clearSessionCacheByPrefix('query:users/');
};

export const firestoreUserRepository: UserRepository = {
  getById: async (
    uid: string,
    options?: { forceServer?: boolean; maxAgeMs?: number }
  ): Promise<AppUser | null> => {
    return getDocumentCacheFirst<AppUser>({
      cacheKey: `users/${uid}`,
      ref: userDocRef(uid),
      mapSnapshot: (snapshot) => normalizeUser(snapshot.id, snapshot.data() as Record<string, unknown>),
      maxAgeMs: options?.maxAgeMs ?? USER_PROFILE_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      isIncomplete: isIncompleteProfile,
      persist: false,
    });
  },

  getAllByCongregation: async (
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<AppUser[]> => {
    return getUsersForCurrentCongregationCached(congregationId, {
      forceServer: options?.forceServer,
    });
  },

  getActiveByCongregation: async (congregationId: string): Promise<AppUser[]> => {
    return getUsersForCurrentCongregationCached(congregationId, {
      activeOnly: true,
    });
  },

  create: async (uid: string, payload: Record<string, unknown>): Promise<void> => {
    await setDoc(userDocRef(uid), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    invalidateUsersCache(uid);
  },

  update: async (uid: string, payload: Record<string, unknown>): Promise<void> => {
    await updateDoc(userDocRef(uid), {
      ...payload,
      updatedAt: serverTimestamp(),
    });

    invalidateUsersCache(uid);
  },

  delete: async (uid: string): Promise<void> => {
    await deleteDoc(userDocRef(uid));
    invalidateUsersCache(uid);
  },

  count: async (congregationId: string): Promise<number> => {
    const users = await firestoreUserRepository.getAllByCongregation(congregationId);
    return users.length;
  },

  subscribeToUser: (
    uid: string,
    callback: (user: AppUser | null) => void,
    onError?: (error: unknown) => void
  ) => {
    const listenerKey = `users:doc:${uid}`;
    logFirestoreListenerCreated(listenerKey);

    const unsubscribe = onSnapshot(
      userDocRef(uid),
      (snap) => {
        callback(snap.exists() ? normalizeUser(snap.id, snap.data()) : null);
      },
      onError
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },
};
