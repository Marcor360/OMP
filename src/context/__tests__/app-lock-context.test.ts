import React from 'react';
import { act, create } from 'react-test-renderer';

type AppStateHandler = (state: string) => void;

// No se hace spread de `actual`: react-native expone muchos exports via
// getters perezosos (DevMenu, ProgressBarAndroid, etc.) que no existen en este
// entorno de pruebas y que un `{...actual}` fuerza a evaluar de inmediato.
// Solo se sobreescribe AppState en el modulo real. Todo el estado mutable del
// mock vive DENTRO del closure del factory: los `import` de react-native se
// elevan (hoisting de ESM/CJS) por encima de cualquier `const` de este archivo,
// asi que una referencia externa a un jest.fn() declarado fuera del factory
// podria seguir siendo `undefined` cuando react-native-css-interop dispara su
// propio addEventListener durante la carga del modulo.
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  const listeners = new Set<AppStateHandler>();
  const addEventListener = jest.fn((_event: string, handler: AppStateHandler) => {
    listeners.add(handler);
    return { remove: () => listeners.delete(handler) };
  });

  Object.defineProperty(actual, 'AppState', {
    configurable: true,
    value: {
      currentState: 'active',
      addEventListener,
      removeEventListener: jest.fn(),
      __emit: (state: string) => listeners.forEach((handler) => handler(state)),
    },
  });

  return actual;
});

// Import after the mock so app-lock-context picks up the mocked AppState/Platform.
import { AppState, Platform } from 'react-native';
import { AppLockProvider, BACKGROUND_LOCK_DELAY_MS, useAppLock } from '@/src/context/app-lock-context';
import {
  __resetAppLockStateForTests,
  isCurrentlyLocallyUnlocked,
} from '@/src/services/security/app-lock-state';

const mockedAppState = AppState as unknown as {
  addEventListener: jest.Mock;
  __emit: (state: string) => void;
};

type LockSnapshot = ReturnType<typeof useAppLock>;
let latestCtx: LockSnapshot | null = null;

function Harness() {
  latestCtx = useAppLock();
  return null;
}

// Cada mount() suscribe un listener nuevo en el AppState mockeado. Sin
// desmontar entre pruebas, los listeners de pruebas anteriores se acumulan y
// reciben los eventos emitidos por __emit() junto con el de la prueba actual.
let activeRenderer: ReturnType<typeof create> | null = null;

const mount = (): ReturnType<typeof create> => {
  act(() => {
    activeRenderer = create(React.createElement(AppLockProvider, null, React.createElement(Harness)));
  });
  return activeRenderer!;
};

const unmountActive = () => {
  if (!activeRenderer) return;
  act(() => {
    activeRenderer!.unmount();
  });
  activeRenderer = null;
};

describe('AppLockProvider (web)', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetAppLockStateForTests();
    latestCtx = null;
    Platform.OS = 'web';
  });

  afterEach(() => {
    unmountActive();
    Platform.OS = originalPlatformOS;
  });

  it('never locks and never subscribes to AppState on web', () => {
    mount();

    expect(latestCtx?.isAppLocked).toBe(false);
    expect(mockedAppState.addEventListener).not.toHaveBeenCalled();
  });

  it('unlock() is a harmless no-op on web', () => {
    mount();

    act(() => {
      latestCtx?.unlock();
    });

    expect(latestCtx?.isAppLocked).toBe(false);
  });
});

describe('AppLockProvider (mobile)', () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    __resetAppLockStateForTests();
    latestCtx = null;
    Platform.OS = 'ios';
  });

  afterEach(() => {
    unmountActive();
    Platform.OS = originalPlatformOS;
    jest.useRealTimers();
  });

  it('locks on a cold start with an existing session', () => {
    mount();

    expect(latestCtx?.isAppLocked).toBe(true);
    expect(mockedAppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('unlocks after a successful local authentication', () => {
    mount();
    expect(latestCtx?.isAppLocked).toBe(true);

    act(() => {
      latestCtx?.unlock();
    });

    expect(latestCtx?.isAppLocked).toBe(false);
    expect(isCurrentlyLocallyUnlocked()).toBe(true);
  });

  it('does not re-lock when returning from background within the grace period', () => {
    mount();
    act(() => {
      latestCtx?.unlock();
    });
    expect(latestCtx?.isAppLocked).toBe(false);

    act(() => {
      mockedAppState.__emit('background');
      jest.advanceTimersByTime(BACKGROUND_LOCK_DELAY_MS - 5000);
      mockedAppState.__emit('active');
    });

    expect(latestCtx?.isAppLocked).toBe(false);
  });

  it('re-locks when returning from background after the grace period', () => {
    mount();
    act(() => {
      latestCtx?.unlock();
    });
    expect(latestCtx?.isAppLocked).toBe(false);

    act(() => {
      mockedAppState.__emit('background');
      jest.advanceTimersByTime(BACKGROUND_LOCK_DELAY_MS + 5000);
      mockedAppState.__emit('active');
    });

    expect(latestCtx?.isAppLocked).toBe(true);
    expect(isCurrentlyLocallyUnlocked()).toBe(false);
  });

  it('resets the local unlock memory when the provider unmounts (session ended)', () => {
    mount();
    act(() => {
      latestCtx?.unlock();
    });
    expect(isCurrentlyLocallyUnlocked()).toBe(true);

    unmountActive();

    expect(isCurrentlyLocallyUnlocked()).toBe(false);
  });
});
