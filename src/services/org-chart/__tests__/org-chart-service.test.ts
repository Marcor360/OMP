/* eslint-disable import/first */
jest.mock('@/src/lib/firebase/app', () => ({
  db: {},
  functions: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  writeBatch: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('@/src/services/users/users-service', () => ({
  normalizeUser: jest.fn(),
}));

import {
  __resetOrgChartRepositoryForTests,
  __setOrgChartRepositoryForTests,
  buildOrgChart,
  createDepartment,
} from '@/src/services/org-chart/org-chart-service';
import type {
  OrgChartRecord,
  OrgChartRepository,
  OrgChartUserRecord,
} from '@/src/services/repositories/ports/org-chart-repository.port';
import type { DepartmentPayload } from '@/src/types/org-chart';
import type { AppUser, UserServiceAssignment } from '@/src/types/user';

class FakeOrgChartRepository implements OrgChartRepository {
  readonly createDepartmentMock = jest.fn<Promise<void>, [string, DepartmentPayload, string]>(
    () => Promise.resolve()
  );

  listOrgChartUsersForCurrentCongregation(): Promise<OrgChartUserRecord[]> {
    return Promise.resolve([]);
  }

  listDepartments(): Promise<OrgChartRecord[]> {
    return Promise.resolve([]);
  }

  listAssignments(): Promise<OrgChartRecord[]> {
    return Promise.resolve([]);
  }

  initializeDepartmentsIfMissing(): Promise<boolean> {
    return Promise.resolve(false);
  }

  createDepartment(
    congregationId: string,
    payload: DepartmentPayload,
    actorUid: string
  ): Promise<void> {
    return this.createDepartmentMock(congregationId, payload, actorUid);
  }

  updateDepartment(): Promise<void> {
    return Promise.resolve();
  }

  deactivateDepartment(): Promise<void> {
    return Promise.resolve();
  }

  assignDepartmentRole(): Promise<void> {
    return Promise.resolve();
  }

  removeDepartmentAssignment(): Promise<void> {
    return Promise.resolve();
  }

  updateDepartmentAssignmentRole(): Promise<void> {
    return Promise.resolve();
  }

  reorderDepartments(): Promise<void> {
    return Promise.resolve();
  }
}

const makeUser = (
  uid: string,
  displayName: string,
  serviceAssignments: UserServiceAssignment[]
): AppUser => ({
  uid,
  email: `${uid}@example.com`,
  displayName,
  role: 'user',
  congregationId: 'c1',
  isActive: true,
  status: 'active',
  serviceAssignments,
  isElder: false,
  isMinisterialServant: false,
});

describe('buildOrgChart', () => {
  afterEach(() => {
    __resetOrgChartRepositoryForTests();
    jest.clearAllMocks();
  });

  it('createDepartment delegates to the repository with the validated payload', async () => {
    const repo = new FakeOrgChartRepository();
    __setOrgChartRepositoryForTests(repo);

    const currentUser = makeUser('coordinator', 'Coordinador', [
      { position: 'coordinador', label: 'Coordinador' },
    ]);
    const payload: DepartmentPayload = {
      name: '  Hospitalidad  ',
      category: 'operations',
      parentId: null,
      order: 40,
    };

    await createDepartment('c1', payload, currentUser);

    expect(repo.createDepartmentMock).toHaveBeenCalledTimes(1);
    expect(repo.createDepartmentMock).toHaveBeenCalledWith('c1', payload, 'coordinator');
  });

  it('builds the auto hierarchy from service assignments without manage permissions', () => {
    const coordinator = makeUser('u1', 'Coordinador', [
      { position: 'coordinador', label: 'Coordinador' },
    ]);
    const secretary = makeUser('u2', 'Secretario', [
      { position: 'secretario', label: 'Secretario' },
    ]);
    const cleaningManager = makeUser('u3', 'Encargado Limpieza', [
      { position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza' },
    ]);
    const cleaningAssistant = makeUser('u4', 'Auxiliar Limpieza', [
      { position: 'auxiliar', department: 'limpieza', label: 'Auxiliar de Limpieza' },
    ]);

    const chart = buildOrgChart([], [], [
      cleaningAssistant,
      secretary,
      cleaningManager,
      coordinator,
    ]);

    const administrationIds = chart.administration.map((node) => node.department.id);
    const coordinatorNode = chart.administration.find((node) => node.department.id === 'auto:coordinador');
    const secretaryNode = chart.administration.find((node) => node.department.id === 'auto:secretario');
    const cleaningNode = chart.operations.find((node) => node.department.id === 'auto:limpieza');

    expect(administrationIds.indexOf('auto:coordinador')).toBeLessThan(
      administrationIds.indexOf('auto:secretario')
    );
    expect(coordinatorNode?.responsible?.uid).toBe('u1');
    expect(secretaryNode?.responsible?.uid).toBe('u2');
    expect(cleaningNode?.responsible?.uid).toBe('u3');
    expect(cleaningNode?.assistants.map((user) => user.uid)).toEqual(['u4']);
  });
});
