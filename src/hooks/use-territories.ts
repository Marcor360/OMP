import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  assignTerritoriesToDay,
  createTerritory,
  deactivateTerritory,
  subscribeToTerritories,
  subscribeToTerritorySchedule,
  updateTerritory,
} from '@/src/services/territories/territories-service';
import type {
  Territory,
  TerritoryDayOfWeek,
  TerritoryFormValues,
  TerritorySchedule,
} from '@/src/types/territory';

export function useTerritories(congregationId: string | null) {
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
    return subscribeToTerritories(
      congregationId,
      (nextTerritories) => {
        setTerritories(nextTerritories);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, [congregationId]);

  const activeTerritories = useMemo(
    () => territories.filter((territory) => territory.status === 'active'),
    [territories]
  );

  return { territories, activeTerritories, loading, error };
}

export function useTerritorySchedule(congregationId: string | null) {
  const [schedule, setSchedule] = useState<TerritorySchedule[]>([]);
  const [loading, setLoading] = useState(Boolean(congregationId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!congregationId) {
      setSchedule([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    return subscribeToTerritorySchedule(
      congregationId,
      (nextSchedule) => {
        setSchedule(nextSchedule);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, [congregationId]);

  return { schedule, loading, error };
}

export function useTerritoryMutations(congregationId: string | null, actorUid: string | null) {
  const [saving, setSaving] = useState(false);

  const requireContext = useCallback(() => {
    if (!congregationId || !actorUid) {
      throw new Error('Necesitas una congregacion y usuario activo.');
    }

    return { congregationId, actorUid };
  }, [actorUid, congregationId]);

  const create = useCallback(
    async (values: TerritoryFormValues) => {
      const context = requireContext();
      setSaving(true);
      try {
        await createTerritory(context.congregationId, context.actorUid, values);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  const update = useCallback(
    async (territoryId: string, values: TerritoryFormValues) => {
      const context = requireContext();
      setSaving(true);
      try {
        await updateTerritory(context.congregationId, territoryId, context.actorUid, values);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  const deactivate = useCallback(
    async (territoryId: string) => {
      const context = requireContext();
      setSaving(true);
      try {
        await deactivateTerritory(context.congregationId, territoryId, context.actorUid);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  const assignToDay = useCallback(
    async (dayOfWeek: TerritoryDayOfWeek, territoryIds: string[], note: string) => {
      const context = requireContext();
      setSaving(true);
      try {
        await assignTerritoriesToDay(
          context.congregationId,
          context.actorUid,
          dayOfWeek,
          territoryIds,
          note
        );
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  return {
    saving,
    createTerritory: create,
    updateTerritory: update,
    deactivateTerritory: deactivate,
    assignTerritoriesToDay: assignToDay,
  };
}
