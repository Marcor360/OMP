import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import { usersCollectionRef } from '@/src/lib/firebase/refs';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import type { TerritoryRepository } from '@/src/services/repositories/ports/territory-repository.port';
import { normalizeUser } from '@/src/services/users/user.mapper';
import type {
  MonthlyTerritoryAssignment,
  MonthlyTerritoryAssignmentInput,
  PreachingGroup,
  PreachingGroupInput,
  Territory,
  TerritoryAssignmentTarget,
  TerritoryInput,
  VisibleMonthlyTerritories,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';
import { isSystemPrincipalUser } from '@/src/utils/users/user-protection';

const territoriesRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'territories');

const territoryRef = (congregationId: string, territoryId: string) =>
  doc(db, 'congregations', congregationId, 'territories', territoryId);

const preachingGroupsRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'preachingGroups');

const preachingGroupRef = (congregationId: string, groupId: string) =>
  doc(db, 'congregations', congregationId, 'preachingGroups', groupId);

const monthlyAssignmentRef = (congregationId: string, monthId: string) =>
  doc(db, 'congregations', congregationId, 'monthlyTerritoryAssignments', monthId);

const normalizeTerritory = (id: string, data: DocumentData): Territory => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  number: typeof data.number === 'number' ? data.number : 0,
  description: typeof data.description === 'string' ? data.description : '',
  status: data.status === 'inactive' ? 'inactive' : 'active',
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: (data.createdAt as Territory['createdAt']) ?? null,
  updatedAt: (data.updatedAt as Territory['updatedAt']) ?? null,
});

const normalizeGroup = (id: string, data: DocumentData): PreachingGroup => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  name: typeof data.name === 'string' ? data.name : 'Grupo',
  number: typeof data.number === 'number' ? data.number : 0,
  captainUserId: typeof data.captainUserId === 'string' ? data.captainUserId : '',
  captainName: typeof data.captainName === 'string' ? data.captainName : '',
  assistantUserId: typeof data.assistantUserId === 'string' ? data.assistantUserId : null,
  assistantName: typeof data.assistantName === 'string' ? data.assistantName : null,
  memberIds: Array.isArray(data.memberIds)
    ? data.memberIds.filter((item: unknown): item is string => typeof item === 'string')
    : [],
  memberNames: Array.isArray(data.memberNames)
    ? data.memberNames.filter((item: unknown): item is string => typeof item === 'string')
    : [],
  memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
  isActive: data.isActive !== false,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: (data.createdAt as PreachingGroup['createdAt']) ?? null,
  updatedAt: (data.updatedAt as PreachingGroup['updatedAt']) ?? null,
});

const normalizeTarget = (data: unknown): TerritoryAssignmentTarget | null => {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const scope = raw.scope === 'group' ? 'group' : raw.scope === 'congregation' ? 'congregation' : null;

  if (!scope || typeof raw.id !== 'string') return null;

  return {
    id: raw.id,
    scope,
    groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
    groupName: typeof raw.groupName === 'string' ? raw.groupName : null,
    territoryIds: Array.isArray(raw.territoryIds)
      ? raw.territoryIds.filter((item): item is string => typeof item === 'string')
      : [],
    territoryNumbers: Array.isArray(raw.territoryNumbers)
      ? raw.territoryNumbers.filter((item): item is number => typeof item === 'number')
      : [],
    notes: typeof raw.notes === 'string' ? raw.notes : null,
  };
};

const normalizeMonthlyAssignment = (
  id: string,
  congregationId: string,
  data: DocumentData
): MonthlyTerritoryAssignment => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : congregationId,
  monthId: typeof data.monthId === 'string' ? data.monthId : id,
  assignments: Array.isArray(data.assignments)
    ? data.assignments
        .map(normalizeTarget)
        .filter((item): item is TerritoryAssignmentTarget => item !== null)
    : [],
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: (data.createdAt as MonthlyTerritoryAssignment['createdAt']) ?? null,
  updatedAt: (data.updatedAt as MonthlyTerritoryAssignment['updatedAt']) ?? null,
});

const toVisibleMonthlyTerritories = (params: {
  monthId: string;
  userId: string;
  territories: Territory[];
  groups: PreachingGroup[];
  monthly: MonthlyTerritoryAssignment | null;
}): VisibleMonthlyTerritories => {
  const activeTerritories = params.territories.filter((territory) => territory.status === 'active');
  const territoriesById = new Map(activeTerritories.map((territory) => [territory.id, territory]));
  const userGroup =
    params.groups.find((group) => group.isActive && group.memberIds.includes(params.userId)) ??
    null;
  const targets = params.monthly?.assignments ?? [];

  return {
    monthId: params.monthId,
    congregationTargets: targets.filter((target) => target.scope === 'congregation'),
    groupTargets: userGroup
      ? targets.filter((target) => target.scope === 'group' && target.groupId === userGroup.id)
      : [],
    territoriesById,
    userGroup,
  };
};

const groupPayload = (
  congregationId: string,
  actorUid: string,
  input: PreachingGroupInput
) => {
  const memberIds = Array.from(new Set(input.memberIds));

  return {
    congregationId,
    name: `Grupo ${input.number}`,
    number: input.number,
    captainUserId: input.captainUserId,
    captainName: input.captainName,
    assistantUserId: input.assistantUserId ?? null,
    assistantName: input.assistantName ?? null,
    memberIds,
    memberNames: input.memberNames,
    memberCount: memberIds.length,
    isActive: input.isActive !== false,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  };
};

const writeMonthlyAssignmentInTransaction = async (payload: {
  congregationId: string;
  monthId: string;
  actorUid: string;
  input: MonthlyTerritoryAssignmentInput;
}): Promise<void> => {
  const ref = monthlyAssignmentRef(payload.congregationId, payload.monthId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    const existingData = existing.exists() ? existing.data() : null;

    transaction.set(ref, {
      id: payload.monthId,
      congregationId: payload.congregationId,
      monthId: payload.monthId,
      assignments: payload.input.assignments,
      createdBy:
        existingData && typeof existingData.createdBy === 'string'
          ? existingData.createdBy
          : payload.actorUid,
      updatedBy: payload.actorUid,
      createdAt: existingData?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const firestoreTerritoryRepository: TerritoryRepository = {
  getTerritories: async (congregationId: string): Promise<Territory[]> => {
    const snapshot = await getDocs(query(territoriesRef(congregationId), orderBy('number', 'asc')));
    return snapshot.docs.map((item) => normalizeTerritory(item.id, item.data()));
  },

  subscribeTerritories: (
    congregationId: string,
    onChange: (territories: Territory[]) => void,
    onError: (error: Error) => void
  ) => {
    const listenerKey = `territories:congregation:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const unsubscribe = onSnapshot(
      query(territoriesRef(congregationId), orderBy('number', 'asc')),
      (snapshot) => {
        onChange(snapshot.docs.map((item) => normalizeTerritory(item.id, item.data())));
      },
      onError
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },

  createTerritory: async (payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }): Promise<void> => {
    await runTransaction(db, async (transaction) => {
      const ref = territoryRef(payload.congregationId, payload.territoryId);
      const existing = await transaction.get(ref);

      if (existing.exists()) {
        throw new Error('Ya existe un territorio con ese numero.');
      }

      transaction.set(ref, {
        id: payload.territoryId,
        congregationId: payload.congregationId,
        number: payload.input.number,
        description: payload.input.description.trim(),
        status: payload.input.status ?? 'active',
        createdBy: payload.actorUid,
        updatedBy: payload.actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  },

  updateTerritory: async (payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }): Promise<void> => {
    await updateDoc(territoryRef(payload.congregationId, payload.territoryId), {
      number: payload.input.number,
      description: payload.input.description.trim(),
      status: payload.input.status ?? 'active',
      updatedBy: payload.actorUid,
      updatedAt: serverTimestamp(),
    });
  },

  deactivateTerritory: async (payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
  }): Promise<void> => {
    await updateDoc(territoryRef(payload.congregationId, payload.territoryId), {
      status: 'inactive',
      updatedBy: payload.actorUid,
      updatedAt: serverTimestamp(),
    });
  },

  getPreachingGroups: async (congregationId: string): Promise<PreachingGroup[]> => {
    const snapshot = await getDocs(
      query(preachingGroupsRef(congregationId), orderBy('number', 'asc'))
    );
    return snapshot.docs.map((item) => normalizeGroup(item.id, item.data()));
  },

  subscribePreachingGroups: (
    congregationId: string,
    onChange: (groups: PreachingGroup[]) => void,
    onError: (error: Error) => void
  ) => {
    const listenerKey = `territories:preaching-groups:${congregationId}`;
    logFirestoreListenerCreated(listenerKey);

    const unsubscribe = onSnapshot(
      query(preachingGroupsRef(congregationId), orderBy('number', 'asc')),
      (snapshot) => {
        onChange(snapshot.docs.map((item) => normalizeGroup(item.id, item.data())));
      },
      onError
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      unsubscribe();
    };
  },

  createPreachingGroup: async (payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }): Promise<void> => {
    await setDoc(preachingGroupRef(payload.congregationId, payload.groupId), {
      id: payload.groupId,
      ...groupPayload(payload.congregationId, payload.actorUid, payload.input),
      createdBy: payload.actorUid,
      createdAt: serverTimestamp(),
    });
  },

  updatePreachingGroup: async (payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }): Promise<void> => {
    await updateDoc(
      preachingGroupRef(payload.congregationId, payload.groupId),
      groupPayload(payload.congregationId, payload.actorUid, payload.input)
    );
  },

  deactivatePreachingGroup: async (payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
  }): Promise<void> => {
    await updateDoc(preachingGroupRef(payload.congregationId, payload.groupId), {
      isActive: false,
      updatedBy: payload.actorUid,
      updatedAt: serverTimestamp(),
    });
  },

  getMonthlyAssignment: async (
    congregationId: string,
    monthId: string
  ): Promise<MonthlyTerritoryAssignment | null> => {
    const snapshot = await getDoc(monthlyAssignmentRef(congregationId, monthId));
    return snapshot.exists()
      ? normalizeMonthlyAssignment(snapshot.id, congregationId, snapshot.data())
      : null;
  },

  subscribeVisibleMonthlyTerritories: (
    congregationId: string,
    userId: string,
    monthId: string,
    onChange: (data: VisibleMonthlyTerritories) => void,
    onError: (error: Error) => void
  ) => {
    let territories: Territory[] = [];
    let groups: PreachingGroup[] = [];
    let monthly: MonthlyTerritoryAssignment | null = null;

    const emit = () => {
      onChange(toVisibleMonthlyTerritories({ monthId, userId, territories, groups, monthly }));
    };

    const listenerKey = `territories:visible-monthly:${congregationId}:${monthId}:${userId}`;
    logFirestoreListenerCreated(listenerKey);

    const territoriesUnsub = onSnapshot(
      query(territoriesRef(congregationId), orderBy('number', 'asc')),
      (snapshot) => {
        territories = snapshot.docs.map((item) => normalizeTerritory(item.id, item.data()));
        emit();
      },
      onError
    );

    const groupsUnsub = onSnapshot(
      query(preachingGroupsRef(congregationId), orderBy('number', 'asc')),
      (snapshot) => {
        groups = snapshot.docs.map((item) => normalizeGroup(item.id, item.data()));
        emit();
      },
      onError
    );

    const monthlyUnsub = onSnapshot(
      monthlyAssignmentRef(congregationId, monthId),
      (snapshot) => {
        monthly = snapshot.exists()
          ? normalizeMonthlyAssignment(snapshot.id, congregationId, snapshot.data())
          : null;
        emit();
      },
      onError
    );

    return () => {
      logFirestoreListenerDestroyed(listenerKey);
      territoriesUnsub();
      groupsUnsub();
      monthlyUnsub();
    };
  },

  upsertMonthlyAssignment: writeMonthlyAssignmentInTransaction,

  deleteMonthlyAssignment: async (payload: {
    congregationId: string;
    monthId: string;
    actorUid: string;
  }): Promise<void> => {
    await writeMonthlyAssignmentInTransaction({
      ...payload,
      input: { assignments: [] },
    });
  },

  getActiveCongregationUsersForGroups: async (congregationId: string): Promise<AppUser[]> => {
    const snapshot = await getDocs(
      query(usersCollectionRef(), where('congregationId', '==', congregationId))
    );

    return snapshot.docs
      .map((userDoc) => normalizeUser(userDoc.id, userDoc.data()))
      .filter((user) => user.isActive === true && user.congregationId === congregationId)
      .filter((user) => !isSystemPrincipalUser(user))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
  },
};
