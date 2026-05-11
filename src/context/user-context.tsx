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
import { getCongregationAccessState } from '@/src/services/congregations/congregations-service';
import { getCurrentUserProfile } from '@/src/services/users/users-service';
import { CongregationAccessState } from '@/src/types/congregation-access';
import { AppUser, UserRole } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';

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
  isSessionValid: boolean;
  loadingProfile: boolean;
  profileError: string | null;
  refreshProfile: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [congregationAccess, setCongregationAccess] =
    useState<CongregationAccessState | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceServerNextLoadRef = useRef(false);
  const loadedUidRef = useRef<string | null>(null);

  const refreshProfile = useCallback(() => {
    forceServerNextLoadRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      console.log('[UserContext] Sin usuario autenticado, limpiando perfil');
      loadedUidRef.current = null;
      setAppUser(null);
      setCongregationAccess(null);
      setProfileError(null);
      setLoadingProfile(false);
      return;
    }

    console.log('[UserContext] Iniciando carga de perfil para:', user.uid);
    const isDifferentUser = loadedUidRef.current !== user.uid;
    loadedUidRef.current = user.uid;

    setLoadingProfile(true);
    setProfileError(null);
    if (isDifferentUser) {
      setAppUser(null);
    }

    let cancelled = false;

    const loadProfile = async () => {
      const forceServer = forceServerNextLoadRef.current;
      forceServerNextLoadRef.current = false;

      try {
        const profile = await getCurrentUserProfile(user.uid, {
          forceServer,
        });

        if (cancelled) return;

        console.log('[UserContext] Perfil cargado:', profile ? 'existe' : 'null');
        loadedUidRef.current = user.uid;
        setAppUser(profile);
        setCongregationAccess(null);

        if (!profile) {
          const errorMsg = 'No se encontro el perfil del usuario autenticado.';
          console.warn('[UserContext]', errorMsg);
          setProfileError(errorMsg);
          setLoadingProfile(false);
          return;
        }

        if (!profile.isActive) {
          const errorMsg = 'Tu cuenta esta inactiva. Contacta a un administrador.';
          console.warn('[UserContext]', errorMsg);
          setProfileError(errorMsg);
          setCongregationAccess(null);
        } else if (!profile.congregationId) {
          const errorMsg = 'Tu cuenta no tiene congregacion asignada.';
          console.warn('[UserContext]', errorMsg);
          setProfileError(errorMsg);
          setCongregationAccess(null);
        } else {
          const accessState = await getCongregationAccessState(profile.congregationId);
          if (cancelled) return;

          setCongregationAccess(accessState);

          if (accessState.isBlocked) {
            console.warn('[UserContext]', accessState.message);
            setProfileError(accessState.message);
            return;
          }

          setProfileError(null);
        }
      } catch (error) {
        if (cancelled) return;
        const formattedError = formatFirestoreError(error);
        console.error('[UserContext] Error cargando perfil:', formattedError);
        if (isDifferentUser) {
          setAppUser(null);
          setCongregationAccess(null);
          loadedUidRef.current = null;
        }
        setProfileError(formattedError);
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
          console.log('[UserContext] loadingProfile cambiado a false');
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
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
      isSessionValid,
      loadingProfile,
      profileError,
      refreshProfile,
    };
  }, [appUser, congregationAccess, loadingProfile, profileError, refreshProfile, user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser debe usarse dentro de un UserProvider');
  }

  return context;
}
