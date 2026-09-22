import React from 'react';
import { MessageSquare, ShieldCheck, ThumbsUp, Trash2, Edit3 } from 'lucide-react';
import { Review } from '../../types';
import RatingStars from './RatingStars';

interface ReviewListProps {
  reviews: Review[];
  currentUserId?: string;
  onEdit?: (review: Review) => void;
  onDelete?: (review: Review) => void;
  onHelpful?: (review: Review) => void;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  reviews,
  currentUserId,
  onEdit,
  onDelete,
  onHelpful
}) => {
  if (!reviews.length) {
    return (
      <div className="p-4 bg-white rounded-lg border border-gray-100 text-sm text-gray-600">
        No reviews yet. Be the first to share your experience.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const isOwner = currentUserId && review.userId === currentUserId;
        return (
          <div key={review.id} className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{review.userName}</span>
                  {review.verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>{new Date(review.createdAt).toLocaleDateString()}</p>
                  {review.bookingDate && review.timeSlot && (
                    <p className="text-gray-400">
                      Visit: {new Date(review.bookingDate).toLocaleDateString()} at {review.timeSlot}
                    </p>
                  )}
                </div>
              </div>
              <RatingStars rating={review.rating} size="sm" />
            </div>

            <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{review.comment}</p>

            <div className="mt-3 flex items-center gap-3 text-sm text-gray-600">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-gray-600 hover:text-[#98e209]"
                onClick={() => onHelpful?.(review)}
                disabled={review.userId === currentUserId}
              >
                <ThumbsUp className="w-4 h-4" /> {review.helpful || 0}
              </button>

              {onEdit && isOwner && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-[#98e209]"
                  onClick={() => onEdit(review)}
                >
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}

              {onDelete && isOwner && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-gray-600 hover:text-red-600"
                  onClick={() => onDelete(review)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>

            {review.responseText && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-100 text-sm text-gray-800">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <MessageSquare className="w-4 h-4" /> Response from owner
                </div>
                <p>{review.responseText}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewList;
