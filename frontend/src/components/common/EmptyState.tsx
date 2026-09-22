import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  iconClassName?: string;
}

const EmptyStateComponent = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  iconClassName = 'text-gray-300',
}: EmptyStateProps) => {
  return (
    <div className={cn('text-center py-16', className)}>
      <Icon className={cn('h-16 w-16 mx-auto mb-4', iconClassName)} aria-hidden="true" />
      <h2 className="text-2xl font-bold text-gray-600 mb-2">{title}</h2>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08]"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const EmptyState = memo(EmptyStateComponent);
