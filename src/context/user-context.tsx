import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/src/context/auth-context';
import { useCongregationCacheBoundary } from '@/src/hooks/use-congregation-cache-boundary';
import { getCongregationAccessState } from '@/src/services/congregations/congregations-service';
import { getCurrentUserProfile, subscribeToUser } from '@/src/services/users/users-service';
import { CongregationAccessState } from '@/src/types/congregation-access';
import { AppUser, UserRole } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { createLogger } from '@/src/utils/logger';

// Motivo estructurado detras de profileError, para que la UI (InvalidSessionScreen)
// no tenga que adivinar la causa a partir de un mensaje humano.
export type ProfileErrorKind = 'not-found' | 'inactive' | 'no-congregation' | 'error' | null;

interface UserContextType {
  appUser: AppUser | null;
  uid: string | null;
  email: string | null;
  role: UserRole | undefined;
  servicePosition: string | undefined;
  serviceDepartment: string | undefined;
  serviceAssignments: AppUser['serviceAssignments'];
  isActive: boolean;
  congregationId: string | null;
  congregationAccess: CongregationAccessState | null;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAdminOrSupervisor: boolean;
  isElder: boolean;
  isSessionValid: boolean;
  loadingProfile: boolean;
  profileError: string | null;
  profileErrorKind: ProfileErrorKind;
  refreshProfile: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);
const userLogger = createLogger('UserContext');
const PROFILE_LOAD_RETRY_DELAYS_MS = [0, 600, 1500] as const;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [congregationAccess, setCongregationAccess] =
    useState<CongregationAccessState | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileErrorKind, setProfileErrorKind] = useState<ProfileErrorKind>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceServerNextLoadRef = useRef(false);
  const loadedUidRef = useRef<string | null>(null);
  useCongregationCacheBoundary(appUser?.congregationId ?? null);

  const refreshProfile = useCallback(() => {
    forceServerNextLoadRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      userLogger.debug('Sin usuario autenticado, limpiando perfil');
      loadedUidRef.current = null;
      setAppUser(null);
      setCongregationAccess(null);
      setProfileError(null);
      setProfileErrorKind(null);
      setLoadingProfile(false);
      return;
    }

    userLogger.debug('Iniciando carga de perfil', user.uid);
    const isDifferentUser = loadedUidRef.current !== user.uid;
    loadedUidRef.current = user.uid;

    setLoadingProfile(true);
    setProfileError(null);
    setProfileErrorKind(null);
    if (isDifferentUser) {
      setAppUser(null);
    }

    let cancelled = false;

    const isCurrentUser = () => !cancelled && loadedUidRef.current === user.uid;

    const applyProfile = async (profile: AppUser | null): Promise<void> => {
      // Bootstrap y listener son asincronos: una respuesta de una sesion
      // anterior no puede sobrescribir el perfil del UID actual.
      if (!isCurrentUser()) return;

      setAppUser(profile);
      setCongregationAccess(null);

      if (!profile) {
        const errorMsg = 'No se encontro el perfil del usuario autenticado.';
        userLogger.warn(errorMsg);
        setProfileError(errorMsg);
        setProfileErrorKind('not-found');
        return;
      }
      if (!profile.isActive) {
        const errorMsg = 'Tu cuenta esta inactiva. Contacta a un administrador.';
        userLogger.warn(errorMsg);
        setProfileError(errorMsg);
        setProfileErrorKind('inactive');
        return;
      }
      if (!profile.congregationId) {
        const errorMsg = 'Tu cuenta no tiene congregacion asignada.';
        userLogger.warn(errorMsg);
        setProfileError(errorMsg);
        setProfileErrorKind('no-congregation');
        return;
      }

      const accessState = await getCongregationAccessState(profile.congregationId);
      if (!isCurrentUser()) return;
      setCongregationAccess(accessState);
      if (accessState.isBlocked) {
        userLogger.warn(accessState.message);
        setProfileError(accessState.message);
        setProfileErrorKind(null);
        return;
      }
      setProfileError(null);
      setProfileErrorKind(null);
    };

    let unsubscribeProfile: (() => void) | null = null;

    const loadProfile = async () => {
      forceServerNextLoadRef.current = false;

      try {
        let profile: AppUser | null = null;
        let lastError: unknown = null;

        for (const delayMs of PROFILE_LOAD_RETRY_DELAYS_MS) {
          if (cancelled) return;
          if (delayMs > 0) {
            await wait(delayMs);
          }

          try {
            profile = await getCurrentUserProfile(user.uid, {
              forceServer: true,
            });
            lastError = null;
          } catch (error) {
            lastError = error;
            profile = null;
          }

          if (profile) {
            break;
          }
        }

        if (!profile && lastError) {
          throw lastError;
        }

        if (!isCurrentUser()) return;

        userLogger.debug('Perfil cargado', profile ? 'existe' : 'null');
        await applyProfile(profile);
        if (!profile || !isCurrentUser()) return;

        // El repositorio conserva la propiedad del listener Firestore. Este
        // effect siempre lo desmonta antes de montar otro UID/refresco.
        unsubscribeProfile = subscribeToUser(
          user.uid,
          (nextProfile) => { void applyProfile(nextProfile); },
          (error) => {
            // Un fallo temporal no invalida un perfil que ya era valido.
            if (isCurrentUser()) userLogger.warn('Error temporal escuchando el perfil actual', error);
          }
        );
      } catch (error) {
        if (cancelled) return;
        const formattedError = formatFirestoreError(error);
        userLogger.error('Error cargando perfil', formattedError);
        if (isDifferentUser) {
          setAppUser(null);
          setCongregationAccess(null);
          loadedUidRef.current = null;
        }
        setProfileError(formattedError);
        setProfileErrorKind('error');
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          userLogger.debug('loadingProfile cambiado a false');
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
      unsubscribeProfile?.();
    };
  }, [user, refreshKey]);

  const value = useMemo<UserContextType>(() => {
    const uid = user?.uid ?? null;
    const email = appUser?.email ?? user?.email ?? null;
    const role = appUser?.role;
    const servicePosition = appUser?.servicePosition;
    const serviceDepartment = appUser?.serviceDepartment;
    const serviceAssignments = appUser?.serviceAssignments;
    const isActive = appUser?.isActive ?? false;
    const congregationId = appUser?.congregationId ?? null;
    const congregationBlocked = congregationAccess?.isBlocked === true;

    const isAdmin = role === 'admin';
    const isSupervisor = role === 'supervisor';
    const isAdminOrSupervisor = isAdmin || isSupervisor;
    const isElder =
      appUser?.privileges?.isElder === true || appUser?.isElder === true;

    const isSessionValid = Boolean(
      uid && appUser && isActive && congregationId && !congregationBlocked
    );

    return {
      appUser,
      uid,
      email,
      role,
      servicePosition,
      serviceDepartment,
      serviceAssignments,
      isActive,
      congregationId,
      congregationAccess,
      isAdmin,
      isSupervisor,
      isAdminOrSupervisor,
      isElder,
      isSessionValid,
      loadingProfile,
      profileError,
      profileErrorKind,
      refreshProfile,
    };
  }, [
    appUser,
    congregationAccess,
    loadingProfile,
    profileError,
    profileErrorKind,
    refreshProfile,
    user,
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser debe usarse dentro de un UserProvider');
  }

  return context;
}
