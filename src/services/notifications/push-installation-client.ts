import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/src/lib/firebase/app';
import { getActiveLocale } from '@/src/i18n/active-locale';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

type Binding = { uid: string; token: string; key: string; issuedAt: number };
const ACTIVE_KEY = '@omp/push-installation/active';
const QUEUE_PREFIX = '@omp/push-installation/revoke/';
let serial = Promise.resolve();
let suspendedUid: string | undefined;
type BindingStatus = 'pending' | 'registering' | 'registered';
let registration: { uid: string; congregationId: string; status: BindingStatus } | undefined;
const registrationListeners = new Set<() => void>();
export const subscribePushRegistration = (listener: () => void): (() => void) => {
  registrationListeners.add(listener);
  return () => { registrationListeners.delete(listener); };
};
export const getPushRegistrationStatus = (
  uid: string | null, congregationId: string | null,
): BindingStatus => registration?.uid === uid && registration?.congregationId === congregationId
  ? registration.status : 'pending';
const updateRegistration = (value: typeof registration) => {
  registration = value;
  registrationListeners.forEach((listener) => listener());
};

const serialize = (task: () => Promise<void>): Promise<void> => {
  const next = serial.then(task);
  serial = next.catch(() => undefined);
  return next;
};

const readBinding = (raw: string | null): Binding | null => {
  if (!raw) return null;
  try {
    const binding = JSON.parse(raw) as Partial<Binding> | null;
    return typeof binding?.uid === 'string' && typeof binding.token === 'string' && typeof binding.key === 'string'
      && typeof binding.issuedAt === 'number'
      ? { uid: binding.uid, token: binding.token, key: binding.key, issuedAt: binding.issuedAt } : null;
  } catch {
    return null;
  }
};

const scheduleRevocation = async (binding: Binding) => {
  await AsyncStorage.setItem(QUEUE_PREFIX + binding.key, JSON.stringify(binding));
  await AsyncStorage.removeItem(ACTIVE_KEY);
};

export const resumePushInstallation = (uid: string): void => {
  if (suspendedUid === uid) suspendedUid = undefined;
};

export const bindCurrentPushInstallation = (params: {
  uid: string; congregationId: string; token: string; platform: string; deviceName: string | null;
}): Promise<void> => {
  const scope = { uid: params.uid, congregationId: params.congregationId };
  return serialize(async () => {
    if (auth.currentUser?.uid !== params.uid || suspendedUid === params.uid) throw new Error('Push account changed');
    try {
      if (getPushRegistrationStatus(params.uid, params.congregationId) !== 'registered') {
        updateRegistration({ ...scope, status: 'registering' });
      }
      const previous = readBinding(await AsyncStorage.getItem(ACTIVE_KEY));
      const reuse = previous?.uid === params.uid && previous.token === params.token;
      if (previous && !reuse) await scheduleRevocation(previous);
      const pendingKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(QUEUE_PREFIX));
      const previousKey = pendingKeys.length ? (await AsyncStorage.multiGet(pendingKeys))
        .map(([, raw]) => readBinding(raw)).find((candidate) => candidate?.token === params.token)?.key : undefined;
      const binding = { uid: params.uid, token: params.token, key: reuse ? previous.key : randomUUID(), issuedAt: Date.now() };
      await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(binding));
      if (auth.currentUser?.uid !== params.uid || suspendedUid === params.uid) {
        await scheduleRevocation(binding);
        throw new Error('Push account changed');
      }
      const bind = httpsCallable<typeof params & { locale: 'es' | 'en'; key: string; previousKey?: string; issuedAt: number }, { ok: true }>(
        functions, 'bindPushInstallation', { timeout: 5_000 },
      );
      const locale = getActiveLocale().startsWith('en') ? 'en' : 'es';
      await bind({ ...params, locale, key: binding.key, issuedAt: binding.issuedAt, ...(previousKey ? { previousKey } : {}) });
      if (auth.currentUser?.uid === params.uid && suspendedUid !== params.uid) {
        updateRegistration({ ...scope, status: 'registered' });
      }
    } catch (error) {
      if (auth.currentUser?.uid === params.uid && suspendedUid !== params.uid) {
        updateRegistration({ ...scope, status: 'pending' });
      }
      throw error;
    }
  });
};

let revocationRequest: Promise<void> | undefined;

export const retryPushInstallationRevocations = (): Promise<void> => {
  if (!canUseRemotePushNotifications) return Promise.resolve();
  if (revocationRequest) return revocationRequest;
  revocationRequest = (async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(QUEUE_PREFIX));
    if (!keys.length) return;
    const revoke = httpsCallable<{ token: string; key: string }, { revoked: boolean }>(
      functions, 'revokePushInstallation', { timeout: 5_000 },
    );
    for (const [storageKey, raw] of await AsyncStorage.multiGet(keys)) {
      const binding = readBinding(raw);
      if (!binding) continue;
      try {
        const { data } = await revoke({ token: binding.token, key: binding.key });
        if (data.revoked || Date.now() - binding.issuedAt > 300_000) {
          await AsyncStorage.removeItem(storageKey);
        }
      } catch {
        // Retain this installation's operation for the next foreground retry.
      }
    }
  })().finally(() => { revocationRequest = undefined; });
  return revocationRequest;
};

export const detachCurrentPushInstallation = async (uid: string, token?: string): Promise<void> => {
  if (!canUseRemotePushNotifications) return;
  if (!token) suspendedUid = uid;
  if (!token && registration?.uid === uid) updateRegistration(undefined);
  await serialize(async () => {
    const previous = readBinding(await AsyncStorage.getItem(ACTIVE_KEY));
    if (previous?.uid === uid && (!token || previous.token === token)) await scheduleRevocation(previous);
  });
  void retryPushInstallationRevocations().catch(() => undefined);
};

export const reconcilePushInstallationOwner = async (uid: string | null): Promise<void> => {
  if (!canUseRemotePushNotifications) return;
  await serialize(async () => {
    const previous = readBinding(await AsyncStorage.getItem(ACTIVE_KEY));
    if (previous && previous.uid !== uid && auth.currentUser?.uid === (uid ?? undefined)) {
      await scheduleRevocation(previous);
    }
  });
  await retryPushInstallationRevocations();
};
