import React from 'react';
import { Calendar, Clock, DollarSign, MapPin, User, Phone, Mail, CreditCard, FileText, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface BookingDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
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
  } | null;
}

export function BookingDetailsModal({
  open,
  onOpenChange,
  booking,
}: BookingDetailsModalProps) {
  if (!booking) return null;

  const depositAmount = Number((Number(booking.price || 0) * 0.5).toFixed(2));
  const isDepositPaid = (booking.paymentStatus || '').toLowerCase() === 'paid';
  const depositPaid = isDepositPaid ? depositAmount : 0;
  const remainingBalance = Number((Number(booking.price || 0) - depositPaid).toFixed(2));

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

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center p-6 overflow-hidden"
      style={{ zIndex: 50, paddingTop: '6rem' }}
    >
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/30"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[calc(100vh-9rem)] overflow-hidden z-50 flex flex-col">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-white rounded-full p-1 hover:bg-gray-100 shadow-sm"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="bg-white border-b px-6 py-4 shrink-0">
          <h2 className="text-xl font-bold text-[#010101] pr-8">Booking Details</h2>
          <p className="text-xs text-gray-600 mt-1">Complete information about this booking</p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="space-y-5">
          {/* Status and Payment */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">Booking Status</p>
              <Badge className={`${getStatusColor(booking.status)} text-sm px-3 py-1`}>
                {booking.status?.toUpperCase() || 'PENDING'}
              </Badge>
            </div>
            {booking.paymentStatus && (
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Payment Status</p>
                <Badge className={`${getPaymentStatusColor(booking.paymentStatus)} text-sm px-3 py-1`}>
                  {booking.paymentStatus?.toUpperCase() || 'PENDING'}
                </Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Customer Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#010101]">Customer Information</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#98e209] bg-opacity-20 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-[#010101]" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="font-medium text-[#010101]">{booking.customerName}</p>
                </div>
              </div>

              {booking.customerEmail && (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-[#010101]">{booking.customerEmail}</p>
                  </div>
                </div>
              )}

              {booking.customerPhone && (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Phone className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-[#010101]">{booking.customerPhone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Venue & Booking Information */}
          <div>
            <h3 className="font-semibold text-lg mb-3 text-[#010101]">Booking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Venue</p>
                  <p className="font-medium text-[#010101]">{booking.court}</p>
                  {booking.venueLocation && (
                    <p className="text-xs text-gray-500 mt-1">{booking.venueLocation}</p>
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
                    {new Date(booking.date).toLocaleDateString('en-US', {
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
                  <p className="font-medium text-[#010101]">{booking.time}</p>
                  {booking.duration && (
                    <p className="text-xs text-gray-500 mt-1">{booking.duration} hour(s)</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-[#98e209] bg-opacity-20 rounded-full flex items-center justify-center shrink-0">
                  {/* <DollarSign className="h-5 w-5 text-[#010101]" /> */}
                  Rs
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Price</p>
                  <p className="font-bold text-2xl text-[#010101]">Rs {booking.price}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {booking.paymentMethod && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3 text-[#010101]">Payment Information</h3>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className="font-medium text-[#010101] capitalize">{booking.paymentMethod}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Booking ID and Notes */}
          {(booking.bookingId || booking.notes) && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Deposit Summary (50%)</p>
                  <div className="text-sm bg-gray-50 px-3 py-2 rounded border space-y-1">
                    <p>Total: <span className="font-semibold">Rs {booking.price}</span></p>
                    <p>Deposit paid: <span className="font-semibold">Rs {depositPaid.toFixed(2)}</span></p>
                    <p>Remaining balance: <span className="font-semibold">Rs {remainingBalance.toFixed(2)}</span></p>
                  </div>
                </div>

                {booking.bookingId && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Booking ID</p>
                    <p className="font-mono text-sm bg-gray-100 px-3 py-2 rounded border">
                      {booking.bookingId || booking.id}
                    </p>
                  </div>
                )}

                {booking.notes && (
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      <p className="text-sm text-gray-600">Notes</p>
                    </div>
                    <p className="text-sm bg-gray-50 px-3 py-2 rounded border">
                      {booking.notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
