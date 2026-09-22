import { useEffect } from 'react';

/**
 * Custom hook to set page title and meta description
 * Improves SEO and accessibility
 * 
 * @param title - Page title
 * @param description - Optional meta description
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    // Set document title
    const baseTitle = 'CourtConnect';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;

    // Set or update meta description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      
      metaDescription.setAttribute('content', description);
    }

    // Cleanup: Reset to default title when component unmounts
    return () => {
      document.title = baseTitle;
    };
  }, [title, description]);
}
