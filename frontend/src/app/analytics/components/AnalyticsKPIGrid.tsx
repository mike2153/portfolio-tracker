"use client";

import React from 'react';
// Import centralized formatters to eliminate duplication
import { formatCurrency, formatPercentage } from '@/utils/formatters';

interface DividendSummary {
  total_received: number;
  total_pending: number;
  ytd_received: number;
  confirmed_count: number;
  pending_count: number;
}

interface AnalyticsSummary {
  portfolio_value: number;
  total_profit: number;
  total_profit_percent: number;
  irr_percent: number;
  passive_income_ytd: number;
  cash_balance: number;
  dividend_summary: DividendSummary;
}

interface AnalyticsKPIGridProps {
  summary?: AnalyticsSummary;
  isLoading: boolean;
  error: Error | null;
}

// Create local wrapper for integer formatting requirement
const formatCompactCurrency = (value: number | null | undefined): string => {
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const getChangeColor = (value: number | null | undefined): string => {
  const numValue = Number(value) || 0;
  if (numValue > 0) return 'text-green-400';
  if (numValue < 0) return 'text-red-400';
  return 'text-gray-400';
};

const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
    <div className="h-8 bg-gray-700 rounded w-32"></div>
  </div>
);

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeColor?: string;
  icon: string;
  isLoading: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  change, 
  changeColor = 'text-gray-400', 
  icon, 
  isLoading 
}) => (
  <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 hover:border-gray-600/50 transition-all duration-200">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
        {title}
      </h3>
      <span className="text-2xl">{icon}</span>
    </div>
    
    {isLoading ? (
      <LoadingSkeleton />
    ) : (
      <>
        <div className="text-3xl font-bold text-white mb-2">
          {value}
        </div>
        {change && (
          <div className={`text-sm font-medium ${changeColor}`}>
            {change}
          </div>
        )}
      </>
    )}
  </div>
);

export default function AnalyticsKPIGrid({ summary, isLoading, error }: AnalyticsKPIGridProps) {
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">⚠️ Error Loading Data</div>
        <p className="text-gray-400 text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {/* Portfolio Value */}
      <KPICard
        title="Portfolio Value"
        value={formatCompactCurrency(summary?.portfolio_value || 0)}
        icon="💼"
        isLoading={isLoading}
      />

      {/* Total Profit */}
      <KPICard
        title="Total Profit"
        value={formatCompactCurrency(summary?.total_profit || 0)}
        change={formatPercentage(summary?.total_profit_percent || 0)}
        changeColor={getChangeColor(summary?.total_profit || 0)}
        icon="📈"
        isLoading={isLoading}
      />

      {/* IRR */}
      <KPICard
        title="IRR"
        value={formatPercentage(summary?.irr_percent || 0)}
        changeColor={getChangeColor(summary?.irr_percent || 0)}
        icon="🎯"
        isLoading={isLoading}
      />

      {/* Passive Income (YTD) */}
      <KPICard
        title="Passive Income"
        value={formatCompactCurrency(summary?.passive_income_ytd || 0)}
        change={`${summary?.dividend_summary?.confirmed_count || 0} dividends`}
        changeColor="text-blue-400"
        icon="💰"
        isLoading={isLoading}
      />

      {/* Cash Balance */}
      <KPICard
        title="Cash Balance"
        value={formatCompactCurrency(summary?.cash_balance || 0)}
        change="Available"
        changeColor="text-gray-400"
        icon="🏦"
        isLoading={isLoading}
      />
    </div>
  );
}