import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

import {
  consumeBackgroundedAt,
  isCurrentlyLocallyUnlocked,
  markLocallyLocked,
  markLocallyUnlocked,
  recordBackgroundedAt,
} from '@/src/services/security/app-lock-state';

// Tiempo en segundo plano a partir del cual se exige un nuevo desbloqueo.
export const BACKGROUND_LOCK_DELAY_MS = 30_000;

export interface AppLockContextType {
  /** true = hay sesion de Firebase valida pero la interfaz esta bloqueada localmente. */
  isAppLocked: boolean;
  /** Llamado tras un desbloqueo local (biometria o codigo del dispositivo) exitoso. */
  unlock: () => void;
}

const AppLockContext = createContext<AppLockContextType | undefined>(undefined);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  // Platform.OS no cambia en un proceso real, pero se lee en cada render (en
  // vez de cachearla en una constante de modulo) para que el provider sea
  // determinista en pruebas que simulan distintas plataformas.
  const isMobile = Platform.OS !== 'web';
  // En web nunca hay bloqueo local: no se monta ningun listener de AppState
  // ni se muestra pantalla biometrica.
  const [isAppLocked, setIsAppLocked] = useState<boolean>(
    () => isMobile && !isCurrentlyLocallyUnlocked()
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isMobile) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        const backgroundedAt = consumeBackgroundedAt();
        if (backgroundedAt !== null && Date.now() - backgroundedAt >= BACKGROUND_LOCK_DELAY_MS) {
          markLocallyLocked();
          setIsAppLocked(true);
        }
      } else if (nextAppState.match(/inactive|background/)) {
        recordBackgroundedAt(Date.now());
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isMobile]);

  // Al desmontar (la sesion de Firebase termino: user paso a null y el layout
  // protegido desmonta este provider) se limpia la memoria de desbloqueo local
  // para que la proxima sesion en este mismo proceso vuelva a pedir biometria,
  // salvo que un login interactivo la marque como desbloqueada de nuevo.
  useEffect(() => {
    return () => {
      if (isMobile) markLocallyLocked();
    };
  }, [isMobile]);

  const unlock = (): void => {
    markLocallyUnlocked();
    setIsAppLocked(false);
  };

  return (
    <AppLockContext.Provider value={{ isAppLocked: isMobile && isAppLocked, unlock }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock(): AppLockContextType {
  const context = useContext(AppLockContext);
  if (context === undefined) {
    throw new Error('useAppLock debe usarse dentro de un AppLockProvider');
  }
  return context;
}
