import React, { useState, useEffect } from 'react';
import { StockResearchData, CompanyFinancialsResponse } from '@/types/stock-research';
import { front_api_client } from '@/lib/front_api_client';
import { BarChart3, TrendingUp, RefreshCw, DollarSign, Percent, LineChart, Activity, FileSpreadsheet } from 'lucide-react';
import FinancialBarChart from '@/components/charts/FinancialBarChart';
import FinancialSpreadsheet from '@/components/charts/FinancialSpreadsheet';
import PriceEpsChart from '@/components/charts/PriceEpsChart';

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
  const [viewMode, setViewMode] = useState<'charts' | 'tables' | 'spreadsheet'>('charts');
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

  // Load balance sheet and cash flow data when spreadsheet view is selected
  useEffect(() => {
    if (ticker && viewMode === 'spreadsheet') {
      // Load both balance sheet and cash flow data for spreadsheet view
      if (!detailedFinancialsData?.balance) {
        loadDetailedFinancialData('balance');
      }
      if (!detailedFinancialsData?.cashflow) {
        loadDetailedFinancialData('cashflow');
      }
    }
  }, [ticker, viewMode]);

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
          
          {/* View Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('charts')}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'charts'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <LineChart className="w-4 h-4" />
              Charts
            </button>
            <button
              onClick={() => setViewMode('tables')}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'tables'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Tables
            </button>
            <button
              onClick={() => setViewMode('spreadsheet')}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'spreadsheet'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              5-Year View
            </button>
          </div>
        </div>

        {/* Chart Controls (shown when chart view is active) */}
        {viewMode === 'charts' && (
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
        )}

        {/* Table Controls (shown when table view is active) */}
        {viewMode === 'tables' && (
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Statement Type Selector */}
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
            
            {/* Period Selector */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setSelectedPeriod('annual')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedPeriod === 'annual'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Annual
              </button>
              <button
                onClick={() => setSelectedPeriod('quarterly')}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedPeriod === 'quarterly'
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                Quarterly
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Financial Data Display */}
      {financialsData ? (
        <div className="space-y-6">
          {/* Interactive Bar Chart (shown when chart view is active) */}
          {viewMode === 'charts' && (
            <FinancialBarChart
              data={detailedFinancialsData?.[selectedStatement]?.[selectedPeriod === 'annual' ? 'annual_reports' : 'quarterly_reports'] || []}
              statementType={selectedStatement}
              selectedMetrics={selectedMetrics}
              onMetricToggle={handleMetricToggle}
              height={450}
              ticker={ticker}
            />
          )}

          {/* Key Financial Metrics */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Key Financial Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-400">Market Cap</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {formatNumber(financialsData.market_cap || 0)}
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-400">P/E Ratio</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {financialsData.pe_ratio || 'N/A'}
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-400">EPS</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  ${financialsData.eps || 'N/A'}
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-400">Div Yield</span>
                </div>
                <div className="text-lg font-semibold text-white">
                  {formatPercent(financialsData.dividend_yield || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Price vs EPS Dual Chart */}
          <PriceEpsChart
            priceData={data?.priceData || []}
            epsData={detailedFinancialsData?.income?.annual_reports || []}
            ticker={ticker}
            height={450}
            isLoading={detailedFinancialsLoading}
            onRefresh={() => loadDetailedFinancialData('income', true)}
          />

          {/* 5-Year Financial Spreadsheet (shown when spreadsheet view is active) */}
          {viewMode === 'spreadsheet' && (
            <FinancialSpreadsheet
              data={detailedFinancialsData}
              ticker={ticker}
              onRefresh={() => {
                loadDetailedFinancialData('balance', true);
                loadDetailedFinancialData('cashflow', true);
              }}
              isLoading={detailedFinancialsLoading}
            />
          )}

          {/* Detailed Financial Statements (shown when table view is active) */}
          {viewMode === 'tables' && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">
                  {selectedStatement === 'income' && 'Income Statement'}
                  {selectedStatement === 'balance' && 'Balance Sheet'}
                  {selectedStatement === 'cashflow' && 'Cash Flow Statement'}
                </h4>
                
                {detailedFinancialsLoading && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>
              
              {/* Show statement data if available */}
              {detailedFinancialsData?.[selectedStatement] ? (
                <div className="space-y-4">
                  {/* Annual/Quarterly Toggle and Data */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left text-gray-400 font-medium py-2">Item</th>
                          {detailedFinancialsData[selectedStatement]?.[selectedPeriod === 'annual' ? 'annual_reports' : 'quarterly_reports']?.slice(0, 4).map((report: any, index: number) => (
                            <th key={index} className="text-right text-gray-400 font-medium py-2">
                              {report.fiscalDateEnding || `Period ${index + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Render rows based on statement type */}
                        {(() => {
                          const reports = detailedFinancialsData[selectedStatement]?.[selectedPeriod === 'annual' ? 'annual_reports' : 'quarterly_reports']?.slice(0, 4) || [];
                          
                          if (selectedStatement === 'income') {
                            return [
                              'totalRevenue',
                              'costOfRevenue', 
                              'grossProfit',
                              'operatingIncome',
                              'netIncome'
                            ].map(field => (
                              <tr key={field} className="border-b border-gray-700">
                                <td className="py-2 text-gray-300">
                                  {field === 'totalRevenue' && 'Total Revenue'}
                                  {field === 'costOfRevenue' && 'Cost of Revenue'}
                                  {field === 'grossProfit' && 'Gross Profit'}
                                  {field === 'operatingIncome' && 'Operating Income'}
                                  {field === 'netIncome' && 'Net Income'}
                                </td>
                                {reports.map((report: any, index: number) => (
                                  <td key={index} className="text-right py-2 text-white">
                                    {formatNumber(report[field] || 0)}
                                  </td>
                                ))}
                              </tr>
                            ));
                          } else if (selectedStatement === 'balance') {
                            return [
                              'totalAssets',
                              'totalCurrentAssets',
                              'totalLiabilities',
                              'totalCurrentLiabilities', 
                              'totalShareholderEquity'
                            ].map(field => (
                              <tr key={field} className="border-b border-gray-700">
                                <td className="py-2 text-gray-300">
                                  {field === 'totalAssets' && 'Total Assets'}
                                  {field === 'totalCurrentAssets' && 'Current Assets'}
                                  {field === 'totalLiabilities' && 'Total Liabilities'}
                                  {field === 'totalCurrentLiabilities' && 'Current Liabilities'}
                                  {field === 'totalShareholderEquity' && 'Shareholder Equity'}
                                </td>
                                {reports.map((report: any, index: number) => (
                                  <td key={index} className="text-right py-2 text-white">
                                    {formatNumber(report[field] || 0)}
                                  </td>
                                ))}
                              </tr>
                            ));
                          } else if (selectedStatement === 'cashflow') {
                            return [
                              'operatingCashflow',
                              'capitalExpenditures',
                              'cashflowFromInvestment',
                              'cashflowFromFinancing',
                              'netIncomeFromContinuingOps'
                            ].map(field => (
                              <tr key={field} className="border-b border-gray-700">
                                <td className="py-2 text-gray-300">
                                  {field === 'operatingCashflow' && 'Operating Cash Flow'}
                                  {field === 'capitalExpenditures' && 'Capital Expenditures'}
                                  {field === 'cashflowFromInvestment' && 'Cash Flow from Investing'}
                                  {field === 'cashflowFromFinancing' && 'Cash Flow from Financing'}
                                  {field === 'netIncomeFromContinuingOps' && 'Net Income (Continuing Ops)'}
                                </td>
                                {reports.map((report: any, index: number) => (
                                  <td key={index} className="text-right py-2 text-white">
                                    {formatNumber(report[field] || 0)}
                                  </td>
                                ))}
                              </tr>
                            ));
                          }
                          return null;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Placeholder when no data available */
                <div className="text-center text-gray-400 py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-2">Loading {selectedStatement} statement...</p>
                  <p className="text-sm">
                    Fetching {selectedPeriod} data from Alpha Vantage
                  </p>
                  <button
                    onClick={() => loadDetailedFinancialData(selectedStatement, true)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                  >
                    Load {selectedStatement} data
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Company Overview Financial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-4">Profitability</h4>
              <div className="space-y-3">
                {[
                  { label: 'Revenue TTM', value: formatNumber(financialsData.revenue_ttm || 0) },
                  { label: 'Operating Margin', value: formatPercent(financialsData.operating_margin || 0) },
                  { label: 'Profit Margin', value: formatPercent(financialsData.profit_margin || 0) },
                  { label: 'Return on Equity', value: formatPercent(financialsData.return_on_equity || 0) },
                  { label: 'Return on Assets', value: formatPercent(financialsData.return_on_assets || 0) }
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-white mb-4">Valuation & Ratios</h4>
              <div className="space-y-3">
                {[
                  { label: 'Book Value', value: `$${financialsData.book_value || 'N/A'}` },
                  { label: 'Price to Book', value: financialsData.price_to_book || 'N/A' },
                  { label: 'Price to Sales', value: financialsData.price_to_sales || 'N/A' },
                  { label: 'Beta', value: financialsData.beta || 'N/A' },
                  { label: '52 Week High', value: `$${financialsData['52_week_high'] || 'N/A'}` },
                  { label: '52 Week Low', value: `$${financialsData['52_week_low'] || 'N/A'}` }
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
