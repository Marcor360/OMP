import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CleaningAssignableUser,
  CleaningMemberStatus,
} from '@/src/modules/cleaning/types/cleaning-group.types';
import { getCleaningAssignableUsersPage } from '@/src/modules/cleaning/services/cleaning-service';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const PAGE_SIZE = 20;

const mergeUsers = (
  current: CleaningAssignableUser[],
  incoming: CleaningAssignableUser[]
): CleaningAssignableUser[] => {
  const byKey = new Map<string, CleaningAssignableUser>();
  [...current, ...incoming].forEach((user) => {
    const key = user.email.trim().toLowerCase() || `uid:${user.uid}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.isActive && user.isActive)) byKey.set(key, user);
  });
  const order: Record<CleaningMemberStatus, number> = {
    available: 0,
    assigned_here: 1,
    assigned_other: 2,
    not_eligible: 3,
    inactive: 4,
  };
  return Array.from(byKey.values()).sort(
    (left, right) =>
      order[left.memberStatus] - order[right.memberStatus] ||
      left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' })
  );
};

export function usePaginatedCleaningAssignableUsers(
  congregationId: string,
  currentGroupId: string | null
) {
  const [users, setUsers] = useState<CleaningAssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(async (reset: boolean) => {
    if (!congregationId || (!reset && requestInFlightRef.current)) return;
    const requestId = ++requestIdRef.current;
    requestInFlightRef.current = true;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const page = await getCleaningAssignableUsersPage(congregationId, currentGroupId, {
        cursor: reset ? null : cursorRef.current,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      setUsers((current) => mergeUsers(reset ? [] : current, page.users));
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(formatFirestoreError(requestError));
      if (reset) setUsers([]);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
      requestInFlightRef.current = false;
    }
  }, [congregationId, currentGroupId]);

  useEffect(() => {
    requestIdRef.current += 1;
    requestInFlightRef.current = false;
    cursorRef.current = null;
    setHasMore(false);
    void loadPage(true);

    return () => {
      requestIdRef.current += 1;
      requestInFlightRef.current = false;
    };
  }, [loadPage]);

  const refresh = useCallback(async () => {
    cursorRef.current = null;
    await loadPage(true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore && !requestInFlightRef.current) {
      void loadPage(false);
    }
  }, [hasMore, loadPage, loadingMore]);

  const selectableUsers = useMemo(
    () => users.filter((user) => user.memberStatus === 'available'),
    [users]
  );

  return {
    users,
    loading: loading && users.length === 0,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
    selectableUsers,
  };
}
