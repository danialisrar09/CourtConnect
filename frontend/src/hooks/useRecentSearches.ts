import { useLocalStorage } from './useLocalStorage';

/**
 * Custom hook for managing recent search queries
 * @param maxItems - Maximum number of recent searches to store (default: 10)
 * @returns [recentSearches, addSearch, removeSearch, clearSearches]
 */
export function useRecentSearches(
  maxItems: number = 10
): [string[], (query: string) => void, (query: string) => void, () => void] {
  const [recentSearches, setRecentSearches] = useLocalStorage<string[]>('recentSearches', []);

  const addSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setRecentSearches((prev) => {
      // Remove if already exists
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmedQuery.toLowerCase());
      // Add to beginning and limit to maxItems
      return [trimmedQuery, ...filtered].slice(0, maxItems);
    });
  };

  const removeSearch = (query: string) => {
    setRecentSearches((prev) => prev.filter((s) => s !== query));
  };

  const clearSearches = () => {
    setRecentSearches([]);
  };

  return [recentSearches, addSearch, removeSearch, clearSearches];
}
