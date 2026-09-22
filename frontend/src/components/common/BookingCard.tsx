import React, { memo } from 'react';
import { Calendar, Clock, MapPin, DollarSign } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { cn } from '../ui/utils';

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled' | 'confirmed' | 'pending';

export interface BookingCardProps {
  id: string | number;
  venueName: string;
  venueImage: string;
  sport: string;
  date: string;
  timeSlot: string;
  duration: number;
  totalPrice: number;
  status: BookingStatus;
  location?: string;
  bookingReference?: string;
  onViewDetails?: () => void;
  onCancel?: () => void;
  onPayDeposit?: () => void;
  onRebook?: () => void;
  showActions?: boolean;
}

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  upcoming: {
    label: 'Upcoming',
    className: 'bg-blue-100 text-blue-800',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-green-100 text-green-800',
  },
  completed: {
    label: 'Completed',
    className: 'bg-gray-100 text-gray-800',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-800',
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
  },
};

// Default status config for unknown statuses
const defaultStatusConfig = { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' };

const BookingCardComponent = ({
  id,
  venueName,
  venueImage,
  sport,
  date,
  timeSlot,
  duration,
  totalPrice,
  status,
  location,
  bookingReference,
  onViewDetails,
  onCancel,
  onPayDeposit,
  onRebook,
  showActions = true,
}: BookingCardProps) => {
  const statusInfo = statusConfig[status] || defaultStatusConfig;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative sm:w-48 h-48 shrink-0 bg-gray-100">
          <ImageWithFallback
            src={venueImage}
            alt={venueName}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3">
            <Badge className="bg-[#98e209] text-[#010101]">
              {sport}
            </Badge>
          </div>
          <div className="absolute top-3 right-3">
            <Badge className={cn('font-medium', statusInfo.className)}>
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <CardContent className="flex-1 p-6">
          <div className="flex flex-col h-full">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-[#010101] mb-3">
                {venueName}
              </h3>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm">{date}</span>
                </div>

                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="text-sm">
                    {timeSlot} • {duration} hour{duration > 1 ? 's' : ''}
                  </span>
                </div>

                {location && (
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span className="text-sm">{location}</span>
                  </div>
                )}

                <div className="flex items-center text-gray-600">
                  {/* <DollarSign className="h-4 w-4 mr-2" /> */}
                  <span className="text-sm font-semibold text-[#010101]">
                    Rs {totalPrice}
                  </span>
                </div>
              </div>

              {bookingReference && (
                <p className="text-xs text-gray-500">
                  Booking ID: {bookingReference}
                </p>
              )}
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex flex-wrap gap-2 mt-4">
                {onViewDetails && (
                  <Button
                    onClick={onViewDetails}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    View Details
                  </Button>
                )}

                {(status === 'upcoming' || status === 'confirmed') && onCancel && (
                  <Button
                    onClick={onCancel}
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                )}

                {status === 'confirmed' && onPayDeposit && (
                  <Button
                    onClick={onPayDeposit}
                    size="sm"
                    className="flex-1 sm:flex-none bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                  >
                    Pay 50% Deposit
                  </Button>
                )}

                {(status === 'completed' || status === 'cancelled') && onRebook && (
                  <Button
                    onClick={onRebook}
                    size="sm"
                    className="flex-1 sm:flex-none bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
                  >
                    Book Again
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
};

export const BookingCard = memo(BookingCardComponent);
