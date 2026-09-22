import React from 'react';
import { cn } from './utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base Skeleton Component
 * Animated loading placeholder
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      role="status"
      aria-label="Loading..."
    />
  );
}

/**
 * Venue Card Skeleton
 * Loading placeholder for venue cards
 */
export function VenueCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/**
 * Booking Card Skeleton
 * Loading placeholder for booking cards
 */
export function BookingCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Table Row Skeleton
 * Loading placeholder for table rows
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
