import type {
  MonthlyTerritoryAssignment,
  MonthlyTerritoryAssignmentInput,
  PreachingGroup,
  PreachingGroupInput,
  Territory,
  TerritoryInput,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';
import type {
  TerritoryRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/territory-repository.port';
import {
  __resetTerritoryRepositoryForTests,
  __setTerritoryRepositoryForTests,
  createPreachingGroup,
  createTerritory,
  deactivateTerritory,
  subscribeTerritories,
  upsertMonthlyTerritoryAssignment,
} from '@/src/services/territories/territories-service';

jest.mock('@/src/services/repositories/firestore/firestore-territory-repository', () => ({
  firestoreTerritoryRepository: {
    getTerritories: jest.fn(),
    subscribeTerritories: jest.fn(),
    createTerritory: jest.fn(),
    updateTerritory: jest.fn(),
    deactivateTerritory: jest.fn(),
    getPreachingGroups: jest.fn(),
    subscribePreachingGroups: jest.fn(),
    createPreachingGroup: jest.fn(),
    updatePreachingGroup: jest.fn(),
    deactivatePreachingGroup: jest.fn(),
    getMonthlyAssignment: jest.fn(),
    subscribeVisibleMonthlyTerritories: jest.fn(),
    upsertMonthlyAssignment: jest.fn(),
    deleteMonthlyAssignment: jest.fn(),
    getActiveCongregationUsersForGroups: jest.fn(),
  },
}));

const timestamp = null;

const territory = (id: string, number: number, status: Territory['status'] = 'active'): Territory => ({
  id,
  congregationId: 'c1',
  number,
  description: `Territorio ${number}`,
  status,
  createdBy: 'admin',
  updatedBy: 'admin',
  createdAt: timestamp,
  updatedAt: timestamp,
});

const group = (id: string): PreachingGroup => ({
  id,
  congregationId: 'c1',
  name: 'Grupo 1',
  number: 1,
  captainUserId: 'user-1',
  captainName: 'Usuario Uno',
  assistantUserId: null,
  assistantName: null,
  memberIds: ['user-1'],
  memberNames: ['Usuario Uno'],
  memberCount: 1,
  isActive: true,
  createdBy: 'admin',
  updatedBy: 'admin',
  createdAt: timestamp,
  updatedAt: timestamp,
});

class FakeTerritoryRepository implements TerritoryRepository {
  readonly createPreachingGroupMock = jest.fn<Promise<void>, [{
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }]>(() => Promise.resolve());

  readonly createTerritoryMock = jest.fn<Promise<void>, [{
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }]>(() => Promise.resolve());

  readonly deactivateTerritoryMock = jest.fn<Promise<void>, [{
    congregationId: string;
    territoryId: string;
    actorUid: string;
  }]>(() => Promise.resolve());

  readonly subscribeTerritoriesMock = jest.fn<
    Unsubscribe,
    [string, (territories: Territory[]) => void, (error: Error) => void]
  >(() => () => undefined);

  readonly upsertMonthlyAssignmentMock = jest.fn<Promise<void>, [{
    congregationId: string;
    monthId: string;
    actorUid: string;
    input: MonthlyTerritoryAssignmentInput;
  }]>(() => Promise.resolve());

  getTerritories(): Promise<Territory[]> {
    return Promise.resolve([
      territory('territory_1', 1),
      territory('territory_2', 2),
      territory('territory_3', 3, 'inactive'),
    ]);
  }

  subscribeTerritories(
    congregationId: string,
    onChange: (territories: Territory[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    return this.subscribeTerritoriesMock(congregationId, onChange, onError);
  }

  createTerritory(payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
    input: TerritoryInput;
  }): Promise<void> {
    return this.createTerritoryMock(payload);
  }

  updateTerritory(): Promise<void> {
    return Promise.resolve();
  }

  deactivateTerritory(payload: {
    congregationId: string;
    territoryId: string;
    actorUid: string;
  }): Promise<void> {
    return this.deactivateTerritoryMock(payload);
  }

  getPreachingGroups(): Promise<PreachingGroup[]> {
    return Promise.resolve([group('group_1')]);
  }

  subscribePreachingGroups(): Unsubscribe {
    return () => undefined;
  }

  createPreachingGroup(payload: {
    congregationId: string;
    groupId: string;
    actorUid: string;
    input: PreachingGroupInput;
  }): Promise<void> {
    return this.createPreachingGroupMock(payload);
  }

  updatePreachingGroup(): Promise<void> {
    return Promise.resolve();
  }

  deactivatePreachingGroup(): Promise<void> {
    return Promise.resolve();
  }

  getMonthlyAssignment(): Promise<MonthlyTerritoryAssignment | null> {
    return Promise.resolve(null);
  }

  subscribeVisibleMonthlyTerritories(): Unsubscribe {
    return () => undefined;
  }

  upsertMonthlyAssignment(payload: {
    congregationId: string;
    monthId: string;
    actorUid: string;
    input: MonthlyTerritoryAssignmentInput;
  }): Promise<void> {
    return this.upsertMonthlyAssignmentMock(payload);
  }

  deleteMonthlyAssignment(): Promise<void> {
    return Promise.resolve();
  }

  getActiveCongregationUsersForGroups(): Promise<AppUser[]> {
    return Promise.resolve([
      {
        uid: 'user-1',
        email: 'uno@example.com',
        displayName: 'Usuario Uno',
        role: 'user',
        congregationId: 'c1',
        isActive: true,
        status: 'active',
        isElder: false,
        isMinisterialServant: false,
      },
      {
        uid: 'user-2',
        email: 'dos@example.com',
        displayName: 'Usuario Dos',
        role: 'user',
        congregationId: 'c1',
        isActive: true,
        status: 'active',
        isElder: false,
        isMinisterialServant: false,
      },
    ]);
  }
}

describe('territories-service repository seam', () => {
  let repo: FakeTerritoryRepository;

  beforeEach(() => {
    repo = new FakeTerritoryRepository();
    __setTerritoryRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetTerritoryRepositoryForTests();
    jest.clearAllMocks();
  });

  it('upsertMonthlyTerritoryAssignment delegates normalized data to the repository', async () => {
    await upsertMonthlyTerritoryAssignment('c1', '2026-06', 'admin', {
      assignments: [
        {
          id: 'group_1',
          scope: 'group',
          groupId: 'group_1',
          groupName: 'Grupo 1',
          territoryIds: ['territory_2', 'territory_1'],
          territoryNumbers: [],
          notes: '  Nota de ruta  ',
        },
      ],
    });

    expect(repo.upsertMonthlyAssignmentMock).toHaveBeenCalledTimes(1);
    expect(repo.upsertMonthlyAssignmentMock).toHaveBeenCalledWith({
      congregationId: 'c1',
      monthId: '2026-06',
      actorUid: 'admin',
      input: {
        assignments: [
          {
            id: 'group_1',
            scope: 'group',
            groupId: 'group_1',
            groupName: 'Grupo 1',
            territoryIds: ['territory_2', 'territory_1'],
            territoryNumbers: [1, 2],
            notes: 'Nota de ruta',
          },
        ],
      },
    });
  });

  it('createTerritory validates and delegates to the repository', async () => {
    const input: TerritoryInput = {
      number: 7,
      description: 'Colonia centro',
      status: 'active',
    };

    await createTerritory('c1', 'admin', input);

    expect(repo.createTerritoryMock).toHaveBeenCalledTimes(1);
    expect(repo.createTerritoryMock).toHaveBeenCalledWith({
      congregationId: 'c1',
      territoryId: 'territory_7',
      actorUid: 'admin',
      input,
    });
  });

  it('rechaza integrantes que ya pertenecen a otro grupo activo', async () => {
    await expect(
      createPreachingGroup('c1', 'admin', {
        number: 2,
        captainUserId: 'user-1',
        captainName: 'Usuario Uno',
        assistantUserId: null,
        assistantName: null,
        memberIds: ['user-1'],
        memberNames: ['Usuario Uno'],
        isActive: true,
      })
    ).rejects.toThrow('Un usuario no puede pertenecer a mas de un grupo activo.');

    expect(repo.createPreachingGroupMock).not.toHaveBeenCalled();
  });

  it('deactivateTerritory delegates to the repository', async () => {
    await deactivateTerritory('c1', 'territory_7', 'admin');

    expect(repo.deactivateTerritoryMock).toHaveBeenCalledTimes(1);
    expect(repo.deactivateTerritoryMock).toHaveBeenCalledWith({
      congregationId: 'c1',
      territoryId: 'territory_7',
      actorUid: 'admin',
    });
  });

  it('subscribeTerritories guards empty congregation ids before delegating', () => {
    const onChange = jest.fn<void, [Territory[]]>();
    const onError = jest.fn<void, [Error]>();

    expect(() => subscribeTerritories('', onChange, onError)).toThrow(
      'No se pudo identificar la congregacion del usuario.'
    );
    expect(repo.subscribeTerritoriesMock).not.toHaveBeenCalled();
  });

  it('subscribeTerritories delegates valid subscriptions', () => {
    const onChange = jest.fn<void, [Territory[]]>();
    const onError = jest.fn<void, [Error]>();

    subscribeTerritories('c1', onChange, onError);

    expect(repo.subscribeTerritoriesMock).toHaveBeenCalledTimes(1);
    expect(repo.subscribeTerritoriesMock).toHaveBeenCalledWith('c1', onChange, onError);
  });
});
