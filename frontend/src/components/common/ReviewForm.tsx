import React, { useState, useEffect } from 'react';
import RatingStars from './RatingStars';

interface UnreviewedBooking {
  id: string;
  date: string;
  timeSlot: string;
  price?: number;
}

interface ReviewFormProps {
  mode?: 'add' | 'edit';
  initialRating?: number;
  initialComment?: string;
  unreviewedBookings?: UnreviewedBooking[];
  initialBookingId?: string;
  onSubmit: (data: { rating: number; comment: string; bookingId?: string }) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  mode = 'add',
  initialRating = 0,
  initialComment = '',
  unreviewedBookings = [],
  initialBookingId = '',
  onSubmit,
  onCancel,
  isSubmitting = false
}) => {
  const [rating, setRating] = useState<number>(initialRating);
  const [comment, setComment] = useState<string>(initialComment);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(initialBookingId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unreviewedBookings.length > 0 && !selectedBookingId) {
      setSelectedBookingId(unreviewedBookings[0].id);
    }
  }, [unreviewedBookings, selectedBookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) {
      setError('Please select a rating.');
      return;
    }
    if (comment && (comment.length < 10 || comment.length > 1000)) {
      setError('Comment must be between 10 and 1000 characters.');
      return;
    }
    if (mode === 'add' && unreviewedBookings.length > 0 && !selectedBookingId) {
      setError('Please select a visit to review.');
      return;
    }
    setError(null);
    await onSubmit({ rating, comment, bookingId: selectedBookingId });
  };

  const getBookingLabel = (booking: UnreviewedBooking) => {
    const date = new Date(booking.date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // Handle timeSlot as either string or object
    let timeStr = '';
    if (typeof booking.timeSlot === 'string') {
      timeStr = booking.timeSlot;
    } else if (booking.timeSlot && typeof booking.timeSlot === 'object') {
      const ts = booking.timeSlot as any;
      if (ts.start && ts.end) {
        timeStr = `${ts.start} - ${ts.end}`;
      } else {
        timeStr = JSON.stringify(ts);
      }
    }
    
    return `${date} - ${timeStr}`;
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {mode === 'add' && unreviewedBookings.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-gray-700" htmlFor="booking-select">Which visit do you want to review?</label>
          <select
            id="booking-select"
            className="w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#98e209]"
            value={selectedBookingId}
            onChange={(e) => setSelectedBookingId(e.target.value)}
          >
            <option value="">Select a visit...</option>
            {unreviewedBookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {getBookingLabel(booking)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-700">Rate your experience</p>
        <RatingStars rating={rating} interactive onChange={setRating} size="lg" />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-gray-700" htmlFor="review-comment">Your review</label>
        <textarea
          id="review-comment"
          className="w-full rounded-md border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#98e209]"
          rows={4}
          placeholder="Share details about the court, staff, cleanliness, and overall experience."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="text-xs text-gray-500 flex justify-between">
          <span>Min 10 chars (optional)</span>
          <span>{comment.length}/1000</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-[#98e209] text-black font-semibold rounded-md hover:bg-[#86cb07] disabled:opacity-60"
        >
          {mode === 'add' ? 'Submit Review' : 'Update Review'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default ReviewForm;
