import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

import {
  getCleaningGroups,
  getCleaningAssignableUsers,
} from '@/src/modules/cleaning/services/cleaning-service';
import {
  CleaningGroup,
  CleaningAssignableUser,
} from '@/src/modules/cleaning/types/cleaning-group.types';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const CACHE_KEY_GROUPS = '@cleaning_groups';
const CACHE_KEY_USERS = '@cleaning_assignable_users';
const CACHE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutos

interface CacheState {
  groups: CleaningGroup[];
  assignableUsers: CleaningAssignableUser[];
  lastSyncAt: number | null;
  loading: boolean;
  error: string | null;
}

interface CleaningCacheContextValue extends CacheState {
  refreshGroups: (congregationId: string) => Promise<void>;
  refreshUsers: (congregationId: string, currentGroupId?: string | null) => Promise<void>;
  refreshAll: (congregationId: string) => Promise<void>;
  invalidate: () => void;
  // Métodos óptimistas
  setOptimisticGroups: (groups: CleaningGroup[]) => void;
  setOptimisticUsers: (users: CleaningAssignableUser[]) => void;
}

const CleaningCacheContext = createContext<CleaningCacheContextValue | undefined>(undefined);

export const CleaningCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CacheState>({
    groups: [],
    assignableUsers: [],
    lastSyncAt: null,
    loading: false,
    error: null,
  });

  // Hidratar desde AsyncStorage al montar
  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const cachedGroups = await AsyncStorage.getItem(CACHE_KEY_GROUPS);
        const cachedUsers = await AsyncStorage.getItem(CACHE_KEY_USERS);
        
        if (mounted) {
          setState((prev) => ({
            ...prev,
            groups: cachedGroups ? JSON.parse(cachedGroups) : [],
            assignableUsers: cachedUsers ? JSON.parse(cachedUsers) : [],
            loading: false,
          }));
        }
      } catch (err) {
        console.warn('Error hidratando caché de limpieza:', err);
        if (mounted) setState((prev) => ({ ...prev, loading: false }));
      }
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const saveToAsyncStorage = async (groups: CleaningGroup[], users: CleaningAssignableUser[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEY_GROUPS, JSON.stringify(groups)),
        AsyncStorage.setItem(CACHE_KEY_USERS, JSON.stringify(users)),
      ]);
    } catch (e) {
      console.warn('Error guardando en caché:', e);
    }
  };

  const refreshGroups = useCallback(async (congregationId: string) => {
    if (!congregationId) return;
    try {
      const data = await getCleaningGroups(congregationId);
      const now = Date.now();
      setState((prev) => {
        const newState = { ...prev, groups: data, error: null, lastSyncAt: now };
        void saveToAsyncStorage(data, prev.assignableUsers);
        return newState;
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: formatFirestoreError(err),
      }));
    }
  }, []);

  const refreshUsers = useCallback(async (congregationId: string, currentGroupId: string | null = null) => {
    if (!congregationId) return;
    try {
      const data = await getCleaningAssignableUsers(congregationId, currentGroupId);
      const now = Date.now();
      setState((prev) => {
        const newState = { ...prev, assignableUsers: data, error: null, lastSyncAt: now };
        void saveToAsyncStorage(prev.groups, data);
        return newState;
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: formatFirestoreError(err),
      }));
    }
  }, []);

  const refreshAll = useCallback(
    async (congregationId: string) => {
      if (!congregationId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const [groupsData, usersData] = await Promise.all([
          getCleaningGroups(congregationId),
          getCleaningAssignableUsers(congregationId, null),
        ]);
        
        const now = Date.now();
        setState({
          groups: groupsData,
          assignableUsers: usersData,
          lastSyncAt: now,
          loading: false,
          error: null,
        });
        
        await saveToAsyncStorage(groupsData, usersData);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: formatFirestoreError(err),
        }));
      }
    },
    []
  );

  const invalidate = useCallback(() => {
    setState((prev) => ({ ...prev, lastSyncAt: null })); // Fuerza sincronización la próxima vez
  }, []);

  const setOptimisticGroups = useCallback((groups: CleaningGroup[]) => {
    setState((prev) => {
      void saveToAsyncStorage(groups, prev.assignableUsers);
      return { ...prev, groups };
    });
  }, []);

  const setOptimisticUsers = useCallback((users: CleaningAssignableUser[]) => {
    setState((prev) => {
      void saveToAsyncStorage(prev.groups, users);
      return { ...prev, assignableUsers: users };
    });
  }, []);

  // Sincronización automática de fondo si la caché expiró (stale-while-revalidate base)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && state.lastSyncAt) {
        const isStale = Date.now() - state.lastSyncAt > CACHE_EXPIRATION_MS;
        if (isStale) invalidate();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [state.lastSyncAt, invalidate]);

  const value = {
    ...state,
    refreshGroups,
    refreshUsers,
    refreshAll,
    invalidate,
    setOptimisticGroups,
    setOptimisticUsers,
  };

  return <CleaningCacheContext.Provider value={value}>{children}</CleaningCacheContext.Provider>;
};

export const useCleaningCache = () => {
  const context = useContext(CleaningCacheContext);
  if (!context) {
    throw new Error('useCleaningCache debe usarse dentro de un CleaningCacheProvider');
  }
  return context;
};

