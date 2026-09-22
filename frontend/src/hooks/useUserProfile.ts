import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import userService, { UserProfile, UpdateProfileData, ChangePasswordData } from '../services/userService';

interface UseUserProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  loadProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfileData) => Promise<void>;
  changePassword: (payload: ChangePasswordData) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export function useUserProfile(): UseUserProfileReturn {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    setError(null);
    try {
      const profileData = await userService.getProfile();
      setProfile(profileData);
    } catch (err: any) {
      const msg = err.message || 'Failed to load profile';
      setError(msg);
      console.error('Load profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const updateProfileHandler = async (payload: UpdateProfileData) => {
    setLoading(true);
    setError(null);
    try {
      const updatedProfile = await userService.updateProfile(payload);
      setProfile(updatedProfile);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      const msg = err.message || 'Failed to update profile';
      setError(msg);
      toast.error(msg);
      console.error('Update profile error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Change password
  const changePasswordHandler = async (payload: ChangePasswordData) => {
    setLoading(true);
    setError(null);
    try {
      // Client-side validation
      if (!payload.currentPassword || !payload.newPassword) {
        throw new Error('Current password and new password are required');
      }
      if (payload.newPassword !== payload.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      await userService.changePassword(payload);
      toast.success('Password changed successfully');
    } catch (err: any) {
      const msg = err.message || 'Failed to change password';
      setError(msg);
      toast.error(msg);
      console.error('Change password error:', err);
      throw err; // Re-throw so component can handle form errors
    } finally {
      setLoading(false);
    }
  };

  // Delete account
  const deleteAccountHandler = async () => {
    setLoading(true);
    setError(null);
    try {
      await userService.deleteAccount('');
      toast.success('Account deleted successfully');
      // Clear auth state
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      // Redirect to login
      navigate('/login');
    } catch (err: any) {
      const msg = err.message || 'Failed to delete account';
      setError(msg);
      toast.error(msg);
      console.error('Delete account error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    error,
    loadProfile: loadProfileData,
    updateProfile: updateProfileHandler,
    changePassword: changePasswordHandler,
    deleteAccount: deleteAccountHandler,
  };
}
