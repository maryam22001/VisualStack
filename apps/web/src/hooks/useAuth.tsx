import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, UNAUTHORIZED_EVENT, apiLogout, apiMe, type UserSession } from '../api/client';

/**
 * Session model
 *  - The real credential is the HTTP-only `token` cookie set by the API. JavaScript can't read it.
 *  - localStorage holds only a NON-sensitive profile cache (name, email, workspace) so the
 *    studio can paint instantly on refresh. It is re-validated against GET /api/auth/me on load.
 *  - If the cookie is gone/expired the server answers 401 and the cache is cleared.
 */
const SESSION_KEY = 'visualstack_session';

interface AuthContextType {
    user: UserSession | null;
    /** true only while there is no cached profile and the first /me check is still running */
    isLoading: boolean;
    setUser: (user: UserSession | null) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

    return <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};
