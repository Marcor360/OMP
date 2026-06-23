import type {
  Unsubscribe,
  UserRepository,
} from '@/src/services/repositories/ports/user-repository.port';
import {
  __resetUserRepositoryForTests,
  __setUserRepositoryForTests,
  createUserProfile,
  getCurrentUserProfile,
  subscribeToUser,
  updateUser,
} from '@/src/services/users/users-service';
import type { AppUser } from '@/src/types/user';

jest.mock('@/src/services/repositories/firestore/firestore-user-repository', () => ({
  firestoreUserRepository: {
    getById: async () => null,
    getAllByCongregation: async () => [],
    getActiveByCongregation: async () => [],
    create: async () => undefined,
    update: async () => undefined,
    delete: async () => undefined,
    count: async () => 0,
    subscribeToUser: () => () => undefined,
  },
}));

const makeUser = (overrides: Partial<AppUser> = {}): AppUser => ({
  uid: 'user-1',
  email: 'user@example.com',
  displayName: 'User One',
  role: 'user',
  congregationId: 'cong-1',
  isActive: true,
  status: 'active',
  isElder: false,
  isMinisterialServant: false,
  ...overrides,
});

class FakeUserRepository implements UserRepository {
  public lastCreate: { uid: string; payload: Record<string, unknown> } | null = null;
  public lastUpdate: { uid: string; payload: Record<string, unknown> } | null = null;
  public getByIdCalls: { uid: string; options?: { forceServer?: boolean; maxAgeMs?: number } }[] = [];
  public userById: AppUser | null = makeUser();
  public subscribedUser: AppUser | null = null;

  async getById(
    uid: string,
    options?: { forceServer?: boolean; maxAgeMs?: number }
  ): Promise<AppUser | null> {
    this.getByIdCalls.push({ uid, options });
    return this.userById;
  }

  async getAllByCongregation(): Promise<AppUser[]> {
    return [];
  }

  async getActiveByCongregation(): Promise<AppUser[]> {
    return [];
  }

  async create(uid: string, payload: Record<string, unknown>): Promise<void> {
    this.lastCreate = { uid, payload };
  }

  async update(uid: string, payload: Record<string, unknown>): Promise<void> {
    this.lastUpdate = { uid, payload };
  }

  async delete(): Promise<void> {
    return undefined;
  }

  async count(): Promise<number> {
    return 0;
  }

  subscribeToUser(
    uid: string,
    callback: (user: AppUser | null) => void
  ): Unsubscribe {
    callback(this.subscribedUser);
    return () => undefined;
  }
}

describe('users-service repository port', () => {
  let repo: FakeUserRepository;

  beforeEach(() => {
    repo = new FakeUserRepository();
    __setUserRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetUserRepositoryForTests();
  });

  it('updateUser derives status when isActive is provided without status', async () => {
    await updateUser('user-1', { isActive: true });

    expect(repo.lastUpdate?.payload).toMatchObject({
      isActive: true,
      status: 'active',
    });
  });

  it('updateUser derives isActive when status is provided without isActive', async () => {
    await updateUser('user-1', { status: 'inactive' });

    expect(repo.lastUpdate?.payload).toMatchObject({
      status: 'inactive',
      isActive: false,
    });
  });

  it('createUserProfile sets emailKey and derives appointment flags from privileges', async () => {
    await createUserProfile('user-1', {
      email: '  Person@Example.COM ',
      displayName: 'Person Example',
      role: 'user',
      congregationId: 'cong-1',
      privileges: {
        isElder: true,
        isMinisterialServant: false,
      },
    });

    expect(repo.lastCreate?.payload).toMatchObject({
      emailKey: 'person@example.com',
      isElder: true,
      isMinisterialServant: false,
      isActive: true,
      status: 'active',
    });
  });

  it('getCurrentUserProfile delegates to getById', async () => {
    await getCurrentUserProfile('user-1', { forceServer: true });

    expect(repo.getByIdCalls).toHaveLength(1);
    expect(repo.getByIdCalls[0]).toMatchObject({
      uid: 'user-1',
      options: { forceServer: true },
    });
  });

  it('subscribeToUser delivers null when the repository emits null', () => {
    const callback = jest.fn<void, [AppUser | null]>();
    repo.subscribedUser = null;

    subscribeToUser('user-1', callback);

    expect(callback).toHaveBeenCalledWith(null);
  });
});
