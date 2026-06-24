import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CacheControlRepository } from '@/src/services/repositories/ports/cache-control-repository.port';
import {
  __resetCacheControlRepositoryForTests,
  __setCacheControlRepositoryForTests,
  syncCacheCleanupControl,
} from '@/src/services/cache/cache-control-service';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

jest.mock('@/src/services/repositories/firestore/firestore-cache-control-repository', () => ({
  firestoreCacheControlRepository: {
    getControlFromServer: async () => null,
    purgeWebPersistence: async () => undefined,
  },
}));

jest.mock('@/src/services/session/session-cleanup', () => ({
  clearTemporaryCacheData: jest.fn(async () => undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: null,
  readDirectoryAsync: jest.fn(async () => []),
  deleteAsync: jest.fn(async () => undefined),
}));

class FakeCacheControlRepository implements CacheControlRepository {
  public docData: Record<string, unknown> | null = null;
  public purgeWebPersistenceCalled = false;

  async getControlFromServer(): Promise<Record<string, unknown> | null> {
    return this.docData;
  }

  async purgeWebPersistence(): Promise<void> {
    this.purgeWebPersistenceCalled = true;
  }
}

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('cache-control-service repository port', () => {
  let repo: FakeCacheControlRepository;

  beforeEach(() => {
    repo = new FakeCacheControlRepository();
    __setCacheControlRepositoryForTests(repo);
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    __resetCacheControlRepositoryForTests();
    jest.clearAllMocks();
  });

  it('returns cache-control-not-found when getControlFromServer returns null', async () => {
    repo.docData = null;

    const result = await syncCacheCleanupControl();

    expect(result).toEqual({ executed: false, reason: 'cache-control-not-found' });
  });

  it('runs cleanup and saves ack when no local ack exists', async () => {
    repo.docData = { cacheVersion: 2, lastCleanupRequestAt: null };
    mockAsyncStorage.getItem.mockResolvedValue(null);

    const result = await syncCacheCleanupControl();

    expect(result).toEqual({ executed: true, reason: 'cleanup-applied' });
    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      '@system_cache_control_ack_v1',
      expect.stringContaining('"cacheVersion":2')
    );
  });

  it('skips cleanup when local ack matches remote', async () => {
    repo.docData = { cacheVersion: 1, lastCleanupRequestAt: null };
    const ack = JSON.stringify({
      cacheVersion: 1,
      lastCleanupRequestAtMillis: null,
      acknowledgedAt: new Date().toISOString(),
    });
    mockAsyncStorage.getItem.mockResolvedValue(ack);

    const result = await syncCacheCleanupControl();

    expect(result).toEqual({ executed: false, reason: 'already-acknowledged' });
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('runs cleanup when remote cacheVersion is greater than local', async () => {
    repo.docData = { cacheVersion: 5, lastCleanupRequestAt: null };
    const ack = JSON.stringify({
      cacheVersion: 3,
      lastCleanupRequestAtMillis: null,
      acknowledgedAt: new Date().toISOString(),
    });
    mockAsyncStorage.getItem.mockResolvedValue(ack);

    const result = await syncCacheCleanupControl();

    expect(result).toEqual({ executed: true, reason: 'cleanup-applied' });
  });

  it('delegates purgeWebPersistence to repository during cleanup', async () => {
    repo.docData = { cacheVersion: 1, lastCleanupRequestAt: null };
    mockAsyncStorage.getItem.mockResolvedValue(null);

    await syncCacheCleanupControl();

    expect(repo.purgeWebPersistenceCalled).toBe(true);
  });
});
