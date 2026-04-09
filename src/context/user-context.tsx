import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { subscribeToUser, createUserProfile } from '@/src/services/users/users-service';
import { useAuth } from '@/src/context/auth-context';
import { AppUser, UserRole } from '@/src/types/user';

interface UserContextType {
  appUser: AppUser | null;
  role: UserRole | undefined;
  loadingProfile: boolean;
  refreshProfile: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshProfile = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setAppUser(null);
      setLoadingProfile(false);
      return;
    }

    setLoadingProfile(true);

    // Suscripción en tiempo real al perfil del usuario
    const unsub = subscribeToUser(user.uid, async (profile) => {
      if (!profile) {
        // Si no existe el perfil en Firestore, crear uno básico
        await createUserProfile(user.uid, {
          email: user.email ?? '',
          displayName: user.displayName ?? user.email ?? 'Usuario',
          role: 'user',
        });
      } else {
        setAppUser(profile);
      }
      setLoadingProfile(false);
    });

    return unsub;
  }, [user, refreshKey]);

  return (
    <UserContext.Provider
      value={{
        appUser,
        role: appUser?.role,
        loadingProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser debe usarse dentro de un UserProvider');
  }
  return ctx;
}
