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
  const [financialsData, setFinancialsData] = useState<any>(null);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  
  // State for chart/table interaction
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Sample financial data structure for demo (would come from API)
  const generateSampleFinancialData = (): FinancialMetric[] => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i).reverse();
    
    const incomeMetrics: FinancialMetric[] = [
      {
        key: 'total_revenue',
        label: 'Total Revenue',
        description: 'Total revenue from all business operations',
        section: 'Revenue',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 50000000000 + (index * 5000000000) + (Math.random() * 2000000000)
        }), {})
      },
      {
        key: 'cost_of_revenue',
        label: 'Cost of Revenue',
        description: 'Direct costs attributable to production of goods sold',
        section: 'Revenue',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 30000000000 + (index * 3000000000) + (Math.random() * 1000000000)
        }), {})
      },
      {
        key: 'gross_profit',
        label: 'Gross Profit',
        description: 'Revenue minus cost of goods sold',
        section: 'Revenue',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 20000000000 + (index * 2000000000) + (Math.random() * 1000000000)
        }), {})
      },
      {
        key: 'operating_income',
        label: 'Operating Income',
        description: 'Income from regular business operations',
        section: 'Operating',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 15000000000 + (index * 1500000000) + (Math.random() * 500000000)
        }), {})
      },
      {
        key: 'operating_expenses',
        label: 'Operating Expenses',
        description: 'Expenses required for normal business operations',
        section: 'Operating',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 5000000000 + (index * 500000000) + (Math.random() * 200000000)
        }), {})
      },
      {
        key: 'research_development',
        label: 'Research & Development',
        description: 'Investment in research and product development',
        section: 'Operating',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 2000000000 + (index * 200000000) + (Math.random() * 100000000)
        }), {})
      },
      {
        key: 'net_income',
        label: 'Net Income',
        description: 'Total earnings after all expenses and taxes',
        section: 'Profit & Loss',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 12000000000 + (index * 1200000000) + (Math.random() * 400000000)
        }), {})
      },
      {
        key: 'ebitda',
        label: 'EBITDA',
        description: 'Earnings before interest, taxes, depreciation, and amortization',
        section: 'Profit & Loss',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 18000000000 + (index * 1800000000) + (Math.random() * 600000000)
        }), {})
      }
    ];

    const balanceMetrics: FinancialMetric[] = [
      {
        key: 'total_assets',
        label: 'Total Assets',
        description: 'Sum of all assets owned by the company',
        section: 'Assets',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 150000000000 + (index * 15000000000) + (Math.random() * 5000000000)
        }), {})
      },
      {
        key: 'current_assets',
        label: 'Current Assets',
        description: 'Assets expected to be converted to cash within one year',
        section: 'Assets',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 80000000000 + (index * 8000000000) + (Math.random() * 3000000000)
        }), {})
      },
      {
        key: 'cash_equivalents',
        label: 'Cash & Cash Equivalents',
        description: 'Highly liquid investments readily convertible to cash',
        section: 'Assets',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 25000000000 + (index * 2500000000) + (Math.random() * 1000000000)
        }), {})
      },
      {
        key: 'total_liabilities',
        label: 'Total Liabilities',
        description: 'Sum of all debts and obligations',
        section: 'Liabilities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 70000000000 + (index * 7000000000) + (Math.random() * 2000000000)
        }), {})
      },
      {
        key: 'current_liabilities',
        label: 'Current Liabilities',
        description: 'Debts and obligations due within one year',
        section: 'Liabilities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 30000000000 + (index * 3000000000) + (Math.random() * 1000000000)
        }), {})
      },
      {
        key: 'shareholder_equity',
        label: 'Shareholder Equity',
        description: 'Net worth of the company belonging to shareholders',
        section: 'Equity',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 80000000000 + (index * 8000000000) + (Math.random() * 3000000000)
        }), {})
      }
    ];

    const cashflowMetrics: FinancialMetric[] = [
      {
        key: 'operating_cashflow',
        label: 'Operating Cash Flow',
        description: 'Cash generated from normal business operations',
        section: 'Operating Activities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 20000000000 + (index * 2000000000) + (Math.random() * 800000000)
        }), {})
      },
      {
        key: 'investing_cashflow',
        label: 'Investing Cash Flow',
        description: 'Cash used for investments in assets and securities',
        section: 'Investing Activities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: -5000000000 - (index * 500000000) - (Math.random() * 200000000)
        }), {})
      },
      {
        key: 'financing_cashflow',
        label: 'Financing Cash Flow',
        description: 'Cash from financing activities like debt and equity',
        section: 'Financing Activities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: -8000000000 - (index * 800000000) - (Math.random() * 300000000)
        }), {})
      },
      {
        key: 'free_cashflow',
        label: 'Free Cash Flow',
        description: 'Operating cash flow minus capital expenditures',
        section: 'Operating Activities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 15000000000 + (index * 1500000000) + (Math.random() * 600000000)
        }), {})
      },
      {
        key: 'capital_expenditures',
        label: 'Capital Expenditures',
        description: 'Money spent on acquiring or maintaining fixed assets',
        section: 'Investing Activities',
        values: years.reduce((acc, year, index) => ({
          ...acc,
          [year]: 3000000000 + (index * 300000000) + (Math.random() * 100000000)
        }), {})
      }
    ];

    switch (activeStatement) {
      case 'income':
        return incomeMetrics;
      case 'balance':
        return balanceMetrics;
      case 'cashflow':
        return cashflowMetrics;
      default:
        return incomeMetrics;
    }
  };

  // Load financial data (placeholder for real API integration)
  const loadFinancialData = async (statement: FinancialStatementType, forceRefresh: boolean = false) => {
    if (!ticker) return;
    
    setFinancialsLoading(true);
    setFinancialsError(null);
    
    try {
      // For now, using sample data - replace with actual API call
      setTimeout(() => {
        setFinancialsData({
          [statement]: {
            annual: generateSampleFinancialData(),
            quarterly: generateSampleFinancialData() // Would be different for quarterly
          }
        });
        setFinancialsLoading(false);
      }, 1000);
      
      // Uncomment when real API is ready:
      // const result = await front_api_client.front_api_get_company_financials(
      //   ticker,
      //   statement,
      //   forceRefresh
      // );
      // 
      // if (result.success) {
      //   setFinancialsData((prev: any) => ({
      //     ...prev,
      //     [statement]: result.data
      //   }));
      // } else {
      //   setFinancialsError(result.error || `Failed to load ${statement} data`);
      // }
    } catch (error) {
      console.error(`Error loading ${statement} data:`, error);
      setFinancialsError(`Failed to load ${statement} data`);
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
    const currentData = financialsData?.[activeStatement]?.[activePeriod];
    if (currentData && currentData.length > 0) {
      // Auto-select first 3 metrics for better UX
      const firstThreeMetrics = currentData.slice(0, 3).map((metric: FinancialMetric) => metric.key);
      setSelectedMetrics(firstThreeMetrics);
    }
  }, [financialsData, activeStatement, activePeriod]);

  // Handle metric selection toggle
  const handleMetricToggle = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  // Get current financial data
  const currentFinancialData = financialsData?.[activeStatement]?.[activePeriod] || [];
  
  // Get available years
  const availableYears = currentFinancialData.length > 0 
    ? Object.keys(currentFinancialData[0]?.values || {}) 
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