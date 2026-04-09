import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/src/config/firebase/firebase';
import { loginWithEmail, logout } from '@/src/services/auth-service';
import { AuthContextType } from '@/src/types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tiempo de inactividad antes de cerrar sesión automáticamente (15 minutos en ms)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

// Eventos de actividad del usuario que reinician el timer (solo web)
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
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Referencia a usuario para poder accederla desde event listeners sin closures stale
  const userRef = useRef<User | null>(null);

  // Mantener userRef sincronizado con el state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Reiniciar el timer de inactividad
  const resetInactivityTimer = () => {
    if (!userRef.current) return;

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(async () => {
      // Cerrar sesión por inactividad
      await logout();
    }, INACTIVITY_TIMEOUT);
  };

  // Limpiar el timer
  const clearInactivityTimer = () => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
  };

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      userRef.current = firebaseUser;
      setLoading(false);

      if (firebaseUser) {
        resetInactivityTimer();
      } else {
        clearInactivityTimer();
      }
    });

    return unsubscribe;
  }, []);

  // Web: registrar eventos de actividad del usuario automáticamente
  // El timer corre incluso si la pestaña está oculta (dejar pestaña abierta cuenta como inactividad)
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleActivity = () => {
      if (userRef.current) resetInactivityTimer();
    };

    // Agregar listeners de actividad
    WEB_ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Page Visibility API: si el usuario regresa a la pestaña, reiniciar timer
    // Si la pestaña lleva oculta más de INACTIVITY_TIMEOUT → logout automático ya ocurrió
    const handleVisibilityChange = () => {
      if (!document.hidden && userRef.current) {
        // El usuario regresó a la pestaña → se considera actividad
        resetInactivityTimer();
      }
      // Si la pestaña se oculta, el timer SIGUE corriendo (no lo limpiamos)
      // Esto asegura que si dejan la pestaña abierta y no regresan, se cierra sesión
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      WEB_ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Solo se monta una vez; usa userRef para evitar closures stale

  // Móvil: manejar cambios de estado de la app (background/foreground)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App volvió al frente → reiniciar timer
        if (userRef.current) resetInactivityTimer();
      } else if (nextAppState.match(/inactive|background/)) {
        // App fue al background → el timer sigue corriendo
        // (si llevan más de 15 min en background, se cierra sesión al volver)
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Reiniciar timer manualmente desde pantallas (útil para móvil)
  const onUserActivity = () => {
    if (userRef.current) resetInactivityTimer();
  };

  const login = async (email: string, password: string) => {
    await loginWithEmail({ email, password });
  };

  const handleLogout = async () => {
    clearInactivityTimer();
    await logout();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout: handleLogout, onUserActivity }}>
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
