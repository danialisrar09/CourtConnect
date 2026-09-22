import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserType } from '../types';
import { authService } from '../services';

interface AuthContextType {
  user: User | null;
  userType: UserType;
  isAuthenticated: boolean;
  login: (email: string, password: string, type: 'customer' | 'business') => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  switchProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedUserType = localStorage.getItem('userType');
    
    if (storedUser && storedUserType) {
      try {
        setUser(JSON.parse(storedUser));
        setUserType(storedUserType as 'customer' | 'business');
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('userType');
      }
    }
  }, []);

  const login = async (email: string, password: string, type: 'customer' | 'business') => {
    try {
      const response = await authService.login({ email, password, rememberMe: true, role: type });
      
      const userData: User = {
        id: response.data.user.id,
        name: response.data.user.name,
        email: response.data.user.email,
        type: response.data.user.currentRole as 'customer' | 'business',
        phone: response.data.user.phone || '',
        createdAt: response.data.user.createdAt || new Date().toISOString(),
        profileType: response.data.user.profileType,
        currentRole: response.data.user.currentRole,
      };

      setUser(userData);
      setUserType(response.data.user.currentRole as 'customer' | 'business');

      // Persist to localStorage
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userType', response.data.user.currentRole);
      localStorage.setItem('authToken', response.data.token);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setUserType(null);
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      localStorage.removeItem('authToken');
      localStorage.removeItem('cart'); // Clear cart on logout
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const switchProfile = async () => {
    if (!user || user.profileType !== 'both') return;

    try {
      const newRole = user.currentRole === 'customer' ? 'business' : 'customer';
      const response = await authService.switchProfile(newRole);
      
      const updatedUser = { 
        ...user, 
        currentRole: response.data.currentRole as 'customer' | 'business', 
        type: response.data.currentRole as 'customer' | 'business' 
      };
      setUser(updatedUser);
      setUserType(response.data.currentRole as 'customer' | 'business');
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('userType', response.data.currentRole);
      localStorage.setItem('authToken', response.data.token);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to switch profile');
    }
  };

  const value: AuthContextType = {
    user,
    userType,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser,
    switchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
