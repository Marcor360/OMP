import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { useUser } from '@/src/context/user-context';
import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import {
  CleaningCacheScope,
  createCleaningCacheScope,
  getCleaningCacheScopeIdentity,
  readScopedCleaningCache,
  writeScopedCleaningGroups,
} from '@/src/modules/cleaning/services/cleaning-cache-storage';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { createLogger } from '@/src/utils/logger';

const CACHE_EXPIRATION_MS = 10 * 60 * 1000;
const log = createLogger('cleaning-cache');

interface CacheState {
  groups: CleaningGroup[];
  lastSyncAt: number | null;
  loading: boolean;
  error: string | null;
}

interface CleaningCacheContextValue extends CacheState {
  refreshGroups: (congregationId: string) => Promise<void>;
  refreshAll: (congregationId: string) => Promise<void>;
  invalidate: () => void;
  setOptimisticGroups: (groups: CleaningGroup[]) => void;
}

const createEmptyState = (loading = false): CacheState => ({
  groups: [],
  lastSyncAt: null,
  loading,
  error: null,
});

const CleaningCacheContext = createContext<CleaningCacheContextValue | undefined>(undefined);

/**
 * Resuelve el scope desde la sesion real y remonta el estado interno cuando cambia.
 * La key evita que un render del usuario B pueda observar memoria del usuario A.
 */
export const CleaningCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { uid, congregationId } = useUser();
  const scope = useMemo(
    () => createCleaningCacheScope(uid, congregationId),
    [congregationId, uid]
  );
  const scopeIdentity = scope
    ? getCleaningCacheScopeIdentity(scope)
    : 'without-authenticated-scope';

  return (
    <ScopedCleaningCacheProvider key={scopeIdentity} scope={scope}>
      {children}
    </ScopedCleaningCacheProvider>
  );
};

interface ScopedCleaningCacheProviderProps {
  children: React.ReactNode;
  scope: CleaningCacheScope | null;
}

const ScopedCleaningCacheProvider: React.FC<ScopedCleaningCacheProviderProps> = ({
  children,
  scope,
}) => {
  const [state, setState] = useState<CacheState>(() => createEmptyState(scope !== null));
  const mountedRef = useRef(true);
  const hydratingRef = useRef(scope !== null);
  const pendingRequestsRef = useRef(0);
  const groupsRevisionRef = useRef(0);
  const freshGroupsAppliedRef = useRef(false);
  const groupsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  const updateLoadingState = useCallback(() => {
    if (!mountedRef.current) return;
    const loading = hydratingRef.current || pendingRequestsRef.current > 0;
    setState((previous) =>
      previous.loading === loading ? previous : { ...previous, loading }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    hydratingRef.current = scope !== null;

    if (!scope) {
      setState(createEmptyState(false));
      return () => {
        cancelled = true;
        mountedRef.current = false;
      };
    }

    void readScopedCleaningCache(scope)
      .then((cached) => {
        if (cancelled || !mountedRef.current || freshGroupsAppliedRef.current) return;
        setState((previous) => ({ ...previous, groups: cached.groups }));
      })
      .catch((error) => {
        log.warn('No se pudo hidratar la cache scoped de limpieza:', error);
      })
      .finally(() => {
        if (cancelled || !mountedRef.current) return;
        hydratingRef.current = false;
        updateLoadingState();
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [scope, updateLoadingState]);

  const beginRequest = useCallback(() => {
    pendingRequestsRef.current += 1;
    if (mountedRef.current) {
      setState((previous) => ({ ...previous, loading: true, error: null }));
    }
  }, []);

  const finishRequest = useCallback(() => {
    pendingRequestsRef.current = Math.max(0, pendingRequestsRef.current - 1);
    updateLoadingState();
  }, [updateLoadingState]);

  const matchesScope = useCallback(
    (congregationId: string): boolean =>
      Boolean(scope && scope.congregationId === congregationId.trim()),
    [scope]
  );

  const persistGroups = useCallback(
    (groups: CleaningGroup[]) => {
      if (!scope) return;
      groupsWriteQueueRef.current = groupsWriteQueueRef.current
        .catch(() => undefined)
        .then(() => writeScopedCleaningGroups(scope, groups))
        .catch((error) => {
          log.warn('No se pudo persistir la cache scoped de grupos:', error);
        });
    },
    [scope]
  );

  const refreshGroups = useCallback(
    async (congregationId: string) => {
      if (!matchesScope(congregationId)) return;

      const revision = ++groupsRevisionRef.current;
      beginRequest();
      try {
        const groups = await getCleaningGroups(congregationId.trim());
        if (!mountedRef.current || revision !== groupsRevisionRef.current) return;

        freshGroupsAppliedRef.current = true;
        const now = Date.now();
        setState((previous) => ({
          ...previous,
          groups,
          error: null,
          lastSyncAt: now,
        }));
        persistGroups(groups);
      } catch (error) {
        if (mountedRef.current && revision === groupsRevisionRef.current) {
          setState((previous) => ({
            ...previous,
            error: formatFirestoreError(error),
          }));
        }
      } finally {
        finishRequest();
      }
    },
    [beginRequest, finishRequest, matchesScope, persistGroups]
  );

  const invalidate = useCallback(() => {
    setState((previous) => ({ ...previous, lastSyncAt: null }));
  }, []);

  const setOptimisticGroups = useCallback(
    (groups: CleaningGroup[]) => {
      if (!scope) return;
      groupsRevisionRef.current += 1;
      freshGroupsAppliedRef.current = true;
      setState((previous) => ({ ...previous, groups }));
      persistGroups(groups);
    },
    [persistGroups, scope]
  );

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && state.lastSyncAt) {
        const isStale = Date.now() - state.lastSyncAt > CACHE_EXPIRATION_MS;
        if (isStale) invalidate();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [invalidate, state.lastSyncAt]);

  const value = useMemo<CleaningCacheContextValue>(
    () => ({
      ...state,
      refreshGroups,
      refreshAll: refreshGroups,
      invalidate,
      setOptimisticGroups,
    }),
    [invalidate, refreshGroups, setOptimisticGroups, state]
  );

  return (
    <CleaningCacheContext.Provider value={value}>
      {children}
    </CleaningCacheContext.Provider>
  );
};

export const useCleaningCache = (): CleaningCacheContextValue => {
  const context = useContext(CleaningCacheContext);
  if (!context) {
    throw new Error('useCleaningCache debe usarse dentro de un CleaningCacheProvider');
  }
  return context;
};
