import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import { useUser } from '@/src/context/user-context';
import { db } from '@/src/lib/firebase/app';
import type {
  SystemAnnouncement,
  SystemAnnouncementScope,
  SystemAnnouncementTarget,
  SystemAnnouncementType,
} from '@/src/types/system-announcement';

type RawSystemAnnouncement = {
  title?: unknown;
  message?: unknown;
  type?: unknown;
  active?: unknown;
  target?: unknown;
  scope?: unknown;
  congregationIds?: unknown;
  showOnce?: unknown;
  priority?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: unknown;
};

const ANNOUNCEMENTS_COLLECTION = 'systemAnnouncements';
const VIEWED_ANNOUNCEMENTS_COLLECTION = 'viewedAnnouncements';

const announcementTypes: SystemAnnouncementType[] = [
  'info',
  'success',
  'warning',
  'maintenance',
];
const announcementTargets: SystemAnnouncementTarget[] = ['all', 'app', 'web'];
const announcementScopes: SystemAnnouncementScope[] = ['global', 'congregation'];

const platformTarget: Exclude<SystemAnnouncementTarget, 'all'> =
  Platform.OS === 'web' ? 'web' : 'app';

const isTimestamp = (value: unknown): value is Timestamp => value instanceof Timestamp;

const toTimestampOrNull = (value: unknown): Timestamp | null => {
  if (value == null) return null;
  return isTimestamp(value) ? value : null;
};

const normalizeAnnouncement = (
  id: string,
  data: RawSystemAnnouncement
): SystemAnnouncement | null => {
  const type = data.type;
  const target = data.target;
  const scope = data.scope;
  const startsAt = data.startsAt;
  const createdAt = data.createdAt;
  const updatedAt = data.updatedAt;

  if (
    typeof data.title !== 'string' ||
    typeof data.message !== 'string' ||
    !announcementTypes.includes(type as SystemAnnouncementType) ||
    typeof data.active !== 'boolean' ||
    !announcementTargets.includes(target as SystemAnnouncementTarget) ||
    !announcementScopes.includes(scope as SystemAnnouncementScope) ||
    typeof data.showOnce !== 'boolean' ||
    typeof data.priority !== 'number' ||
    !isTimestamp(startsAt) ||
    !isTimestamp(createdAt) ||
    !isTimestamp(updatedAt) ||
    typeof data.createdBy !== 'string'
  ) {
    return null;
  }

  const congregationIds = Array.isArray(data.congregationIds)
    ? data.congregationIds.filter((value): value is string => typeof value === 'string')
    : undefined;

  return {
    id,
    title: data.title,
    message: data.message,
    type: type as SystemAnnouncementType,
    active: data.active,
    target: target as SystemAnnouncementTarget,
    scope: scope as SystemAnnouncementScope,
    congregationIds,
    showOnce: data.showOnce,
    priority: data.priority,
    startsAt,
    endsAt: toTimestampOrNull(data.endsAt),
    createdAt,
    updatedAt,
    createdBy: data.createdBy,
  };
};

const isAnnouncementVisible = (
  announcement: SystemAnnouncement,
  uid: string,
  congregationId: string | null,
  viewedIds: Set<string>,
  dismissedIds: Set<string>,
  now: Date
): boolean => {
  if (!uid || dismissedIds.has(announcement.id)) return false;
  if (!announcement.active) return false;
  if (announcement.startsAt.toDate() > now) return false;
  if (announcement.endsAt && announcement.endsAt.toDate() < now) return false;
  if (announcement.target !== 'all' && announcement.target !== platformTarget) return false;
  if (announcement.showOnce && viewedIds.has(announcement.id)) return false;

  if (announcement.scope === 'global') return true;

  return Boolean(
    congregationId && announcement.congregationIds?.includes(congregationId)
  );
};

const sortAnnouncements = (announcements: SystemAnnouncement[]) => {
  return [...announcements].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.startsAt.toMillis() - a.startsAt.toMillis();
  });
};

export function useSystemAnnouncements() {
  const { uid, congregationId, isSessionValid } = useUser();
  const [announcementState, setAnnouncementState] = useState<{
    ownerUid: string | null;
    announcements: SystemAnnouncement[];
    loading: boolean;
    error: string | null;
  }>({ ownerUid: null, announcements: [], loading: true, error: null });
  const [viewedState, setViewedState] = useState<{
    ownerUid: string | null;
    viewedIds: Set<string>;
    dismissedIds: Set<string>;
    loading: boolean;
  }>({ ownerUid: null, viewedIds: new Set(), dismissedIds: new Set(), loading: true });

  useEffect(() => {
    if (!isSessionValid || !uid) return;

    let active = true;
    const announcementsQuery = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      where('active', '==', true)
    );

    void getDocs(announcementsQuery)
      .then((snapshot) => {
        const nextAnnouncements = snapshot.docs
          .map((announcementDoc) =>
            normalizeAnnouncement(
              announcementDoc.id,
              announcementDoc.data() as RawSystemAnnouncement
            )
          )
          .filter((announcement): announcement is SystemAnnouncement => announcement != null);

        if (active) setAnnouncementState({
          ownerUid: uid,
          announcements: nextAnnouncements,
          loading: false,
          error: null,
        });
      })
      .catch((snapshotError: unknown) => {
        if (active) setAnnouncementState({
          ownerUid: uid,
          announcements: [],
          loading: false,
          error: snapshotError instanceof Error ? snapshotError.message : 'No se pudieron cargar avisos.',
        });
      });

    return () => {
      active = false;
    };
  }, [isSessionValid, uid]);

  useEffect(() => {
    if (!isSessionValid || !uid) return;

    let cancelled = false;

    const loadViewedAnnouncements = async () => {
      try {
        const viewedSnapshot = await getDocs(
          collection(db, 'users', uid, VIEWED_ANNOUNCEMENTS_COLLECTION)
        );

        if (cancelled) return;

        setViewedState({
          ownerUid: uid,
          viewedIds: new Set(viewedSnapshot.docs.map((viewedDoc) => viewedDoc.id)),
          dismissedIds: new Set(),
          loading: false,
        });
      } catch (loadError) {
        if (cancelled) return;

        setAnnouncementState((current) => current.ownerUid === uid
          ? { ...current, error: loadError instanceof Error ? loadError.message : 'No se pudieron cargar avisos.' }
          : current);
        setViewedState((current) => current.ownerUid === uid
          ? { ...current, loading: false }
          : { ownerUid: uid, viewedIds: new Set(), dismissedIds: new Set(), loading: false });
      }
    };

    void loadViewedAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [isSessionValid, uid]);

  const hasCurrentAnnouncements = announcementState.ownerUid === uid;
  const hasCurrentViewed = viewedState.ownerUid === uid;
  const emptyAnnouncements = useMemo<SystemAnnouncement[]>(() => [], []);
  const emptyIds = useMemo<Set<string>>(() => new Set(), []);
  const announcements = hasCurrentAnnouncements ? announcementState.announcements : emptyAnnouncements;
  const viewedIds = hasCurrentViewed ? viewedState.viewedIds : emptyIds;
  const dismissedIds = hasCurrentViewed ? viewedState.dismissedIds : emptyIds;

  const currentAnnouncement = useMemo(() => {
    if (!uid || !isSessionValid) return null;

    const now = new Date();
    const visibleAnnouncements = announcements.filter((announcement) =>
      isAnnouncementVisible(
        announcement,
        uid,
        congregationId,
        viewedIds,
        dismissedIds,
        now
      )
    );

    return sortAnnouncements(visibleAnnouncements)[0] ?? null;
  }, [announcements, congregationId, dismissedIds, isSessionValid, uid, viewedIds]);

  const markAsViewed = useCallback(async () => {
    if (!uid || !currentAnnouncement) return;

    const announcementId = currentAnnouncement.id;
    setViewedState((current) => current.ownerUid === uid
      ? {
        ...current,
        dismissedIds: new Set(current.dismissedIds).add(announcementId),
        viewedIds: new Set(current.viewedIds).add(announcementId),
      }
      : current);

    await setDoc(
      doc(db, 'users', uid, VIEWED_ANNOUNCEMENTS_COLLECTION, announcementId),
      {
        announcementId,
        viewedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }, [currentAnnouncement, uid]);

  return {
    currentAnnouncement,
    loading: Boolean(uid && isSessionValid) && (!hasCurrentAnnouncements || !hasCurrentViewed
      || announcementState.loading || viewedState.loading),
    error: hasCurrentAnnouncements ? announcementState.error : null,
    markAsViewed,
  };
}
