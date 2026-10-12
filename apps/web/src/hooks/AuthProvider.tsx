import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, UNAUTHORIZED_EVENT, apiLogout, apiLogoutAll, apiMe, type UserSession } from '../api/client';
import { AuthContext } from './useAuth';

/**
 * Session model
 *  - The real credential is the HTTP-only `token` cookie set by the API. JavaScript can't read it.
 *  - localStorage holds only a NON-sensitive profile cache (name, email, workspace) so the
 *    studio can paint instantly on refresh. It is re-validated against GET /api/auth/me on load.
 *  - If the cookie is gone, expired or revoked the server answers 401 and the cache is cleared.
 */
const SESSION_KEY = 'visualstack_session';

function readCache(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(readCache);
  const [isLoading, setIsLoading] = useState<boolean>(() => readCache() === null);

  // Mirror the user into the cache.
  useEffect(() => {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  // Re-validate the session with the server on every page load.
  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then(({ user: fresh }) => {
        if (!cancelled) setUser(fresh);
      })
      .catch((err) => {
        // Only a definite 401 signs the user out; a network blip keeps the cached session.
        if (!cancelled && err instanceof ApiError && err.status === 401) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any protected API call that returns 401 drops the user back to the sign-in screen.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout(); // clears the cookie server-side
    } catch {
      /* even if the request fails, sign out locally */
    }
    setUser(null);
  }, []);

  const logoutEverywhere = useCallback(async () => {
    try {
      await apiLogoutAll(); // bumps tokenVersion: every device's session stops working
    } catch {
      /* fall through: at least sign out here */
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout, logoutEverywhere }}>
      {children}
    </AuthContext.Provider>
  );
};
