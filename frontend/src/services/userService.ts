import { api } from './api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  profileType: string;
  currentRole?: string;
  businessInfo?: {
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  name?: string;
  phone?: string;
  businessInfo?: {
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
  };
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

class UserService {
  // Get user profile
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await api.get<{ success: boolean; data: UserProfile }>('/users/profile');
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch profile');
    }
  }

  // Update user profile
  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    try {
      const response = await api.put<{ success: boolean; data: UserProfile }>('/users/profile', data);
      
      // Update local storage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const updatedUser = { ...user, ...response.data.data };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update profile');
    }
  }

  // Change password
  async changePassword(data: ChangePasswordData): Promise<void> {
    try {
      await api.post('/users/change-password', data);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to change password');
    }
  }

  // Delete account
  async deleteAccount(password: string): Promise<void> {
    try {
      await api.delete('/users/account', { data: { password } });
      
      // Clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to delete account');
    }
  }

  // Get user sessions
  async getSessions(): Promise<any[]> {
    try {
      const response = await api.get<{ success: boolean; data: any[] }>('/users/sessions');
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch sessions');
    }
  }

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await api.delete(`/users/sessions/${sessionId}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to revoke session');
    }
  }

  // Get user's favorite venues
  async getFavorites(): Promise<any[]> {
    try {
      const response = await api.get<{ success: boolean; data: any[] }>('/users/favorites');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch favorites');
    }
  }

  // Add a venue to favorites
  async addFavorite(venueId: string): Promise<any[]> {
    try {
      const response = await api.post<{ success: boolean; data: any[] }>('/users/favorites', { venueId });
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to add favorite');
    }
  }

  // Remove a venue from favorites
  async removeFavorite(venueId: string): Promise<any[]> {
    try {
      const response = await api.delete<{ success: boolean; data: any[] }>(`/users/favorites/${venueId}`);
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to remove favorite');
    }
  }
}

export default new UserService();
