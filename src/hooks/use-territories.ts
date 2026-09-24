import { useCallback, useEffect, useState } from 'react';

import {
  createPreachingGroup,
  createTerritory,
  deactivatePreachingGroup,
  deactivateTerritory,
  getActiveCongregationUsersForGroups,
  getMonthlyTerritoryAssignment,
  subscribePreachingGroups,
  subscribeTerritories,
  subscribeVisibleMonthlyTerritories,
  updatePreachingGroup,
  updateTerritory,
  upsertMonthlyTerritoryAssignment,
} from '@/src/services/territories/territories-service';
import type {
  MonthlyTerritoryAssignment,
  MonthlyTerritoryAssignmentInput,
  PreachingGroup,
  PreachingGroupInput,
  Territory,
  TerritoryInput,
  VisibleMonthlyTerritories,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudieron cargar los territorios.';

type ScopedLoadState<T> = {
  key: string | null;
  data: T;
  error: string | null;
};

export function useTerritoriesCatalog(congregationId: string | null) {
  const [state, setState] = useState<ScopedLoadState<Territory[]>>({
    key: null,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!congregationId) return;

    let active = true;
    const unsubscribe = subscribeTerritories(
      congregationId,
      (next) => {
        if (active) setState({ key: congregationId, data: next, error: null });
      },
      (snapshotError) => {
        if (active) setState({ key: congregationId, data: [], error: getErrorMessage(snapshotError) });
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [congregationId]);

  const current = state.key === congregationId;
  return {
    territories: current ? state.data : [],
    loading: Boolean(congregationId && !current),
    error: current ? state.error : null,
  };
}

export function usePreachingGroups(congregationId: string | null) {
  const [state, setState] = useState<ScopedLoadState<PreachingGroup[]>>({
    key: null,
    data: [],
    error: null,
  });

  useEffect(() => {
    if (!congregationId) return;

    let active = true;
    const unsubscribe = subscribePreachingGroups(
      congregationId,
      (next) => {
        if (active) setState({ key: congregationId, data: next, error: null });
      },
      (snapshotError) => {
        if (active) setState({ key: congregationId, data: [], error: getErrorMessage(snapshotError) });
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [congregationId]);

  const current = state.key === congregationId;
  return {
    groups: current ? state.data : [],
    loading: Boolean(congregationId && !current),
    error: current ? state.error : null,
  };
}

export function useVisibleMonthlyTerritories(
  congregationId: string | null,
  userId: string | null,
  monthId: string
) {
  const requestKey = congregationId && userId ? `${congregationId}:${userId}:${monthId}` : null;
  const [state, setState] = useState<ScopedLoadState<VisibleMonthlyTerritories | null>>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!congregationId || !userId || !requestKey) return;

    let active = true;
    const unsubscribe = subscribeVisibleMonthlyTerritories(
      congregationId,
      userId,
      monthId,
      (next) => {
        if (active) setState({ key: requestKey, data: next, error: null });
      },
      (snapshotError) => {
        if (active) setState({ key: requestKey, data: null, error: getErrorMessage(snapshotError) });
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [congregationId, monthId, requestKey, userId]);

  const current = state.key === requestKey;
  return {
    data: current ? state.data : null,
    loading: Boolean(requestKey && !current),
    error: current ? state.error : null,
  };
}

export function useMonthlyTerritoryAssignment(congregationId: string | null, monthId: string) {
  const requestKey = congregationId ? `${congregationId}:${monthId}` : null;
  const [state, setState] = useState<ScopedLoadState<MonthlyTerritoryAssignment | null>>({
    key: null,
    data: null,
    error: null,
  });

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!congregationId || !requestKey) return;
    try {
      const assignment = await getMonthlyTerritoryAssignment(congregationId, monthId);
      if (isCurrent()) setState({ key: requestKey, data: assignment, error: null });
    } catch (requestError) {
      if (isCurrent()) setState({ key: requestKey, data: null, error: getErrorMessage(requestError) });
    }
  }, [congregationId, monthId, requestKey]);

  useEffect(() => {
    if (!requestKey) return;
    let active = true;
    void (async () => {
      await load(() => active);
    })();
    return () => {
      active = false;
    };
  }, [load, requestKey]);

  const current = state.key === requestKey;
  return {
    assignment: current ? state.data : null,
    loading: Boolean(requestKey && !current),
    error: current ? state.error : null,
    refresh: load,
  };
}

export function useTerritoryMutations(congregationId: string | null, actorUid: string | null) {
  const [saving, setSaving] = useState(false);

  const requireContext = useCallback(() => {
    if (!congregationId || !actorUid) throw new Error('Necesitas una congregacion y usuario activo.');
    return { congregationId, actorUid };
  }, [actorUid, congregationId]);

  const run = useCallback(
    async (action: (context: { congregationId: string; actorUid: string }) => Promise<void>) => {
      const context = requireContext();
      setSaving(true);
      try {
        await action(context);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  return {
    saving,
    createTerritory: (input: TerritoryInput) =>
      run((context) => createTerritory(context.congregationId, context.actorUid, input)),
    updateTerritory: (territoryId: string, input: TerritoryInput) =>
      run((context) => updateTerritory(context.congregationId, territoryId, context.actorUid, input)),
    deactivateTerritory: (territoryId: string) =>
      run((context) => deactivateTerritory(context.congregationId, territoryId, context.actorUid)),
    createPreachingGroup: (input: PreachingGroupInput) =>
      run((context) => createPreachingGroup(context.congregationId, context.actorUid, input)),
    updatePreachingGroup: (groupId: string, input: PreachingGroupInput) =>
      run((context) => updatePreachingGroup(context.congregationId, groupId, context.actorUid, input)),
    deactivatePreachingGroup: (groupId: string) =>
      run((context) => deactivatePreachingGroup(context.congregationId, groupId, context.actorUid)),
    upsertMonthlyTerritoryAssignment: (monthId: string, input: MonthlyTerritoryAssignmentInput) =>
      run((context) => upsertMonthlyTerritoryAssignment(context.congregationId, monthId, context.actorUid, input)),
  };
}

export function useActiveCongregationUsers(congregationId: string | null) {
  const [state, setState] = useState<ScopedLoadState<AppUser[]>>({
    key: null,
    data: [],
    error: null,
  });

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    if (!congregationId) return;
    try {
      const users = await getActiveCongregationUsersForGroups(congregationId);
      if (isCurrent()) setState({ key: congregationId, data: users, error: null });
    } catch (requestError) {
      if (isCurrent()) setState({ key: congregationId, data: [], error: getErrorMessage(requestError) });
    }
  }, [congregationId]);

  useEffect(() => {
    if (!congregationId) return;
    let active = true;
    void (async () => {
      await load(() => active);
    })();
    return () => {
      active = false;
    };
  }, [congregationId, load]);

  const current = state.key === congregationId;
  return {
    users: current ? state.data : [],
    loading: Boolean(congregationId && !current),
    error: current ? state.error : null,
    refresh: load,
  };
}
