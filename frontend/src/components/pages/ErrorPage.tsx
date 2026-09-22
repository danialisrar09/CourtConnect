import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ErrorPage() {
  usePageTitle('Server Error', 'An unexpected error occurred. Please try again later.');
  const navigate = useNavigate();

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-2">500</h1>
          <h2 className="text-3xl font-semibold text-gray-700 mb-4">
            Oops! Something went wrong
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            We're experiencing technical difficulties. Our team has been notified and is working to fix the issue.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button
            onClick={handleRefresh}
            className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08] gap-2"
            size="lg"
          >
            <RefreshCw className="h-5 w-5" />
            Try Again
          </Button>

          <Button
            onClick={handleGoHome}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <Home className="h-5 w-5" />
            Go to Homepage
          </Button>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-lg shadow-md p-6 text-left">
          <h3 className="font-semibold text-lg mb-3 text-gray-900">What can you do?</h3>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start">
              <span className="text-[#98e209] mr-2">•</span>
              <span>Try refreshing the page</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#98e209] mr-2">•</span>
              <span>Check your internet connection</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#98e209] mr-2">•</span>
              <span>Clear your browser cache and cookies</span>
            </li>
            <li className="flex items-start">
              <span className="text-[#98e209] mr-2">•</span>
              <span>Try again in a few minutes</span>
            </li>
          </ul>
        </div>

        {/* Contact Support */}
        <div className="mt-8 text-sm text-gray-500">
          <p className="mb-2">Still having problems?</p>
          <a
            href="mailto:danialisrar09@gmail.com"
            className="inline-flex items-center gap-2 text-[#98e209] hover:text-[#89cb08] font-medium"
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
