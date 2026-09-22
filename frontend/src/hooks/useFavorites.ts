import { useState, useEffect, useCallback } from 'react';
import userService from '../services/userService';

export interface FavoriteVenue {
  _id?: string;
  id: string;
  name: string;
  sport: string;
  image: string;
  images?: string[];
  rating: number;
  hourlyPrice?: number;
  price?: number;
  location?: string;
  address?: string;
  amenities?: string[];
  addedAt?: string;
}

/**
 * Custom hook for managing favorite/wishlist venues with backend sync
 * @returns [favorites, addFavorite, removeFavorite, isFavorite, refreshFavorites, loading]
 */
export function useFavorites(): [
  FavoriteVenue[],
  (venueId: string) => Promise<void>,
  (venueId: string) => Promise<void>,
  (venueId: string) => boolean,
  () => Promise<void>,
  boolean
] {
  const [favorites, setFavorites] = useState<FavoriteVenue[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch favorites from backend on mount
  const refreshFavorites = useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setFavorites([]);
      return;
    }

    try {
      setLoading(true);
      const data = await userService.getFavorites();
      setFavorites(data || []);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const addFavorite = async (venueId: string) => {
    try {
      const updatedFavorites = await userService.addFavorite(venueId);
      setFavorites(updatedFavorites || []);
    } catch (error) {
      console.error('Failed to add favorite:', error);
      throw error;
    }
  };

  const removeFavorite = async (venueId: string) => {
    try {
      const updatedFavorites = await userService.removeFavorite(venueId);
      setFavorites(updatedFavorites || []);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      throw error;
    }
  };

  const isFavorite = (venueId: string): boolean => {
    return favorites.some((fav) => (fav._id || fav.id) === venueId);
  };

  return [favorites, addFavorite, removeFavorite, isFavorite, refreshFavorites, loading];
}
