import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { MapPin, Star, Clock, Users, Wifi, Car, Coffee, Zap, ShoppingCart, Heart, Calendar, ArrowLeft, ArrowRight, Phone, Mail } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar as CalendarComponent } from '../ui/calendar';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useCart } from '../../contexts';
import { useAuth } from '../../contexts';
import { useChat } from '../../contexts';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useFavorites } from '../../hooks/useFavorites';
import { toast } from 'sonner';
import venueService from '../../services/venueService';
import bookingService from '../../services/bookingService';
import { ReviewForm } from '../common/ReviewForm';
import { ReviewList } from '../common/ReviewList';
import { ReviewSummary } from '../common/ReviewSummary';
import useReviews from '../../hooks/useReviews';

export function CourtListingPage() {
  usePageTitle('Court Details', 'View court details, check availability, and book your slot.');
  const navigate = useNavigate();
  const location = useLocation();
  const { id: courtId } = useParams<{ id: string }>();
  const fromAI = (location.state as any)?.fromAI;
  const { addToCart } = useCart();
  const { user, userType } = useAuth();
  const {
    startConversationForVenue,
    activeConversation,
    messages,
    messagesLoading,
    messagesError,
    startingConversation,
    startingConversationError,
    sendTextMessage,
  } = useChat();
  const isBusiness = userType === 'business';
  const [favorites, addFavorite, removeFavorite, isFavorite, refreshFavorites] = useFavorites();
  const {
    reviews,
    stats,
    addReview,
    updateReview,
    deleteReview,
    toggleHelpful,
    getUserReview,
    canUserReview,
    unreviewedBookings,
    fetchUnreviewedBookings
  } = useReviews(courtId);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>();
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);
  
  // API data state
  const [court, setCourt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookedSlots, setBookedSlots] = useState<any[]>([]);
  const [chatTestFormOpen, setChatTestFormOpen] = useState(false);
  const [chatDraftMessage, setChatDraftMessage] = useState('');
  const [chatDraftSending, setChatDraftSending] = useState(false);
  const [chatProbeOpen, setChatProbeOpen] = useState(false);
  const [chatProbeStatus, setChatProbeStatus] = useState<'idle' | 'opening' | 'success' | 'error'>('idle');
  const [chatProbeMessage, setChatProbeMessage] = useState('');

  // Fetch venue data on component mount
  useEffect(() => {
    const fetchVenue = async () => {
      if (!courtId) {
        setError('No court ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await venueService.getPublicVenueById(courtId);
        const venue = response?.data?.venue || response?.venue || response?.data;
        
        if (!venue) {
          setError('Court not found');
          setLoading(false);
          return;
        }

        // Transform venue data to match court object structure
        const transformedCourt = {
          id: venue._id || venue.id,
          ownerId: venue.owner?._id || venue.owner?.id || venue.owner || null,
          name: venue.title || venue.name,
          sport: venue.sport,
          location: venue.location || '',
          rating: venue.rating || 0,
          reviews: venue.ratingCount || venue.reviews || 0,
          price: venue.hourlyPrice || venue.price || 0,
          currency: 'Rs',
          images: venue.images && venue.images.length > 0 ? venue.images : [
            'https://images.unsplash.com/photo-1584392282358-0334b7494872?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZW5uaXMlMjBjb3VydCUyMGJvb2tpbmd8ZW58MXx8fHwxNzU5MDgzMDU3fDA&ixlib=rb-4.1.0&q=80&w=1080'
          ],
          amenities: formatAmenities(venue.amenities || []),
          description: venue.description || 'No description available',
          rules: venue.rules || [],
          contact: venue.contact || { phone: 'Not provided', email: 'Not provided' },
          openHours: formatOpenHours(venue.availability) || '6:00 AM - 10:00 PM',
          surface: venue.surface,
          indoor: venue.indoor,
          lighting: venue.lighting,
          availability: Array.isArray(venue.availability) ? venue.availability : [],
        };

        setCourt(transformedCourt);
      } catch (err: any) {
        console.error('Error fetching venue:', err);
        setError(err?.message || 'Failed to load court details');
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [courtId]);

  const handleSendLocalChatMessage = async () => {
    const trimmedMessage = chatDraftMessage.trim();

    if (!trimmedMessage || chatDraftSending || !activeConversation) {
      return;
    }

    try {
      setChatDraftSending(true);
      await sendTextMessage(trimmedMessage);
      setChatDraftMessage('');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send chat message');
    } finally {
      setChatDraftSending(false);
    }
  };

  const handleOpenChat = async () => {
    const startedAt = Date.now();
    let slowLogTimer: number | null = null;

    setChatTestFormOpen(true);
    setChatProbeOpen(true);
    setChatProbeStatus('opening');
    setChatProbeMessage('Chat button clicked. Trying to open conversation...');

    console.log('[CHAT_DEBUG] Chat with Owner clicked', {
      courtId,
      hasUser: Boolean(user),
      userId: user?.id || null,
      userType,
      courtOwnerId: court?.ownerId || null,
      path: location.pathname,
      time: new Date().toISOString(),
    });

    if (!courtId) {
      console.warn('[CHAT_DEBUG] Blocked: missing courtId');
      setChatProbeStatus('error');
      setChatProbeMessage('Blocked: missing courtId');
      return;
    }

    if (!user) {
      console.warn('[CHAT_DEBUG] Blocked: user not logged in');
      setChatProbeStatus('error');
      setChatProbeMessage('Blocked: user is not logged in');
      toast.error('Please log in as a customer to start chatting with the venue owner.');
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (userType !== 'customer') {
      console.warn('[CHAT_DEBUG] Blocked: user is not in customer role', { userType });
      setChatProbeStatus('error');
      setChatProbeMessage(`Blocked: active role is ${String(userType)}`);
      toast.error('Switch to your customer profile to chat with venue owners.');
      return;
    }

    if (court?.ownerId && String(court.ownerId) === String(user.id)) {
      console.warn('[CHAT_DEBUG] Blocked: self-chat prevention triggered', {
        ownerId: court?.ownerId,
        userId: user.id,
      });
      setChatProbeStatus('error');
      setChatProbeMessage('Blocked: self chat is not allowed');
      toast.error('You cannot start a chat with your own venue.');
      return;
    }

    try {
      console.log('[CHAT_DEBUG] Calling startConversationForVenue', { courtId });

      slowLogTimer = window.setTimeout(() => {
        console.warn('[CHAT_DEBUG] startConversationForVenue is still pending after 3000ms', {
          courtId,
          elapsedMs: Date.now() - startedAt,
        });
      }, 3000);

      await startConversationForVenue(courtId, { openDrawer: false });

      if (slowLogTimer) {
        window.clearTimeout(slowLogTimer);
      }

      console.log('[CHAT_DEBUG] startConversationForVenue completed successfully');
      setChatProbeStatus('success');
      setChatProbeMessage('Conversation opened successfully. Main chat drawer should now be visible.');
    } catch (error: any) {
      if (slowLogTimer) {
        window.clearTimeout(slowLogTimer);
      }

      console.error('[CHAT_DEBUG] startConversationForVenue failed', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        elapsedMs: Date.now() - startedAt,
      });
      setChatProbeStatus('error');
      setChatProbeMessage(error?.message || 'Failed to open chat conversation');
      toast.error(error?.message || 'Failed to open chat');
    }
  };

  // Fetch booked slots when selected date changes
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!selectedDate || !courtId) return;

      try {
        // Use local date string to avoid UTC shifting the day
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        console.log('=== BOOKED SLOTS FETCH ===');
        console.log('Selected Date object:', selectedDate);
        console.log('Selected Date local string:', dateStr);
        console.log('Court ID:', courtId);
        
        const availability = await bookingService.checkAvailability(courtId, dateStr);
        console.log('Availability response:', availability);
        const slots = availability?.data?.bookedSlots || availability?.bookedSlots || [];
        console.log('Booked slots returned:', slots);
        setBookedSlots(slots);
      } catch (err: any) {
        console.error('Error fetching booked slots:', err?.response?.data || err);
        // Continue anyway, treat all as available
        setBookedSlots([]);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, courtId]);

  // Helper function to format amenities with icons
  const formatAmenities = (amenitiesList: string[]) => {
    const amenityIconMap: { [key: string]: React.ReactNode } = {
      'Air Conditioning': <Zap className="h-4 w-4" />,
      'Air Conditioning (AC)': <Zap className="h-4 w-4" />,
      'Parking': <Car className="h-4 w-4" />,
      'Equipment Rental': <Users className="h-4 w-4" />,
      'Locker Rooms': <Users className="h-4 w-4" />,
      'Changing Rooms': <Users className="h-4 w-4" />,
      'WiFi': <Wifi className="h-4 w-4" />,
      'Wi-Fi': <Wifi className="h-4 w-4" />,
      'Refreshments': <Coffee className="h-4 w-4" />,
      'Cafeteria': <Coffee className="h-4 w-4" />,
      'Lighting': <Zap className="h-4 w-4" />,
    };

    return amenitiesList.map(amenity => ({
      name: amenity,
      icon: amenityIconMap[amenity] || <Star className="h-4 w-4" />
    }));
  };

  // Helper function to format open hours from availability
  const formatOpenHours = (availability: any) => {
    if (!availability || typeof availability !== 'object') return null;

    const rows = Array.isArray(availability) ? availability : Object.values(availability);
    const firstEnabledDay = (rows as any[]).find((a: any) => a?.enabled !== false);
    if (firstEnabledDay?.startTime && firstEnabledDay?.endTime) {
      return `${convert24HourTo12Hour(firstEnabledDay.startTime)} - ${convert24HourTo12Hour(firstEnabledDay.endTime)}`;
    }
    return null;
  };

  // Convert 12-hour time to 24-hour format (e.g., "2:00 PM" -> "14:00")
  const convert12HourTo24Hour = (time12: string): string => {
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return time12;
    
    let [, hours, minutes, period] = match;
    let h = parseInt(hours, 10);
    
    if (/PM/i.test(period) && h !== 12) h += 12;
    if (/AM/i.test(period) && h === 12) h = 0;
    
    return `${String(h).padStart(2, '0')}:${minutes}`;
  };

  const convert24HourTo12Hour = (time24: string): string => {
    const [h, m] = time24.split(':').map(Number);
    const hour12 = h % 12 || 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${hour12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  };

  const toMinutes = (time24: string): number => {
    const [h, m] = time24.split(':').map(Number);
    return (h * 60) + m;
  };

  const fromMinutes = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getVenueOpenClose = () => {
    const fallback = { open: '06:00', close: '22:00' };

    const weeklyAvailability = Array.isArray(court?.availability) ? court.availability : [];
    if (selectedDate && weeklyAvailability.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const selectedDay = dayNames[selectedDate.getDay()];
      const dayAvailability = weeklyAvailability.find((a: any) => a?.day === selectedDay);

      if (dayAvailability) {
        if (!dayAvailability.enabled) {
          return null;
        }

        const open = String(dayAvailability.startTime || '');
        const close = String(dayAvailability.endTime || '');
        if (/^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close) && open < close) {
          return { open, close };
        }
      }
    }

    const openHours = court?.openHours;
    if (typeof openHours !== 'string') return fallback;

    const parts = openHours.split('-').map((p: string) => p.trim());
    if (parts.length !== 2) return fallback;

    const open24 = convert12HourTo24Hour(parts[0]);
    const close24 = convert12HourTo24Hour(parts[1]);

    if (!/^\d{2}:\d{2}$/.test(open24) || !/^\d{2}:\d{2}$/.test(close24)) {
      return fallback;
    }

    return { open: open24, close: close24 };
  };

  // Helper function to filter available slots based on selected duration
  const getAvailableTimeSlotsForDuration = (duration: number) => {
    const venueHours = getVenueOpenClose();
    if (!venueHours) {
      return [];
    }

    const { open, close } = venueHours;
    const openMin = toMinutes(open);
    const closeMin = toMinutes(close);
    const slots: Array<{ time: string; isBooked: boolean; isPast: boolean }> = [];

    for (let startMin = openMin; startMin + (duration * 60) <= closeMin; startMin += 60) {
      const start24 = fromMinutes(startMin);
      const end24 = fromMinutes(startMin + (duration * 60));

      const isBooked = bookedSlots.some((booked: any) => {
        const bookedStart = String(booked?.start || '00:00');
        const bookedEnd = String(booked?.end || '00:00');
        return (
          (start24 >= bookedStart && start24 < bookedEnd) ||
          (end24 > bookedStart && end24 <= bookedEnd) ||
          (start24 <= bookedStart && end24 >= bookedEnd)
        );
      });

      let isPast = false;
      if (selectedDate) {
        const now = new Date();
        const selectedMidnight = new Date(selectedDate);
        selectedMidnight.setHours(0, 0, 0, 0);
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        if (selectedMidnight.getTime() === todayMidnight.getTime()) {
          const [hStr, mStr] = start24.split(':');
          const slotDate = new Date();
          slotDate.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);

          const cutoff = new Date(now.getTime() + 120 * 60 * 1000);
          if (slotDate.getTime() < cutoff.getTime()) {
            isPast = true;
          }
        }
      }

      slots.push({
        time: convert24HourTo12Hour(start24),
        isBooked,
        isPast,
      });
    }

    return slots;
  };

  const durationSlots = useMemo(() => {
    return getAvailableTimeSlotsForDuration(selectedDuration);
  }, [selectedDuration, bookedSlots, selectedDate, court?.openHours]);

  useEffect(() => {
    if (!selectedSlot) return;
    const stillValid = durationSlots.some((slot) => slot.time === selectedSlot && !slot.isBooked && !slot.isPast);
    if (!stillValid) {
      setSelectedSlot('');
    }
  }, [durationSlots, selectedSlot]);

  const nextImage = () => {
    if (!court?.images) return;
    setCurrentImageIndex((prev) => (prev + 1) % court.images.length);
  };

  const prevImage = () => {
    if (!court?.images) return;
    setCurrentImageIndex((prev) => (prev - 1 + court.images.length) % court.images.length);
  };

  const handleAddToCart = async () => {
    if (isBusiness) {
      toast.error('Booking is only available in customer mode.');
      return;
    }
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Please login to add items to cart');
      navigate('/login');
      return;
    }
    if (!selectedDate || !selectedSlot || !court) {
      toast.error('Please select a date and time slot');
      return;
    }

    await addToCart({
      venueId: courtId || court.id,
      date: selectedDate.toISOString().split('T')[0],
      time: selectedSlot,
      duration: selectedDuration,
    });
    toast.success('Added to cart successfully!');
  };

  const totalPrice = selectedSlot && court ? court.price * selectedDuration : 0;
  const userReview = user ? getUserReview(user.id) : null;
  const editingReview = editingReviewId ? reviews.find((r) => r.id === editingReviewId) : userReview;

  const handleStartReview = async () => {
    if (!user) {
      toast.error('Please log in to write a review');
      navigate('/login');
      return;
    }
    // Check if user is a business owner
    const currentRole = user.currentRole || user.profileType;
    if (currentRole === 'business') {
      toast.error('Business owners cannot write reviews. Switch to customer mode to review venues.');
      return;
    }
    const result = await canUserReview(user.id, currentRole);
    if (!result.allowed) {
      setEligibilityMessage(result.reason || 'You cannot review this venue.');
      setShowReviewForm(false);
      return;
    }
    setEligibilityMessage(null);
    // Fetch unreviewed bookings for the dropdown
    await fetchUnreviewedBookings(user.id);
    setEditingReviewId(null);
    setShowReviewForm(true);
  };

  const handleSubmitReview = async ({ rating, comment, bookingId }: { rating: number; comment: string; bookingId?: string }) => {
    if (!user) {
      toast.error('Please log in to write a review');
      navigate('/login');
      return;
    }
    setIsSubmittingReview(true);
    try {
      if (editingReviewId) {
        await updateReview(editingReviewId, { rating, comment });
        toast.success('Review updated');
      } else {
        if (!bookingId) {
          setEligibilityMessage('Please select a visit to review.');
          setShowReviewForm(true);
          return;
        }
        await addReview({
          userId: user.id,
          userName: user.name,
          userAvatar: undefined,
          rating,
          comment,
          bookingId,
          verified: true
        });
        toast.success('Review submitted');
      }
      setShowReviewForm(false);
      setEditingReviewId(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Could not submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleEditReview = (review: any) => {
    setEditingReviewId(review.id);
    setActiveBookingId(review.bookingId);
    setShowReviewForm(true);
  };

  const handleDeleteReview = async (review: any) => {
    if (!window.confirm('Delete your review?')) return;
    await deleteReview(review.id);
    toast.success('Review deleted');
  };

  const handleHelpful = async (review: any) => {
    if (!user) {
      toast.error('Please log in to vote helpful');
      navigate('/login');
      return;
    }
    await toggleHelpful(review.id, user.id);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-0 flex items-center justify-center relative z-30">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading court details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !court) {
    return (
      <div className="min-h-screen bg-gray-50 pt-0 relative z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button
            onClick={() => navigate('/find-court')}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-red-700 mb-2">Unable to Load Court Details</h2>
              <p className="text-red-600 mb-4">{error || 'Court not found'}</p>
              <Button onClick={() => navigate('/find-court')} className="bg-red-600 hover:bg-red-700">
                Return to Court Search
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-0 relative z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          onClick={() => {
            // Check if user came from AI Finder page
            if (fromAI) {
              navigate('/ai-finder');
            } else {
              navigate('/find-court');
            }
          }}
          variant="ghost"
          className="mb-8 rounded-full hover:bg-gray-100 transition-colors duration-200"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        <div className={isBusiness ? "grid grid-cols-1 gap-8" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <Card className="overflow-hidden">
              <div className="relative">
                <ImageWithFallback
                  src={court.images[currentImageIndex]}
                  alt={court.name}
                  className="w-full h-96 object-cover"
                />
                <Button
                  onClick={prevImage}
                  variant="ghost"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={nextImage}
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white hover:bg-opacity-70"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {court.images.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      aria-label={`View image ${index + 1} of ${court.images.length}`}
                      className={`w-3 h-3 rounded-full ${
                        index === currentImageIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                      }`}
                    />
                  ))}
                </div>
                {!isBusiness && courtId && (
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('authToken');
                      if (!token) {
                        toast.error('Please login to add favorites');
                        navigate('/login');
                        return;
                      }
                      
                      try {
                        if (isFavorite(courtId)) {
                          await removeFavorite(courtId);
                          toast.success(`${court.name} removed from favorites`);
                        } else {
                          await addFavorite(courtId);
                          toast.success(`${court.name} added to favorites`);
                        }
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to update favorites');
                      }
                    }}
                    aria-label={courtId && isFavorite(courtId) ? 'Remove from favorites' : 'Add to favorites'}
                    className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg"
                  >
                    <Heart className={`h-5 w-5 ${courtId && isFavorite(courtId) ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
                  </button>
                )}
              </div>
            </Card>

            {/* Court Details */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-4xl font-bold text-[#010101] mb-3">{court.name}</h1>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-[#98e209] text-[#010101] rounded-full px-3 py-1 text-xs font-semibold">
                        {court.sport}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-2 text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-[#98e209]" />
                        <span className="text-sm">{court.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[#98e209]" />
                        <span className="text-sm">{court.openHours}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-3">
                      <Star className="h-5 w-5 text-yellow-400 fill-current" />
                      <span className="text-2xl font-bold text-[#010101]">{stats.average.toFixed(1)}</span>
                      <span className="text-sm text-gray-600">({stats.count} reviews)</span>
                    </div>
                    <p className="text-4xl font-bold text-[#98e209]">
                      Rs {court.price}<span className="text-sm text-gray-600 font-normal">/hour</span>
                    </p>
                  </div>
                </div>

                <p className="text-gray-600 text-base leading-relaxed mb-8">{court.description}</p>

                {/* Rules */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-[#010101] mb-4">Court Rules</h3>
                  <ul className="space-y-2 grid grid-cols-1 md:grid-cols-2">
                    {court.rules.map((rule: any, index: number) => (
                      <li key={index} className="flex items-start space-x-3">
                        <span className="text-[#98e209] font-bold text-lg">•</span>
                        <span className="text-sm text-gray-700">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold text-[#010101]">
                    Reviews
                  </CardTitle>
                  {user && (user.currentRole || user.profileType) !== 'business' && (
                    <Button
                      size="sm"
                      className="rounded-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                      onClick={handleStartReview}
                    >
                      {userReview ? 'Edit your review' : 'Write a review'}
                    </Button>
                  )}
                </div>
                <ReviewSummary stats={stats} size="detailed" />
                {eligibilityMessage && (
                  <p className="text-sm text-red-600">{eligibilityMessage}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                {showReviewForm && (
                  <ReviewForm
                    mode={editingReviewId ? 'edit' : 'add'}
                    initialRating={editingReview?.rating || 0}
                    initialComment={editingReview?.comment || ''}
                    unreviewedBookings={editingReviewId ? [] : unreviewedBookings}
                    initialBookingId={editingReview?.bookingId || activeBookingId}
                    onSubmit={handleSubmitReview}
                    onCancel={() => {
                      setShowReviewForm(false);
                      setEditingReviewId(null);
                    }}
                    isSubmitting={isSubmittingReview}
                  />
                )}

                <ReviewList
                  reviews={reviews}
                  currentUserId={user?.id}
                  onEdit={handleEditReview}
                  onDelete={handleDeleteReview}
                  onHelpful={handleHelpful}
                />
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          {!isBusiness && (
          <div className="lg:col-span-1">
            {/* Booking Card */}
            <Card className="border border-gray-200 shadow-sm sticky top-24">
              <CardHeader className="pb-4 bg-gradient-to-r from-[#98e209] from-10% to-transparent to-90% bg-opacity-5 rounded-t-lg">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-[#010101]">Book This Court</span>
                  <span className="text-3xl font-bold text-[#98e209]">
                    Rs {court.price}/hr
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isBusiness && (
                  <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-medium">
                    Booking is disabled for business accounts. Switch to customer profile to book.
                  </div>
                )}
                
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#010101] mb-3">Select Date</label>
                  <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date: Date | undefined) => {
                        console.log('=== CALENDAR DATE SELECTED ===');
                        console.log('Selected date object:', date);
                        console.log('Selected date ISO:', date?.toISOString());
                        console.log('Selected date local:', date?.toLocaleDateString());
                        setSelectedDate(date);
                      }}
                      disabled={(date: Date) => {
                        // Get today at midnight in local timezone
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Compare with the date at midnight
                        const compareDate = new Date(date);
                        compareDate.setHours(0, 0, 0, 0);
                        
                        return compareDate < today;
                      }}
                      className="w-full [&_.rdp]:w-full [&_.rdp-months]:w-full [&_.rdp_month]:w-full"
                    />
                  </div>
                </div>

                {/* Duration Selection */}
                <div>
                  <label className="block text-sm font-semibold text-[#010101] mb-3">Duration</label>
                  <div className="flex gap-2">
                    {[1, 2, 3].map((duration) => (
                      <Button
                        key={duration}
                        size="sm"
                        onClick={() => setSelectedDuration(duration)}
                        className={`flex-1 rounded-lg font-semibold transition-all duration-300 ${
                          selectedDuration === duration
                            ? "bg-[#010101] text-[#98e209] hover:bg-[#1a1a1a] shadow-md"
                            : "border-2 border-gray-300 text-[#010101] bg-white hover:border-[#010101] hover:bg-[#010101] hover:text-[#98e209]"
                        }`}
                      >
                        {duration}h
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div>
                    <label className="block text-sm font-semibold text-[#010101] mb-3">Available Time Slots ({selectedDuration}h)</label>
                    {durationSlots.length === 0 ? (
                      <p className="text-sm text-gray-600 border rounded-lg p-3 bg-gray-50">
                        This venue is closed for the selected day or has no slot window configured.
                      </p>
                    ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2">
                      {durationSlots.map((slot) => {
                        const hasOverlapWithSelection = (() => {
                          if (!selectedSlot || selectedSlot === slot.time) return false;
                          const selectedStartMin = toMinutes(convert12HourTo24Hour(selectedSlot));
                          const selectedEndMin = selectedStartMin + (selectedDuration * 60);

                          const slotStartMin = toMinutes(convert12HourTo24Hour(slot.time));

                          // Only disable in-between subsequent starts inside the selected window.
                          // Example: 2h at 7:00 disables 8:00, but keeps 6:00 selectable.
                          return slotStartMin > selectedStartMin && slotStartMin < selectedEndMin;
                        })();

                        const isDisabled = slot.isBooked || slot.isPast || hasOverlapWithSelection;

                        return (
                          <Button
                            key={slot.time}
                            size="sm"
                            disabled={isDisabled}
                            onClick={() => {
                              if (slot.isBooked) {
                                toast.error(`This court is already booked for ${slot.time}`);
                                return;
                              }
                              if (slot.isPast) {
                                toast.error('Bookings must be made at least 2 hours in advance.');
                                return;
                              }
                              if (hasOverlapWithSelection) {
                                toast.error('This slot overlaps your current selected booking window.');
                                return;
                              }
                              setSelectedSlot(slot.time);
                            }}
                            className={`text-xs rounded-lg font-semibold transition-all duration-300 ${
                              isDisabled
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50 border border-gray-400"
                                : selectedSlot === slot.time
                                ? "bg-[#010101] text-[#98e209] border border-[#010101] shadow-md hover:bg-[#1a1a1a]"
                                : "border-2 border-gray-300 text-[#010101] bg-white hover:bg-[#010101] hover:text-[#98e209] hover:border-[#010101]"
                            }`}
                            title={
                              slot.isBooked
                                ? "This time slot is already booked"
                                : slot.isPast
                                ? "Bookings must be made at least 2 hours in advance."
                                : hasOverlapWithSelection
                                ? "Overlaps your selected booking window"
                                : ""
                            }
                          >
                            {slot.time}
                          </Button>
                        );
                      })}
                    </div>
                    )}
                  </div>
                )}

                {/* Booking Summary */}
                {selectedSlot && (
                  <div className="rounded-lg bg-gradient-to-br from-[#98e209] from-10% to-transparent to-90% bg-opacity-5 border border-[#98e209] border-opacity-30 p-4">
                    <h4 className="text-sm font-semibold text-[#010101] mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium text-[#010101]">{selectedDate?.toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Time:</span>
                        <span className="font-medium text-[#010101]">{selectedSlot}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium text-[#010101]">{selectedDuration} hour{selectedDuration > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg border-t border-[#98e209] border-opacity-30 pt-2 mt-2">
                        <span>Total:</span>
                        <span className="text-[#98e209]">${totalPrice}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 mt-6">
                  <Button
                    onClick={handleAddToCart}
                    className="w-full bg-[#98e209] text-[#010101] hover:bg-[#7ec908] rounded-full font-semibold shadow-md hover:shadow-lg transition-all duration-300 py-2"
                    disabled={!selectedSlot || isBusiness}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    onClick={() => {
                      if (!selectedDate || !selectedSlot || !courtId) return;
                      const price = court.price * selectedDuration;
                      // Use local date string (YYYY-MM-DD)
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      const dateStr = `${year}-${month}-${day}`;

                      console.log('=== BOOKING NOW CLICKED ===');
                      console.log('Selected Date object:', selectedDate);
                      console.log('Date string for booking:', dateStr);
                      console.log('Selected Slot:', selectedSlot);
                      console.log('Selected Duration:', selectedDuration);
                      console.log('Price:', price);

                      navigate('/checkout', {
                        state: {
                          directBooking: {
                            venueId: courtId,
                            date: dateStr,
                            startTime: selectedSlot,
                            duration: selectedDuration,
                            price,
                            court: court.name,
                          }
                        }
                      });
                    }}
                    className="w-full bg-[#010101] text-[#98e209] hover:bg-[#1a1a1a] rounded-full font-semibold border-2 border-[#010101] shadow-md hover:shadow-lg transition-all duration-300 py-2"
                    disabled={!selectedSlot || isBusiness}
                  >
                    Book Now
                  </Button>
                </div>

                {/* Contact Info Section */}
                <div className="pt-6 border-t border-gray-200 mt-6">
                  <h4 className="text-lg font-semibold text-[#010101] mb-4">Contact Venue</h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-4 p-3 rounded-lg bg-gradient-to-r from-[#98e209] from-10% to-transparent to-90% bg-opacity-5 border border-[#98e209] border-opacity-20 hover:border-opacity-40 transition-all duration-200">
                      <Phone className="h-5 w-5 text-[#98e209] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Phone</p>
                        <p className="text-sm font-semibold text-[#010101] truncate">{court.contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 p-3 rounded-lg bg-gradient-to-r from-[#98e209] from-10% to-transparent to-90% bg-opacity-5 border border-[#98e209] border-opacity-20 hover:border-opacity-40 transition-all duration-200">
                      <Mail className="h-5 w-5 text-[#98e209] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Email</p>
                        <p className="text-sm font-semibold text-[#010101] truncate">{court.contact.email}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleOpenChat}
                      disabled={Boolean(user && userType === 'business')}
                      className="w-full rounded-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08] font-semibold shadow-md hover:shadow-lg transition-all duration-200 mt-4 mb-4 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {user ? 'Chat with Owner' : 'Login to Chat'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </div>
      </div>
      {chatProbeOpen && (
        <div className="fixed bottom-5 right-5 w-[min(92vw,360px)] rounded-2xl border border-[#d9ef9d] bg-white p-4 shadow-2xl" style={{ zIndex: 10002 }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#010101]">Chat Click Debug Panel</p>
            <button
              type="button"
              onClick={() => setChatProbeOpen(false)}
              className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">Status: <span className="font-semibold text-[#010101]">{chatProbeStatus}</span></p>
          <p className="mt-1 text-xs text-gray-600 wrap-break-word">{chatProbeMessage}</p>
        </div>
      )}
      {chatTestFormOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/45"
            style={{ zIndex: 10003 }}
            onClick={() => setChatTestFormOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed left-1/2 top-1/2 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-6 shadow-2xl"
            style={{ zIndex: 10004 }}
            role="dialog"
            aria-modal="true"
            aria-label="Chat owner test form"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-[#010101]">Chat with Owner</p>
                <p className="mt-1 text-sm text-gray-600">
                  This is a page-local chat window using the same chat conversation and messages as the main chat feature.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatTestFormOpen(false)}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendLocalChatMessage().catch(() => undefined);
              }}
            >
              <div className="rounded-2xl border border-gray-200 bg-[#f8fbea] p-4">
                {startingConversation ? (
                  <p className="text-sm text-gray-700">Opening conversation with the venue owner...</p>
                ) : startingConversationError ? (
                  <p className="text-sm text-red-600">{startingConversationError}</p>
                ) : activeConversation ? (
                  <div className="space-y-3">
                    <div className="border-b border-[#d9ef9d] pb-3">
                      <p className="text-sm font-semibold text-[#010101]">{activeConversation.otherParticipant.name}</p>
                      <p className="text-xs text-gray-500">{activeConversation.venueName || 'Venue owner chat'}</p>
                    </div>

                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {messagesLoading ? (
                        <p className="text-sm text-gray-600">Loading messages...</p>
                      ) : messagesError ? (
                        <p className="text-sm text-red-600">{messagesError}</p>
                      ) : messages.length === 0 ? (
                        <p className="text-sm text-gray-600">No messages yet. Send the first one below.</p>
                      ) : (
                        messages.map((message) => {
                          const isMine = message.senderId !== activeConversation.otherParticipant.userId;

                          return (
                            <div
                              key={message.id}
                              className={`rounded-2xl px-4 py-3 text-sm ${
                                isMine
                                  ? 'ml-8 bg-[#010101] text-white'
                                  : 'mr-8 border border-[#d9ef9d] bg-white text-[#010101]'
                              }`}
                            >
                              <p className="wrap-break-word whitespace-pre-wrap">{message.content}</p>
                              <p className={`mt-1 text-[11px] ${isMine ? 'text-gray-300' : 'text-gray-500'}`}>
                                {new Date(message.createdAt).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Waiting for chat conversation data...</p>
                )}
              </div>

              <div>
                <label htmlFor="chat-test-message" className="mb-1 block text-sm font-medium text-[#010101]">
                  Message
                </label>
                <textarea
                  id="chat-test-message"
                  value={chatDraftMessage}
                  onChange={(event) => setChatDraftMessage(event.target.value)}
                  placeholder="Type a message to the owner"
                  rows={4}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-[#98e209]"
                />
              </div>

              <div className="rounded-2xl border border-[#d9ef9d] bg-[#f7fce8] px-4 py-3 text-sm text-gray-700">
                <p><span className="font-semibold text-[#010101]">Live status:</span> {chatProbeStatus}</p>
                <p className="mt-1 wrap-break-word">{chatProbeMessage}</p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setChatTestFormOpen(false)}
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!chatDraftMessage.trim() || !activeConversation || chatDraftSending}
                  className="rounded-full bg-[#98e209] px-5 py-2 text-sm font-semibold text-[#010101] hover:bg-[#89cb08]"
                >
                  {chatDraftSending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}