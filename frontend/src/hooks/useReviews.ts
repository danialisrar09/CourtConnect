import { useCallback, useMemo, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Review, ReviewStats } from '../types';
import bookingService from '../services/bookingService';
import reviewService from '../services/reviewService';

const STORAGE_KEY = 'venueReviews';
const REVIEW_WINDOW_DAYS = Number((import.meta as any).env.VITE_REVIEW_WINDOW_DAYS ?? 30);
const ALLOW_CONFIRMED = ((import.meta as any).env.VITE_REVIEW_ALLOW_CONFIRMED ?? 'false') === 'true';
const ALLOWED_STATUSES = ALLOW_CONFIRMED ? ['completed', 'confirmed'] : ['completed'];

type ReviewStore = Record<string, Review[]>;

const emptyStats: ReviewStats = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
};

interface UnreviewedBooking {
  id: string;
  date: string;
  timeSlot?: { start: string; end: string };
  price?: number;
}

interface AddReviewInput {
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  bookingId: string; // Required for multiple reviews per booking
  verified?: boolean;
}

interface UpdateReviewInput {
  rating?: number;
  comment?: string;
}

const computeStats = (reviews: Review[]): ReviewStats => {
  if (!reviews.length) return emptyStats;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewStats['distribution'];
  const sum = reviews.reduce((acc, r) => {
    distribution[r.rating as keyof typeof distribution] = (distribution[r.rating as keyof typeof distribution] || 0) + 1;
    return acc + r.rating;
  }, 0);
  return {
    average: sum / reviews.length,
    count: reviews.length,
    distribution
  };
};

const findLatestCompletedBooking = (bookings: any[], venueId: string) => {
  const now = new Date();
  
  // Helper to check if booking is finished
  const isBookingFinished = (b: any) => {
    const status = (b?.status || '').toString().toLowerCase();
    if (status === 'completed') return true;
    const dateStr = b?.bookingDate || b?.date;
    const end24 = b?.timeSlot?.end;
    if (!dateStr) return false;
    const bookingDate = new Date(dateStr);
    if (isNaN(bookingDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bd = new Date(bookingDate);
    bd.setHours(0, 0, 0, 0);
    // Past dates are always finished
    if (bd < today) return true;
    if (bd > today) return false;
    // For today: if no valid end time, consider it finished if status is completed
    if (!end24 || !/^\d{2}:\d{2}$/.test(String(end24))) {
      return status === 'completed';
    }
    // Build end time on the SAME LOCAL DAY as bookingDate to avoid UTC shift
    const [endH, endM] = String(end24).split(':');
    const endDateTime = new Date(bookingDate);
    endDateTime.setHours(parseInt(endH, 10), parseInt(endM, 10), 0, 0);
    return now >= endDateTime;
  };

  // Match venue by multiple possible ID fields
  const venueMatches = bookings.filter((b) => {
    const bVenueId = b.venue?._id || b.venue?.id || b.venue || b.venueId;
    return String(bVenueId) === String(venueId);
  });

  console.log('Review eligibility check:', {
    venueId,
    totalBookings: bookings.length,
    venueMatches: venueMatches.length,
    ALLOWED_STATUSES,
    ALLOW_CONFIRMED,
    venueMatchesDetails: venueMatches.map(b => ({
      id: b._id || b.id,
      status: b.status,
      statusLower: String(b.status || '').toLowerCase(),
      date: b.bookingDate || b.date,
      timeSlot: b.timeSlot,
      venue: b.venue?._id || b.venue?.id || b.venue || b.venueId,
      finished: isBookingFinished(b),
      allowedStatus: ALLOWED_STATUSES.includes(String(b.status || '').toLowerCase()),
      cancelled: String(b.status || '').toLowerCase() === 'cancelled'
    }))
  });

  const filtered = venueMatches
    .filter((b) => {
      const status = String(b.status || '').toLowerCase();
      console.log(`Checking booking ${b._id || b.id}:`, {
        status,
        cancelled: status === 'cancelled',
        inAllowedStatuses: ALLOWED_STATUSES.includes(status),
        isFinished: isBookingFinished(b),
        passes: status !== 'cancelled' && ALLOWED_STATUSES.includes(status) && isBookingFinished(b)
      });
      if (status === 'cancelled') return false;
      // Accept completed or confirmed if ALLOW_CONFIRMED is true
      if (!ALLOWED_STATUSES.includes(status)) return false;
      // Must be finished
      return isBookingFinished(b);
    })
    .sort((a, b) => new Date(b.bookingDate || b.date).getTime() - new Date(a.bookingDate || a.date).getTime());

  console.log('Filtered finished bookings:', filtered.length);

  if (!filtered.length) return null;
  const booking = filtered[0];
  if (REVIEW_WINDOW_DAYS <= 0) return { booking, windowExpired: false };
  const daysSince = (Date.now() - new Date(booking.bookingDate || booking.date).getTime()) / (1000 * 60 * 60 * 24);
  return { booking, windowExpired: daysSince > REVIEW_WINDOW_DAYS };
};

export function useReviews(venueId?: string) {
  const [store, setStore] = useLocalStorage<ReviewStore>(STORAGE_KEY, {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreviewedBookings, setUnreviewedBookings] = useState<UnreviewedBooking[]>([]);

  const reviews = useMemo(() => {
    if (!venueId) return [] as Review[];
    return store[venueId] || [];
  }, [store, venueId]);

  const stats = useMemo(() => computeStats(reviews), [reviews]);

  const persist = useCallback(
    (next: Review[]) => {
      if (!venueId) return;
      setStore((prev) => ({ ...prev, [venueId]: next }));
    },
    [venueId, setStore]
  );

  const addReview = useCallback(
    async (input: AddReviewInput) => {
      if (!venueId || !input.bookingId) return;
      
      try {
        // Call backend API to create review
        const response = await reviewService.addReview(venueId, {
          rating: input.rating,
          comment: input.comment,
          bookingId: input.bookingId
        });
        
        // If successful, also update local state for immediate UI feedback
        const nowIso = new Date().toISOString();
        const review: Review = {
          id: response?.data?._id || `${venueId}-${input.bookingId}-${Date.now()}`,
          venueId,
          userId: input.userId,
          userName: input.userName,
          userAvatar: input.userAvatar,
          bookingId: input.bookingId,
          verified: Boolean(input.verified),
          rating: input.rating,
          comment: input.comment,
          helpful: 0,
          createdAt: response?.data?.createdAt || nowIso,
          updatedAt: response?.data?.updatedAt || nowIso
        };
        persist([review, ...reviews]);
        // Remove this booking from unreviewed list
        setUnreviewedBookings(unreviewedBookings.filter(b => b.id !== input.bookingId));
      } catch (error: any) {
        console.error('Failed to add review:', error);
        throw error;
      }
    },
    [venueId, persist, reviews, unreviewedBookings]
  );

  const updateReview = useCallback(
    async (reviewId: string, input: UpdateReviewInput) => {
      const next = reviews.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              rating: typeof input.rating === 'number' ? input.rating : r.rating,
              comment: typeof input.comment === 'string' ? input.comment : r.comment,
              updatedAt: new Date().toISOString()
            }
          : r
      );
      persist(next);
    },
    [reviews, persist]
  );

  const deleteReview = useCallback(
    async (reviewId: string) => {
      persist(reviews.filter((r) => r.id !== reviewId));
    },
    [reviews, persist]
  );

  const toggleHelpful = useCallback(
    async (reviewId: string, userId: string) => {
      const next = reviews.map((r) => {
        if (r.id !== reviewId) return r;
        if (r.userId === userId) return r; // cannot mark own review
        const already = (r as any).helpfulUsers?.includes(userId);
        const newCount = already ? Math.max(0, r.helpful - 1) : r.helpful + 1;
        const helpfulUsers = already
          ? (r as any).helpfulUsers?.filter((u: string) => u !== userId)
          : [...(r as any).helpfulUsers || [], userId];
        return { ...r, helpful: newCount, helpfulUsers } as Review;
      });
      persist(next);
    },
    [reviews, persist]
  );

  const getUserReview = useCallback(
    (userId: string) => reviews.find((r) => r.userId === userId) || null,
    [reviews]
  );

  const isBookingFinishedSimple = useCallback((b: any) => {
    const status = (b?.status || '').toString().toLowerCase();
    // Completed is always finished
    if (status === 'completed') return true;
    // Cancelled never eligible
    if (status === 'cancelled') return false;
    
    const dateStr = b?.bookingDate || b?.date;
    const end24 = b?.timeSlot?.end;
    if (!dateStr || !end24) return status === 'completed';
    
    const bookingDate = new Date(dateStr);
    if (isNaN(bookingDate.getTime())) return false;
    
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bd = new Date(bookingDate);
    bd.setHours(0, 0, 0, 0);
    
    // Past dates are finished
    if (bd < today) return true;
    if (bd > today) return false;
    
    // Today: check if current time is after end time
    if (!/^\d{2}:\d{2}$/.test(String(end24))) return false;
    const [endH, endM] = String(end24).split(':');
    const endDateTime = new Date(bookingDate);
    endDateTime.setHours(parseInt(endH, 10), parseInt(endM, 10), 0, 0);
    return now >= endDateTime;
  }, []);

  const fetchUnreviewedBookings = useCallback(
    async (userId?: string) => {
      if (!userId || !venueId) {
        console.log('fetchUnreviewedBookings: missing userId or venueId', { userId, venueId });
        return [];
      }
      try {
        setLoading(true);
        setError(null);
        console.log('fetchUnreviewedBookings: starting', { userId, venueId });
        
        // Try backend first
        const venueService = (await import('../services/venueService')).default;
        if (venueService && typeof venueService.getUnreviewedBookings === 'function') {
          const res = await venueService.getUnreviewedBookings(venueId);
          if (res?.data?.bookings && res.data.bookings.length > 0) {
            console.log('fetchUnreviewedBookings: backend success', res.data.bookings);
            setUnreviewedBookings(res.data.bookings);
            setLoading(false);
            return res.data.bookings;
          } else {
            console.log('fetchUnreviewedBookings: backend returned empty, falling back to client');
          }
        }
      } catch (err: any) {
        console.warn('Backend unreviewed bookings fetch failed, falling back to client-side', err);
      }

      // Fallback: client-side computation
      try {
        console.log('fetchUnreviewedBookings: fallback to client-side');
        const bookings = await bookingService.getMyBookings();
        const allBookings = bookings?.data?.bookings || bookings?.bookings || [];
        
        console.log('=== UNREVIEWED BOOKINGS FETCH ===', {
          totalBookings: allBookings.length,
          venueId,
          ALLOWED_STATUSES,
          ALLOW_CONFIRMED,
          REVIEW_WINDOW_DAYS,
          reviewedIds: reviews.map(r => r.bookingId)
        });
        
        const venueBookings = allBookings.filter((b: any) => {
          const bVenueId = b.venue?._id || b.venue?.id || b.venue || b.venueId;
          return String(bVenueId) === String(venueId);
        });

        console.log('Venue bookings found:', venueBookings.length, venueBookings.map((b: any) => ({
          id: b._id || b.id,
          status: b.status,
          date: b.bookingDate || b.date,
          timeSlot: b.timeSlot,
          finished: isBookingFinishedSimple(b)
        })));

        const reviewedBookingIds = new Set(reviews.map(r => r.bookingId));
        const unreviewed = venueBookings
          .filter((b: any) => {
            const status = String(b.status || '').toLowerCase();
            const id = b._id || b.id;
            const finished = isBookingFinishedSimple(b);
            const alreadyReviewed = reviewedBookingIds.has(id);
            const inAllowedStatuses = ALLOWED_STATUSES.includes(status);
            
            const passes = inAllowedStatuses && finished && !alreadyReviewed;
            console.log(`Booking ${id}:`, { status, finished, alreadyReviewed, inAllowedStatuses, passes });
            return passes;
          })
          .map((b: any) => ({
            id: b._id || b.id,
            date: b.bookingDate || b.date,
            timeSlot: b.timeSlot,
            price: b.totalPrice || b.price
          }));
        
        console.log('Unreviewed bookings result:', unreviewed.length, unreviewed);
        setUnreviewedBookings(unreviewed);
        setLoading(false);
        return unreviewed;
      } catch (err: any) {
        console.error('fetchUnreviewedBookings error:', err);
        setError(err?.message || 'Failed to check eligibility');
        setLoading(false);
        return [];
      }
    },
    [venueId, reviews, isBookingFinishedSimple]
  );

  const checkEligibility = useCallback(
    async (userId?: string) => {
      if (!userId) {
        return { allowed: false, reason: 'Please log in to review.' };
      }
      if (!venueId) {
        return { allowed: false, reason: 'Venue not found.' };
      }
      try {
        setLoading(true);
        setError(null);
        // Fetch all bookings (not just completed) to include confirmed ones that have finished
        const res = await bookingService.getMyBookings();
        const bookings = res?.data?.bookings || res?.bookings || [];
        const result = findLatestCompletedBooking(bookings, venueId);
        if (!result) {
          return { allowed: false, reason: 'Complete a booking at this venue before reviewing.' };
        }
        if (result.windowExpired) {
          return { allowed: false, reason: 'Review window has expired (30 days).' };
        }
        return { allowed: true, bookingId: result.booking?._id || result.booking?.id, reason: undefined };
      } catch (err: any) {
        console.error('Eligibility check failed', err);
        setError(err?.message || 'Failed to check eligibility');
        return { allowed: false, reason: 'Could not verify booking eligibility right now.' };
      } finally {
        setLoading(false);
      }
    },
    [venueId]
  );

  const canUserReview = useCallback(
    async (userId?: string, userRole?: string) => {
      if (!userId) {
        console.log('canUserReview: no userId');
        return { allowed: false, reason: 'Please log in to review.' };
      }
      // Business users cannot review venues
      if (userRole === 'business') {
        console.log('canUserReview: business user cannot review');
        return { allowed: false, reason: 'Business owners cannot write reviews. Switch to customer mode to review venues.' };
      }
      // For multi-review per booking, fetch and return list of unreviewed bookings
      console.log('canUserReview: fetching unreviewed bookings...');
      const unreviewed = await fetchUnreviewedBookings(userId);
      console.log('canUserReview result:', { count: unreviewed?.length || 0, unreviewed });
      return {
        allowed: unreviewed && unreviewed.length > 0,
        reason: unreviewed && unreviewed.length > 0 ? undefined : 'No unreviewed bookings at this venue.',
        unreviewedBookings: unreviewed || []
      };
    },
    [fetchUnreviewedBookings]
  );

  return {
    reviews,
    stats,
    loading,
    error,
    addReview,
    updateReview,
    deleteReview,
    toggleHelpful,
    getUserReview,
    canUserReview,
    unreviewedBookings,
    fetchUnreviewedBookings
  };
}

export default useReviews;
