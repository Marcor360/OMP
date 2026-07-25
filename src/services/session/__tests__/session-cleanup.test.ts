import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalSessionData } from '../session-cleanup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  multiRemove: jest.fn(),
}));

jest.mock('@/src/services/repositories/firestore-cache-first', () => ({
  markFirestoreCacheSessionBoundary: jest.fn(),
}));

jest.mock('@/src/services/repositories/persistent-cache', () => ({
  clearAllPersistentCache: jest.fn(async () => undefined),
}));

jest.mock('@/src/services/repositories/session-cache', () => ({
  clearAllSessionCache: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('session-cleanup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('purga solo claves globales legadas y conserva caches scoped en logout', async () => {
    await clearLocalSessionData();

    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
      '@cleaning_groups',
      '@cleaning_assignable_users',
      '@field_service_v1',
    ]);

    const removedKeys = mockAsyncStorage.multiRemove.mock.calls[0]?.[0] ?? [];
    expect(removedKeys).not.toContain('@cleaning_groups:v1:user-a:cong-1');
    expect(removedKeys).not.toContain('@cleaning_assignable_users:v1:user-a:cong-1');
    expect(removedKeys).not.toContain('@omp/my-cleaning-dashboard:v2:user-a:cong-1');
  });
});
