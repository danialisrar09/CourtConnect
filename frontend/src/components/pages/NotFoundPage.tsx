import React from 'react';
import { AlertCircle, Home, Search } from 'lucide-react';
import { Button } from '../ui/button';

interface NotFoundPageProps {
  onPageChange: (page: string) => void;
}

/**
 * 404 Not Found Page Component
 * Displayed when user navigates to a non-existent page
 */
export function NotFoundPage({ onPageChange }: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <AlertCircle className="h-16 w-16 text-red-600" aria-hidden="true" />
          </div>
        </div>

        {/* 404 Title */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        
        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Page Not Found
        </h2>
        
        <p className="text-gray-600 mb-8">
          Oops! The page you're looking for doesn't exist. 
          It might have been moved or deleted.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => onPageChange('home')}
            className="bg-[#98e209] hover:bg-[#7bc206] text-[#010101] font-semibold"
          >
            <Home className="h-4 w-4 mr-2" aria-hidden="true" />
            Back to Home
          </Button>
          
          <Button
            onClick={() => onPageChange('find-court')}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            <Search className="h-4 w-4 mr-2" aria-hidden="true" />
            Find Courts
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">
            Here are some helpful links instead:
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <button
              onClick={() => onPageChange('about')}
              className="text-[#98e209] hover:text-[#7bc206] font-medium underline"
            >
              About Us
            </button>
            <button
              onClick={() => onPageChange('login')}
              className="text-[#98e209] hover:text-[#7bc206] font-medium underline"
            >
              Login
            </button>
            <button
              onClick={() => onPageChange('find-court')}
              className="text-[#98e209] hover:text-[#7bc206] font-medium underline"
            >
              Browse Courts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
