import React from 'react';
import { ReviewStats } from '../../types';
import RatingStars from './RatingStars';

interface ReviewSummaryProps {
  stats: ReviewStats;
  size?: 'compact' | 'detailed';
}

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({ stats, size = 'compact' }) => {
  const { average, count, distribution } = stats;
  const total = count || 0;

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center gap-4">
        <div>
          <div className="text-3xl font-semibold text-gray-900">{average.toFixed(1)}</div>
          <div className="text-sm text-gray-500">{total} review{total === 1 ? '' : 's'}</div>
        </div>
        <RatingStars rating={average} showCount reviewCount={total} size="md" />
      </div>

      {size === 'detailed' && (
        <div className="mt-4 space-y-2">
          {[5, 4, 3, 2, 1].map((score) => {
            const value = distribution?.[score as 1 | 2 | 3 | 4 | 5] || 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div key={score} className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-10 text-right">{score}★</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReviewSummary;
