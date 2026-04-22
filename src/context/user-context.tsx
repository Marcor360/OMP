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
import { getCurrentUserProfile } from '@/src/services/users/users-service';
import { AppUser, UserRole } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';

interface UserContextType {
  appUser: AppUser | null;
  uid: string | null;
  email: string | null;
  role: UserRole | undefined;
  servicePosition: string | undefined;
  isActive: boolean;
  congregationId: string | null;
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
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceServerNextLoadRef = useRef(false);

  const refreshProfile = useCallback(() => {
    forceServerNextLoadRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setAppUser(null);
      setProfileError(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);
    setAppUser(null);

    let cancelled = false;

    const loadProfile = async () => {
      const forceServer = forceServerNextLoadRef.current;
      forceServerNextLoadRef.current = false;

      try {
        const profile = await getCurrentUserProfile(user.uid, {
          forceServer,
        });

        if (cancelled) return;

        setAppUser(profile);

        if (!profile) {
          setProfileError('No se encontro el perfil del usuario autenticado.');
          setLoadingProfile(false);
          return;
        }

        if (!profile.isActive) {
          setProfileError('Tu cuenta esta inactiva. Contacta a un administrador.');
        } else {
          setProfileError(null);
        }
      } catch (error) {
        if (cancelled) return;
        setAppUser(null);
        setProfileError(formatFirestoreError(error));
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
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
    const isActive = appUser?.isActive ?? false;
    const congregationId = appUser?.congregationId ?? null;

    const isAdmin = role === 'admin';
    const isSupervisor = role === 'supervisor';
    const isAdminOrSupervisor = isAdmin || isSupervisor;

    const isSessionValid = Boolean(uid && appUser && isActive && congregationId);

    return {
      appUser,
      uid,
      email,
      role,
      servicePosition,
      isActive,
      congregationId,
      isAdmin,
      isSupervisor,
      isAdminOrSupervisor,
      isSessionValid,
      loadingProfile,
      profileError,
      refreshProfile,
    };
  }, [appUser, loadingProfile, profileError, refreshProfile, user]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error('useUser debe usarse dentro de un UserProvider');
  }

  return context;
}
