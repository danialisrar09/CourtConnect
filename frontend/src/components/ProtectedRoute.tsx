import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requiredUserType?: 'customer' | 'business';
  redirectTo?: string;
}

/**
 * ProtectedRoute Component
 * Wraps routes that require authentication or specific user types
 */
export function ProtectedRoute({
  children,
  requireAuth = true,
  requiredUserType,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, userType } = useAuth();

  // Check if authentication is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check if specific user type is required
  if (requiredUserType && userType !== requiredUserType) {
    // Redirect to appropriate dashboard or home
    if (userType === 'customer') {
      return <Navigate to="/dashboard/customer" replace />;
    } else if (userType === 'business') {
      return <Navigate to="/dashboard/business" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
