import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  iconBgClassName?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  className?: string;
}

const StatCardComponent = ({
  title,
  value,
  icon: Icon,
  iconClassName = 'text-[#98e209]',
  iconBgClassName = 'bg-[#98e209] bg-opacity-10',
  trend,
  subtitle,
  className,
}: StatCardProps) => {
  return (
    <Card className={cn('hover:shadow-lg transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-[#010101]">{value}</h3>
            {trend && (
              <div className="flex items-center mt-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-sm text-gray-500 ml-2">vs last month</span>
              </div>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={cn('p-4 rounded-full', iconBgClassName)}>
            <Icon className={cn('h-8 w-8', iconClassName)} aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const StatCard = memo(StatCardComponent);
