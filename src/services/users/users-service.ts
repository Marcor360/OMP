import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/config/firebase/firebase';
import {
  AppUser,
  CreateUserDTO,
  UpdateUserDTO,
  UserStatus,
} from '@/src/types/user';

const COLLECTION = 'users';
const col = () => collection(db, COLLECTION);

/** Obtiene un usuario por UID */
export const getUserById = async (uid: string): Promise<AppUser | null> => {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as AppUser;
};

/** Obtiene todos los usuarios */
export const getAllUsers = async (): Promise<AppUser[]> => {
  const q = query(col(), orderBy('displayName', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
};

/** Obtiene usuarios activos */
export const getActiveUsers = async (): Promise<AppUser[]> => {
  const q = query(
    col(),
    where('status', '==', 'active'),
    orderBy('displayName', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser));
};

/** Crea un perfil de usuario en Firestore (sin crear cuenta Auth) */
export const createUserProfile = async (
  uid: string,
  data: Omit<CreateUserDTO, 'password'>
): Promise<void> => {
  await setDoc(doc(db, COLLECTION, uid), {
    ...data,
    status: 'active' as UserStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/** Actualiza un usuario */
export const updateUser = async (
  uid: string,
  data: UpdateUserDTO
): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/** Elimina un usuario de Firestore (no de Auth) */
export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, uid));
};

/** Cuenta total de usuarios */
export const getUsersCount = async (): Promise<number> => {
  const snap = await getDocs(col());
  return snap.size;
};

/** Suscripción en tiempo real a todos los usuarios */
export const subscribeToUsers = (
  callback: (users: AppUser[]) => void
): Unsubscribe => {
  const q = query(col(), orderBy('displayName', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as AppUser)));
  });
};

/** Suscripción en tiempo real a un usuario específico */
export const subscribeToUser = (
  uid: string,
  callback: (user: AppUser | null) => void
): Unsubscribe => {
  return onSnapshot(doc(db, COLLECTION, uid), (snap) => {
    callback(snap.exists() ? ({ uid: snap.id, ...snap.data() } as AppUser) : null);
  });
};
