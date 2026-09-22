import { api } from './api';

interface VenueAvailability {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface CreateVenuePayload {
  title: string;
  description: string;
  sport: string;
  hourlyPrice: number;
  capacity?: number;
  location?: string;
  amenities: string[];
  images: string[];
  availability: VenueAvailability[];
  rules?: string[];
  contact?: {
    phone?: string;
    email?: string;
  };
  surface?: string;
  indoor?: boolean;
  lighting?: boolean;
}

interface VenueResponse {
  success: boolean;
  message: string;
  data: {
    venue: any;
  };
}

interface ViewportVenuesParams {
  north: number;
  south: number;
  east: number;
  west: number;
  q?: string;
  sport?: string;
  location?: string;
  amenities?: string;
  availability?: string;
  rating?: number;
  maxRating?: number;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}

interface NearbyVenuesParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  q?: string;
  sport?: string;
  location?: string;
  amenities?: string;
  availability?: string;
  rating?: number;
  maxRating?: number;
  minPrice?: number;
  maxPrice?: number;
}

interface DirectionsParams {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  profile?: 'driving' | 'walking' | 'cycling';
}

const venueService = {
  /**
   * Create a new venue
   */
  createVenue: async (venueData: CreateVenuePayload): Promise<VenueResponse> => {
    const response = await api.post<VenueResponse>('/venues', venueData);
    return response.data;
  },

  /**
   * Get all venues owned by the current user
   */
  getMyVenues: async (): Promise<any> => {
    const response = await api.get('/venues/my');
    return response.data;
  },

  /**
   * Get a single venue by ID
   */
  getVenueById: async (venueId: string): Promise<any> => {
    const response = await api.get(`/venues/${venueId}`);
    return response.data;
  },

  /**
   * Update an existing venue
   */
  updateVenue: async (venueId: string, venueData: Partial<CreateVenuePayload>): Promise<any> => {
    const response = await api.put(`/venues/${venueId}`, venueData);
    return response.data;
  },

  /**
   * Delete a venue
   */
  deleteVenue: async (venueId: string): Promise<any> => {
    const response = await api.delete(`/venues/${venueId}`);
    return response.data;
  },

  /**
   * Get top performing venues (business dashboard)
   */
  getTopVenues: async (limit: number = 3): Promise<any> => {
    const response = await api.get(`/venues/top`, { params: { limit } });
    return response.data;
  },

  /**
   * Public list of venues with filters and pagination
   */
  getVenues: async (params: Record<string, any> = {}): Promise<any> => {
    const response = await api.get(`/venues`, { params });
    return response.data;
  },

  /**
   * Get a single venue by ID for public viewing (no auth required)
   */
  getPublicVenueById: async (venueId: string): Promise<any> => {
    const response = await api.get(`/venues/public/${venueId}`);
    return response.data;
  },

  /**
   * Get court counts by sport type
   */
  getSportStats: async (): Promise<any> => {
    const response = await api.get('/venues/stats/sports');
    return response.data;
  },

  /**
   * Get all distinct active venue locations for filter dropdowns
   */
  getVenueLocations: async (): Promise<any> => {
    const response = await api.get('/venues/locations');
    return response.data;
  },

  /**
   * Get venues visible in current map viewport bounds
   */
  getViewportVenues: async (params: ViewportVenuesParams): Promise<any> => {
    const response = await api.get('/venues/map/viewport', { params });
    return response.data;
  },

  /**
   * Get venues near a user location within a radius
   */
  getNearbyVenues: async (params: NearbyVenuesParams): Promise<any> => {
    const response = await api.get('/venues/map/nearby', { params });
    return response.data;
  },

  /**
   * Get directions between two points
   */
  getDirections: async (params: DirectionsParams): Promise<any> => {
    const response = await api.get('/venues/map/directions', { params });
    return response.data;
  },

  /**
   * Get unreviewed bookings for a venue (bookings user can write reviews for)
   */
  getUnreviewedBookings: async (venueId: string): Promise<any> => {
    try {
      const response = await api.get(`/venues/${venueId}/unreviewed-bookings`);
      return response.data;
    } catch (err: any) {
      // If endpoint doesn't exist or fails, return empty data to trigger fallback
      console.warn('getUnreviewedBookings endpoint not available', err?.message);
      return { data: { bookings: [] } };
    }
  },
};

export default venueService;
