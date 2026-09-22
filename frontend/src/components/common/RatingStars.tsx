import React from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showCount?: boolean;
  reviewCount?: number;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

export const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onChange,
  showCount = false,
  reviewCount
}) => {
  const filled = Math.floor(rating);
  const half = rating - filled >= 0.5;

  const handleClick = (value: number) => {
    if (!interactive || !onChange) return;
    onChange(value);
  };

  return (
    <div className="flex items-center gap-2" aria-label={`Rating: ${rating} out of ${maxRating}`}>
      <div className="flex items-center">
        {Array.from({ length: maxRating }).map((_, idx) => {
          const value = idx + 1;
          const isFilled = value <= filled;
          const isHalf = !isFilled && half && value === filled + 1;
          return (
            <button
              type="button"
              key={value}
              onClick={() => handleClick(value)}
              className={`p-0.5 ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label={`Rate ${value}`}
            >
              <Star
                className={`${sizeMap[size]} ${isFilled ? 'fill-yellow-400 text-yellow-400' : isHalf ? 'text-yellow-400' : 'text-gray-300'}`}
                strokeWidth={isFilled || isHalf ? 1 : 1.5}
                fill={isFilled || isHalf ? 'currentColor' : 'none'}
              />
            </button>
          );
        })}
      </div>
      {showCount && typeof reviewCount === 'number' && (
        <span className="text-sm text-gray-600">({reviewCount})</span>
      )}
    </div>
  );
};

export default RatingStars;
