import { useCallback, useEffect, useRef, useState } from 'react';

import { getCleaningGroupMembersPage } from '@/src/modules/cleaning/services/cleaning-service';
import type { CleaningMemberProfile } from '@/src/modules/cleaning/types/cleaning-group.types';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const PAGE_SIZE = 20;

const mergeMembers = (
  current: CleaningMemberProfile[],
  incoming: CleaningMemberProfile[]
): CleaningMemberProfile[] => {
  const byUid = new Map(current.map((member) => [member.uid, member]));
  incoming.forEach((member) => byUid.set(member.uid, member));
  return Array.from(byUid.values());
};

export function usePaginatedCleaningGroupMembers(
  congregationId: string,
  groupId: string
) {
  const [members, setMembers] = useState<CleaningMemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(async (reset: boolean) => {
    if (!congregationId || !groupId || (!reset && requestInFlightRef.current)) return;

    const requestId = ++requestIdRef.current;
    requestInFlightRef.current = true;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const page = await getCleaningGroupMembersPage(congregationId, groupId, {
        cursor: reset ? null : cursorRef.current,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      setMembers((current) => mergeMembers(reset ? [] : current, page.users));
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(formatFirestoreError(requestError));
      if (reset) setMembers([]);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setLoadingMore(false);
      requestInFlightRef.current = false;
    }
  }, [congregationId, groupId]);

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

  return {
    members,
    loading: loading && members.length === 0,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
