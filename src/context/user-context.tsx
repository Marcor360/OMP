import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/src/context/auth-context';
import { subscribeToUser } from '@/src/services/users/users-service';
import { AppUser, UserRole } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';

interface UserContextType {
  appUser: AppUser | null;
  uid: string | null;
  email: string | null;
  role: UserRole | undefined;
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

  const refreshProfile = useCallback(() => {
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

    const unsubscribe = subscribeToUser(
      user.uid,
      (profile) => {
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

        setLoadingProfile(false);
      },
      (error) => {
        setAppUser(null);
        setProfileError(formatFirestoreError(error));
        setLoadingProfile(false);
      }
    );

    return unsubscribe;
  }, [user, refreshKey]);

  const value = useMemo<UserContextType>(() => {
    const uid = user?.uid ?? null;
    const email = appUser?.email ?? user?.email ?? null;
    const role = appUser?.role;
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