import React from 'react';
import { act, create } from 'react-test-renderer';
import { Platform } from 'react-native';

import { AuthProvider, useAuth } from '@/src/context/auth-context';
import {
  __resetAppLockStateForTests,
  isCurrentlyLocallyUnlocked,
} from '@/src/services/security/app-lock-state';

type FakeUser = { uid: string };

let authStateCallback: ((user: FakeUser | null) => void) | null = null;
const mockOnAuthStateChanged = jest.fn(
  (_auth: unknown, callback: (user: FakeUser | null) => void) => {
    authStateCallback = callback;
    return jest.fn();
  }
);

jest.mock('@/src/config/firebase/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth: unknown, cb: (user: FakeUser | null) => void) =>
    mockOnAuthStateChanged(auth, cb),
}));

const mockLoginWithEmail = jest.fn(async (_credentials: unknown) => undefined);
// Refleja el comportamiento real de Firebase: signOut() dispara el listener
// onAuthStateChanged existente con null casi de inmediato. Sin esto, userRef
// quedaria "vivo" tras un logout simulado y una segunda comprobacion de
// expiracion (p. ej. un visibilitychange posterior) volveria a cerrar sesion.
const mockLogout = jest.fn(async () => {
  authStateCallback?.(null);
});
jest.mock('@/src/services/auth-service', () => ({
  loginWithEmail: (credentials: unknown) => mockLoginWithEmail(credentials),
  logout: () => mockLogout(),
}));

const mockClearLocalSessionData = jest.fn(async () => undefined);
jest.mock('@/src/services/session/session-cleanup', () => ({
  clearLocalSessionData: () => mockClearLocalSessionData(),
}));

const mockStorageMap = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorageMap.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorageMap.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorageMap.delete(key);
  }),
}));

type AuthSnapshot = ReturnType<typeof useAuth>;
let latestCtx: AuthSnapshot | null = null;

function Harness() {
  latestCtx = useAuth();
  return null;
}

const flush = async (times = 1) => {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const mount = async (): Promise<ReturnType<typeof create>> => {
  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(React.createElement(AuthProvider, null, React.createElement(Harness)));
  });
  await flush();
  return renderer;
};

const signIn = async (uid = 'user-1') => {
  await act(async () => {
    authStateCallback?.({ uid });
    await Promise.resolve();
  });
  await flush();
};

// Instala stubs minimos de window/document: este entorno de jest usa
// testEnvironment 'node' (sin DOM), pero la rama web de auth-context accede a
// ambos globals cuando Platform.OS === 'web'.
const installWebGlobals = () => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const windowStub = {
    addEventListener: (event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    },
    removeEventListener: (event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    },
  };
  const documentListeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const documentStub = {
    hidden: false,
    addEventListener: (event: string, handler: (...args: unknown[]) => void) => {
      if (!documentListeners.has(event)) documentListeners.set(event, new Set());
      documentListeners.get(event)!.add(handler);
    },
    removeEventListener: (event: string, handler: (...args: unknown[]) => void) => {
      documentListeners.get(event)?.delete(handler);
    },
  };

  (global as unknown as { window: typeof windowStub }).window = windowStub;
  (global as unknown as { document: typeof documentStub }).document = documentStub;

  return {
    fireVisibilityChange: () => {
      documentListeners.get('visibilitychange')?.forEach((handler) => handler());
    },
    setHidden: (hidden: boolean) => {
      documentStub.hidden = hidden;
    },
  };
};

const uninstallWebGlobals = () => {
  delete (global as unknown as { window?: unknown }).window;
  delete (global as unknown as { document?: unknown }).document;
};

describe('AuthProvider - web inactivity policy', () => {
  const originalPlatformOS = Platform.OS;
  let webGlobals: ReturnType<typeof installWebGlobals>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStorageMap.clear();
    authStateCallback = null;
    latestCtx = null;
    __resetAppLockStateForTests();
    Platform.OS = 'web';
    webGlobals = installWebGlobals();
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    uninstallWebGlobals();
    jest.useRealTimers();
  });

  it('closes the session after 15 minutes of real inactivity', async () => {
    await mount();
    await signIn();

    expect(latestCtx?.user?.uid).toBe('user-1');

    // advanceTimersByTimeAsync flushes microtasks between cada tick del
    // intervalo de 60s, dandole tiempo a forceLogoutByInactivity de limpiar el
    // intervalo antes de que se procese el siguiente (igual que en tiempo real).
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15 * 60 * 1000 + 1000);
    });
    await flush(2);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockClearLocalSessionData).toHaveBeenCalled();
  });

  it('does not close the session while there is activity', async () => {
    await mount();
    await signIn();

    // Simulate activity every 5 minutes, well under the 15 minute limit.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000);
        await Promise.resolve();
      });
      await act(async () => {
        latestCtx?.onUserActivity();
        await Promise.resolve();
      });
    }
    await flush(2);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('shows the inactivity warning before closing the session', async () => {
    await mount();
    await signIn();

    expect(latestCtx?.showInactivityWarning).toBe(false);

    await act(async () => {
      // 14 minutes + 30s: inside the 60s warning window before the 15 min cutoff.
      jest.advanceTimersByTime(14 * 60 * 1000 + 30 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush(2);

    expect(latestCtx?.showInactivityWarning).toBe(true);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('extendSession dismisses the warning and keeps the session alive', async () => {
    await mount();
    await signIn();

    await act(async () => {
      jest.advanceTimersByTime(14 * 60 * 1000 + 30 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush(2);
    expect(latestCtx?.showInactivityWarning).toBe(true);

    await act(async () => {
      latestCtx?.extendSession();
      await Promise.resolve();
    });
    await flush();

    expect(latestCtx?.showInactivityWarning).toBe(false);

    // Another 14m30s should not expire it since extendSession reset the clock.
    await act(async () => {
      jest.advanceTimersByTime(14 * 60 * 1000 + 30 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush(2);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('validates real elapsed time on visibility change instead of trusting the resume as activity', async () => {
    await mount();
    await signIn();

    // Tab goes hidden; wait past the inactivity window while hidden, then return.
    webGlobals.setHidden(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(16 * 60 * 1000);
    });

    webGlobals.setHidden(false);
    await act(async () => {
      webGlobals.fireVisibilityChange();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush(2);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider - mobile session policy', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStorageMap.clear();
    authStateCallback = null;
    latestCtx = null;
    __resetAppLockStateForTests();
    Platform.OS = 'ios';
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
    jest.useRealTimers();
  });

  it('keeps the Firebase session after more than 15 minutes without any signOut', async () => {
    await mount();
    await signIn();

    await act(async () => {
      jest.advanceTimersByTime(20 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush(2);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(latestCtx?.user?.uid).toBe('user-1');
  });

  it('marks the app as locally unlocked after an interactive login', async () => {
    await mount();
    expect(isCurrentlyLocallyUnlocked()).toBe(false);

    await act(async () => {
      await latestCtx?.login('user@example.com', 'secret');
    });

    expect(mockLoginWithEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    });
    expect(isCurrentlyLocallyUnlocked()).toBe(true);
  });

  it('resets the local unlock memory on explicit logout', async () => {
    await mount();
    await signIn();
    await act(async () => {
      await latestCtx?.login('user@example.com', 'secret');
    });
    expect(isCurrentlyLocallyUnlocked()).toBe(true);

    await act(async () => {
      await latestCtx?.logout();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockClearLocalSessionData).toHaveBeenCalled();
    expect(isCurrentlyLocallyUnlocked()).toBe(false);
  });

  it('sends an unauthenticated user to a null session (no crash, no signOut)', async () => {
    await mount();

    await act(async () => {
      authStateCallback?.(null);
      await Promise.resolve();
    });
    await flush();

    expect(latestCtx?.user).toBeNull();
    expect(latestCtx?.loading).toBe(false);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
