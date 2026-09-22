import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, Clock, DollarSign, MapPin, User, Phone, Mail, CreditCard, FileText, ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { usePageTitle } from '../../hooks/usePageTitle';
import bookingService from '../../services/bookingService';
import { toast } from 'react-toastify';

export function BookingDetailsPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  usePageTitle('Booking Details', 'View complete booking information');

  useEffect(() => {
    const fetchBookingDetails = async () => {
      if (!bookingId) return;
      
      try {
        setLoading(true);
        const response = await bookingService.getMyBookings();
        const allBookings = response?.data?.bookings || response?.bookings || [];
        const foundBooking = allBookings.find((b: any) => b._id === bookingId || b.id === bookingId);
        
        if (foundBooking) {
          setBooking(foundBooking);
        } else {
          toast.error('Booking not found');
          navigate('/dashboard/business');
        }
      } catch (error: any) {
        console.error('Error fetching booking:', error);
        toast.error('Failed to load booking details');
        navigate('/dashboard/business');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();
  }, [bookingId, navigate]);

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

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
      case 'refunded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '00:00 AM';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')} ${period}`;
  };

  const handleContactCustomer = () => {
    toast.info('Contact feature coming soon');
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    
    const customerName = booking.user?.name || 'customer';
    if (!window.confirm(`Are you sure you want to cancel the booking for ${customerName}?`)) {
      return;
    }

    try {
      await bookingService.cancelBooking(booking._id || booking.id);
      toast.success('Booking cancelled successfully');
      navigate('/dashboard/business');
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error(error?.response?.data?.message || 'Failed to cancel booking');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98e209] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading booking details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const venueName = booking.venue?.title || booking.venue?.name || 'Unknown Venue';
  const customerName = booking.user?.name || booking.userDetails?.name || 'Unknown Customer';
  const customerEmail = booking.user?.email || booking.userDetails?.email || 'N/A';
  const customerPhone = booking.user?.phone || booking.userDetails?.phone || 'N/A';
  const venueLocation = booking.venue?.location?.address || booking.venue?.location?.city || '';
  const startTime = formatTime12Hour(booking.timeSlot?.start);
  const endTime = formatTime12Hour(booking.timeSlot?.end);
  const bookingDate = booking.bookingDate ? new Date(booking.bookingDate) : new Date();
  
  // Check if booking date has passed
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDateOnly = new Date(bookingDate);
  bookingDateOnly.setHours(0, 0, 0, 0);
  const isBookingPast = bookingDateOnly < today;

  return (
    <div className="min-h-screen bg-gray-50 pt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          onClick={() => navigate('/dashboard/business')}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#010101]">Booking Details</h1>
          <p className="text-gray-600 mt-1">Complete information about this booking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Booking Status</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Badge className={`${getStatusColor(booking.status)} text-base px-4 py-1`}>
                    {booking.status?.toUpperCase() || 'PENDING'}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-600">Payment Status</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Badge className={`${getPaymentStatusColor(booking.paymentStatus)} text-base px-4 py-1`}>
                    {booking.paymentStatus?.toUpperCase() || 'PENDING'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2 text-[#98e209]" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-[#98e209] bg-opacity-20 rounded-full flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-[#010101]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium text-[#010101]">{customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-[#010101] break-all">{customerEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <Phone className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-[#010101]">{customerPhone}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-[#98e209]" />
                  Booking Information
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <MapPin className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Venue</p>
                      <p className="font-medium text-[#010101]">{venueName}</p>
                      {venueLocation && (
                        <p className="text-xs text-gray-500 mt-1">{venueLocation}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Date</p>
                      <p className="font-medium text-[#010101]">
                        {bookingDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Time Slot</p>
                      <p className="font-medium text-[#010101]">{startTime} - {endTime}</p>
                      {booking.duration && (
                        <p className="text-xs text-gray-500 mt-1">{booking.duration} hour(s)</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-[#98e209] bg-opacity-20 rounded-full flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-[#010101]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Price</p>
                      <p className="font-bold text-3xl text-[#010101]">Rs {booking.totalPrice || booking.price || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            {booking.paymentInfo?.method && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2 text-[#98e209]" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Payment Method</p>
                      <p className="font-medium text-[#010101] capitalize">{booking.paymentInfo.method}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {booking.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-[#98e209]" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <p className="text-sm text-gray-700">{booking.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-8">
                <Button
                  onClick={handleContactCustomer}
                  className="w-full bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Contact Customer
                </Button>
                {!isBookingPast && (
                  <Button
                    onClick={handleCancelBooking}
                    variant="outline"
                    className="w-full text-red-600 border-red-600 hover:bg-red-50"
                  >
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Booking ID Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Booking ID</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <p className="font-mono text-xs bg-gray-100 px-3 py-2 rounded border break-all">
                  {booking._id || booking.id}
                </p>
              </CardContent>
            </Card>

            {/* Quick Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm p-8">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">
                    {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{booking.duration || 1} hour(s)</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-bold text-lg text-[#010101]">
                    Rs {booking.totalPrice || booking.price || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
