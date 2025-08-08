'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { 
  KPICardProps
} from '@/types/dashboard';

// Props now imported from centralized types
// Enhanced with better error handling and loading states

const KPICard = ({ 
  title, 
  data, 
  prefix = "", 
  suffix = "", 
  showPercentage = false, 
  percentValue, 
  showValueAsPercent = false,
  loading = false,
  error = null
}: KPICardProps) => {
//  console.log(`[KPICard] 🚀 Enhanced KPI card rendering for: ${title}`);
 // console.log(`[KPICard] 📊 Raw data received:`, data);
  //console.log(`[KPICard] 📊 Data type:`, typeof data);
  //console.log(`[KPICard] 📊 Data keys:`, data ? Object.keys(data) : 'null');
  //console.log(`[KPICard] 🎯 Props - title: "${title}", prefix: "${prefix}", suffix: "${suffix}"`);
  
  // Handle loading state
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-[#30363D]/50">
            <div className="w-6 h-6 bg-[#30363D] rounded"></div>
          </div>
          <div className="flex-1">
            <div className="h-4 bg-[#30363D] rounded mb-2"></div>
            <div className="h-8 bg-[#30363D] rounded mb-2"></div>
            <div className="h-3 bg-[#30363D] rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#EF4444]/5 via-transparent to-[#EF4444]/5"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 rounded-lg bg-[#EF4444]/10">
            <ArrowDown className="w-6 h-6 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-sm text-[#8B949E] mb-1">{title}</p>
            <p className="text-2xl font-bold text-[#EF4444]">Error</p>
            <p className="text-xs text-[#EF4444] mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle invalid data
  if (!data || typeof data !== 'object') {
    console.error(`[KPICard] ❌ Invalid data for ${title}:`, data);
    return (
      <div className="bg-transparent border border-[#30363D] rounded-xl p-6 border border-[#EF4444]/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#EF4444]/5 via-transparent to-[#EF4444]/5"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 rounded-lg bg-[#EF4444]/10">
            <ArrowDown className="w-6 h-6 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-sm text-[#8B949E] mb-1">{title}</p>
            <p className="text-2xl font-bold text-[#EF4444]">Error</p>
            <p className="text-xs text-[#EF4444] mt-1">Invalid data</p>
          </div>
        </div>
      </div>
    );
  }
  
  const { value, sub_label, is_positive } = data;
  
  /*

*/
  // Type-safe value formatting function
  const safeFormatValue = (val: number | string | null | undefined): string => {
    //console.log(`[KPICard] safeFormatValue called with:`, val, 'type:', typeof val);
    
    // Handle null/undefined
    if (val == null) {
      //console.log(`[KPICard] safeFormatValue: value is null/undefined, returning 0.00`);
      return '0.00';
    }
    
    // If it's already a number
    if (typeof val === 'number') {
  //    console.log(`[KPICard] safeFormatValue: value is number, using toLocaleString`);
      if (isNaN(val)) {
        return '—';
      }
      // For percentage values, don't use thousands separator
      if (showValueAsPercent) {
        return val.toFixed(2);
      }
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // If it's a string, try to parse it
    if (typeof val === 'string') {
  //    console.log(`[KPICard] safeFormatValue: value is string, attempting to parse`);
      const parsed = Number(val);
      if (!isNaN(parsed)) {
        //console.log(`[KPICard] safeFormatValue: successfully parsed string to number:`, parsed);
        if (showValueAsPercent) {
          return parsed.toFixed(2);
        }
        return parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        //console.log(`[KPICard] safeFormatValue: failed to parse string, returning raw value`);
        return '—';
      }
    }
    
    // Fallback for any other type
    //console.log(`[KPICard] safeFormatValue: unknown type, converting to string`);
    return String(val);
  };


  const finalSafeValue = safeFormatValue(value);
  const finalDisplayValue = `${prefix}${finalSafeValue}${suffix}`;
  
  // Format percentage for Performance card
  const formatPercentageDisplay = (percent: number | undefined) => {
    if (percent === undefined) return '';
    const sign = percent >= 0 ? '+' : '';
    return ` (${sign}${percent.toFixed(2)}%)`;
  };
  
  /*

*/
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg transition-all duration-500 ${
        is_positive 
          ? 'bg-[#10B981]/10 hover:bg-[#10B981]/20 hover:shadow-lg hover:shadow-[#10B981]/25' 
          : 'bg-[#EF4444]/10 hover:bg-[#EF4444]/20'
      }`}>
        {is_positive ? (
          <ArrowUp className={`w-4 h-4 text-[#10B981] transition-all duration-500 hover:scale-110 hover:text-[#34D399] ${
            is_positive ? 'animate-pulse-glow' : ''
          }`} />
        ) : (
          <ArrowDown className="w-4 h-4 text-[#EF4444] transition-all duration-500 hover:scale-110 hover:text-[#f87171]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#8B949E] mb-1 hover:text-gray-300 transition-colors duration-500 truncate">
          {title}
        </p>
        <div className="flex items-baseline">
          <p className={`text-2xl font-bold transition-all duration-500 animate-number-reveal ${
            is_positive 
              ? 'gradient-text-performance hover:scale-105' 
              : 'gradient-text-negative hover:scale-105'
          }`}>
            {finalDisplayValue}
          </p>
          {showPercentage && (percentValue !== undefined || data.percentGain !== undefined) && (
            <span className="ml-2 text-base font-medium text-[#8B949E] hover:text-gray-300 transition-colors duration-500">
              {formatPercentageDisplay(percentValue || data.percentGain)}
            </span>
          )}
        </div>
        {sub_label && (
          <p className="text-sm text-[#8B949E] mt-1 hover:text-gray-300 transition-colors duration-500 truncate">
            {sub_label}
          </p>
        )}
      </div>
    </div>
  );
};

export default KPICard; 