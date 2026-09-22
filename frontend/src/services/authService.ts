import { api } from './api';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  role?: 'customer' | 'business';
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  profileType: 'customer' | 'business' | 'both';
  phone?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      profileType: string;
      currentRole?: string;
    };
  };
}

export interface SwitchProfileResponse {
  success: boolean;
  message: string;
  data: {
    currentRole: string;
    token: string;
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

class AuthService {
  // Login user
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      
      if (response.data.success) {
        // Store token and user data
        localStorage.setItem('authToken', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        
        // Handle remember me
        if (credentials.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  // Register new user
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);
      
      if (response.data.success) {
        // Auto-login after registration
        localStorage.setItem('authToken', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
    }
  }

  // Switch profile (Customer <-> Business)
  async switchProfile(newRole: 'customer' | 'business'): Promise<SwitchProfileResponse> {
    try {
      const response = await api.post<SwitchProfileResponse>('/auth/switch-profile', { role: newRole });
      
      if (response.data.success) {
        // Update user data in localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.currentRole = response.data.data.currentRole;
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update token if new one is provided
        if (response.data.data.token) {
          localStorage.setItem('authToken', response.data.data.token);
        }
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to switch profile');
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem('authToken');
    return !!token;
  }

  // Get current user
  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Get auth token
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  // Forgot Password — sends a reset request to the backend
  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    try {
      const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to send reset email. Please try again.');
    }
  }

  // Verify token (optional - check with backend)
  async verifyToken(): Promise<boolean> {
    try {
      const response = await api.get('/auth/verify');
      return response.data.success;
    } catch (error) {
      return false;
    }
  }
}

export default new AuthService();
