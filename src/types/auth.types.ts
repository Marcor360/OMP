import { User } from 'firebase/auth';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  onUserActivity: () => void;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginValidationErrors {
  email?: string;
  password?: string;
}
