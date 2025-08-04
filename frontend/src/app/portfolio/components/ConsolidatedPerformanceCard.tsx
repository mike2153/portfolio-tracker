'use client';

import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target, PieChart, Percent } from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../../../../shared/utils/formatters';

interface PortfolioData {
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  total_dividends_received?: number;
  unrealized_gain_loss?: number;
  realized_gain_loss?: number;
  expected_annual_dividends?: number;
  dividend_yield?: number;
  yield_on_cost?: number;
}

interface ConsolidatedPerformanceCardProps {
  portfolioData?: PortfolioData;
  isLoading?: boolean;
}

const ConsolidatedPerformanceCard: React.FC<ConsolidatedPerformanceCardProps> = ({
  portfolioData,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="bg-transparent border border-[#30363D] hover-3d animate-glow-pulse rounded-2xl p-8 relative overflow-hidden">
        <div className="animate-pulse">
          <div className="h-6 bg-[#30363D] rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 bg-[#30363D] rounded"></div>
                <div className="h-8 bg-[#30363D] rounded"></div>
                <div className="h-3 bg-[#30363D] rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const {
    total_value = 0,
    total_gain_loss = 0,
    total_gain_loss_percent = 0,
    total_dividends_received = 0,
    unrealized_gain_loss = 0,
    expected_annual_dividends = 0,
    dividend_yield = 0,
    yield_on_cost = 0
  } = portfolioData || {};

  // Calculate total capital gains (dividends + profit)
  const totalCapitalGains = total_dividends_received + total_gain_loss;
  const isPositiveGains = totalCapitalGains >= 0;
  const isPositivePerformance = total_gain_loss >= 0;

  const metrics = [
    {
      id: 'total-value',
      label: 'Portfolio Value',
      value: formatCurrency(total_value),
      icon: <DollarSign className="w-6 h-6" />,
      trend: null,
      className: 'gradient-text-green',
      bgColor: 'bg-[#10B981]/10'
    },
    {
      id: 'total-profit',
      label: 'Total Profit/Loss',
      value: formatCurrency(total_gain_loss),
      icon: isPositivePerformance ? 
        <TrendingUp className="w-6 h-6" /> : 
        <TrendingDown className="w-6 h-6" />,
      trend: formatPercentage(total_gain_loss_percent),
      className: isPositivePerformance ? 'text-[#10B981]' : 'text-[#EF4444]',
      bgColor: isPositivePerformance ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
    },
    {
      id: 'dividends-received',
      label: 'Dividends YTD',
      value: formatCurrency(total_dividends_received),
      icon: <DollarSign className="w-6 h-6" />,
      trend: null,
      className: 'text-[#F59E0B]',
      bgColor: 'bg-[#F59E0B]/10'
    },
    {
      id: 'capital-gains',
      label: 'Total Capital Gains',
      value: formatCurrency(totalCapitalGains),
      subtext: 'Dividends + Profit',
      icon: <Target className="w-6 h-6" />,
      trend: null,
      className: isPositiveGains ? 'text-[#10B981]' : 'text-[#EF4444]',
      bgColor: isPositiveGains ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
    },
    {
      id: 'unrealized-profit',
      label: 'Unrealized P&L',
      value: formatCurrency(unrealized_gain_loss),
      icon: <PieChart className="w-6 h-6" />,
      trend: null,
      className: unrealized_gain_loss >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
      bgColor: unrealized_gain_loss >= 0 ? 'bg-[#10B981]/10' : 'bg-[#EF4444]/10'
    },
    {
      id: 'dividend-metrics',
      label: 'Expected Annual Dividends',
      value: formatCurrency(expected_annual_dividends),
      subtext: `${formatPercentage(dividend_yield)} yield • ${formatPercentage(yield_on_cost)} YOC`,
      icon: <Percent className="w-6 h-6" />,
      trend: null,
      className: 'text-[#F59E0B]',
      bgColor: 'bg-[#F59E0B]/10'
    }
  ];

  return (
    <div className="relative">
      {/* Main Performance Card with Subtle Effects */}
      <div className="bg-transparent border border-[#30363D] rounded-2xl p-8 relative overflow-hidden group">
        
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-[#1E3A8A]/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-[#10B981]/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-[#F59E0B]/10 rounded-full blur-xl"></div>
        </div>


        {/* Header */}
        <div className="relative z-10 mb-8">
          <h2 className="text-2xl font-bold gradient-text-green mb-2">
            Portfolio Performance
          </h2>
          <p className="text-[#8B949E]">
            Comprehensive overview of your investment performance and returns
          </p>
        </div>

        {/* Performance Metrics Grid - Flush Layout */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className="group/metric"
            >
              {/* Icon and Label */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  {React.cloneElement(metric.icon, {
                    className: `w-5 h-5 ${metric.className}`
                  })}
                </div>
                <div>
                  <p className="text-sm text-[#8B949E] font-medium">
                    {metric.label}
                  </p>
                </div>
              </div>

              {/* Value */}
              <div className="mb-2">
                <p className={`text-3xl font-bold ${metric.className}`}>
                  {metric.value}
                </p>
              </div>

              {/* Trend or Subtext */}
              {metric.trend && (
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${metric.className}`}>
                    {metric.trend}
                  </span>
                  {metric.trend.startsWith('+') ? (
                    <TrendingUp className="w-4 h-4 text-[#10B981]" />
                  ) : metric.trend.startsWith('-') ? (
                    <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                  ) : null}
                </div>
              )}

              {metric.subtext && (
                <p className="text-xs text-[#8B949E]">
                  {metric.subtext}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Summary Insights */}
        <div className="relative z-10 mt-8 p-6 bg-transparent border border-[#30363D] rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
            <span className="font-medium gradient-text-green">Portfolio Summary</span>
          </div>
          <p className="text-[#8B949E] leading-relaxed">
            Your portfolio is currently valued at <span className="text-white font-medium">{formatCurrency(total_value)}</span>
            {isPositivePerformance ? (
              <span className="text-[#10B981]"> with unrealized gains of {formatCurrency(total_gain_loss)}</span>
            ) : (
              <span className="text-[#EF4444]"> with unrealized losses of {formatCurrency(Math.abs(total_gain_loss))}</span>
            )}
            {total_dividends_received > 0 && (
              <span className="text-[#F59E0B]"> and dividends of {formatCurrency(total_dividends_received)} received this year</span>
            )}.
          </p>
        </div>

      </div>

      {/* Subtle Floating Status Cards */}
      <div className="absolute -top-4 -right-4">
        <div className="bg-transparent border border-[#30363D] rounded-lg p-2">
          <div className="flex items-center space-x-1">
            <div className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></div>
            <div>
              <div className="text-xs text-[#10B981] font-medium">Live</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute -bottom-4 -left-4">
        <div className="bg-transparent border border-[#30363D] rounded-lg p-2">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-[#1E3A8A] rounded flex items-center justify-center">
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </div>
            <div>
              <div className={`text-xs font-medium ${isPositivePerformance ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                {isPositivePerformance ? 'Up' : 'Down'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedPerformanceCard;