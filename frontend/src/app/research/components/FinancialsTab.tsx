import React, { useState, useEffect } from 'react';
import { StockResearchData, CompanyFinancialsResponse } from '@/types/stock-research';
import { front_api_client } from '@/lib/front_api_client';
import { BarChart3, TrendingUp, RefreshCw, DollarSign, Percent, LineChart, Activity, FileSpreadsheet } from 'lucide-react';
import FinancialBarChartApexEnhanced from '@/components/charts/FinancialBarChartApexEnhanced';
import FinancialSpreadsheetApex from '@/components/charts/FinancialSpreadsheetApex';
import PriceEpsChartApex from '@/components/charts/PriceEpsChartApex';

interface FinancialsTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

type FinancialPeriod = 'annual' | 'quarterly';
type FinancialStatement = 'income' | 'balance' | 'cashflow';

const FinancialsTab: React.FC<FinancialsTabProps> = ({ ticker, data, isLoading, onRefresh }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<FinancialPeriod>('annual');
  const [selectedStatement, setSelectedStatement] = useState<FinancialStatement>('income');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['totalRevenue', 'netIncome']);
  const [financialsData, setFinancialsData] = useState<any>(null);
  const [detailedFinancialsData, setDetailedFinancialsData] = useState<any>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [detailedFinancialsLoading, setDetailedFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  // Load financial data using the new caching API
  const loadFinancialData = async (forceRefresh: boolean = false) => {
    if (!ticker) return;
    
    setFinancialsLoading(true);
    setFinancialsError(null);
    
    try {
      const result = await front_api_client.front_api_get_company_financials(
        ticker,
        'overview', // Start with overview, extend later for income/balance/cashflow
        forceRefresh
      );
      
      if (result.success) {
        setFinancialsData(result.data);
        setCacheStatus(result.metadata?.cache_status || null);
      } else {
        setFinancialsError(result.error || 'Failed to load financial data');
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      setFinancialsError('Failed to load financial data');
    } finally {
      setFinancialsLoading(false);
    }
  };

  // Load data when ticker changes
  useEffect(() => {
    if (ticker) {
      loadFinancialData();
      // Also load income data for the PriceEpsChart
      loadDetailedFinancialData('income');
    }
  }, [ticker]);

  // Load detailed financial statements when chart view or table view is selected
  useEffect(() => {
    if (ticker) {
      // Only load if we don't already have the data
      if (!detailedFinancialsData?.[selectedStatement]) {
        loadDetailedFinancialData(selectedStatement);
      }
    }
  }, [ticker, selectedStatement]);

  // Load balance sheet and cash flow data automatically for 5-year analysis
  useEffect(() => {
    if (ticker) {
      // Always load both balance sheet and cash flow data for comprehensive 5-year analysis
      if (!detailedFinancialsData?.balance) {
        loadDetailedFinancialData('balance');
      }
      if (!detailedFinancialsData?.cashflow) {
        loadDetailedFinancialData('cashflow');
      }
    }
  }, [ticker]);

  const handleForceRefresh = () => {
    loadFinancialData(true);
  };

  // Load detailed financial statements data
  const loadDetailedFinancialData = async (statement: FinancialStatement, forceRefresh: boolean = false) => {
    if (!ticker) return;
    
    setDetailedFinancialsLoading(true);
    setFinancialsError(null);
    
    try {
      const result = await front_api_client.front_api_get_company_financials(
        ticker,
        statement, // 'income', 'balance', or 'cashflow'
        forceRefresh
      );
      
      if (result.success) {
        setDetailedFinancialsData((prev: any) => ({
          ...prev,
          [statement]: result.data
        }));
        setCacheStatus(result.metadata?.cache_status || null);
      } else {
        setFinancialsError(result.error || `Failed to load ${statement} statement`);
      }
    } catch (error) {
      console.error(`Error loading ${statement} statement:`, error);
      setFinancialsError(`Failed to load ${statement} statement`);
    } finally {
      setDetailedFinancialsLoading(false);
    }
  };

  if (isLoading || financialsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Financial Statements</h3>
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading financial data...
          </div>
        </div>
        
        {/* Loading skeleton */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6">
              <div className="h-4 bg-gray-700 rounded w-1/4 mb-4 animate-pulse"></div>
              <div className="space-y-2">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-3 bg-gray-700 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (financialsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Financial Statements</h3>
          <button
            onClick={handleForceRefresh}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
        
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <BarChart3 className="w-5 h-5" />
            <span className="font-semibold">Error Loading Financial Data</span>
          </div>
          <p className="text-red-300 text-sm">{financialsError}</p>
          <p className="text-gray-400 text-xs mt-2">
            This could be due to API rate limits or the stock symbol not being found.
          </p>
        </div>
      </div>
    );
  }

  // Format financial numbers with graceful handling
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return 'N/A';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1e12) {
      return `${sign}$${(absNum / 1e12).toFixed(1)}T`;
    } else if (absNum >= 1e9) {
      return `${sign}$${(absNum / 1e9).toFixed(1)}B`;
    } else if (absNum >= 1e6) {
      return `${sign}$${(absNum / 1e6).toFixed(1)}M`;
    } else if (absNum >= 1e3) {
      return `${sign}$${(absNum / 1e3).toFixed(1)}K`;
    } else if (absNum >= 1) {
      return `${sign}$${absNum.toFixed(2)}`;
    } else {
      return `${sign}$${absNum.toFixed(4)}`;
    }
  };

  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    return `${(num * 100).toFixed(2)}%`;
  };

  // Handle metric toggle for bar chart
  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric) 
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };


  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Financial Analysis</h3>
            {cacheStatus && (
              <p className="text-xs text-gray-400 mt-1">
                Cache: {cacheStatus.toUpperCase()} • 
                <button 
                  onClick={handleForceRefresh}
                  className="ml-1 text-blue-400 hover:text-blue-300 underline"
                >
                  Force Refresh
                </button>
              </p>
            )}
          </div>
          
        </div>

        {/* Chart Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Statement Type Selector for Charts */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            {[
              { key: 'income', label: 'Income', icon: DollarSign },
              { key: 'balance', label: 'Balance', icon: BarChart3 },
              { key: 'cashflow', label: 'Cash Flow', icon: TrendingUp }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedStatement(key as FinancialStatement)}
                className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedStatement === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Financial Data Display */}
      {financialsData ? (
        <div className="space-y-6">
          {/* Interactive Bar Chart */}
          <FinancialBarChartApexEnhanced
            data={detailedFinancialsData?.[selectedStatement]?.[selectedPeriod === 'annual' ? 'annual_reports' : 'quarterly_reports']?.slice(0, 5) || []}
            statementType={selectedStatement}
            selectedMetrics={selectedMetrics}
            onMetricToggle={handleMetricToggle}
            height={450}
            ticker={ticker}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            isLoading={detailedFinancialsLoading}
            onRefresh={() => loadDetailedFinancialData(selectedStatement, true)}
          />



          {/* 5-Year Financial Spreadsheet - Always Visible */}
          <FinancialSpreadsheetApex
            data={detailedFinancialsData}
            ticker={ticker}
            onRefresh={() => {
              loadDetailedFinancialData('balance', true);
              loadDetailedFinancialData('cashflow', true);
            }}
            isLoading={detailedFinancialsLoading}
          />


        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-center text-gray-400 py-8">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No financial data available for {ticker}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsTab;
