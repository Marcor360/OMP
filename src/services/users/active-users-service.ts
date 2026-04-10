import { getDocs, orderBy, query, where } from 'firebase/firestore';

import { usersCollectionRef } from '@/src/lib/firebase/refs';

export interface ActiveCongregationUser {
  uid: string;
  displayName: string;
  email?: string;
  role?: string;
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const computeDisplayName = (uid: string, data: Record<string, unknown>): string => {
  const displayName = normalizeText(data.displayName);
  if (displayName) return displayName;

  const firstName = normalizeText(data.firstName);
  const lastName = normalizeText(data.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName.length > 0) return fullName;

  const email = normalizeText(data.email);
  if (email) return email;

  return uid;
};

const isActiveUserRecord = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (typeof data.active === 'boolean') return data.active;
  if (data.status === 'active') return true;
  if (data.status === 'inactive' || data.status === 'suspended') return false;

  // Legacy fallback: if status fields are absent, treat record as active.
  return true;
};

const toActiveUser = (uid: string, data: Record<string, unknown>): ActiveCongregationUser => ({
  uid,
  displayName: computeDisplayName(uid, data),
  email: normalizeText(data.email),
  role: normalizeText(data.role),
});

const sortByDisplayName = (items: ActiveCongregationUser[]): ActiveCongregationUser[] =>
  [...items].sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'));

export const getActiveCongregationUsers = async (
  congregationId: string
): Promise<ActiveCongregationUser[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const usersRef = usersCollectionRef();

  const queryWithOrder = query(
    usersRef,
    where('congregationId', '==', congregationId),
    orderBy('displayName', 'asc')
  );

  try {
    const orderedSnapshot = await getDocs(queryWithOrder);

    return orderedSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
      .filter((entry) => isActiveUserRecord(entry.data))
      .map((entry) => toActiveUser(entry.id, entry.data));
  } catch {
    const fallbackSnapshot = await getDocs(query(usersRef, where('congregationId', '==', congregationId)));

    return sortByDisplayName(
      fallbackSnapshot.docs
        .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
        .filter((entry) => isActiveUserRecord(entry.data))
        .map((entry) => toActiveUser(entry.id, entry.data))
    );
  }
};
