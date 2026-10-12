import { createContext, useContext } from 'react';
import type { UserSession } from '../api/client';

export interface AuthContextType {
  user: UserSession | null;
  /** true only while there is no cached profile and the first /me check is still running */
  isLoading: boolean;
  setUser: (user: UserSession | null) => void;
  /** Signs out of this device (clears the cookie). */
  logout: () => Promise<void>;
  /** Signs out of EVERY device by revoking all issued sessions. */
  logoutEverywhere: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
