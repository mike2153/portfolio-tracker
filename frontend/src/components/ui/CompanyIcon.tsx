'use client';

import Image from 'next/image';
import { useCompanyIcon } from '@/hooks/useCompanyIcon';

interface CompanyIconProps {
  symbol: string;
  size?: number;
  className?: string;
  fallback?: 'initials' | 'placeholder' | 'none';
}

const CompanyIcon = ({ 
  symbol, 
  size = 24, 
  className = '', 
  fallback = 'initials' 
}: CompanyIconProps) => {
  const { iconPath, loading, error } = useCompanyIcon(symbol);

  // Loading state
  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="animate-pulse bg-gray-300 rounded" style={{ width: size * 0.6, height: size * 0.6 }} />
      </div>
    );
  }

  // Icon found - render it
  if (iconPath && !error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Image
          src={iconPath}
          alt={`${symbol} logo`}
          width={size}
          height={size}
          className="rounded"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  // Fallback rendering
  if (fallback === 'none') {
    return null;
  }

  if (fallback === 'placeholder') {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-200 rounded ${className}`}
        style={{ width: size, height: size }}
      >
        <svg 
          width={size * 0.6} 
          height={size * 0.6} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          className="text-gray-500"
        >
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <path d="M9 9h.01"/>
          <path d="M15 9h.01"/>
        </svg>
      </div>
    );
  }

  // Default: initials fallback
  const initials = symbol.length >= 2 ? symbol.substring(0, 2) : symbol;
  const fontSize = size < 32 ? 'text-xs' : size < 48 ? 'text-sm' : 'text-base';

  return (
    <div 
      className={`flex items-center justify-center bg-blue-100 text-blue-700 font-medium rounded ${fontSize} ${className}`}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

export default CompanyIcon;