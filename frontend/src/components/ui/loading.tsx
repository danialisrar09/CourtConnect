import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

/**
 * Loading Spinner Component
 * Reusable loading indicator with multiple sizes
 */
export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <Loader2 
        className={cn('animate-spin text-[#98e209]', sizeClasses[size], className)} 
        aria-hidden="true"
      />
      {text && (
        <p className="text-sm text-gray-600" role="status" aria-live="polite">
          {text}
        </p>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

/**
 * Full Page Loading Component
 * Displays a centered loading spinner for page-level loading
 */
export function LoadingPage({ message = 'Loading...' }: LoadingPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="xl" text={message} />
    </div>
  );
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

/**
 * Loading Button Component
 * A button that shows spinner when loading
 */
export function LoadingButton({ 
  isLoading, 
  children, 
  loadingText, 
  className,
  disabled,
  ...props 
}: LoadingButtonProps) {
  return (
    <button 
      type="button" 
      disabled={isLoading || disabled} 
      className={className}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingText || 'Loading...'}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
