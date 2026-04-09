export interface PaginatedResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  lastCursor?: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface FirestoreDoc {
  id: string;
  createdAt: import('firebase/firestore').Timestamp;
  updatedAt: import('firebase/firestore').Timestamp;
}
