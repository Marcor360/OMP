import { firestoreTerritoryRepository } from '@/src/services/repositories/firestore/firestore-territory-repository';
import type {
  TerritoryRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/territory-repository.port';
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

let territoryRepository: TerritoryRepository = firestoreTerritoryRepository;

export const __setTerritoryRepositoryForTests = (repo: TerritoryRepository): void => {
  territoryRepository = repo;
};

export const __resetTerritoryRepositoryForTests = (): void => {
  territoryRepository = firestoreTerritoryRepository;
};

const assertCongregationId = (congregationId: string): void => {
  if (!congregationId.trim()) {
    throw new Error('No se pudo identificar la congregacion del usuario.');
  }
};

const assertTerritoryInput = (input: TerritoryInput): void => {
  if (!Number.isInteger(input.number) || input.number <= 0) {
    throw new Error('El numero de territorio debe ser un entero positivo.');
  }

  const description = input.description.trim();
  if (!description) {
    throw new Error('La descripcion del territorio es obligatoria.');
  }

  if (description.length > TERRITORY_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`La descripcion no puede superar ${TERRITORY_DESCRIPTION_MAX_LENGTH} caracteres.`);
  }
};

const assertGroupInput = async (
  congregationId: string,
  groupId: string | null,
  input: PreachingGroupInput
): Promise<void> => {
  if (!Number.isInteger(input.number) || input.number <= 0) {
    throw new Error('El numero del grupo debe ser positivo.');
  }

  if (!input.captainUserId) {
    throw new Error('El capitan del grupo es obligatorio.');
  }

  const memberIds = Array.from(new Set(input.memberIds));
  if (!memberIds.includes(input.captainUserId)) {
    throw new Error('El capitan debe pertenecer al grupo.');
  }

  if (input.assistantUserId && !memberIds.includes(input.assistantUserId)) {
    throw new Error('El auxiliar debe pertenecer al grupo.');
  }

  const activeUsers = await territoryRepository.getActiveCongregationUsersForGroups(congregationId);
  const activeUserIds = new Set(activeUsers.map((user) => user.uid));

  if (memberIds.some((uid) => !activeUserIds.has(uid))) {
    throw new Error('Todos los integrantes deben ser usuarios activos de la congregacion.');
  }

  const groups = await territoryRepository.getPreachingGroups(congregationId);
  const duplicatedMember = groups
    .filter((group) => group.isActive && group.id !== groupId)
    .flatMap((group) => group.memberIds)
    .find((uid) => memberIds.includes(uid));

  if (duplicatedMember) {
    throw new Error('Un usuario no puede pertenecer a mas de un grupo activo.');
  }
};

const assertMonthlyInput = (
  activeTerritories: Territory[],
  activeGroups: PreachingGroup[],
  input: MonthlyTerritoryAssignmentInput
): void => {
  const activeTerritoryIds = new Set(activeTerritories.map((territory) => territory.id));
  const activeGroupIds = new Set(
    activeGroups.filter((group) => group.isActive).map((group) => group.id)
  );
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
      if (!activeTerritoryIds.has(territoryId)) {
        throw new Error('Solo puedes asignar territorios activos.');
      }

      if (usedTerritoryIds.has(territoryId)) {
        throw new Error('Un territorio no puede repetirse dentro del mismo mes.');
      }

      usedTerritoryIds.add(territoryId);
    });
  });
};

const normalizeMonthlyInput = (
  activeTerritories: Territory[],
  input: MonthlyTerritoryAssignmentInput
): MonthlyTerritoryAssignmentInput => {
  const territoryNumbersById = new Map(
    activeTerritories.map((territory) => [territory.id, territory.number])
  );

  const assignments: TerritoryAssignmentTarget[] = input.assignments.map((target) => ({
    ...target,
    territoryIds: Array.from(new Set(target.territoryIds)),
    territoryNumbers: Array.from(new Set(target.territoryIds))
      .map((territoryId) => territoryNumbersById.get(territoryId))
      .filter((number): number is number => typeof number === 'number')
      .sort((left, right) => left - right),
    notes: target.notes?.trim() ?? null,
  }));

  return { assignments };
};

export const getTerritories = async (congregationId: string): Promise<Territory[]> => {
  assertCongregationId(congregationId);
  return territoryRepository.getTerritories(congregationId);
};

export const subscribeTerritories = (
  congregationId: string,
  onChange: (territories: Territory[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  return territoryRepository.subscribeTerritories(congregationId, onChange, onError);
};

export const createTerritory = async (
  congregationId: string,
  actorUid: string,
  input: TerritoryInput
): Promise<void> => {
  assertCongregationId(congregationId);
  assertTerritoryInput(input);

  await territoryRepository.createTerritory({
    congregationId,
    territoryId: buildTerritoryId(input.number),
    actorUid,
    input,
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
  if (territoryId !== expectedId) {
    throw new Error('No se puede cambiar el numero identificador del territorio.');
  }

  await territoryRepository.updateTerritory({
    congregationId,
    territoryId,
    actorUid,
    input,
  });
};

export const deactivateTerritory = async (
  congregationId: string,
  territoryId: string,
  actorUid: string
): Promise<void> => {
  assertCongregationId(congregationId);
  await territoryRepository.deactivateTerritory({ congregationId, territoryId, actorUid });
};

export const getPreachingGroups = async (congregationId: string): Promise<PreachingGroup[]> => {
  assertCongregationId(congregationId);
  return territoryRepository.getPreachingGroups(congregationId);
};

export const subscribePreachingGroups = (
  congregationId: string,
  onChange: (groups: PreachingGroup[]) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  return territoryRepository.subscribePreachingGroups(congregationId, onChange, onError);
};

export const createPreachingGroup = async (
  congregationId: string,
  actorUid: string,
  input: PreachingGroupInput
): Promise<void> => {
  assertCongregationId(congregationId);
  await assertGroupInput(congregationId, null, input);

  await territoryRepository.createPreachingGroup({
    congregationId,
    groupId: `group_${input.number}`,
    actorUid,
    input,
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

  await territoryRepository.updatePreachingGroup({
    congregationId,
    groupId,
    actorUid,
    input,
  });
};

export const deactivatePreachingGroup = async (
  congregationId: string,
  groupId: string,
  actorUid: string
): Promise<void> => {
  assertCongregationId(congregationId);
  await territoryRepository.deactivatePreachingGroup({ congregationId, groupId, actorUid });
};

export const getMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string
): Promise<MonthlyTerritoryAssignment | null> => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) {
    throw new Error('Selecciona un mes valido.');
  }

  return territoryRepository.getMonthlyAssignment(congregationId, monthId);
};

export const subscribeVisibleMonthlyTerritories = (
  congregationId: string,
  userId: string,
  monthId: string,
  onChange: (data: VisibleMonthlyTerritories) => void,
  onError: (error: Error) => void
): Unsubscribe => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) {
    throw new Error('Selecciona un mes valido.');
  }

  return territoryRepository.subscribeVisibleMonthlyTerritories(
    congregationId,
    userId,
    monthId,
    onChange,
    onError
  );
};

export const upsertMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string,
  actorUid: string,
  input: MonthlyTerritoryAssignmentInput
): Promise<void> => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) {
    throw new Error('Selecciona un mes valido.');
  }

  const [territories, groups] = await Promise.all([
    territoryRepository.getTerritories(congregationId),
    territoryRepository.getPreachingGroups(congregationId),
  ]);
  const activeTerritories = territories.filter((territory) => territory.status === 'active');
  assertMonthlyInput(activeTerritories, groups, input);

  await territoryRepository.upsertMonthlyAssignment({
    congregationId,
    monthId,
    actorUid,
    input: normalizeMonthlyInput(activeTerritories, input),
  });
};

export const deleteMonthlyTerritoryAssignment = async (
  congregationId: string,
  monthId: string,
  actorUid: string
): Promise<void> => {
  assertCongregationId(congregationId);
  if (!isValidMonthId(monthId)) {
    throw new Error('Selecciona un mes valido.');
  }

  const [territories, groups] = await Promise.all([
    territoryRepository.getTerritories(congregationId),
    territoryRepository.getPreachingGroups(congregationId),
  ]);
  const activeTerritories = territories.filter((territory) => territory.status === 'active');
  assertMonthlyInput(activeTerritories, groups, { assignments: [] });

  await territoryRepository.deleteMonthlyAssignment({ congregationId, monthId, actorUid });
};

export const getActiveCongregationUsersForGroups = async (
  congregationId: string
): Promise<AppUser[]> => {
  assertCongregationId(congregationId);
  return territoryRepository.getActiveCongregationUsersForGroups(congregationId);
};
