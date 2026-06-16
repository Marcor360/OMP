import { useEffect, useRef } from 'react';

import { markFirestoreCacheSessionBoundary } from '@/src/services/repositories/firestore-cache-first';
import { clearPersistentCacheByPrefix } from '@/src/services/repositories/persistent-cache';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';

const clearLegacyCongregationSessionPrefixes = (congregationId: string): void => {
  [
    `doc:congregations/${congregationId}/`,
    `query:congregations/${congregationId}/`,
    `doc:dashboard-summary/${congregationId}`,
    `query:dashboard-summary/${congregationId}`,
    `doc:meetings/${congregationId}/`,
    `query:meetings/${congregationId}/`,
    `query:midweek/${congregationId}/`,
    `query:assignments/${congregationId}/`,
    `query:assignments-panel/${congregationId}/`,
    `query:outgoingTalks/${congregationId}/`,
    `query:users/congregation/${congregationId}/`,
    `query:cleaning/${congregationId}/`,
    `query:territories/${congregationId}/`,
    `query:preaching/${congregationId}/`,
    `query:notifications/${congregationId}/`,
    `query:departments/${congregationId}/`,
    `query:organization-chart/${congregationId}/`,
    `query:settings/${congregationId}/`,
  ].forEach(clearSessionCacheByPrefix);
};

export const useCongregationCacheBoundary = (congregationId: string | null): void => {
  const previousCongregationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!congregationId) return;

    const previousCongregationId = previousCongregationIdRef.current;
    previousCongregationIdRef.current = congregationId;

    if (!previousCongregationId || previousCongregationId === congregationId) {
      return;
    }

    markFirestoreCacheSessionBoundary();
    clearLegacyCongregationSessionPrefixes(previousCongregationId);
    void clearPersistentCacheByPrefix(`congregation:${previousCongregationId}:`);
  }, [congregationId]);
};
