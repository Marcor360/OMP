import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
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
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [loadingViewed, setLoadingViewed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSessionValid || !uid) {
      setAnnouncements([]);
      setLoadingAnnouncements(false);
      return;
    }

    setLoadingAnnouncements(true);
    const announcementsQuery = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        const nextAnnouncements = snapshot.docs
          .map((announcementDoc) =>
            normalizeAnnouncement(
              announcementDoc.id,
              announcementDoc.data() as RawSystemAnnouncement
            )
          )
          .filter((announcement): announcement is SystemAnnouncement => announcement != null);

        setAnnouncements(nextAnnouncements);
        setLoadingAnnouncements(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoadingAnnouncements(false);
      }
    );

    return unsubscribe;
  }, [isSessionValid, uid]);

  useEffect(() => {
    if (!isSessionValid || !uid) {
      setViewedIds(new Set());
      setDismissedIds(new Set());
      setLoadingViewed(false);
      return;
    }

    let cancelled = false;
    setLoadingViewed(true);

    const loadViewedAnnouncements = async () => {
      try {
        const viewedSnapshot = await getDocs(
          collection(db, 'users', uid, VIEWED_ANNOUNCEMENTS_COLLECTION)
        );

        if (cancelled) return;

        setViewedIds(new Set(viewedSnapshot.docs.map((viewedDoc) => viewedDoc.id)));
        setLoadingViewed(false);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar avisos.');
        setLoadingViewed(false);
      }
    };

    void loadViewedAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [isSessionValid, uid]);

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
    setDismissedIds((current) => new Set(current).add(announcementId));
    setViewedIds((current) => new Set(current).add(announcementId));

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
    loading: loadingAnnouncements || loadingViewed,
    error,
    markAsViewed,
  };
}
