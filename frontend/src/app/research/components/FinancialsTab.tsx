'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import FinancialChart from '@/components/charts/FinancialChart';
import { front_api_client } from '@/lib/front_api_client';
import type { 
  TabContentProps, 
  FinancialStatementType, 
  FinancialPeriodType, 
  FinancialsData,
  FinancialStatement 
} from '@/types/stock-research';

const STATEMENT_TYPES: { value: FinancialStatementType; label: string }[] = [
  { value: 'income', label: 'Income Statement' },
  { value: 'balance', label: 'Balance Sheet' },
  { value: 'cashflow', label: 'Cash Flow' },
];

const PERIOD_TYPES: { value: FinancialPeriodType; label: string }[] = [
  { value: 'annual', label: 'Annual' },
  { value: 'quarterly', label: 'Quarterly' },
];

// Define financial statement categories for better organization
const STATEMENT_CATEGORIES = {
  income: {
    'Revenue': ['totalRevenue', 'grossProfit'],
    'Operating': ['totalOperatingExpense', 'operatingIncome'],
    'Net Income': ['netIncome', 'netIncomeFromContinuingOps'],
    'Per Share': ['reportedEPS', 'dilutedEPS']
  },
  balance: {
    'Assets': ['totalAssets', 'totalCurrentAssets', 'cashAndCashEquivalentsAtCarryingValue'],
    'Liabilities': ['totalLiabilities', 'totalCurrentLiabilities', 'currentDebt'],
    'Equity': ['totalShareholderEquity', 'retainedEarnings', 'commonStock'],
  },
  cashflow: {
    'Operating': ['operatingCashflow', 'netIncome'],
    'Investing': ['cashflowFromInvestment', 'capitalExpenditures'],
    'Financing': ['cashflowFromFinancing', 'dividendPayout', 'proceedsFromIssuanceOfCommonStock'],
  }
};

export default function FinancialsTab({ ticker, data, isLoading, onRefresh }: TabContentProps) {
  const [selectedStatement, setSelectedStatement] = useState<FinancialStatementType>('income');
  const [selectedPeriod, setSelectedPeriod] = useState<FinancialPeriodType>('annual');
  const [financialData, setFinancialData] = useState<Record<FinancialStatementType, FinancialsData | null>>({
    income: null,
    balance: null,
    cashflow: null
  });
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string>('totalRevenue');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Load financial data
  useEffect(() => {
    loadFinancialData(selectedStatement);
  }, [selectedStatement, ticker]);

  const loadFinancialData = async (statementType: FinancialStatementType) => {
    if (financialData[statementType]) return; // Already loaded
    
    setLoadingStatement(true);
    try {
      const response = await stockResearchAPI.getFinancials(ticker, statementType);
      if (response.ok && response.data) {
        setFinancialData(prev => ({
          ...prev,
          [statementType]: response.data
        }));
      } else {
        console.error('Failed to load financial data:', response.error);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoadingStatement(false);
    }
  };

  const handleStatementChange = (statementType: FinancialStatementType) => {
    setSelectedStatement(statementType);
    // Set default metric based on statement type
    if (statementType === 'income') {
      setSelectedMetric('totalRevenue');
    } else if (statementType === 'balance') {
      setSelectedMetric('totalAssets');
    } else if (statementType === 'cashflow') {
      setSelectedMetric('operatingCashflow');
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === 'None' || value === '') {
      return 'N/A';
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return 'N/A';
    
    // Format large numbers
    if (Math.abs(numValue) >= 1e12) {
      return `$${(numValue / 1e12).toFixed(2)}T`;
    }
    if (Math.abs(numValue) >= 1e9) {
      return `$${(numValue / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(numValue) >= 1e6) {
      return `$${(numValue / 1e6).toFixed(2)}M`;
    }
    if (Math.abs(numValue) >= 1e3) {
      return `$${(numValue / 1e3).toFixed(2)}K`;
    }
    
    return `$${numValue.toFixed(0)}`;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const renderFinancialTable = () => {
    const currentData = financialData[selectedStatement];
    if (!currentData) return null;

    const statements = selectedPeriod === 'annual' ? currentData.annual : currentData.quarterly;
    if (!statements || statements.length === 0) {
      return (
        <div className="text-center py-8 text-gray-400">
          No {selectedPeriod} data available for {STATEMENT_TYPES.find(s => s.value === selectedStatement)?.label}
        </div>
      );
    }

    const categories = STATEMENT_CATEGORIES[selectedStatement] || {};
    const periods = statements.slice(0, 8); // Show last 8 periods

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left py-3 px-4 font-medium text-gray-300 sticky left-0 bg-gray-800 min-w-[200px]">
                Financial Metric
              </th>
              {periods.map((statement, index) => (
                <th key={index} className="text-right py-3 px-4 font-medium text-gray-300 min-w-[120px]">
                  {statement.fiscalDateEnding?.slice(0, 7) || `Period ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(categories).map(([categoryName, metrics]) => (
              <React.Fragment key={categoryName}>
                {/* Category Header */}
                <tr className="bg-gray-750 border-b border-gray-600">
                  <td 
                    className="py-2 px-4 font-medium text-white cursor-pointer hover:bg-gray-700 sticky left-0 bg-gray-750"
                    onClick={() => toggleCategory(categoryName)}
                  >
                    <div className="flex items-center gap-2">
                      {expandedCategories[categoryName] ? 
                        <ChevronDown size={16} /> : 
                        <ChevronRight size={16} />
                      }
                      {categoryName}
                    </div>
                  </td>
                  <td colSpan={periods.length} className="py-2 px-4"></td>
                </tr>
                
                {/* Category Metrics */}
                {expandedCategories[categoryName] && metrics.map(metric => (
                  <tr 
                    key={metric}
                    className={`border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors ${
                      selectedMetric === metric ? 'bg-blue-900/30' : ''
                    }`}
                    onClick={() => setSelectedMetric(metric)}
                  >
                    <td className="py-2 px-4 text-gray-300 sticky left-0 bg-gray-800 hover:bg-gray-700">
                      <div className="flex items-center gap-2">
                        {selectedMetric === metric && <BarChart3 size={14} className="text-blue-400" />}
                        {metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </div>
                    </td>
                    {periods.map((statement, index) => (
                      <td key={index} className="py-2 px-4 text-right text-white font-mono">
                        {formatValue(statement[metric])}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Initialize expanded categories
  useEffect(() => {
    const categories = STATEMENT_CATEGORIES[selectedStatement] || {};
    const initialExpanded: Record<string, boolean> = {};
    Object.keys(categories).forEach(category => {
      initialExpanded[category] = true; // Expand all by default
    });
    setExpandedCategories(initialExpanded);
  }, [selectedStatement]);

  const currentData = financialData[selectedStatement];
  const statements = currentData ? (selectedPeriod === 'annual' ? currentData.annual : currentData.quarterly) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Financial Statements</h2>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Statement Type Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Statement Type
          </label>
          <div className="flex rounded-lg bg-gray-700 p-1">
            {STATEMENT_TYPES.map(type => (
              <button
                key={type.value}
                onClick={() => handleStatementChange(type.value)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedStatement === type.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Period
          </label>
          <div className="flex rounded-lg bg-gray-700 p-1">
            {PERIOD_TYPES.map(period => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {statements.length > 0 && (
        <FinancialChart
          data={statements}
          metric={selectedMetric}
          title={selectedMetric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          ticker={ticker}
          height={300}
        />
      )}

      {/* Financial Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {loadingStatement || isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Loading financial data...
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {STATEMENT_TYPES.find(s => s.value === selectedStatement)?.label} - {selectedPeriod}
              </h3>
              <span className="text-sm text-gray-400">
                Click rows to update chart
              </span>
            </div>
            {renderFinancialTable()}
          </div>
        )}
      </div>

      {/* Data Attribution */}
      <div className="text-center text-xs text-gray-500">
        Financial data provided by Alpha Vantage • Data may be delayed or restated
      </div>
    </div>
  );
}