import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, Calendar, Users, TrendingUp, Plus, Edit, Eye, Settings, LogOut, MapPin, Star, Clock, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { StatCard, ChangePasswordDialog } from '../common';
import { ChatConversationList } from '../chat/ChatConversationList';
import { useAuth } from '../../contexts';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import bookingService from '../../services/bookingService';
import { ContactCustomerModal } from './ContactCustomerModal';

export function BusinessDashboard() {
    const { profile, loading: profileLoading, updateProfile, changePassword, deleteAccount } = useUserProfile();
  usePageTitle('Business Dashboard', 'Manage your venues, bookings, and revenue analytics.');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  // Derive dynamic user display information
  const displayName = profile?.name || user?.name || 'Business User';
  const displayEmail = profile?.email || user?.email || 'business@example.com';
  const displayPhone = profile?.phone || user?.phone || '';
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map(part => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Form state for business profile
  const [nameInput, setNameInput] = useState(displayName);
  const [emailInput] = useState(displayEmail); // Email is read-only
  const [phoneInput, setPhoneInput] = useState(displayPhone);
  const [commissionInput, setCommissionInput] = useState('10');
  
  useEffect(() => {
    if (profile) {
      setNameInput(profile.name || user?.name || '');
      setPhoneInput(profile.phone || user?.phone || '');
    }
  }, [profile, user]);

  useEffect(() => {
    const requestedTab = (location.state as { defaultTab?: string } | null)?.defaultTab;
    if (requestedTab === 'messages') {
      setActiveTab('messages');
    }
  }, [location.state]);

  // My venues fetched from API
  const [myVenues, setMyVenues] = useState<any[]>([]);
  const [loadingMyVenues, setLoadingMyVenues] = useState(false);
  const [myVenuesError, setMyVenuesError] = useState<string | null>(null);

  // Top venues fetched from API
  const [topVenues, setTopVenues] = useState<any[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingFilterStatus, setBookingFilterStatus] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<{ month: string; bookings: number; revenue: number }[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  useEffect(() => {
    const loadTop = async () => {
      setLoadingTop(true);
      setTopError(null);
      try {
        // Only attempt if business role
        const role = user?.currentRole || user?.profileType;
        if (!(role === 'business' || role === 'both')) {
          setLoadingTop(false);
          return;
        }
        const resp = await (await import('../../services/venueService')).default.getTopVenues(3);
        // Expected shape: { success, data: { venues: [...] } }
        const venues = resp?.data?.venues || [];
        setTopVenues(venues);
      } catch (e: any) {
        setTopError(e?.message || 'Failed to load top venues');
      } finally {
        setLoadingTop(false);
      }
    };
    loadTop();
  }, [user]);

  // Fetch bookings for business owner
  useEffect(() => {
    const loadBookings = async () => {
      try {
        setBookingsLoading(true);
        setBookingsError(null);
        const response = await bookingService.getMyBookings();
        console.log('Business Bookings Response:', response);
        // API returns: { success: true, message: '...', data: { bookings: [...], pagination: {...} } }
        const bookingsData = response?.data?.bookings || response?.bookings || [];
        setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      } catch (error: any) {
        console.error('Error fetching business bookings:', error);
        setBookingsError(error?.response?.data?.message || error?.message || 'Failed to load bookings');
        setBookings([]);
      } finally {
        setBookingsLoading(false);
      }
    };
    loadBookings();
  }, [user]);

  // Fetch my venues
  useEffect(() => {
    const loadMine = async () => {
      setLoadingMyVenues(true);
      setMyVenuesError(null);
      try {
        const role = user?.currentRole || user?.profileType;
        if (!(role === 'business' || role === 'both')) {
          setLoadingMyVenues(false);
          return;
        }
        const resp = await (await import('../../services/venueService')).default.getMyVenues();
        const venues = resp?.data?.venues || [];
        setMyVenues(venues);
      } catch (e: any) {
        setMyVenuesError(e?.message || 'Failed to load your venues');
      } finally {
        setLoadingMyVenues(false);
      }
    };
    loadMine();
  }, [user]);

  // Derived stats
  // Revenue from venues (monthly figures if API provides),
  // Bookings count reflects actual fetched bookings
  // Helper: determine if a booking's play time has finished
  const isBookingFinished = (b: any) => {
    const status = (b?.status || '').toString().toLowerCase();
    if (status === 'completed') return true;
    const dateStr = b?.bookingDate;
    const end24 = b?.timeSlot?.end as string | undefined;
    if (!dateStr) return false;
    const bookingDate = new Date(dateStr);
    if (isNaN(bookingDate.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bd = new Date(bookingDate);
    bd.setHours(0, 0, 0, 0);
    // If booking date is before today, it's finished regardless of end time
    if (bd < today) return true;
    // If booking date is after today, not finished
    if (bd > today) return false;
    // For today, we need a valid end time (HH:MM)
    if (!end24 || !/^\d{2}:\d{2}$/.test(end24)) return false;
    const [endH, endM] = end24.split(':');
    const endDateTime = new Date(`${bookingDate.toISOString().split('T')[0]}T${endH}:${endM}:00`);
    const now = new Date();
    return now >= endDateTime;
  };

  const totalRevenue = bookings.reduce((sum, b) => {
    const status = (b?.status || '').toString().toLowerCase();
    if (status === 'cancelled') return sum;
    if (!isBookingFinished(b)) return sum; // count only realized revenue
    const amount = Number(b?.totalPrice ?? b?.price ?? 0) || 0;
    return sum + amount;
  }, 0);
  const totalBookings = bookings.length;

  // Month-over-month helpers
  const getMonthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const currentMonthKey = getMonthKey(new Date());
  const prevDate = new Date();
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonthKey = getMonthKey(prevDate);

  const monthAgg = bookings.reduce(
    (acc, b) => {
      const dateStr = b?.bookingDate;
      if (!dateStr) return acc;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return acc;
      const key = getMonthKey(d);
      // Count bookings (same definition as totalBookings)
      if (key === acc.currentKey) acc.currentBookings += 1;
      if (key === acc.prevKey) acc.prevBookings += 1;

      // Revenue uses finished + non-cancelled definition
      const status = (b?.status || '').toString().toLowerCase();
      if (status === 'cancelled') return acc;
      if (!isBookingFinished(b)) return acc;
      const amount = Number(b?.totalPrice ?? b?.price ?? 0) || 0;
      if (key === acc.currentKey) acc.currentRevenue += amount;
      if (key === acc.prevKey) acc.prevRevenue += amount;
      return acc;
    },
    {
      currentKey: currentMonthKey,
      prevKey: prevMonthKey,
      currentRevenue: 0,
      prevRevenue: 0,
      currentBookings: 0,
      prevBookings: 0,
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

  const revenueTrend = calcTrend(monthAgg.currentRevenue, monthAgg.prevRevenue);
  const bookingsTrend = calcTrend(monthAgg.currentBookings, monthAgg.prevBookings);

  const activeCount = myVenues.filter(v => v.status === 'active').length;
  const pendingCount = myVenues.filter(v => v.status === 'pending').length;
  const ratingNumerator = myVenues.reduce((sum, v) => sum + (Number(v.rating || 0) * Number(v.reviews || 0)), 0);
  const ratingDenominator = myVenues.reduce((sum, v) => sum + (Number(v.reviews) || 0), 0);
  const avgRating = ratingDenominator > 0 ? ratingNumerator / ratingDenominator : 0;

  useEffect(() => {
    const loadMonthlyStats = async () => {
      setMonthlyLoading(true);
      setMonthlyError(null);
      try {
        const role = user?.currentRole || user?.profileType;
        if (!(role === 'business' || role === 'both')) {
          setMonthlyStats([]);
          setMonthlyLoading(false);
          return;
        }
        const resp = await bookingService.getMonthlyStats({ months: 6 });
        const stats = resp?.data?.stats || [];
        const formatted = stats.map((item: any) => {
          const label = new Date(item.year, item.month - 1, 1).toLocaleString('default', { month: 'short' });
          return {
            month: label,
            bookings: Number(item.bookings) || 0,
            revenue: Number(item.revenue) || 0,
          };
        });
        setMonthlyStats(formatted);
      } catch (error: any) {
        setMonthlyError(error?.response?.data?.message || error?.message || 'Failed to load monthly stats');
        setMonthlyStats([]);
      } finally {
        setMonthlyLoading(false);
      }
    };
    loadMonthlyStats();
  }, [user]);

  // Recompute monthly stats from current bookings and overlay on server data
  useEffect(() => {
    // Skip while loading bookings
    if (bookingsLoading) return;

    const monthsBack = 6;
    const now = new Date();
    const buckets: { key: string; year: number; monthIndex: number; month: string; bookings: number; revenue: number }[] = [];
    const keyToIndex = new Map<string, number>();

    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString('default', { month: 'short' });
      keyToIndex.set(key, buckets.length);
      buckets.push({ key, year: d.getFullYear(), monthIndex: d.getMonth(), month: label, bookings: 0, revenue: 0 });
    }

    for (const b of bookings) {
      const status = (b?.status || '').toString().toLowerCase();
      if (status === 'cancelled') continue;
      // Only include realized/finished bookings in revenue & bookings count
      if (!isBookingFinished(b)) continue;
      const when = b?.bookingDate ? new Date(b.bookingDate) : null;
      if (!when || isNaN(when.getTime())) continue;
      const key = `${when.getFullYear()}-${when.getMonth()}`;
      const idx = keyToIndex.get(key);
      if (idx === undefined) continue; // outside the 6-month window
      buckets[idx].bookings += 1;
      const amount = Number(b?.totalPrice ?? b?.price ?? 0) || 0;
      buckets[idx].revenue += amount;
    }

    const computed = buckets.map(({ month, bookings, revenue }) => ({ month, bookings, revenue }));

    // Merge with server data, but prefer computed values for months we have locally (keeps order from computed)
    const serverByLabel = new Map<string, { bookings: number; revenue: number }>();
    for (const item of monthlyStats) {
      serverByLabel.set(item.month, { bookings: Number(item.bookings) || 0, revenue: Number(item.revenue) || 0 });
    }
    const merged = computed.map(item => {
      const server = serverByLabel.get(item.month);
      if (!server) return item; // use computed if server missing
      // Always prefer computed for the month to keep dashboard live/up-to-date
      return { ...item };
    });

    setMonthlyStats(merged);
  }, [bookings, bookingsLoading]); // Removed monthlyStats from dependencies to prevent infinite loop

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
    const venueName = booking.venue?.title || booking.venue?.name || booking.venueName || 'Unknown Venue';
    const customerName = booking.user?.name || booking.userDetails?.name || booking.customerName || 'Unknown Customer';
    
    // Format time in 12-hour format
    const start24 = booking.timeSlot?.start || '00:00';
    const end24 = booking.timeSlot?.end || '00:00';
    const startTime = formatTime12Hour(start24);
    const endTime = formatTime12Hour(end24);
    
    return {
      id: booking._id || booking.id,
      customerName: customerName,
      court: venueName,
      date: booking.bookingDate ? new Date(booking.bookingDate).toISOString().split('T')[0] : '',
      time: `${startTime} - ${endTime}`,
      price: booking.totalPrice || booking.price || 0,
      status: booking.status?.toLowerCase() || 'pending',
      start24,
      end24,
    };
  };

  // Filter bookings based on selected status filter
  const filteredBookings = bookings
    .map(formatBooking)
    .filter(booking => {
      if (bookingFilterStatus === 'all') return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(booking.date);
      bookingDate.setHours(0, 0, 0, 0);
      const [endH = '00', endM = '00'] = (booking as any).end24?.split(':') || [];
      const endDateTime = new Date(booking.date + 'T' + `${endH}:${endM}:00`);
      const now = new Date();

      if (bookingFilterStatus === 'upcoming') {
        const futureDate = bookingDate > today;
        const todayOngoing = bookingDate.getTime() === today.getTime() && now < endDateTime;
        return (futureDate || todayOngoing) && (booking.status === 'pending' || booking.status === 'confirmed');
      }
      if (bookingFilterStatus === 'completed') {
        const pastDate = bookingDate < today;
        const finishedToday = bookingDate.getTime() === today.getTime() && now >= endDateTime;
        return (pastDate || finishedToday || booking.status === 'completed') && booking.status !== 'cancelled';
      }
      if (bookingFilterStatus === 'cancelled') return booking.status === 'cancelled';
      return true;
    });

  const upcomingBookings = filteredBookings.slice(0, 3);
  const allBookings = filteredBookings;

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Booking action handlers
  const handleCancelBooking = async (bookingId: string, bookingCustomer: string) => {
    if (!window.confirm(`Are you sure you want to cancel the booking for ${bookingCustomer}? This action can be undone by updating the booking status.`)) {
      return;
    }
    try {
      await bookingService.cancelBooking(bookingId);
      toast.success('Booking cancelled successfully');
      // Refresh bookings
      const response = await bookingService.getMyBookings();
      const bookingsData = response?.data?.bookings || response?.bookings || [];
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to cancel booking');
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, nextStatus: 'confirmed' | 'completed' | 'cancelled') => {
    try {
      await bookingService.updateBooking(bookingId, { status: nextStatus });
      const statusLabel = nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1);
      toast.success(`Booking ${statusLabel} successfully`);

      const response = await bookingService.getMyBookings();
      const bookingsData = response?.data?.bookings || response?.bookings || [];
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update booking status');
    }
  };

  const handleViewDetails = (booking: any) => {
    // Navigate to booking details page
    navigate(`/booking/${booking.id}`);
  };

  const handleContactCustomer = (booking: any) => {
    setSelectedBooking(booking);
    setContactOpen(true);
  };

  const handleAddVenue = (venueData: any) => {
    // Here you would typically send the data to your backend
    console.log('New venue data:', venueData);
    // You could also update the local state to show the new venue in the list
    // For now, we'll just close the modal
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
              <h1 className="text-3xl font-bold text-[#010101]">{displayName} Dashboard</h1>
              <p className="text-gray-600">Manage your venues and bookings</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/venue/add')}
              className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Venue
            </Button>
            <Button
              onClick={logout}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            title="Total Revenue"
            value={`Rs ${totalRevenue.toFixed(0)}`}
            trend={revenueTrend}
            iconClassName="text-[#98e209]"
            iconBgClassName="bg-[#98e209] bg-opacity-20"
          />
          
          <StatCard
            icon={Calendar}
            title="Total Bookings"
            value={totalBookings.toString()}
            trend={bookingsTrend}
            iconClassName="text-blue-600"
            iconBgClassName="bg-blue-100"
          />
          
          <StatCard
            icon={Users}
            title="Active Venues"
            value={activeCount.toString()}
            subtitle={`${activeCount} active${pendingCount ? `, ${pendingCount} pending` : ''}`}
            iconClassName="text-purple-600"
            iconBgClassName="bg-purple-100"
          />
          
          <StatCard
            icon={TrendingUp}
            title="Avg. Rating"
            value={avgRating ? avgRating.toFixed(1) : '0.0'}
            subtitle={ratingDenominator ? `Based on ${ratingDenominator} reviews` : 'No reviews yet'}
            iconClassName="text-green-600"
            iconBgClassName="bg-green-100"
          />
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-8 flex w-full items-center gap-1 rounded-full border border-[#d9d9df] bg-[#ececf1] p-1">
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="overview">Overview</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="listings">My Listings</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="bookings">Bookings</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="messages">Messages</TabsTrigger>
            <TabsTrigger className="flex-1 rounded-full border border-transparent text-[#010101] hover:border-[#d3d3d9] hover:bg-white/70 data-[state=active]:border-[#89cb08] data-[state=active]:bg-[#98e209] data-[state=active]:text-[#010101]" value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Revenue Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Revenue & Bookings Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    {monthlyLoading ? (
                      <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading chart...</div>
                    ) : monthlyError ? (
                      <div className="h-full flex items-center justify-center text-red-600 text-sm">{monthlyError}</div>
                    ) : monthlyStats.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-500 text-sm">No monthly data available yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyStats}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip formatter={(value: any, name: string) => name === 'revenue' ? [`$${Number(value).toFixed(0)}`, 'Revenue'] : [value, 'Bookings']} />
                          <Bar yAxisId="right" dataKey="bookings" fill="#98e209" opacity={0.3} />
                          <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#010101" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Bookings */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Recent Bookings</CardTitle>
                    <Button
                      onClick={() => setActiveTab('bookings')}
                      variant="ghost"
                      size="sm"
                    >
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-4">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-[#010101]">{booking.customerName}</p>
                          <p className="text-sm text-gray-600">{booking.court}</p>
                          <p className="text-xs text-gray-500">{booking.date} • {booking.time}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#010101]">${booking.price}</p>
                          <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                            {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Performing Venues (Dynamic) */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Venues</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTop && (
                    <p className="text-sm text-gray-500">Loading top venues...</p>
                  )}
                  {topError && !loadingTop && (
                    <p className="text-sm text-red-600">{topError}</p>
                  )}
                  {!loadingTop && !topError && topVenues.length === 0 && (
                    <p className="text-sm text-gray-500">No performance data yet.</p>
                  )}
                  <div className="space-y-4">
                    {topVenues.map((v, index) => (
                      <div key={v.id} className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-[#98e209] bg-opacity-20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-[#010101]">{index + 1}</span>
                        </div>
                        <ImageWithFallback
                          src={v.image}
                          alt={v.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-[#010101]">{v.name}</p>
                          <p className="text-sm text-gray-600">{v.bookings} bookings this month</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#010101]">Rs {v.revenue}</p>
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs ml-1">{v.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            <ChatConversationList role="business" />
          </TabsContent>

          <TabsContent value="listings">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>My Venue Listings</CardTitle>
                  <Button
                    onClick={() => navigate('/venue/add')}
                    className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Venue
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {loadingMyVenues && (
                    <p className="text-sm text-gray-500">Loading your venues...</p>
                  )}
                  {myVenuesError && !loadingMyVenues && (
                    <p className="text-sm text-red-600">{myVenuesError}</p>
                  )}
                  {!loadingMyVenues && !myVenuesError && myVenues.length === 0 && (
                    <p className="text-sm text-gray-500">You have not created any venues yet.</p>
                  )}
                  {myVenues.map((listing) => (
                    <div key={listing.id} className="border rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <ImageWithFallback
                            src={listing.image}
                            alt={listing.name}
                            className="w-20 h-20 rounded-lg object-cover"
                          />
                          <div>
                            <h3 className="font-bold text-xl text-[#010101]">{listing.name}</h3>
                            <Badge className="mb-2">{listing.sport}</Badge>
                            <div className="flex items-center space-x-4 text-gray-600">
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-1" />
                                <span className="text-sm">{listing.location || listing.address || listing.city || 'Location not set'}</span>
                              </div>
                              <div className="flex items-center">
                                <Star className="h-4 w-4 mr-1 text-yellow-400 fill-current" />
                                <span className="text-sm">{listing.rating} ({listing.reviews} reviews)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(listing.status)}>
                            {listing.status}
                          </Badge>
                          <p className="text-2xl font-bold text-[#010101] mt-2">Rs {listing.price}/hr</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Monthly Bookings</p>
                          <p className="text-xl font-bold text-[#010101]">{listing.bookings}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Monthly Revenue</p>
                          <p className="text-xl font-bold text-[#010101]">Rs {listing.revenue}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Avg. Rating</p>
                          <p className="text-xl font-bold text-[#010101]">{listing.rating}</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Total Reviews</p>
                          <p className="text-xl font-bold text-[#010101]">{listing.reviews}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/venue/edit/${listing.id}`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => navigate(`/court/${listing.id}`)}
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Public Page
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/venue/${listing.id}/calendar`)}
                        >
                          Manage Calendar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete venue '${listing.name}'? This action cannot be undone.`)) {
                              try {
                                await (await import('../../services/venueService')).default.deleteVenue(listing.id);
                                toast.success('Venue deleted successfully');
                                // Optionally refresh venues list
                                setMyVenues(myVenues.filter(v => v.id !== listing.id));
                              } catch (e: any) {
                                toast.error(e?.message || 'Failed to delete venue');
                              }
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Booking Management</CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      variant={bookingFilterStatus === 'all' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilterStatus('all')}
                      className={bookingFilterStatus === 'all' ? 'bg-[#98e209] text-[#010101] hover:bg-[#89cb08]' : ''}
                    >
                      All
                    </Button>
                    <Button 
                      variant={bookingFilterStatus === 'upcoming' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilterStatus('upcoming')}
                      className={bookingFilterStatus === 'upcoming' ? 'bg-[#98e209] text-[#010101] hover:bg-[#89cb08]' : ''}
                    >
                      Upcoming
                    </Button>
                    <Button 
                      variant={bookingFilterStatus === 'completed' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilterStatus('completed')}
                      className={bookingFilterStatus === 'completed' ? 'bg-[#98e209] text-[#010101] hover:bg-[#89cb08]' : ''}
                    >
                      Completed
                    </Button>
                    <Button 
                      variant={bookingFilterStatus === 'cancelled' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setBookingFilterStatus('cancelled')}
                      className={bookingFilterStatus === 'cancelled' ? 'bg-[#98e209] text-[#010101] hover:bg-[#89cb08]' : ''}
                    >
                      Cancelled
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {bookingsLoading && (
                  <p className="text-sm text-gray-500">Loading bookings...</p>
                )}
                {bookingsError && !bookingsLoading && (
                  <p className="text-sm text-red-600">{bookingsError}</p>
                )}
                {!bookingsLoading && !bookingsError && allBookings.length === 0 && (
                  <p className="text-sm text-gray-500">No bookings found for the selected filter.</p>
                )}
                <div className="space-y-4">
                  {allBookings.map((booking) => (
                    <div key={booking.id} className="border rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-lg text-[#010101]">{booking.customerName}</h3>
                          <p className="text-gray-600">{booking.court}</p>
                          <div className="flex items-center space-x-4 text-gray-600 mt-2">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>{booking.date}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              <span>{booking.time}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-[#010101]">${booking.price}</p>
                          <Badge className={`mt-1 ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleContactCustomer(booking)}
                        >
                          Contact Customer
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDetails(booking)}
                        >
                          View Details
                        </Button>

                        {booking.status === 'pending' && (
                          <Button
                            size="sm"
                            className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                            onClick={() => handleUpdateBookingStatus(booking.id, 'confirmed')}
                          >
                            Confirm Booking
                          </Button>
                        )}

                        {(booking.status === 'pending' || booking.status === 'confirmed') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600"
                            onClick={() => handleCancelBooking(booking.id, booking.customerName)}
                          >
                            Cancel Booking
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Business Profile */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Business Profile</CardTitle>
                    <Button
                      onClick={() => setEditingProfile(!editingProfile)}
                      variant="ghost"
                      size="sm"
                    >
                      {editingProfile ? <X className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                      {editingProfile ? "Cancel" : "Edit"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <div className="flex items-center space-x-4 mb-6">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src="/api/placeholder/80/80" />
                      <AvatarFallback className="bg-[#98e209] text-[#010101] text-2xl font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {editingProfile && (
                      <Button variant="outline" size="sm">
                        Change Logo
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="name" className="mb-2 block">Full Name</Label>
                      <Input
                        id="name"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? "bg-gray-50" : ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="mb-2 block">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={emailInput}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="mb-2 block">Phone</Label>
                      <Input
                        id="phone"
                        value={phoneInput}
                        onChange={e => setPhoneInput(e.target.value)}
                        disabled={!editingProfile}
                        className={!editingProfile ? "bg-gray-50" : ""}
                      />
                    </div>
                  </div>

                  {editingProfile && (
                    <div className="flex gap-2 pt-4">
                      <Button 
                        className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                        onClick={async () => {
                          try {
                            const payload: any = {};
                            if (nameInput !== (profile?.name || user?.name || '')) payload.name = nameInput;
                            if (phoneInput !== (profile?.phone || user?.phone || '')) payload.phone = phoneInput;
                            if (Object.keys(payload).length === 0) {
                              toast.info('No changes to save');
                              setEditingProfile(false);
                              return;
                            }
                            await updateProfile(payload);
                            setEditingProfile(false);
                            toast.success('Profile updated successfully');
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to update profile');
                          }
                        }}
                        disabled={profileLoading}
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

              {/* Business Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Business Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-accept bookings</p>
                      <p className="text-sm text-gray-600">Automatically approve booking requests</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email notifications</p>
                      <p className="text-sm text-gray-600">Receive booking notifications via email</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS notifications</p>
                      <p className="text-sm text-gray-600">Receive booking notifications via SMS</p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Public profile</p>
                      <p className="text-sm text-gray-600">Show business profile publicly</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="pt-4 border-t">
                    <Label htmlFor="commission" className="mb-2 block">Commission Rate</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="commission"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={10}
                        className="w-24"
                      />
                      <span className="text-gray-600">%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <ContactCustomerModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          booking={selectedBooking}
          businessDisplayName={displayName}
        />
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        onSubmit={changePassword}
      />
    </div>
  );
}
   