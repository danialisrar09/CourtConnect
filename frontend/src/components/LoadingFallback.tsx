/**
 * LoadingFallback Component
 * 
 * Displays a loading spinner for Suspense boundaries during code splitting
 */

export function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center space-y-4">
        {/* Spinner */}
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-[#98e209] rounded-full animate-spin"></div>
        </div>
        
        {/* Loading Text */}
        <p className="text-gray-600 font-medium animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}

/**
 * PageLoadingFallback Component
 * 
 * Minimal loading state for faster perceived performance
 */
export function PageLoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        
        {/* Content skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  );
}
