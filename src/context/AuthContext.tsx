// src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCookie, setCookie, removeCookie, verifyAccessToken } from '@/lib/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin';
  avatar?: string;
  phone?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, userData: User) => void;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggingIn) {
      checkAuth();
    }
  }, [pathname, isLoggingIn]);

  const checkAuth = useCallback(async () => {
    try {
      const token = getCookie('accessToken');
      
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // ✅ VALIDATE TOKEN FORMAT
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.warn('Invalid token format, clearing...');
        setUser(null);
        removeCookie('accessToken');
        removeCookie('refreshToken');
        localStorage.removeItem('user');
        setIsLoading(false);
        return;
      }

      const decoded = verifyAccessToken(token);
      
      if (!decoded) {
        console.warn('Token expired or invalid, clearing...');
        setUser(null);
        removeCookie('accessToken');
        removeCookie('refreshToken');
        localStorage.removeItem('user');
        setIsLoading(false);
        return;
      }

      const userStr = localStorage.getItem('user');
      
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser(userData);
        } catch (err) {
          console.error('Failed to parse user data:', err);
          localStorage.removeItem('user');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      removeCookie('accessToken');
      removeCookie('refreshToken');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((token: string, userData: User) => {
    console.log('=== LOGIN FUNCTION CALLED ===');
    console.log('Token:', token ? 'EXISTS' : 'MISSING');
    console.log('UserData:', userData);
    console.log('=============================');

    setIsLoggingIn(true);
    setCookie('accessToken', token, 7);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setIsLoading(false);
    
    console.log('=== LOGIN STATE UPDATED ===');
    console.log('User in state:', userData);
    console.log('Cookie set:', getCookie('accessToken') ? 'YES' : 'NO');
    console.log('LocalStorage:', localStorage.getItem('user') ? 'EXISTS' : 'MISSING');
    console.log('===========================');

    setTimeout(() => {
      setIsLoggingIn(false);
    }, 1000);
    
    router.push('/');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      const token = getCookie('accessToken');
      
      if (token) {
        await fetch('/api/auth/logout', { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).catch(err => console.error('Logout API error:', err));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      removeCookie('accessToken');
      removeCookie('refreshToken');
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const updateUser = useCallback((userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}