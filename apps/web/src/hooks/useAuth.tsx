import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserSession } from '../api/client';

interface AuthContextType {
    user: UserSession | null;
    setUser: (user: UserSession | null) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserSession | null>(() => {
        const cached = localStorage.getItem('visualstack_session');
        return cached ? JSON.parse(cached) : null;
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem('visualstack_session', JSON.stringify(user));
        } else {
            localStorage.removeItem('visualstack_session');
        }
    }, [user]);

    const logout = () => {
        setUser(null);
        localStorage.removeItem('visualstack_session');
    };

    return (
        <AuthContext.Provider value={{ user, setUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};
