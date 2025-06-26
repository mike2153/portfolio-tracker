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
  console.log(`[KPICard] 🚀 Enhanced KPI card rendering for: ${title}`);
  console.log(`[KPICard] 📊 Raw data received:`, data);
  console.log(`[KPICard] 📊 Data type:`, typeof data);
  console.log(`[KPICard] 📊 Data keys:`, data ? Object.keys(data) : 'null');
  console.log(`[KPICard] 🎯 Props - title: "${title}", prefix: "${prefix}", suffix: "${suffix}"`);
  
  if (!data || typeof data !== 'object') {
    console.error(`[KPICard] ❌ Invalid data for ${title}:`, data);
    return (
      <div className="relative rounded-xl border border-red-700 bg-red-800/50 p-4 shadow-md backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-red-400">{title}</h3>
        </div>
        <div className="mt-2">
          <p className="text-2xl font-semibold text-red-300">Error</p>
          <p className="text-xs text-red-500">Invalid data</p>
        </div>
      </div>
    );
  }
  
  const { value, sub_label, deltaPercent, is_positive } = data;
  
  console.log(`[KPICard] 🔍 Extracted fields for ${title}:`);
  console.log(`[KPICard]   - value: "${value}" (type: ${typeof value})`);
  console.log(`[KPICard]   - sub_label: "${sub_label}" (type: ${typeof sub_label})`);
  console.log(`[KPICard]   - deltaPercent: "${deltaPercent}" (type: ${typeof deltaPercent})`);
  console.log(`[KPICard]   - is_positive: ${is_positive} (type: ${typeof is_positive})`);

  // Add defensive function to safely format value
  const safeFormatValue = (val: any): string => {
    console.log(`[KPICard] safeFormatValue called with:`, val, 'type:', typeof val);
    
    // Handle null/undefined
    if (val == null) {
      console.log(`[KPICard] safeFormatValue: value is null/undefined, returning 0.00`);
      return '0.00';
    }
    
    // If it's already a number
    if (typeof val === 'number') {
      console.log(`[KPICard] safeFormatValue: value is number, using toLocaleString`);
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // If it's a string, try to parse it
    if (typeof val === 'string') {
      console.log(`[KPICard] safeFormatValue: value is string, attempting to parse`);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        console.log(`[KPICard] safeFormatValue: successfully parsed string to number:`, parsed);
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        console.log(`[KPICard] safeFormatValue: failed to parse string, returning raw value`);
        return val;
      }
    }
    
    // Fallback for any other type
    console.log(`[KPICard] safeFormatValue: unknown type, converting to string`);
    return String(val);
  };

  // Add defensive function to safely format delta percentage
  const safeFormatDelta = (delta: any): string => {
    console.log(`[KPICard] safeFormatDelta called with:`, delta, 'type:', typeof delta);
    
    // Handle null/undefined
    if (delta == null) {
      console.log(`[KPICard] safeFormatDelta: delta is null/undefined, returning 0.0`);
      return '0.0';
    }
    
    // If it's already a number
    if (typeof delta === 'number') {
      console.log(`[KPICard] safeFormatDelta: delta is number, using toFixed`);
      return delta.toFixed(1);
    }
    
    // If it's a string, try to parse it
    if (typeof delta === 'string') {
      console.log(`[KPICard] safeFormatDelta: delta is string, attempting to parse`);
      const parsed = parseFloat(delta);
      if (!isNaN(parsed)) {
        console.log(`[KPICard] safeFormatDelta: successfully parsed string to number:`, parsed);
        return parsed.toFixed(1);
      } else {
        console.log(`[KPICard] safeFormatDelta: failed to parse string, returning raw value`);
        return delta;
      }
    }
    
    // Fallback for any other type
    console.log(`[KPICard] safeFormatDelta: unknown type, converting to string`);
    return String(delta);
  };

  const TrendArrow = is_positive ? ArrowUp : ArrowDown;

  const finalSafeValue = safeFormatValue(value);
  const finalSafeDelta = deltaPercent ? safeFormatDelta(deltaPercent) : null;
  const finalDisplayValue = `${prefix}${finalSafeValue}${suffix}`;
  
  console.log(`[KPICard] 🎯 Final render data for ${title}:`);
  console.log(`[KPICard]   - Raw value: "${value}" (${typeof value})`);
  console.log(`[KPICard]   - Safe formatted value: "${finalSafeValue}"`);
  console.log(`[KPICard]   - Final display value: "${finalDisplayValue}"`);
  console.log(`[KPICard]   - Sub label: "${sub_label}"`);
  console.log(`[KPICard]   - Delta percent: "${deltaPercent}" -> "${finalSafeDelta}"`);
  console.log(`[KPICard]   - Is positive: ${is_positive}`);
  console.log(`[KPICard]   - Trend color: ${is_positive ? 'green' : 'red'}`);

  return (
    <div className="relative rounded-xl border border-gray-700 bg-gray-800/50 p-4 shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <Info className="h-4 w-4 text-gray-500" />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-semibold text-white">
          {finalDisplayValue}
        </p>
        <div className="mt-1 flex items-center space-x-2 text-xs">
          {deltaPercent && (
            <span className={cn('flex items-center', is_positive ? 'text-green-400' : 'text-red-400')}>
              <TrendArrow className="mr-1 h-4 w-4" />
              {finalSafeDelta}%
            </span>
          )}
          <p className="text-gray-500">{sub_label}</p>
        </div>
      </div>
    </div>
  );
};

export default KPICard; 