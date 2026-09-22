/**
 * Shared TypeScript Type Definitions
 * Centralized type definitions used across the application
 */

// User Types
export type UserType = 'customer' | 'business' | null;

export interface User {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'business';
  profileType?: 'customer' | 'business' | 'both';
  currentRole?: 'customer' | 'business';
  phone?: string;
  createdAt: string;
}

// Cart & Booking Types
export interface CartItem {
  id: string; // server cart item id
  court: string;
  sport: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  image: string;
  location?: string;
  venueId?: number | string;
}

export interface Booking {
  id: string;
  courtName: string;
  sport: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  venueId: number;
  venueName: string;
  location: string;
  image: string;
  bookingDate: string;
}

// Venue Types
export interface Amenity {
  id: string;
  name: string;
  icon: string;
}

export interface Review {
  id: string;
  venueId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  bookingId?: string;
  bookingDate?: string;
  timeSlot?: string;
  verified: boolean;
  rating: number;
  comment: string;
  helpful: number;
  respondedBy?: string;
  responseText?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  average: number;
  count: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}

export interface Venue {
  id: number | string;
  name: string;
  sport: string;
  location: string;
  city: string;
  address: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  amenities: string[];
  description?: string;
  openingHours?: {
    start: string;
    end: string;
  };
  availability?: TimeSlot[];
  reviewsList?: Review[];
  reviewStats?: ReviewStats;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  price?: number;
}

// Form Types
export interface LoginFormData {
  email: string;
  password: string;
  userType: 'customer' | 'business';
}

export interface VenueFormData {
  name: string;
  sport: string;
  address: string;
  city: string;
  price: number;
  amenities: string[];
  description: string;
  openingHours: {
    start: string;
    end: string;
  };
  images?: File[];
}

// UPDATED Phase 4: Payment processing moved to Stripe gateway
// Old fields (cardNumber, expiryDate, cvv, paymentMethod) removed
// See: CheckoutPage for updated form handling
export interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  agreeToTerms: boolean;
}

// Search & Filter Types
export interface SearchFilters {
  query: string;
  sport: string;
  location: string;
  priceRange: {
    min: number;
    max: number;
  };
  date?: string;
  time?: string;
  sortBy: 'price' | 'rating' | 'distance' | 'popularity';
}

// Analytics Types (for Business Dashboard)
export interface BusinessAnalytics {
  totalRevenue: number;
  totalBookings: number;
  activeVenues: number;
  averageRating: number;
  revenueByMonth: {
    month: string;
    revenue: number;
  }[];
  bookingsByStatus: {
    upcoming: number;
    completed: number;
    cancelled: number;
  };
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Page Props Types
export interface PageProps {
  onPageChange?: (page: string) => void; // Will be removed after routing implementation
}
