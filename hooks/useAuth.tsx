'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, UserProfile, getToken, removeToken, setToken } from '@/lib/api-client';
import { authenticateWithSIWE } from '@/lib/siwe';

interface AuthContextType {
  user: UserProfile | null;
  roles: string[];
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithSIWE: (address: string, chainId: number, signMessageAsync: (args: { message: string }) => Promise<string>) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string, fullName: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await api.getMe();
      setUser(profile);
      setRoles(profile.roles || []);
      setPermissions(profile.permissions || []);
    } catch (err: any) {
      console.warn('Failed to fetch user profile, clearing stale token:', err);
      removeToken();
      setUser(null);
      setRoles([]);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithSIWE = async (
    address: string,
    chainId: number,
    signMessageAsync: (args: { message: string }) => Promise<string>
  ) => {
    setError(null);
    setIsLoading(true);
    try {
      const authRes = await authenticateWithSIWE({ address, chainId, signMessageAsync });
      setRoles(authRes.roles || []);
      setPermissions(authRes.permissions || []);
      await refreshUser();
    } catch (err: any) {
      const msg = err.message || 'SIWE authentication failed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      if (res.access_token) {
        setToken(res.access_token);
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        await refreshUser();
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const registerWithPassword = async (email: string, password: string, fullName: string, role?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await api.register({ email, password, full_name: fullName, role });
      if (res.access_token) {
        setToken(res.access_token);
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        await refreshUser();
      }
    } catch (err: any) {
      const msg = err.message || 'Registration failed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } catch (err) {
      console.warn('Logout API failed or token already invalid:', err);
    } finally {
      removeToken();
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    roles,
    permissions,
    isAuthenticated: !!user || roles.length > 0,
    isLoading,
    error,
    loginWithSIWE,
    loginWithPassword,
    registerWithPassword,
    logout,
    refreshUser,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
