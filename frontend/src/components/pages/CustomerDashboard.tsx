import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  Settings,
  Heart,
  CreditCard,
  User,
  Bell,
  LogOut,
  Edit,
  Star,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../ui/avatar";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { StatCard, BookingCard, ChangePasswordDialog } from "../common";
import { BookingDetailsModal } from "../common/BookingDetailsModal";
import { ChatConversationList } from "../chat/ChatConversationList";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useAuth } from "../../contexts";
import userService from "../../services/userService";
import { toast } from "sonner";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useFavorites } from "../../hooks/useFavorites";
import { useUserProfile } from "../../hooks/useUserProfile";
import bookingService from "../../services/bookingService";

export function CustomerDashboard() {
  usePageTitle('Customer Dashboard', 'Manage your bookings, favorites, and account settings.');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const { profile, loading: profileLoading, updateProfile, changePassword, deleteAccount } = useUserProfile();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [favorites, addFavorite, removeFavorite, isFavorite, refreshFavorites, favoritesLoading] = useFavorites();
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "upcoming" | "history">("upcoming");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<null | {
    id: string;
    customerName: string;
    court: string;
    date: string;
    time: string;
    price: number;
    status: string;
    customerEmail?: string;
    customerPhone?: string;
    venueLocation?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    notes?: string;
    bookingId?: string;
    duration?: number;
  }>(null);

  // Derive dynamic user display information
  const displayName = profile?.name || user?.name || 'User';
  const displayEmail = profile?.email || user?.email || 'user@example.com';
  const displayPhone = profile?.phone || user?.phone || '';
  const [nameInput, setNameInput] = useState(displayName);
  const [emailInput, setEmailInput] = useState(displayEmail);
  const [phoneInput, setPhoneInput] = useState(displayPhone);
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Update form fields when profile loads
  useEffect(() => {
    if (profile) {
      setNameInput(profile.name || '');
      setEmailInput(profile.email || '');
      setPhoneInput(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    const requestedTab = (location.state as { defaultTab?: string } | null)?.defaultTab;
    if (requestedTab === 'messages') {
      setActiveTab('messages');
    }
  }, [location.state]);

  const refreshBookings = async () => {
    try {
      setBookingsLoading(true);
      setBookingsError(null);
      const response = await bookingService.getMyBookings();
      console.log('Bookings Response:', response);
      const bookingsData = response?.data?.bookings || response?.bookings || [];
      const normalized = Array.isArray(bookingsData) ? bookingsData : [];
      setBookings(normalized);
      return normalized;
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      setBookingsError(error?.response?.data?.message || error?.message || 'Failed to load bookings');
      setBookings([]);
      return [];
    } finally {
      setBookingsLoading(false);
    }
  };

  // Fetch bookings on component mount
  useEffect(() => {
    refreshBookings();
  }, []);

  // Handle Stripe checkout return status and refresh bookings.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get('payment');
    const bookingId = params.get('bookingId');
    const sessionId = params.get('session_id');

    if (!paymentStatus) return;

    const handleStripeReturn = async () => {
      if (paymentStatus === 'success') {
        if (bookingId && sessionId) {
          try {
            await bookingService.confirmDepositCheckoutSession(String(bookingId), String(sessionId));
          } catch (error) {
            console.warn('Checkout confirmation API did not complete immediately:', error);
          }
        }

        const maxAttempts = 5;
        let isPaid = false;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const updatedBookings = await refreshBookings();
          const matchedBooking = bookingId
            ? updatedBookings.find((b: any) => String(b?._id || b?.id) === String(bookingId))
            : null;

          if ((matchedBooking?.paymentStatus || '').toString().toLowerCase() === 'paid') {
            isPaid = true;
            break;
          }

          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (isPaid) {
          toast.success('Deposit payment confirmed successfully.');
        } else {
          toast.info('Payment submitted. Verification is in progress; refresh in a few seconds if status is still pending.');
        }
      } else if (paymentStatus === 'cancelled') {
        toast.error('Deposit payment was cancelled. You can retry from your booking list.');
      }

      navigate('/dashboard/customer', { replace: true });
    };

    handleStripeReturn();
  }, [location.search, navigate]);

  // Derived stats from bookings and favorites
  const isBookingFinished = (b: any) => {
    const status = (b?.status || '').toString().toLowerCase();
    if (status === 'completed') return true;
    const dateStr = b?.bookingDate || b?.date;
    const end24 = b?.timeSlot?.end || b?.end24;
    if (!dateStr) return false;
    const bookingDate = new Date(dateStr);
    if (isNaN(bookingDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bd = new Date(bookingDate);
    bd.setHours(0, 0, 0, 0);
    if (bd < today) return true; // any past date is finished
    if (bd > today) return false; // future date not finished
    if (!end24 || !/^\d{2}:\d{2}$/.test(String(end24))) return false; // need valid end time for today
    const [endH, endM] = String(end24).split(':');
    const endDateTime = new Date(`${bookingDate.toISOString().split('T')[0]}T${endH}:${endM}:00`);
    const now = new Date();
    return now >= endDateTime;
  };

  const totalBookings = bookings.length;
  const totalHoursPlayed = bookings
    .filter(isBookingFinished)
    .reduce((sum, b) => sum + (Number(b.duration) || 0), 0);
  // Count only successful, non-refunded payments as actual customer spending.
  const getPaidAmount = (b: any) => {
    const bookingStatus = (b?.status || '').toString().toLowerCase();
    const paymentStatus = (b?.paymentStatus || '').toString().toLowerCase();

    // Completed bookings: the full session was used, count the full price.
    if (bookingStatus === 'completed' && paymentStatus !== 'refunded') {
      return Number(b?.totalPrice ?? b?.price ?? 0) || 0;
    }

    if (paymentStatus !== 'paid') return 0;

    const amountPaid = Number(b?.paymentInfo?.amountPaid);
    if (Number.isFinite(amountPaid) && amountPaid > 0) return amountPaid;

    const depositAmount = Number(b?.paymentInfo?.depositAmount);
    if (Number.isFinite(depositAmount) && depositAmount > 0) return depositAmount;

    // Fallback for legacy data where amountPaid/depositAmount might be missing.
    return Number(b?.totalPrice ?? b?.price ?? 0) || 0;
  };

  const totalSpent = bookings.reduce((sum, b) => sum + getPaidAmount(b), 0);

  // Month-over-month for bookings and spending
  const getMonthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentMonthKey = getMonthKey(new Date());
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = getMonthKey(prevDate);

  const monthAgg = bookings.reduce(
    (acc, b) => {
      const dateStr = b?.bookingDate || b?.date;
      if (!dateStr) return acc;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return acc;
      const key = getMonthKey(d);
      if (key === acc.currentKey) {
        acc.currentBookings += 1;
        acc.currentSpent += getPaidAmount(b);
      }
      if (key === acc.prevKey) {
        acc.prevBookings += 1;
        acc.prevSpent += getPaidAmount(b);
      }
      return acc;
    },
    {
      currentKey: currentMonthKey,
      prevKey: prevMonthKey,
      currentBookings: 0,
      prevBookings: 0,
      currentSpent: 0,
      prevSpent: 0,
    }
  );

  const calcTrend = (current: number, prev: number) => {
    if (prev === 0) {
      if (current === 0) return { value: 0, isPositive: true };
      return { value: 100, isPositive: true };
    }
    const change = ((current - prev) / prev) * 100;
    return { value: Math.round(change), isPositive: change >= 0 };
  };

  const bookingsTrend = calcTrend(monthAgg.currentBookings, monthAgg.prevBookings);
  const spentTrend = calcTrend(monthAgg.currentSpent, monthAgg.prevSpent);

  // Convert 24-hour time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '00:00 AM';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')} ${period}`;
  };

  // Format booking data for display
  const formatBooking = (booking: any) => {
    console.log('Raw booking data:', booking);
    
    const venueName = booking.venue?.title || booking.venue?.name || booking.venueName || 'Unknown Venue';
    const sportType = booking.venue?.sport || booking.venue?.sportType || booking.sport || 'Sports';
    const venueImages = booking.venue?.images || [];
    const venueImage = Array.isArray(venueImages) ? venueImages[0] : venueImages;
    
    // Format time in 12-hour format
    const start24 = booking.timeSlot?.start || '00:00';
    const end24 = booking.timeSlot?.end || '00:00';
    const startTime = formatTime12Hour(start24);
    const endTime = formatTime12Hour(end24);
    
    return {
      id: booking._id || booking.id,
      court: venueName,
      sport: sportType,
      date: booking.bookingDate ? new Date(booking.bookingDate).toISOString().split('T')[0] : '',
      time: `${startTime} - ${endTime}`,
      price: booking.totalPrice || booking.price || 0,
      status: booking.status?.toLowerCase() || 'pending',
      paymentStatus: booking.paymentStatus?.toLowerCase() || 'pending',
      paymentMethod: booking.paymentInfo?.method,
      notes: booking.notes,
      bookingReference: booking._id || booking.id,
      image: venueImage || 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300',
      duration: booking.duration || 1,
      start24,
      end24,
    };
  };

  // Sort helper: pending first → confirmed → completed/cancelled, then most recent date first within group
  const sortByStatusThenDate = (a: any, b: any) => {
    const priority: Record<string, number> = { pending: 0, confirmed: 1, completed: 2, cancelled: 2 };
    const pa = priority[a.status] ?? 3;
    const pb = priority[b.status] ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  };

  // Filter bookings based on status and date
  const filteredBookings = bookings
    .map(formatBooking)
    .filter(booking => {
      if (filterStatus === 'all') return true;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(booking.date);
      bookingDate.setHours(0, 0, 0, 0);
      const [endH = '00', endM = '00'] = (booking as any).end24?.split(':') || [];
      const [startH = '00', startM = '00'] = (booking as any).start24?.split(':') || [];
      const endDateTime = new Date(booking.date + 'T' + `${endH}:${endM}:00`);
      const startDateTime = new Date(booking.date + 'T' + `${startH}:${startM}:00`);
      const now = new Date();
      
      if (filterStatus === 'upcoming') {
        // Show pending (awaiting owner confirmation) and confirmed bookings whose play time hasn't ended
        const futureDate = bookingDate > today;
        const todayNotEnded = bookingDate.getTime() === today.getTime() && now < endDateTime;
        return (futureDate || todayNotEnded) && (booking.status === 'pending' || booking.status === 'confirmed');
      }
      
      if (filterStatus === 'history') {
        // History = completed or cancelled only
        return booking.status === 'completed' || booking.status === 'cancelled';
      }
      
      return booking.status === filterStatus;
    });
  const sortedFilteredBookings = [...filteredBookings].sort(sortByStatusThenDate);

  const recentBookings = sortedFilteredBookings.slice(0, 3);

  // Overview widget: all bookings — pending first, confirmed next, completed/cancelled last,
  // within each group most recent date first. Top 3.
  const overviewRecentBookings = bookings
    .map(formatBooking)
    .sort(sortByStatusThenDate)
    .slice(0, 3);

  const handleRemoveFavorite = async (venueId: string, venueName: string) => {
    try {
      await removeFavorite(venueId);
      toast.success(`${venueName} removed from favorites`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove favorite');
    }
  };

  const handleCancelBooking = async (bookingId: string | number) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      const response = await bookingService.cancelBooking(String(bookingId), 'User requested cancellation');
      console.log('Booking cancelled:', response);
      toast.success('Booking cancelled successfully');
      
      // Refresh bookings list
      await refreshBookings();
    } catch (error: any) {
      console.error('Cancel booking error:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to cancel booking';
      toast.error(errorMsg);
    }
  };

  const handlePayDeposit = async (bookingId: string | number) => {
    try {
      const response = await bookingService.createDepositCheckoutSession(String(bookingId));
      const checkoutUrl = response?.data?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error('Stripe checkout URL was not returned by server');
      }

      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error('Deposit payment initialization error:', error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to start deposit payment';
      toast.error(errorMsg);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":    return "Awaiting Confirmation";
      case "confirmed":  return "Confirmed";
      case "completed":  return "Completed";
      case "cancelled":  return "Cancelled";
      default:           return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <Avatar className="h-16 w-16">
              <AvatarImage src="/api/placeholder/64/64" />
              <AvatarFallback className="bg-[#98e209] text-[#010101] text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-[#010101]">
                Welcome back, {displayName}!
              </h1>
              <p className="text-gray-600">
                Manage your bookings and profile
              </p>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="outline"
            className="text-[#010101] hover:text-[#010101] hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Calendar}
            title="Total Bookings"
            value={totalBookings.toString()}
            trend={bookingsTrend}
            iconClassName="text-[#98e209]"
            iconBgClassName="bg-[#98e209] bg-opacity-20"
          />
          <StatCard
            icon={Clock}
            title="Hours Played"
            value={totalHoursPlayed.toString()}
            iconClassName="text-blue-600"
            iconBgClassName="bg-blue-100"
          />
          <StatCard
            icon={Heart}
            title="Favorite Venues"
            value={favorites.length.toString()}
            iconClassName="text-purple-600"
            iconBgClassName="bg-purple-100"
          />
          <StatCard
            icon={CreditCard}
            title="Total Spent"
            value={`Rs ${totalSpent.toFixed(0)}`}
            trend={spentTrend}
            iconClassName="text-green-600"
            iconBgClassName="bg-green-100"
          />
        </div>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-8 flex w-full items-center gap-1 rounded-full border border-[#d9d9df] bg-[#ececf1] p-1">
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="overview">Overview</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="bookings">
              My Bookings
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="favorites">
              Favorites
            </TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="messages">Messages</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Bookings */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Recent Bookings</CardTitle>
                    <Button
                      onClick={() => setActiveTab("bookings")}
                      variant="ghost"
                      size="sm"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-4 mb-3">
                    {bookingsLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98e209]"></div>
                      </div>
                    ) : bookingsError ? (
                      <div className="text-center py-12">
                        <p className="text-red-600 mb-4">{bookingsError}</p>
                        <Button onClick={() => window.location.reload()} variant="outline">
                          Try Again
                        </Button>
                      </div>
                    ) : overviewRecentBookings.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No bookings yet</h3>
                        <p className="text-gray-600 mb-4">Start booking venues to see your bookings here</p>
                        <Button onClick={() => navigate('/find-court')} className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]">
                          Find Courts
                        </Button>
                      </div>
                    ) : (
                      overviewRecentBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between space-x-4 p-3 border rounded-lg"
                        >
                          <div className="flex items-center space-x-4 flex-1">
                            <ImageWithFallback
                              src={booking.image}
                              alt={booking.court}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#010101] truncate">
                                {booking.court}
                              </p>
                              <p className="text-sm text-gray-600">
                                {booking.date} • {booking.time}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge
                              className={getStatusColor(booking.status)}
                            >
                              {getStatusLabel(booking.status)}
                            </Badge>
                            {(() => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const bookingDate = new Date(booking.date);
                              bookingDate.setHours(0, 0, 0, 0);
                              const isNotPast = bookingDate >= today;
                              return booking.status === "confirmed" && isNotPast && (
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  title="Cancel booking"
                                >
                                  ✕
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-3">
                    <Button
                      onClick={() => navigate("/find-court")}
                      variant="outline"
                      className="w-full justify-start h-12 font-medium hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm transition-all"
                    >
                      <Calendar className="h-5 w-5 mr-3" />
                      Book a New Court
                    </Button>
                    <Button
                      onClick={() => navigate("/cart")}
                      variant="outline"
                      className="w-full justify-start h-12 font-medium hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm transition-all"
                    >
                      <CreditCard className="h-5 w-5 mr-3" />
                      View Cart
                    </Button>
                    <Button
                      onClick={() => setActiveTab("favorites")}
                      variant="outline"
                      className="w-full justify-start h-12 font-medium hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm transition-all"
                    >
                      <Heart className="h-5 w-5 mr-3" />
                      Browse Favorites
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <ChatConversationList role="customer" />
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Booking History</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant={filterStatus === "all" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setFilterStatus("all")}
                    >
                      All
                    </Button>
                    <Button 
                      variant={filterStatus === "upcoming" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setFilterStatus("upcoming")}
                    >
                      Upcoming
                    </Button>
                    <Button 
                      variant={filterStatus === "history" ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setFilterStatus("history")}
                    >
                      History
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="space-y-4">
                  {bookingsLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98e209]"></div>
                    </div>
                  ) : bookingsError ? (
                    <div className="text-center py-12">
                      <p className="text-red-600 mb-4">{bookingsError}</p>
                      <Button onClick={() => window.location.reload()} variant="outline">
                        Try Again
                      </Button>
                    </div>
                  ) : sortedFilteredBookings.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No {filterStatus === 'history' ? 'past' : filterStatus !== 'all' ? filterStatus : ''} bookings</h3>
                      <p className="text-gray-600 mb-4">You don't have any {filterStatus === 'history' ? 'completed or cancelled' : filterStatus !== 'all' ? filterStatus : ''} bookings yet</p>
                      <Button onClick={() => navigate('/find-court')} className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]">
                        Find Courts
                      </Button>
                    </div>
                  ) : (
                    sortedFilteredBookings.map((booking) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const bookingDate = new Date(booking.date);
                      bookingDate.setHours(0, 0, 0, 0);
                      const isNotPast = bookingDate >= today;
                      
                      return (
                        <BookingCard
                          key={booking.id}
                          id={booking.id}
                          venueName={booking.court}
                          venueImage={booking.image}
                          sport={booking.sport}
                          date={booking.date}
                          timeSlot={booking.time}
                          duration={booking.duration}
                          totalPrice={booking.price}
                          status={booking.status as "upcoming" | "completed" | "cancelled" | "confirmed" | "pending"}
                          onViewDetails={() => {
                            setDetailsOpen(true);
                            setSelectedBooking({
                              id: String(booking.id),
                              customerName: booking.customerName || displayName || 'You',
                              court: booking.court,
                              date: booking.date,
                              time: booking.time,
                              price: booking.price,
                              status: booking.status,
                              customerEmail: displayEmail,
                              customerPhone: displayPhone,
                              venueLocation: booking.location,
                              paymentMethod: booking.paymentMethod,
                              paymentStatus: booking.paymentStatus,
                              notes: booking.notes,
                              bookingId: booking.bookingReference || String(booking.id),
                              duration: booking.duration,
                            });
                          }}
                          onPayDeposit={
                            booking.status === "confirmed" &&
                            (booking.paymentStatus === "pending" || booking.paymentStatus === "failed") &&
                            isNotPast
                              ? () => handlePayDeposit(booking.id)
                              : undefined
                          }
                          onCancel={booking.status === "confirmed" && isNotPast ? () => handleCancelBooking(booking.id) : undefined}
                          onRebook={booking.status === "completed" ? () => navigate("/find-court") : undefined}
                        />
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favorites">
            <Card>
              <CardHeader>
                <CardTitle>Favorite Venues</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {favoritesLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98e209]"></div>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No favorites yet</h3>
                    <p className="text-gray-600 mb-4">Start adding venues to your favorites to see them here</p>
                    <Button onClick={() => navigate('/find-court')} className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]">
                      Browse Venues
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map((venue) => {
                      const venueId = venue._id || venue.id;
                      const venueName = venue.title || venue.name || 'Unnamed Venue';
                      const venueImage = venue.images?.[0] || venue.image || '';
                      const venueSport = venue.sport;
                      const venueRating = venue.rating || 0;
                      
                      return (
                        <div
                          key={venueId}
                          className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                          onClick={() => navigate(`/court/${venueId}`)}
                        >
                          <ImageWithFallback
                            src={venueImage}
                            alt={venueName}
                            className="w-full h-32 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="font-bold text-[#010101] mb-1">
                              {venueName}
                            </h3>
                            <Badge className="mb-2">
                              {venueSport}
                            </Badge>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                <span className="ml-1 text-sm">
                                  {venueRating > 0 ? venueRating.toFixed(1) : 'New'}
                                </span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFavorite(venueId, venueName);
                                }}
                              >
                                <Heart className="h-4 w-4 text-red-500 fill-current" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Profile Settings */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Profile Information</CardTitle>
                    <Button
                      onClick={() =>
                        setEditingProfile(!editingProfile)
                      }
                      variant="ghost"
                      size="sm"
                    >
                      {editingProfile ? <X className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                      {editingProfile ? "Cancel" : "Edit"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-8">
                  <div className="flex items-center space-x-4 mb-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src="/api/placeholder/80/80" />
                      <AvatarFallback className="bg-[#98e209] text-[#010101] text-2xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {editingProfile && (
                      <Button variant="outline" size="sm">
                        Change Photo
                      </Button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="mb-2 block">Full Name</Label>
                      <Input
                        id="name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={!editingProfile}
                        className={
                          !editingProfile ? "bg-gray-50" : ""
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="mb-2 block">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        disabled={true}
                        className={
                          !editingProfile ? "bg-gray-50" : ""
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="mb-2 block">Phone</Label>
                      <Input
                        id="phone"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        disabled={!editingProfile}
                        className={
                          !editingProfile ? "bg-gray-50" : ""
                        }
                      />
                    </div>
                  </div>

                  {editingProfile && (
                    <div className="flex gap-2 pt-4">
                      <Button 
                        className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                        disabled={profileLoading}
                        onClick={async () => {
                          try {
                            const payload: any = {};
                            if (nameInput !== (profile?.name || '')) payload.name = nameInput;
                            if (phoneInput !== (profile?.phone || '')) payload.phone = phoneInput;
                            if (Object.keys(payload).length === 0) {
                              toast.info('No changes to save');
                              setEditingProfile(false);
                              return;
                            }
                            await updateProfile(payload);
                            setEditingProfile(false);
                          } catch (err: any) {
                            console.error('Update error:', err);
                          }
                        }}
                      >
                        {profileLoading ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={profileLoading}
                        onClick={() => setPasswordDialogOpen(true)}
                      >
                        Change Password
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={profileLoading}
                        onClick={async () => {
                          if (!window.confirm('Delete your account? This cannot be undone.')) return;
                          try {
                            await deleteAccount();
                          } catch (err: any) {
                            console.error('Delete account error:', err);
                          }
                        }}
                      >
                        Delete Account
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Notification Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Booking Confirmations
                      </p>
                      <p className="text-sm text-gray-600">
                        Get notified when bookings are confirmed
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Booking Reminders
                      </p>
                      <p className="text-sm text-gray-600">
                        Reminders before your booking time
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Special Offers
                      </p>
                      <p className="text-sm text-gray-600">
                        Receive promotional offers and discounts
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">New Venues</p>
                      <p className="text-sm text-gray-600">
                        Notifications about new courts near you
                      </p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={changePassword}
      />

      {/* Booking Details Modal */}
      {selectedBooking && (
        <BookingDetailsModal
          open={detailsOpen}
          onOpenChange={(open) => {
            setDetailsOpen(open);
            if (!open) setSelectedBooking(null);
          }}
          booking={selectedBooking}
        />
      )}
    </div>
  );
}