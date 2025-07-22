import React, { useState, useEffect } from 'react';
import { TabContentProps, FinancialStatementType, FinancialPeriodType } from '@/types/stock-research';
import { front_api_client } from '@/lib/front_api_client';
import { DollarSign, TrendingUp, BarChart3, RefreshCw, ChevronDown } from 'lucide-react';
import FinancialsChart from './FinancialsChart';
import FinancialsTable from './FinancialsTable';

interface FinancialMetric {
  key: string;
  label: string;
  description: string;
  values: Record<string, number>;
  section: string;
}

/**
 * FinancialsTabNew Component
 * 
 * Comprehensive financials page with interactive chart and table.
 * Features tabs, dropdowns, ApexCharts integration, and multi-select table.
 */
const FinancialsTabNew: React.FC<TabContentProps> = ({ ticker, data, isLoading, onRefresh }) => {
  // State for tab navigation and controls
  const [activeStatement, setActiveStatement] = useState<FinancialStatementType>('income');
  const [activePeriod, setActivePeriod] = useState<FinancialPeriodType>('annual');
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  
  // State for financial data
  const [financialsData, setFinancialsData] = useState<Record<string, any>>({});
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  
  // State for chart/table interaction
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Load financial data from API
  const loadFinancialData = async (statement: FinancialStatementType, forceRefresh: boolean = false) => {
    if (!ticker) return;
    
    setFinancialsLoading(true);
    setFinancialsError(null);
    
    try {
      const result = await front_api_client.front_api_get_company_financials(
        ticker,
        statement,
        forceRefresh
      );
      
      if (result.success && result.data) {
        setFinancialsData((prev: any) => ({
          ...prev,
          [statement]: result.data
        }));
      } else {
        setFinancialsError(result.error || `Failed to load ${statement} data`);
      }
    } catch (error) {
      console.error(`Error loading ${statement} data:`, error);
      setFinancialsError(`Failed to load ${statement} data`);
    } finally {
      setFinancialsLoading(false);
    }
  };

  // Load data when ticker or statement changes
  useEffect(() => {
    if (ticker) {
      loadFinancialData(activeStatement);
    }
  }, [ticker, activeStatement]);

  // Auto-select first few metrics when data changes
  useEffect(() => {
    if (currentFinancialData.length > 0) {
      // Auto-select first 3 metrics for better UX
      const firstThreeMetrics = currentFinancialData.slice(0, 3).map((metric: FinancialMetric) => metric.key);
      setSelectedMetrics(firstThreeMetrics);
    }
  }, [activeStatement, activePeriod, ticker]);

  // Handle metric selection toggle
  const handleMetricToggle = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  // Transform API data to component format
  const transformFinancialData = (): FinancialMetric[] => {
    const statementData = financialsData?.[activeStatement];
    if (!statementData) return [];
    
    const reports = activePeriod === 'annual' 
      ? statementData.annual_reports || [] 
      : statementData.quarterly_reports || [];
    
    if (reports.length === 0) return [];
    
    // Get metric definitions based on statement type
    const metricDefinitions = getMetricDefinitions(activeStatement);
    
    // Transform the data
    return metricDefinitions.map(metric => {
      const values: Record<string, number> = {};
      
      reports.forEach((report: any) => {
        const period = activePeriod === 'annual' 
          ? new Date(report.fiscalDateEnding).getFullYear().toString()
          : formatQuarterlyPeriod(report.fiscalDateEnding);
        
        const value = parseFloat(report[metric.key] || '0');
        values[period] = isNaN(value) ? 0 : value;
      });
      
      return {
        key: metric.key,
        label: metric.label,
        description: metric.description,
        section: metric.section,
        values
      };
    });
  };
  
  // Format quarterly period (e.g., "2023-12-31" -> "2023-Q4")
  const formatQuarterlyPeriod = (fiscalDate: string): string => {
    const date = new Date(fiscalDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year}-Q${quarter}`;
  };
  
  // Get metric definitions for each statement type
  const getMetricDefinitions = (statement: FinancialStatementType): Array<{key: string, label: string, description: string, section: string}> => {
    switch (statement) {
      case 'income':
        return [
          { key: 'totalRevenue', label: 'Total Revenue', description: 'Total revenue from all business operations', section: 'Revenue' },
          { key: 'costOfRevenue', label: 'Cost of Revenue', description: 'Direct costs attributable to production', section: 'Revenue' },
          { key: 'grossProfit', label: 'Gross Profit', description: 'Revenue minus cost of goods sold', section: 'Revenue' },
          { key: 'operatingIncome', label: 'Operating Income', description: 'Income from regular business operations', section: 'Operating' },
          { key: 'operatingExpenses', label: 'Operating Expenses', description: 'Expenses for normal business operations', section: 'Operating' },
          { key: 'researchAndDevelopment', label: 'Research & Development', description: 'Investment in R&D', section: 'Operating' },
          { key: 'netIncome', label: 'Net Income', description: 'Total earnings after all expenses', section: 'Profit & Loss' },
          { key: 'ebitda', label: 'EBITDA', description: 'Earnings before interest, taxes, depreciation', section: 'Profit & Loss' }
        ];
      case 'balance':
        return [
          { key: 'totalAssets', label: 'Total Assets', description: 'Sum of all assets', section: 'Assets' },
          { key: 'totalCurrentAssets', label: 'Current Assets', description: 'Assets convertible to cash within a year', section: 'Assets' },
          { key: 'cashAndCashEquivalentsAtCarryingValue', label: 'Cash & Equivalents', description: 'Highly liquid investments', section: 'Assets' },
          { key: 'totalLiabilities', label: 'Total Liabilities', description: 'Sum of all debts', section: 'Liabilities' },
          { key: 'totalCurrentLiabilities', label: 'Current Liabilities', description: 'Debts due within one year', section: 'Liabilities' },
          { key: 'totalShareholderEquity', label: 'Shareholder Equity', description: 'Net worth belonging to shareholders', section: 'Equity' }
        ];
      case 'cashflow':
        return [
          { key: 'operatingCashflow', label: 'Operating Cash Flow', description: 'Cash from operations', section: 'Operating Activities' },
          { key: 'cashflowFromInvestment', label: 'Investing Cash Flow', description: 'Cash used for investments', section: 'Investing Activities' },
          { key: 'cashflowFromFinancing', label: 'Financing Cash Flow', description: 'Cash from financing activities', section: 'Financing Activities' },
          { key: 'freeCashFlow', label: 'Free Cash Flow', description: 'Operating cash minus capex', section: 'Operating Activities' },
          { key: 'capitalExpenditures', label: 'Capital Expenditures', description: 'Money spent on fixed assets', section: 'Investing Activities' }
        ];
      default:
        return [];
    }
  };
  
  // Get current financial data
  const currentFinancialData = transformFinancialData();
  
  // Get available years/periods
  const availableYears = currentFinancialData.length > 0 
    ? Object.keys(currentFinancialData[0]?.values || {}).sort() 
    : [];

  // Prepare data for chart
  const chartFinancialData = currentFinancialData.reduce((acc: Record<string, Record<string, number>>, metric: FinancialMetric) => {
    acc[metric.key] = metric.values;
    return acc;
  }, {});

  const chartMetricLabels = currentFinancialData.reduce((acc: Record<string, string>, metric: FinancialMetric) => {
    acc[metric.key] = metric.label;
    return acc;
  }, {});

  if (isLoading || financialsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-400">Loading financial data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Statement Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'income', label: 'Income Statement', icon: DollarSign },
            { key: 'balance', label: 'Balance Sheet', icon: BarChart3 },
            { key: 'cashflow', label: 'Cash Flow', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeStatement === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              onClick={() => setActiveStatement(tab.key as FinancialStatementType)}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period and Currency Controls */}
        <div className="flex gap-3">
          {/* Period Dropdown */}
          <div className="relative">
            <select
              value={activePeriod}
              onChange={(e) => setActivePeriod(e.target.value as FinancialPeriodType)}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 appearance-none pr-8 cursor-pointer hover:bg-gray-700 transition"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Currency Dropdown */}
          <div className="relative">
            <select
              value={activeCurrency}
              onChange={(e) => setActiveCurrency(e.target.value as 'USD' | 'EUR' | 'GBP')}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 appearance-none pr-8 cursor-pointer hover:bg-gray-700 transition"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadFinancialData(activeStatement, true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {financialsError && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
          <p className="text-red-200">{financialsError}</p>
        </div>
      )}

      {/* Interactive Chart */}
      <FinancialsChart
        selectedMetrics={selectedMetrics}
        financialData={chartFinancialData}
        metricLabels={chartMetricLabels}
        years={availableYears}
      />

      {/* Interactive Financial Table */}
      <FinancialsTable
        financialData={currentFinancialData}
        selectedRows={selectedMetrics}
        years={availableYears}
        onRowToggle={handleMetricToggle}
      />

      {/* Summary Info */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400">
          <span className="font-medium">Data Period:</span> {activePeriod === 'annual' ? 'Annual' : 'Quarterly'} • 
          <span className="font-medium ml-2">Currency:</span> {activeCurrency} • 
          <span className="font-medium ml-2">Statement:</span> {
            activeStatement === 'income' ? 'Income Statement' :
            activeStatement === 'balance' ? 'Balance Sheet' : 'Cash Flow Statement'
          }
        </div>
      </div>
    </div>
  );
};

export default FinancialsTabNew;