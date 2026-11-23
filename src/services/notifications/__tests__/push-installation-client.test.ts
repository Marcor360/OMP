import { bindCurrentPushInstallation, detachCurrentPushInstallation, getPushRegistrationStatus, retryPushInstallationRevocations } from '../push-installation-client';

const mockStorage = new Map<string, string>();
const mockBind = jest.fn();
const mockRevoke = jest.fn();
const mockKey = 'acc1be42-1b37-47bc-8033-965a960587b7';

jest.mock('@/src/utils/runtime', () => ({ canUseRemotePushNotifications: true }));
jest.mock('@/src/lib/firebase/app', () => ({ auth: { currentUser: { uid: 'a1' } }, functions: {} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => mockKey }));
jest.mock('firebase/functions', () => ({
  httpsCallable: (_functions: unknown, name: string) => name === 'bindPushInstallation' ? mockBind : mockRevoke,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => { mockStorage.set(key, value); },
  removeItem: async (key: string) => { mockStorage.delete(key); },
  getAllKeys: async () => Array.from(mockStorage.keys()),
  multiGet: async (keys: string[]) => keys.map((key) => [key, mockStorage.get(key) ?? null]),
}));

it('keeps the revocation across offline logout and clears it after server confirmation', async () => {
  const token = 'ExpoPushToken[synthetic-test]';
  mockBind.mockResolvedValue({ data: { ok: true } });
  mockRevoke.mockRejectedValue(new Error('Offline'));
  await bindCurrentPushInstallation({ uid: 'a1', congregationId: 'test', token, platform: 'android', deviceName: null });
  expect(getPushRegistrationStatus('a1', 'test')).toBe('registered');
  expect(getPushRegistrationStatus('a2', 'test')).toBe('pending');

  await detachCurrentPushInstallation('a1');
  expect(getPushRegistrationStatus('a1', 'test')).toBe('pending');
  await retryPushInstallationRevocations();
  expect(Array.from(mockStorage.keys())).toEqual([`@omp/push-installation/revoke/${mockKey}`]);

  mockRevoke.mockResolvedValue({ data: { revoked: true } });
  await retryPushInstallationRevocations();
  expect(mockRevoke).toHaveBeenLastCalledWith({ token, key: mockKey });
  expect(mockStorage.size).toBe(0);
});
