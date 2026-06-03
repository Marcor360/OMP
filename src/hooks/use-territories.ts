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

export function useTerritoriesCatalog(congregationId: string | null) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(Boolean(congregationId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!congregationId) {
      setTerritories([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return subscribeTerritories(
      congregationId,
      (next) => {
        setTerritories(next);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(getErrorMessage(snapshotError));
        setLoading(false);
      }
    );
  }, [congregationId]);

  return { territories, loading, error };
}

export function usePreachingGroups(congregationId: string | null) {
  const [groups, setGroups] = useState<PreachingGroup[]>([]);
  const [loading, setLoading] = useState(Boolean(congregationId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!congregationId) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return subscribePreachingGroups(
      congregationId,
      (next) => {
        setGroups(next);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(getErrorMessage(snapshotError));
        setLoading(false);
      }
    );
  }, [congregationId]);

  return { groups, loading, error };
}

export function useVisibleMonthlyTerritories(
  congregationId: string | null,
  userId: string | null,
  monthId: string
) {
  const [data, setData] = useState<VisibleMonthlyTerritories | null>(null);
  const [loading, setLoading] = useState(Boolean(congregationId && userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!congregationId || !userId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return subscribeVisibleMonthlyTerritories(
      congregationId,
      userId,
      monthId,
      (next) => {
        setData(next);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(getErrorMessage(snapshotError));
        setLoading(false);
      }
    );
  }, [congregationId, monthId, userId]);

  return { data, loading, error };
}

export function useMonthlyTerritoryAssignment(congregationId: string | null, monthId: string) {
  const [assignment, setAssignment] = useState<MonthlyTerritoryAssignment | null>(null);
  const [loading, setLoading] = useState(Boolean(congregationId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!congregationId) {
      setAssignment(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setAssignment(await getMonthlyTerritoryAssignment(congregationId, monthId));
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [congregationId, monthId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assignment, loading, error, refresh: load };
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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(Boolean(congregationId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!congregationId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setUsers(await getActiveCongregationUsersForGroups(congregationId));
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [congregationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { users, loading, error, refresh: load };
}
