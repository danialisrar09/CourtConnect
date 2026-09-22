import React from 'react';

/**
 * Skip Navigation Link Component
 * Provides a link for keyboard users to skip directly to main content
 * Follows WCAG 2.1 accessibility guidelines
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-6 focus:py-3 focus:bg-[#98e209] focus:text-[#010101] focus:rounded-md focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#98e209]"
    >
      Skip to main content
    </a>
  );
}
