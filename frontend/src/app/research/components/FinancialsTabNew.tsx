import React, { useState, useEffect, useCallback } from 'react';
import { TabContentProps, FinancialStatementType as _FinancialStatementType, FinancialPeriodType } from '@/types/stock-research';
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
const FinancialsTabNew: React.FC<TabContentProps> = ({ ticker, data: _data, isLoading, onRefresh: _onRefresh }) => {
  // State for tab navigation and controls
  const [activeStatement, setActiveStatement] = useState<'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'>('INCOME_STATEMENT');
  const [activePeriod, setActivePeriod] = useState<FinancialPeriodType>('annual');
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  
  // State for financial data
  const [financialsData, setFinancialsData] = useState<Record<string, any>>({});
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  
  // State for chart/table interaction
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  // Load financial data from API
  const loadFinancialData = useCallback(async (statement: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW', forceRefresh: boolean = false) => {
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
        console.log(`[FinancialsTabNew] Loaded ${statement} data:`, result.data);
        setFinancialsData((prev: any) => ({
          ...prev,
          [statement]: result.data
        }));
      } else {
        console.error(`[FinancialsTabNew] Failed to load ${statement}:`, result);
        setFinancialsError(result.error || `Failed to load ${statement} data`);
      }
    } catch (error) {
      console.error(`Error loading ${statement} data:`, error);
      setFinancialsError(`Failed to load ${statement} data`);
    } finally {
      setFinancialsLoading(false);
    }
  }, [ticker]);

  // Transform API data to component format
  const transformFinancialData = (): FinancialMetric[] => {
    const statementData = financialsData?.[activeStatement];
    console.log(`[FinancialsTabNew] Transforming data for ${activeStatement}:`, statementData);
    
    if (!statementData) return [];
    
    const reports = activePeriod === 'annual' 
      ? statementData.annual_reports || [] 
      : statementData.quarterly_reports || [];
    
    console.log(`[FinancialsTabNew] Reports (${activePeriod}):`, reports);
    
    if (reports.length === 0) return [];
    
    // Get metric definitions based on statement type
    const metricDefinitions = getMetricDefinitions(activeStatement);
    
    // Transform the data
    console.log(`[FinancialsTabNew] Metric definitions:`, metricDefinitions);
    console.log(`[FinancialsTabNew] First report sample:`, reports[0]);
    
    return metricDefinitions.map(metric => {
      const values: Record<string, number> = {};
      
      reports.forEach((report: any) => {
        const period = activePeriod === 'annual' 
          ? new Date(report.fiscalDateEnding).getFullYear().toString()
          : formatQuarterlyPeriod(report.fiscalDateEnding);
        
        let value = 0;
        
        // Calculate free cash flow if needed
        if (metric.key === 'freeCashFlow' && activeStatement === 'CASH_FLOW') {
          const operatingCashflow = parseFloat(report.operatingCashflow || '0');
          const capitalExpenditures = parseFloat(report.capitalExpenditures || '0');
          value = operatingCashflow - Math.abs(capitalExpenditures); // CapEx is usually negative
        } else {
          // Handle "None" values from Alpha Vantage
          const rawValue = report[metric.key];
          value = rawValue === 'None' || rawValue === null || rawValue === undefined 
            ? 0 
            : parseFloat(String(rawValue));
        }
        
        values[period] = isNaN(value) ? 0 : Number(value);
      });
      
      console.log(`[FinancialsTabNew] Metric ${metric.key} values:`, values);
      
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
  const getMetricDefinitions = (statement: 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW'): Array<{key: string, label: string, description: string, section: string}> => {
    switch (statement) {
      case 'INCOME_STATEMENT':
        return [
          // Revenue Section
          { key: 'totalRevenue', label: 'Total Revenue', description: 'Total revenue from all business operations', section: 'Revenue' },
          { key: 'costOfRevenue', label: 'Cost of Revenue', description: 'Direct costs attributable to production', section: 'Revenue' },
          { key: 'costofGoodsAndServicesSold', label: 'Cost of Goods & Services Sold', description: 'Direct costs of producing goods/services', section: 'Revenue' },
          { key: 'grossProfit', label: 'Gross Profit', description: 'Revenue minus cost of goods sold', section: 'Revenue' },
          
          // Operating Section
          { key: 'operatingIncome', label: 'Operating Income', description: 'Income from regular business operations', section: 'Operating' },
          { key: 'operatingExpenses', label: 'Operating Expenses', description: 'Expenses for normal business operations', section: 'Operating' },
          { key: 'sellingGeneralAndAdministrative', label: 'Selling, General & Admin', description: 'SG&A expenses', section: 'Operating' },
          { key: 'researchAndDevelopment', label: 'Research & Development', description: 'Investment in R&D', section: 'Operating' },
          { key: 'depreciationAndAmortization', label: 'Depreciation & Amortization', description: 'Non-cash expenses', section: 'Operating' },
          
          // Interest & Tax Section
          { key: 'interestIncome', label: 'Interest Income', description: 'Income from interest-bearing investments', section: 'Interest & Tax' },
          { key: 'interestExpense', label: 'Interest Expense', description: 'Cost of borrowed funds', section: 'Interest & Tax' },
          { key: 'netInterestIncome', label: 'Net Interest Income', description: 'Interest income minus interest expense', section: 'Interest & Tax' },
          { key: 'incomeBeforeTax', label: 'Income Before Tax', description: 'Earnings before income taxes', section: 'Interest & Tax' },
          { key: 'incomeTaxExpense', label: 'Income Tax Expense', description: 'Taxes on earnings', section: 'Interest & Tax' },
          
          // Profit & Loss Section
          { key: 'netIncome', label: 'Net Income', description: 'Total earnings after all expenses', section: 'Profit & Loss' },
          { key: 'netIncomeFromContinuingOperations', label: 'Net Income from Continuing Ops', description: 'Income from ongoing operations', section: 'Profit & Loss' },
          { key: 'ebit', label: 'EBIT', description: 'Earnings before interest and taxes', section: 'Profit & Loss' },
          { key: 'ebitda', label: 'EBITDA', description: 'Earnings before interest, taxes, depreciation, and amortization', section: 'Profit & Loss' }
        ];
      case 'BALANCE_SHEET':
        return [
          // Assets Section
          { key: 'totalAssets', label: 'Total Assets', description: 'Sum of all assets', section: 'Assets' },
          { key: 'totalCurrentAssets', label: 'Current Assets', description: 'Assets convertible to cash within a year', section: 'Assets' },
          { key: 'cashAndCashEquivalentsAtCarryingValue', label: 'Cash & Equivalents', description: 'Highly liquid investments', section: 'Assets' },
          { key: 'cashAndShortTermInvestments', label: 'Cash & Short Term Investments', description: 'Cash plus short-term marketable securities', section: 'Assets' },
          { key: 'inventory', label: 'Inventory', description: 'Goods available for sale', section: 'Assets' },
          { key: 'currentNetReceivables', label: 'Net Receivables', description: 'Money owed by customers', section: 'Assets' },
          { key: 'totalNonCurrentAssets', label: 'Non-Current Assets', description: 'Long-term assets', section: 'Assets' },
          { key: 'propertyPlantEquipment', label: 'Property, Plant & Equipment', description: 'Physical assets (net of depreciation)', section: 'Assets' },
          { key: 'goodwill', label: 'Goodwill', description: 'Premium paid for acquisitions', section: 'Assets' },
          { key: 'intangibleAssets', label: 'Intangible Assets', description: 'Non-physical assets', section: 'Assets' },
          { key: 'intangibleAssetsExcludingGoodwill', label: 'Intangible Assets (ex. Goodwill)', description: 'Patents, trademarks, etc.', section: 'Assets' },
          { key: 'longTermInvestments', label: 'Long Term Investments', description: 'Investments held for over a year', section: 'Assets' },
          
          // Liabilities Section
          { key: 'totalLiabilities', label: 'Total Liabilities', description: 'Sum of all debts', section: 'Liabilities' },
          { key: 'totalCurrentLiabilities', label: 'Current Liabilities', description: 'Debts due within one year', section: 'Liabilities' },
          { key: 'currentAccountsPayable', label: 'Accounts Payable', description: 'Money owed to suppliers', section: 'Liabilities' },
          { key: 'currentDebt', label: 'Current Debt', description: 'Short-term borrowings', section: 'Liabilities' },
          { key: 'shortTermDebt', label: 'Short Term Debt', description: 'Debt due within one year', section: 'Liabilities' },
          { key: 'totalNonCurrentLiabilities', label: 'Non-Current Liabilities', description: 'Long-term obligations', section: 'Liabilities' },
          { key: 'longTermDebt', label: 'Long Term Debt', description: 'Debt due after one year', section: 'Liabilities' },
          { key: 'longTermDebtNoncurrent', label: 'Long Term Debt (Non-current)', description: 'Non-current portion of long-term debt', section: 'Liabilities' },
          
          // Equity Section
          { key: 'totalShareholderEquity', label: 'Total Shareholder Equity', description: 'Net worth belonging to shareholders', section: 'Equity' },
          { key: 'retainedEarnings', label: 'Retained Earnings', description: 'Accumulated profits not distributed', section: 'Equity' },
          { key: 'commonStock', label: 'Common Stock', description: 'Par value of common shares', section: 'Equity' },
          { key: 'commonStockSharesOutstanding', label: 'Shares Outstanding', description: 'Number of shares held by investors', section: 'Equity' },
          { key: 'treasuryStock', label: 'Treasury Stock', description: 'Company\'s own repurchased shares', section: 'Equity' }
        ];
      case 'CASH_FLOW':
        return [
          // Operating Activities Section
          { key: 'operatingCashflow', label: 'Operating Cash Flow', description: 'Cash generated from operations', section: 'Operating Activities' },
          { key: 'depreciationDepletionAndAmortization', label: 'Depreciation & Amortization', description: 'Non-cash charges', section: 'Operating Activities' },
          { key: 'changeInReceivables', label: 'Change in Receivables', description: 'Change in money owed by customers', section: 'Operating Activities' },
          { key: 'changeInInventory', label: 'Change in Inventory', description: 'Change in goods held for sale', section: 'Operating Activities' },
          { key: 'profitLoss', label: 'Profit/Loss', description: 'Net earnings', section: 'Operating Activities' },
          { key: 'freeCashFlow', label: 'Free Cash Flow', description: 'Operating cash minus capital expenditures', section: 'Operating Activities' },
          
          // Investing Activities Section
          { key: 'cashflowFromInvestment', label: 'Cash Flow from Investment', description: 'Net cash used in investing activities', section: 'Investing Activities' },
          { key: 'capitalExpenditures', label: 'Capital Expenditures', description: 'Money spent on property, plant, and equipment', section: 'Investing Activities' },
          
          // Financing Activities Section
          { key: 'cashflowFromFinancing', label: 'Cash Flow from Financing', description: 'Net cash from financing activities', section: 'Financing Activities' },
          { key: 'dividendPayout', label: 'Total Dividend Payout', description: 'Total dividends paid to shareholders', section: 'Financing Activities' },
          { key: 'dividendPayoutCommonStock', label: 'Common Stock Dividends', description: 'Dividends paid on common shares', section: 'Financing Activities' },
          { key: 'dividendPayoutPreferredStock', label: 'Preferred Stock Dividends', description: 'Dividends paid on preferred shares', section: 'Financing Activities' },
          { key: 'proceedsFromIssuanceOfCommonStock', label: 'Proceeds from Common Stock', description: 'Cash from issuing new common shares', section: 'Financing Activities' },
          { key: 'proceedsFromIssuanceOfPreferredStock', label: 'Proceeds from Preferred Stock', description: 'Cash from issuing new preferred shares', section: 'Financing Activities' },
          { key: 'proceedsFromRepurchaseOfEquity', label: 'Stock Repurchase', description: 'Cash used to buy back shares', section: 'Financing Activities' },
          { key: 'proceedsFromIssuanceOfLongTermDebtAndCapitalSecuritiesNet', label: 'Debt Issuance', description: 'Net proceeds from issuing debt', section: 'Financing Activities' },
          
          // Summary Section
          { key: 'changeInCashAndCashEquivalents', label: 'Change in Cash', description: 'Net change in cash position', section: 'Summary' },
          { key: 'netIncome', label: 'Net Income', description: 'Total earnings', section: 'Summary' }
        ];
      default:
        return [];
    }
  };

  // Load all financial statements when ticker changes
  useEffect(() => {
    if (ticker) {
      // Load all three statements
      loadFinancialData('INCOME_STATEMENT');
      loadFinancialData('BALANCE_SHEET');
      loadFinancialData('CASH_FLOW');
    }
  }, [ticker]);

  // Handle metric selection toggle
  const handleMetricToggle = (metricKey: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    );
  };
  
  // Get current financial data
  const currentFinancialData = transformFinancialData();

  // Auto-select default metrics when statement changes
  useEffect(() => {
    // Define default metrics for each statement type
    const defaultMetrics: Record<string, string[]> = {
      'INCOME_STATEMENT': ['netIncome', 'totalRevenue', 'grossProfit'],
      'BALANCE_SHEET': ['totalAssets', 'totalLiabilities', 'totalShareholderEquity'],
      'CASH_FLOW': ['netIncome', 'operatingCashflow', 'freeCashFlow']
    };
    
    // Set default metrics for the current statement
    const defaults = defaultMetrics[activeStatement] || [];
    setSelectedMetrics(defaults);
    
    console.log(`[FinancialsTabNew] Setting default metrics for ${activeStatement}:`, defaults);
  }, [activeStatement]);
  
  // Get available years/periods
  const availableYears = currentFinancialData.length > 0 
    ? Object.keys(currentFinancialData[0]?.values || {}).sort() 
    : [];

  // Prepare data for chart
  const chartFinancialData = currentFinancialData.reduce((acc: Record<string, Record<string, string | number>>, metric: FinancialMetric) => {
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
            { key: 'INCOME_STATEMENT', label: 'Income Statement', icon: DollarSign },
            { key: 'BALANCE_SHEET', label: 'Balance Sheet', icon: BarChart3 },
            { key: 'CASH_FLOW', label: 'Cash Flow', icon: TrendingUp }
          ].map(tab => (
            <button
              key={tab.key}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeStatement === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              onClick={() => setActiveStatement(tab.key as 'INCOME_STATEMENT' | 'BALANCE_SHEET' | 'CASH_FLOW')}
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
        key={`${activeStatement}-${activePeriod}`}
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
            activeStatement === 'INCOME_STATEMENT' ? 'Income Statement' :
            activeStatement === 'BALANCE_SHEET' ? 'Balance Sheet' : 'Cash Flow Statement'
          }
        </div>
      </div>
    </div>
  );
};

export default FinancialsTabNew;