import React from 'react';
import { act, create } from 'react-test-renderer';

import { UserProvider, useUser } from '@/src/context/user-context';
import type { AppUser } from '@/src/types/user';

let mockCurrentAuthUser: { uid: string; email?: string } | null = null;
const mockProfileByUid = new Map<string, AppUser | null>();
const mockSubscriptions = new Map<string, { callback: (user: AppUser | null) => void; onError?: (error: unknown) => void }>();
const mockUnsubscribes = new Map<string, jest.Mock>();

jest.mock('@/src/context/auth-context', () => ({ useAuth: () => ({ user: mockCurrentAuthUser }) }));
jest.mock('@/src/hooks/use-congregation-cache-boundary', () => ({ useCongregationCacheBoundary: jest.fn() }));
jest.mock('@/src/services/congregations/congregations-service', () => ({
  getCongregationAccessState: jest.fn(async () => ({ isBlocked: false, message: '' })),
}));
jest.mock('@/src/services/users/users-service', () => ({
  getCurrentUserProfile: jest.fn(async (uid: string) => mockProfileByUid.get(uid) ?? null),
  subscribeToUser: jest.fn((uid: string, callback: (user: AppUser | null) => void, onError?: (error: unknown) => void) => {
    mockSubscriptions.set(uid, { callback, onError });
    const unsubscribe = jest.fn(() => mockSubscriptions.delete(uid));
    mockUnsubscribes.set(uid, unsubscribe);
    return unsubscribe;
  }),
}));

let latest: ReturnType<typeof useUser> | null = null;
function Harness() { latest = useUser(); return null; }

const makeUser = (uid: string, changes: Partial<AppUser> = {}): AppUser => ({
  uid, email: `${uid}@example.com`, displayName: uid, role: 'user', congregationId: 'cong-a',
  isActive: true, status: 'active', isElder: false, isMinisterialServant: false, ...changes,
});

const flush = async () => {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
};

const render = async () => {
  let renderer!: ReturnType<typeof create>;
  await act(async () => { renderer = create(<UserProvider><Harness /></UserProvider>); });
  await flush();
  return renderer;
};

describe('UserProvider current-profile subscription', () => {
  beforeEach(() => {
    mockCurrentAuthUser = { uid: 'u1', email: 'u1@example.com' };
    mockProfileByUid.clear(); mockProfileByUid.set('u1', makeUser('u1'));
    mockSubscriptions.clear(); mockUnsubscribes.clear(); latest = null;
    jest.clearAllMocks();
  });

  it('applies role, manual permissions and service assignments emitted after bootstrap', async () => {
    await render();
    await act(async () => mockSubscriptions.get('u1')!.callback(makeUser('u1', {
      role: 'supervisor', permissions: { limpieza: { edit: true } },
      serviceAssignments: [{ position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza' }],
    })));
    expect(latest?.role).toBe('supervisor');
    expect(latest?.appUser?.permissions?.limpieza?.edit).toBe(true);
    expect(latest?.serviceAssignments).toHaveLength(1);
  });

  it('invalidates the functional session when the profile is disabled or deleted', async () => {
    await render();
    await act(async () => mockSubscriptions.get('u1')!.callback(makeUser('u1', { isActive: false, status: 'inactive' })));
    expect(latest?.isSessionValid).toBe(false);
    expect(latest?.profileErrorKind).toBe('inactive');
    await act(async () => mockSubscriptions.get('u1')!.callback(null));
    expect(latest?.appUser).toBeNull();
    expect(latest?.profileErrorKind).toBe('not-found');
  });

  it('recomputes the congregation-backed session when congregationId changes', async () => {
    await render();
    await act(async () => mockSubscriptions.get('u1')!.callback(makeUser('u1', { congregationId: 'cong-b' })));
    await flush();
    expect(latest?.congregationId).toBe('cong-b');
    expect(latest?.isSessionValid).toBe(true);
  });

  it('cleans up on logout and UID change, ignoring callbacks from the prior UID', async () => {
    const renderer = await render();
    mockCurrentAuthUser = { uid: 'u2', email: 'u2@example.com' };
    mockProfileByUid.set('u2', makeUser('u2', { role: 'admin' }));
    await act(async () => renderer.update(<UserProvider><Harness /></UserProvider>));
    await flush();
    expect(mockUnsubscribes.get('u1')).toHaveBeenCalledTimes(1);
    await act(async () => mockSubscriptions.get('u1')?.callback(makeUser('u1', { role: 'supervisor' })));
    expect(latest?.uid).toBe('u2');
    expect(latest?.role).toBe('admin');
    mockCurrentAuthUser = null;
    await act(async () => renderer.update(<UserProvider><Harness /></UserProvider>));
    await flush();
    expect(mockUnsubscribes.get('u2')).toHaveBeenCalledTimes(1);
    expect(latest?.appUser).toBeNull();
  });

  it('keeps a valid profile during a temporary listener error and unsubscribes on unmount', async () => {
    const renderer = await render();
    await act(async () => mockSubscriptions.get('u1')!.onError?.(new Error('unavailable')));
    expect(latest?.isSessionValid).toBe(true);
    await act(async () => { renderer.unmount(); });
    expect(mockUnsubscribes.get('u1')).toHaveBeenCalledTimes(1);
  });
});
