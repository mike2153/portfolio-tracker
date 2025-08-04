'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface UltraGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
}

/**
 * Web-optimised bg-transparent border border-[#30363D] card used across the research section.
 * Three variants for opacity / emphasis.
 */
export default function UltraGlassCard({
  className,
  variant = 'default',
  ...props
}: UltraGlassCardProps) {
  const variants: Record<string, string> = {
    default:
      'bg-white/5 border border-white/10 backdrop-blur-lg shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
    elevated:
      'bg-white/8 border border-emerald-400/20 backdrop-blur-xl shadow-[0_6px_32px_rgba(0,0,0,0.35)] hover:shadow-emerald-500/40',
    subtle:
      'bg-white/3 border border-white/5 backdrop-blur shadow-[0_2px_12px_rgba(0,0,0,0.15)]',
  };

  return (
    <div
      className={cn(
        'rounded-xl transition-shadow duration-300 hover:shadow-lg',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
