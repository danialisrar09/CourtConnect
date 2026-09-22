import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';

const ProfileSwitcher: React.FC = () => {
  const { user, switchProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has dual roles
  const isDualRole = user?.profileType === 'both';
  const currentRole = user?.currentRole || user?.profileType;

  if (!isDualRole) {
    return null; // Don't show switcher if user doesn't have dual roles
  }

  const handleSwitch = async () => {
    setIsLoading(true);

    try {
      await switchProfile();
      const newRole = currentRole === 'customer' ? 'business' : 'customer';
      toast.success(`Switched to ${newRole === 'business' ? 'Business' : 'Customer'} profile`);
      
      // Navigate to appropriate dashboard without page reload
      navigate(newRole === 'customer' ? '/dashboard/customer' : '/dashboard/business', { replace: true });
      setIsLoading(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch profile');
      setIsLoading(false);
    }
  };

  const isBusiness = currentRole === 'business';
  const isCustomer = currentRole === 'customer';

  const handleRoleClick = async (role: 'customer' | 'business') => {
    if (role === currentRole || isLoading) return;
    
    setIsLoading(true);
    try {
      await switchProfile();
      toast.success(`Switched to ${role === 'business' ? 'Business' : 'Customer'} profile`);
      navigate(role === 'customer' ? '/dashboard/customer' : '/dashboard/business', { replace: true });
      setIsLoading(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to switch profile');
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Desktop Layout - Toggle Style */}
      <div className="hidden md:flex items-center flex-shrink-0">
        <div className="flex items-center rounded-full border border-gray-200 bg-gray-100 p-1 gap-1">
          <button
            onClick={() => handleRoleClick('customer')}
            disabled={isLoading}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-1 ${
              isCustomer
                ? 'bg-[#98e209] text-[#010101] shadow-sm'
                : 'bg-transparent text-[#010101] hover:bg-gray-200'
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => handleRoleClick('business')}
            disabled={isLoading}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-1 ${
              isBusiness
                ? 'bg-[#98e209] text-[#010101] shadow-sm'
                : 'bg-transparent text-[#010101] hover:bg-gray-200'
            }`}
          >
            Business
          </button>
        </div>
      </div>

      {/* Mobile Layout - Toggle Style */}
      <div className="flex flex-col gap-2 md:hidden w-full">
        <div className="flex items-center rounded-full border border-gray-200 bg-gray-100 p-1 gap-1 w-full">
          <button
            onClick={() => handleRoleClick('customer')}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-1 ${
              isCustomer
                ? 'bg-[#98e209] text-[#010101] shadow-sm'
                : 'bg-transparent text-[#010101] hover:bg-gray-200'
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => handleRoleClick('business')}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:ring-offset-1 ${
              isBusiness
                ? 'bg-[#98e209] text-[#010101] shadow-sm'
                : 'bg-transparent text-[#010101] hover:bg-gray-200'
            }`}
          >
            Business
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfileSwitcher;
