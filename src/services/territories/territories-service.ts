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
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import { getAllUsers } from '@/src/services/users/users-service';
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
import {
  buildTerritoryId,
  isValidMonthId,
  TERRITORY_DESCRIPTION_MAX_LENGTH,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';

const assertCongregationId = (congregationId: string) => {
  if (!congregationId.trim()) throw new Error('No se pudo identificar la congregacion del usuario.');
};

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
  memberIds: Array.isArray(data.memberIds) ? data.memberIds.filter((item: unknown): item is string => typeof item === 'string') : [],
  memberNames: Array.isArray(data.memberNames) ? data.memberNames.filter((item: unknown): item is string => typeof item === 'string') : [],
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
    territoryIds: Array.isArray(raw.territoryIds) ? raw.territoryIds.filter((item): item is string => typeof item === 'string') : [],
    territoryNumbers: Array.isArray(raw.territoryNumbers) ? raw.territoryNumbers.filter((item): item is number => typeof item === 'number') : [],
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
    ? data.assignments.map(normalizeTarget).filter((item): item is TerritoryAssignmentTarget => item !== null)
    : [],
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: (data.createdAt as MonthlyTerritoryAssignment['createdAt']) ?? null,
  updatedAt: (data.updatedAt as MonthlyTerritoryAssignment['updatedAt']) ?? null,
});

const assertTerritoryInput = (input: TerritoryInput) => {
  if (!Number.isInteger(input.number) || input.number <= 0) {
    throw new Error('El numero de territorio debe ser un entero positivo.');
  }
  const description = input.description.trim();
  if (!description) throw new Error('La descripcion del territorio es obligatoria.');
  if (description.length > TERRITORY_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`La descripcion no puede superar ${TERRITORY_DESCRIPTION_MAX_LENGTH} caracteres.`);
  }
};

const assertGroupInput = async (congregationId: string, groupId: string | null, input: PreachingGroupInput) => {
  if (!Number.isInteger(input.number) || input.number <= 0) throw new Error('El numero del grupo debe ser positivo.');
  if (!input.captainUserId) throw new Error('El capitan del grupo es obligatorio.');
  const memberIds = Array.from(new Set(input.memberIds));
  if (!memberIds.includes(input.captainUserId)) throw new Error('El capitan debe pertenecer al grupo.');
  if (input.assistantUserId && !memberIds.includes(input.assistantUserId)) {
    throw new Error('El auxiliar debe pertenecer al grupo.');
  }

  const activeUsers = await getAllUsers(congregationId, { forceServer: true });
  const activeUserIds = new Set(
    activeUsers
      .filter((user) => user.isActive === true && user.congregationId === congregationId)
      .map((user) => user.uid)
  );
  if (memberIds.some((uid) => !activeUserIds.has(uid))) {
    throw new Error('Todos los integrantes deben ser usuarios activos de la congregacion.');
  }

  const groups = await getPreachingGroups(congregationId);
  const duplicatedMember = groups
    .filter((group) => group.isActive && group.id !== groupId)
    .flatMap((group) => group.memberIds)
    .find((uid) => memberIds.includes(uid));
  if (duplicatedMember) throw new Error('Un usuario no puede pertenecer a mas de un grupo activo.');
};

const assertMonthlyInput = (
  activeTerritories: Territory[],
  activeGroups: PreachingGroup[],
  input: MonthlyTerritoryAssignmentInput
) => {
  const activeTerritoryIds = new Set(activeTerritories.map((territory) => territory.id));
  const activeGroupIds = new Set(activeGroups.filter((group) => group.isActive).map((group) => group.id));
  const usedTerritoryIds = new Set<string>();

  input.assignments.forEach((target) => {
    if (target.scope === 'group' && (!target.groupId || !activeGroupIds.has(target.groupId))) {
      throw new Error('Selecciona un grupo activo para la asignacion.');
    }
    const uniqueIds = new Set(target.territoryIds);
    if (uniqueIds.size !== target.territoryIds.length) {
      throw new Error('No repitas territorios dentro de una asignacion.');
    }
    target.territoryIds.forEach((territoryId) => {
      if (!activeTerritoryIds.has(territoryId)) throw new Error('Solo puedes asignar territorios activos.');
      if (usedTerritoryIds.has(territoryId)) {
        throw new Error('Un territorio no puede repetirse dentro del mismo mes.');
      }
      usedTerritoryIds.add(territoryId);
    });
  });
};

export const getTerritories = async (congregationId: string): Promise<Territory[]> => {
  assertCongregationId(congregationId);
  const snapshot = await getDocs(query(territoriesRef(congregationId), orderBy('number', 'asc')));
  return snapshot.docs.map((item) => normalizeTerritory(item.id, item.data()));
};

export const subscribeTerritories = (
  congregationId: string,
  onChange: (territories: Territory[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  return onSnapshot(query(territoriesRef(congregationId), orderBy('number', 'asc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => normalizeTerritory(item.id, item.data())));
  }, onError);
};

export const createTerritory = async (
  congregationId: string,
  actorUid: string,
  input: TerritoryInput
): Promise<void> => {
  assertCongregationId(congregationId);
  assertTerritoryInput(input);
  const id = buildTerritoryId(input.number);
  await runTransaction(db, async (transaction) => {
    const ref = territoryRef(congregationId, id);
    const existing = await transaction.get(ref);
    if (existing.exists()) throw new Error('Ya existe un territorio con ese numero.');
    transaction.set(ref, {
      id,
      congregationId,
      number: input.number,
      description: input.description.trim(),
      status: input.status ?? 'active',
      createdBy: actorUid,
      updatedBy: actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const updateTerritory = async (
  congregationId: string,
  territoryId: string,
  actorUid: string,
  input: TerritoryInput
): Promise<void> => {
  assertCongregationId(congregationId);
  assertTerritoryInput(input);
  const expectedId = buildTerritoryId(input.number);
  if (territoryId !== expectedId) throw new Error('No se puede cambiar el numero identificador del territorio.');
  await updateDoc(territoryRef(congregationId, territoryId), {
    number: input.number,
    description: input.description.trim(),
    status: input.status ?? 'active',
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const deactivateTerritory = async (
  congregationId: string,
  territoryId: string,
  actorUid: string
): Promise<void> => {
  assertCongregationId(congregationId);
  await updateDoc(territoryRef(congregationId, territoryId), {
    status: 'inactive',
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const getPreachingGroups = async (congregationId: string): Promise<PreachingGroup[]> => {
  assertCongregationId(congregationId);
  const snapshot = await getDocs(query(preachingGroupsRef(congregationId), orderBy('number', 'asc')));
  return snapshot.docs.map((item) => normalizeGroup(item.id, item.data()));
};

export const subscribePreachingGroups = (
  congregationId: string,
  onChange: (groups: PreachingGroup[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  return onSnapshot(query(preachingGroupsRef(congregationId), orderBy('number', 'asc')), (snapshot) => {
    onChange(snapshot.docs.map((item) => normalizeGroup(item.id, item.data())));
  }, onError);
};

export const createPreachingGroup = async (
  congregationId: string,
  actorUid: string,
  input: PreachingGroupInput
): Promise<void> => {
  assertCongregationId(congregationId);
  await assertGroupInput(congregationId, null, input);
  const id = `group_${input.number}`;
  const ref = preachingGroupRef(congregationId, id);
  await setDoc(ref, {
    id,
    congregationId,
    name: `Grupo ${input.number}`,
    number: input.number,
    captainUserId: input.captainUserId,
    captainName: input.captainName,
    assistantUserId: input.assistantUserId ?? null,
    assistantName: input.assistantName ?? null,
    memberIds: Array.from(new Set(input.memberIds)),
    memberNames: input.memberNames,
    memberCount: Array.from(new Set(input.memberIds)).length,
    isActive: input.isActive !== false,
    createdBy: actorUid,
    updatedBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updatePreachingGroup = async (
  congregationId: string,
  groupId: string,
  actorUid: string,
  input: PreachingGroupInput
): Promise<void> => {
  assertCongregationId(congregationId);
  await assertGroupInput(congregationId, groupId, input);
  await updateDoc(preachingGroupRef(congregationId, groupId), {
    name: `Grupo ${input.number}`,
    number: input.number,
    captainUserId: input.captainUserId,
    captainName: input.captainName,
    assistantUserId: input.assistantUserId ?? null,
    assistantName: input.assistantName ?? null,
    memberIds: Array.from(new Set(input.memberIds)),
    memberNames: input.memberNames,
    memberCount: Array.from(new Set(input.memberIds)).length,
    isActive: input.isActive !== false,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const deactivatePreachingGroup = async (
  congregationId: string,
  groupId: string,
  actorUid: string
): Promise<void> => {
  assertCongregationId(congregationId);
  await updateDoc(preachingGroupRef(congregationId, groupId), {
    isActive: false,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
};

export const getMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string
): Promise<MonthlyTerritoryAssignment | null> => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) throw new Error('Selecciona un mes valido.');
  const snapshot = await getDoc(monthlyAssignmentRef(congregationId, monthId));
  return snapshot.exists() ? normalizeMonthlyAssignment(snapshot.id, congregationId, snapshot.data()) : null;
};

export const subscribeVisibleMonthlyTerritories = (
  congregationId: string,
  userId: string,
  monthId: string,
  onChange: (data: VisibleMonthlyTerritories) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) throw new Error('Selecciona un mes valido.');

  let territories: Territory[] = [];
  let groups: PreachingGroup[] = [];
  let monthly: MonthlyTerritoryAssignment | null = null;

  const emit = () => {
    const activeTerritories = territories.filter((territory) => territory.status === 'active');
    const territoriesById = new Map(activeTerritories.map((territory) => [territory.id, territory]));
    const userGroup = groups.find((group) => group.isActive && group.memberIds.includes(userId)) ?? null;
    const targets = monthly?.assignments ?? [];
    onChange({
      monthId,
      congregationTargets: targets.filter((target) => target.scope === 'congregation'),
      groupTargets: userGroup
        ? targets.filter((target) => target.scope === 'group' && target.groupId === userGroup.id)
        : [],
      territoriesById,
      userGroup,
    });
  };

  const unsubscribers = [
    subscribeTerritories(congregationId, (next) => {
      territories = next;
      emit();
    }, onError),
    subscribePreachingGroups(congregationId, (next) => {
      groups = next;
      emit();
    }, onError),
    onSnapshot(monthlyAssignmentRef(congregationId, monthId), (snapshot) => {
      monthly = snapshot.exists() ? normalizeMonthlyAssignment(snapshot.id, congregationId, snapshot.data()) : null;
      emit();
    }, onError),
  ];

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
};

export const upsertMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string,
  actorUid: string,
  input: MonthlyTerritoryAssignmentInput
): Promise<void> => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) throw new Error('Selecciona un mes valido.');
  const [territories, groups] = await Promise.all([
    getTerritories(congregationId),
    getPreachingGroups(congregationId),
  ]);
  const activeTerritories = territories.filter((territory) => territory.status === 'active');
  assertMonthlyInput(activeTerritories, groups, input);
  const territoryNumbersById = new Map(activeTerritories.map((territory) => [territory.id, territory.number]));
  const normalizedAssignments = input.assignments.map((target) => ({
    ...target,
    territoryIds: Array.from(new Set(target.territoryIds)),
    territoryNumbers: Array.from(new Set(target.territoryIds))
      .map((territoryId) => territoryNumbersById.get(territoryId))
      .filter((number): number is number => typeof number === 'number')
      .sort((a, b) => a - b),
    notes: target.notes?.trim() ?? null,
  }));
  const ref = monthlyAssignmentRef(congregationId, monthId);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    id: monthId,
    congregationId,
    monthId,
    assignments: normalizedAssignments,
    createdBy: existing.exists() ? existing.data().createdBy : actorUid,
    updatedBy: actorUid,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deleteMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string,
  actorUid: string
): Promise<void> => {
  await upsertMonthlyTerritoryAssignment(congregationId, monthId, actorUid, { assignments: [] });
};

export const getActiveCongregationUsersForGroups = async (congregationId: string): Promise<AppUser[]> =>
  getAllUsers(congregationId, { forceServer: true }).then((users) =>
    users
      .filter((user) => user.isActive === true && user.congregationId === congregationId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  );
