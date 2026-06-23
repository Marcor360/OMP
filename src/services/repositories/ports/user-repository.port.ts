import type { Unsubscribe } from 'firebase/firestore';

import type { AppUser } from '@/src/types/user';

export type { Unsubscribe };

export interface UserRepository {
  getById(
    uid: string,
    options?: { forceServer?: boolean; maxAgeMs?: number }
  ): Promise<AppUser | null>;
  getAllByCongregation(
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<AppUser[]>;
  getActiveByCongregation(congregationId: string): Promise<AppUser[]>;
  create(uid: string, payload: Record<string, unknown>): Promise<void>;
  update(uid: string, payload: Record<string, unknown>): Promise<void>;
  delete(uid: string): Promise<void>;
  count(congregationId: string): Promise<number>;
  subscribeToUser(
    uid: string,
    callback: (user: AppUser | null) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
}
