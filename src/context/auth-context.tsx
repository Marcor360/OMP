import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { auth } from '@/src/config/firebase/firebase';
import { loginWithEmail, logout } from '@/src/services/auth-service';
import { clearLocalSessionData } from '@/src/services/session/session-cleanup';
import { AuthContextType } from '@/src/types/auth.types';
import { createLogger } from '@/src/utils/logger';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const authLogger = createLogger('AuthProvider');

// Tiempo real de inactividad antes de cerrar sesión (única fuente de verdad).
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// Ventana de aviso previo al cierre por inactividad (vive dentro de INACTIVITY_TIMEOUT_MS).
const INACTIVITY_WARNING_MS = 60 * 1000;
// Clave de persistencia del último momento de actividad (wall clock, ms epoch).
const LAST_ACTIVITY_STORAGE_KEY = 'omp:session:last-activity-at';
// Throttle de escritura a AsyncStorage (no escribir en cada mousemove).
const ACTIVITY_PERSIST_THROTTLE_MS = 30 * 1000;
// Tick de verificación mientras la app está viva en primer plano.
const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000;

// Eventos de actividad del usuario que actualizan la marca (solo web)
const WEB_ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
] as const;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Referencia a usuario para poder accederla desde event listeners sin closures stale
  const userRef = useRef<User | null>(null);
  const lastActivityRef = useRef<number>(0);
  const lastPersistedRef = useRef<number>(0);
  const expiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mantener userRef sincronizado con el state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const clearExpiryInterval = () => {
    if (expiryIntervalRef.current) {
      clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }
  };

  const clearWarningTick = () => {
    if (warningTickRef.current) {
      clearInterval(warningTickRef.current);
      warningTickRef.current = null;
    }
  };

  const dismissInactivityWarning = () => {
    clearWarningTick();
    setShowInactivityWarning(false);
  };

  // Arranca (si no está corriendo) un tick de 1s que recalcula el tiempo restante
  // a partir de lastActivityRef (misma fuente de verdad que checkExpiry, sin
  // temporizador aislado). El resync con AsyncStorage lo sigue haciendo el tick
  // regular de 60s y los checkExpiry disparados por resume/visibilitychange.
  const beginInactivityWarning = (remainingMs: number) => {
    setShowInactivityWarning(true);
    setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));

    if (warningTickRef.current) return;

    warningTickRef.current = setInterval(() => {
      const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityRef.current);

      if (remaining <= 0) {
        clearWarningTick();
        void checkExpiry('warning-tick');
        return;
      }

      setSecondsLeft(Math.ceil(remaining / 1000));
    }, 1000);
  };

  const persistLastActivity = async (at: number, force = false) => {
    if (!force && at - lastPersistedRef.current < ACTIVITY_PERSIST_THROTTLE_MS) return;
    lastPersistedRef.current = at;
    try {
      await AsyncStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at));
    } catch (error) {
      authLogger.warn('No se pudo persistir last-activity', error);
    }
  };

  const touchActivity = (force = false) => {
    if (!userRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    void persistLastActivity(now, force);
  };

  const readPersistedLastActivity = async (): Promise<number | null> => {
    try {
      const raw = await AsyncStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  };

  const clearPersistedLastActivity = async () => {
    try {
      await AsyncStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    } catch {
      // noop
    }
  };

  const forceLogoutByInactivity = async () => {
    authLogger.info('Sesión cerrada por inactividad (wall-clock)');
    clearExpiryInterval();
    clearWarningTick();
    setShowInactivityWarning(false);
    await clearPersistedLastActivity();
    await clearLocalSessionData();
    await logout();
  };

  // Verifica expiración leyendo la mayor marca conocida (memoria vs storage).
  // Leer storage cubre multi-pestaña en web: actividad en la pestaña A cuenta para la B.
  const checkExpiry = async (source: string): Promise<boolean> => {
    if (!userRef.current) return false;
    const persisted = await readPersistedLastActivity();
    const last = Math.max(lastActivityRef.current, persisted ?? 0);
    if (last === 0) {
      touchActivity(true);
      return false;
    }
    const elapsed = Date.now() - last;
    const remaining = INACTIVITY_TIMEOUT_MS - elapsed;

    if (remaining <= 0) {
      authLogger.info(`Inactividad detectada (${source}): ${Math.round(elapsed / 1000)}s`);
      await forceLogoutByInactivity();
      return true;
    }

    if (remaining <= INACTIVITY_WARNING_MS) {
      beginInactivityWarning(remaining);
    } else {
      dismissInactivityWarning();
    }

    return false;
  };

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    authLogger.debug('Iniciando onAuthStateChanged listener');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authLogger.debug('onAuthStateChanged fired', firebaseUser?.uid ?? 'null');

      userRef.current = firebaseUser;
      setAuthError(null);

      if (firebaseUser) {
        authLogger.info('Usuario autenticado', firebaseUser.uid);
        const expired = await checkExpiry('auth-restore');
        if (expired) return;
        touchActivity(true);
        dismissInactivityWarning();
        clearExpiryInterval();
        expiryIntervalRef.current = setInterval(() => {
          void checkExpiry('tick');
        }, EXPIRY_CHECK_INTERVAL_MS);
      } else {
        authLogger.info('Sin sesion activa');
        clearExpiryInterval();
        dismissInactivityWarning();
        lastActivityRef.current = 0;
        lastPersistedRef.current = 0;
        void clearPersistedLastActivity();
        void clearLocalSessionData();
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return () => {
      authLogger.debug('Limpiando onAuthStateChanged listener');
      clearExpiryInterval();
      clearWarningTick();
      unsubscribe();
    };
  }, []);

  // Web: persistir actividad y comprobar el tiempo real transcurrido al volver a la pestaña.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleActivity = () => {
      touchActivity();
    };

    WEB_ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Al volver, comprobar expiración antes de registrar actividad.
    const handleVisibilityChange = () => {
      if (!document.hidden && userRef.current) {
        void checkExpiry('web-visible').then((expired) => {
          if (!expired) {
            touchActivity();
            dismissInactivityWarning();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      WEB_ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Solo se monta una vez; usa userRef para evitar closures stale

  // Móvil: manejar cambios de estado con el tiempo wall-clock persistido.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Comprobar expiración antes de considerar el regreso como actividad.
        const expired = await checkExpiry('app-resume');
        if (!expired) {
          touchActivity();
          dismissInactivityWarning();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // Forzar la marca en disco antes de que el runtime quede suspendido.
        void persistLastActivity(Date.now(), true);
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Registrar actividad manualmente desde pantallas (útil para móvil).
  const onUserActivity = () => {
    touchActivity();
  };

  // "Seguir conectado": renueva la actividad y oculta el aviso de inactividad.
  const extendSession = () => {
    touchActivity(true);
    dismissInactivityWarning();
  };

  const login = async (email: string, password: string) => {
    await clearLocalSessionData();
    await loginWithEmail({ email, password });
    touchActivity(true);
  };

  const handleLogout = async () => {
    clearExpiryInterval();
    clearWarningTick();
    setShowInactivityWarning(false);
    void clearPersistedLastActivity();
    await clearLocalSessionData();
    await logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        login,
        logout: handleLogout,
        onUserActivity,
        showInactivityWarning,
        secondsLeft,
        extendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
