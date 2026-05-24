import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createTerritorySchedule,
  deleteTerritorySchedule,
  subscribeTerritorySchedule,
  updateTerritorySchedule,
} from '@/src/services/territories/territories-service';
import type {
  CreateTerritoryScheduleInput,
  TerritoryDay,
  TerritorySchedule,
  UpdateTerritoryScheduleInput,
} from '@/src/types/territory';

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
    return subscribeTerritorySchedule(
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

  const scheduleByDay = useMemo(
    () => new Map(schedule.map((item) => [item.dayOfWeek, item])),
    [schedule]
  );

  return { schedule, scheduleByDay, loading, error };
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
    async (input: CreateTerritoryScheduleInput) => {
      const context = requireContext();
      setSaving(true);
      try {
        await createTerritorySchedule(context.congregationId, context.actorUid, input);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  const update = useCallback(
    async (scheduleId: TerritoryDay, input: UpdateTerritoryScheduleInput) => {
      const context = requireContext();
      setSaving(true);
      try {
        await updateTerritorySchedule(
          context.congregationId,
          scheduleId,
          context.actorUid,
          input
        );
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  const remove = useCallback(
    async (scheduleId: TerritoryDay) => {
      const context = requireContext();
      setSaving(true);
      try {
        await deleteTerritorySchedule(context.congregationId, scheduleId);
      } finally {
        setSaving(false);
      }
    },
    [requireContext]
  );

  return {
    saving,
    createTerritorySchedule: create,
    updateTerritorySchedule: update,
    deleteTerritorySchedule: remove,
  };
}
