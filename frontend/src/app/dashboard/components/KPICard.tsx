'use client';

import { ArrowUp, ArrowDown, Info } from 'lucide-react';
import { KPIValue } from '@/types/api';
import { cn } from '@/lib/utils'; // Assuming a utility for classnames exists

interface KPICardProps {
  title: string;
  data: KPIValue;
  prefix?: string;
  suffix?: string;
}

const KPICard = ({ title, data, prefix = "", suffix = "" }: KPICardProps) => {
  const { value, sub_label, delta_percent, is_positive } = data;

  const TrendArrow = is_positive ? ArrowUp : ArrowDown;

  return (
    <div className="relative rounded-xl border border-gray-700 bg-gray-800/50 p-4 shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <Info className="h-4 w-4 text-gray-500" />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-semibold text-white">
          {prefix}{Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{suffix}
        </p>
        <div className="mt-1 flex items-center space-x-2 text-xs">
          {delta_percent && (
            <span className={cn('flex items-center', is_positive ? 'text-green-400' : 'text-red-400')}>
              <TrendArrow className="mr-1 h-4 w-4" />
              {delta_percent.toFixed(1)}%
            </span>
          )}
          <p className="text-gray-500">{sub_label}</p>
        </div>
      </div>
    </div>
  );
};

export default KPICard; 