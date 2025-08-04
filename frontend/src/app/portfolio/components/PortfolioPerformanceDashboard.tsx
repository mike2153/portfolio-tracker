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

interface PortfolioPerformanceDashboardProps {
  portfolioData?: PortfolioData;
  isLoading?: boolean;
}

const PortfolioPerformanceDashboard: React.FC<PortfolioPerformanceDashboardProps> = ({
  portfolioData,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-transparent border border-[#30363D] rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-[#30363D] rounded mb-2"></div>
            <div className="h-8 bg-[#30363D] rounded mb-4"></div>
            <div className="h-3 bg-[#30363D] rounded w-2/3"></div>
          </div>
        ))}
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
      label: 'Current Portfolio Value',
      value: formatCurrency(total_value),
      icon: <DollarSign className="w-5 h-5" />,
      trend: null,
      className: 'gradient-text-green',
      delay: '0ms'
    },
    {
      id: 'total-profit',
      label: 'Total Profit/Loss',
      value: formatCurrency(total_gain_loss),
      icon: isPositivePerformance ? 
        <TrendingUp className="w-5 h-5" /> : 
        <TrendingDown className="w-5 h-5" />,
      trend: formatPercentage(total_gain_loss_percent),
      className: isPositivePerformance ? 'text-[#10B981]' : 'text-[#EF4444]',
      delay: '100ms'
    },
    {
      id: 'dividends-received',
      label: 'Dividends Received YTD',
      value: formatCurrency(total_dividends_received),
      icon: <DollarSign className="w-5 h-5" />,
      trend: null,
      className: 'text-[#F59E0B]',
      delay: '200ms'
    },
    {
      id: 'capital-gains',
      label: 'Total Capital Gains',
      value: formatCurrency(totalCapitalGains),
      subtext: 'Dividends + Profit',
      icon: <Target className="w-5 h-5" />,
      trend: null,
      className: isPositiveGains ? 'text-[#10B981]' : 'text-[#EF4444]',
      delay: '300ms'
    },
    {
      id: 'unrealized-profit',
      label: 'Unrealized Profit/Loss',
      value: formatCurrency(unrealized_gain_loss),
      icon: <PieChart className="w-5 h-5" />,
      trend: null,
      className: unrealized_gain_loss >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]',
      delay: '400ms'
    },
    {
      id: 'dividend-metrics',
      label: 'Expected Annual Dividends',
      value: formatCurrency(expected_annual_dividends),
      subtext: `${formatPercentage(dividend_yield)} yield • ${formatPercentage(yield_on_cost)} YOC`,
      icon: <Percent className="w-5 h-5" />,
      trend: null,
      className: 'text-[#F59E0B]',
      delay: '500ms'
    }
  ];

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold gradient-text-green mb-2">Portfolio Performance</h2>
        <p className="text-[#8B949E]">Overview of your investment performance and dividend income</p>
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-transparent border border-[#30363D] rounded-xl p-6 hover-lift animate-slide-in-bottom btn-micro group"
            style={{ animationDelay: metric.delay }}
          >
            {/* Icon and Label */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#30363D]/50 group-hover:bg-[#10B981]/20 transition-colors duration-300">
                {React.cloneElement(metric.icon, {
                  className: `w-5 h-5 ${metric.className} group-hover:text-[#10B981] transition-colors duration-300`
                })}
              </div>
              <div>
                <p className="text-xs text-[#8B949E] group-hover:text-gray-300 transition-colors duration-300">{metric.label}</p>
              </div>
            </div>

            {/* Value */}
            <div className="mb-3">
              <p className={`text-3xl font-bold ${metric.className} group-hover:text-[#10B981] transition-colors duration-300`}>
                {metric.value}
              </p>
            </div>

            {/* Trend or Subtext */}
            {metric.trend && (
              <div className="flex items-center gap-1">
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
              <p className="text-xs text-[#8B949E] group-hover:text-gray-300 transition-colors duration-300">
                {metric.subtext}
              </p>
            )}

            {/* Floating indicator for positive performance */}
            {(metric.id === 'total-profit' && isPositivePerformance) && (
              <div className="absolute top-3 right-3 w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Insights */}
      <div className="mt-6 p-4 bg-transparent border border-[#30363D] rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-white">Portfolio Summary</span>
        </div>
        <p className="text-sm text-[#8B949E]">
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
  );
};

export default PortfolioPerformanceDashboard;