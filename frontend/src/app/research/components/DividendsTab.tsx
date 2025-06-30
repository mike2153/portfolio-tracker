'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, DollarSign, TrendingUp, Calendar, BarChart as BarChartIcon } from 'lucide-react';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { front_api_client } from '@/lib/front_api_client';
import type { TabContentProps, DividendData } from '@/types/stock-research';

export default function DividendsTab({ ticker, data, isLoading, onRefresh }: TabContentProps) {
  const [dividendData, setDividendData] = useState<DividendData | null>(null);
  const [loadingDividends, setLoadingDividends] = useState(false);

  useEffect(() => {
    loadDividendData();
  }, [ticker]);

  const loadDividendData = async () => {
    setLoadingDividends(true);
    try {
      const data = await stockResearchAPI.getDividends(ticker);
      setDividendData(data);
    } catch (error) {
      console.error('Error loading dividend data:', error);
    } finally {
      setLoadingDividends(false);
    }
  };

  const formatValue = (value: string | number | undefined, fallback = 'N/A') => {
    if (!value || value === 'None' || value === 'null') return fallback;
    
    if (typeof value === 'string' && value.includes('%')) return value;
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return fallback;
    
    return `$${num.toFixed(2)}`;
  };

  const formatPercent = (value: string | undefined) => {
    if (!value || value === 'None' || value === 'null') return 'N/A';
    if (value.includes('%')) return value;
    
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    
    return `${(num * 100).toFixed(2)}%`;
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString || dateString === 'None' || dateString === 'null') return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-white font-medium">
            {formatValue(data.amount)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loadingDividends || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading dividend data...
        </div>
      </div>
    );
  }

  const hasDividendData = dividendData && (
    dividendData.yield !== 'N/A' || 
    dividendData.ex_dividend_date !== 'N/A' || 
    dividendData.history.length > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dividends</h2>
        <button
          onClick={() => {
            onRefresh();
            loadDividendData();
          }}
          disabled={isLoading || loadingDividends}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || loadingDividends) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!hasDividendData ? (
        <div className="text-center py-16">
          <DollarSign size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Dividend Data Available</h3>
          <p className="text-gray-500">
            {ticker} may not pay dividends or dividend data is not available from our data provider.
          </p>
        </div>
      ) : (
        <>
          {/* Dividend Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Dividend Yield</h4>
                <DollarSign size={16} className="text-gray-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {formatPercent(dividendData?.yield)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Payout Ratio</h4>
                <TrendingUp size={16} className="text-gray-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {dividendData?.payout_ratio || 'N/A'}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Ex-Dividend Date</h4>
                <Calendar size={16} className="text-gray-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {formatDate(dividendData?.ex_dividend_date)}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Payment Date</h4>
                <Calendar size={16} className="text-gray-400" />
              </div>
              <div className="text-xl font-bold text-white">
                {formatDate(dividendData?.dividend_date)}
              </div>
            </div>
          </div>

          {/* Dividend History Chart */}
          {dividendData?.history && dividendData.history.length > 0 ? (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">
                Dividend History
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <ReBarChart
                  data={dividendData.history}
                  margin={{
                    top: 20,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af"
                    fontSize={12}
                    tick={{ fill: '#9ca3af' }}
                  />
                  <YAxis 
                    stroke="#9ca3af"
                    fontSize={12}
                    tick={{ fill: '#9ca3af' }}
                    tickFormatter={(value) => formatValue(value)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    fill="#10b981"
                    radius={[2, 2, 0, 0]}
                  />
                </ReBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <BarChartIcon size={48} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Historical Data</h3>
              <p className="text-gray-500">
                Historical dividend payment data is not available for {ticker}.
              </p>
            </div>
          )}

          {/* Dividend Analysis */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Dividend Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-300 mb-3">Key Metrics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Current Yield:</span>
                    <span className="text-white">{formatPercent(dividendData?.yield)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Payout Ratio:</span>
                    <span className="text-white">{dividendData?.payout_ratio || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Payments Per Year:</span>
                    <span className="text-white">
                      {dividendData?.history.length || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-300 mb-3">Important Dates</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Ex-Dividend:</span>
                    <span className="text-white">{formatDate(dividendData?.ex_dividend_date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Payment Date:</span>
                    <span className="text-white">{formatDate(dividendData?.dividend_date)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Data Attribution */}
      <div className="text-center text-xs text-gray-500">
        Dividend data provided by Alpha Vantage • Information may be delayed or estimated
      </div>
    </div>
  );
}