import {
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  userDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  AppUser,
  CreateUserDTO,
  UpdateUserDTO,
  UserRole,
  UserStatus,
} from '@/src/types/user';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'admin' || value === 'supervisor' || value === 'user';

const isUserStatus = (value: unknown): value is UserStatus =>
  value === 'active' || value === 'inactive' || value === 'suspended';

const normalizeUser = (uid: string, data: Record<string, unknown>): AppUser => {
  const role = isUserRole(data.role) ? data.role : 'user';
  const isActive =
    typeof data.isActive === 'boolean'
      ? data.isActive
      : typeof data.active === 'boolean'
        ? data.active
      : data.status === 'active';
  const status = isUserStatus(data.status)
    ? data.status
    : isActive
      ? 'active'
      : 'inactive';

  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : typeof data.email === 'string' && data.email.trim().length > 0
          ? data.email
          : 'Usuario',
    role,
    congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
    isActive,
    status,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    department: typeof data.department === 'string' ? data.department : undefined,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
    createdAt: data.createdAt as AppUser['createdAt'],
    updatedAt: data.updatedAt as AppUser['updatedAt'],
  };
};

const sortUsers = (items: AppUser[]): AppUser[] => {
  return [...items].sort((a, b) => {
    const left = String(a.displayName || a.email || a.uid || '').toLowerCase();
    const right = String(b.displayName || b.email || b.uid || '').toLowerCase();
    return left.localeCompare(right, 'es');
  });
};

/** Obtiene un usuario por UID */
export const getUserById = async (uid: string): Promise<AppUser | null> => {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  return normalizeUser(snap.id, snap.data());
};

/** Obtiene todos los usuarios de una congregacion */
export const getAllUsers = async (congregationId: string): Promise<AppUser[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));
  const snap = await getDocs(q);
  return sortUsers(snap.docs.map((d) => normalizeUser(d.id, d.data())));
};

/** Obtiene usuarios activos de una congregacion */
export const getActiveUsers = async (congregationId: string): Promise<AppUser[]> => {
  const q = query(
    usersCollectionRef(),
    where('congregationId', '==', congregationId),
    where('isActive', '==', true),
    orderBy('displayName', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalizeUser(d.id, d.data()));
};

/** Crea o actualiza el perfil de usuario en Firestore */
export const createUserProfile = async (
  uid: string,
  data: Omit<CreateUserDTO, 'password'>
): Promise<void> => {
  const isActive = data.isActive ?? true;

  await setDoc(userDocRef(uid), {
    ...data,
    isActive,
    status: isActive ? 'active' : 'inactive',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/** Actualiza un usuario */
export const updateUser = async (
  uid: string,
  data: UpdateUserDTO
): Promise<void> => {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (typeof data.isActive === 'boolean' && !data.status) {
    payload.status = data.isActive ? 'active' : 'inactive';
  }

  if (data.status && typeof data.isActive !== 'boolean') {
    payload.isActive = data.status === 'active';
  }

  await updateDoc(userDocRef(uid), payload);
};

/** Elimina un usuario de Firestore (no de Auth) */
export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(userDocRef(uid));
};

/** Cuenta total de usuarios por congregacion */
export const getUsersCount = async (congregationId: string): Promise<number> => {
  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));
  const snap = await getDocs(q);
  return snap.size;
};

/** Suscripcion en tiempo real a usuarios por congregacion */
export const subscribeToUsers = (
  congregationId: string,
  callback: (users: AppUser[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar usuarios.'));
    return () => {};
  }

  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));

  return onSnapshot(
    q,
    (snap) => {
      const users = sortUsers(snap.docs.map((d) => normalizeUser(d.id, d.data())));
      callback(users);
    },
    (error) => {
      console.error('subscribeToUsers error:', error);
      onError?.(error);
    }
  );
};

/** Suscripcion en tiempo real a un usuario especifico */
export const subscribeToUser = (
  uid: string,
  callback: (user: AppUser | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      callback(snap.exists() ? normalizeUser(snap.id, snap.data()) : null);
    },
    onError
  );
};
