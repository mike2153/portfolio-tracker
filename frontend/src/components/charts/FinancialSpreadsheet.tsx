'use client';

import React, { useState } from 'react';
import { RefreshCw, Download, FileText, DollarSign, TrendingUp } from 'lucide-react';

export interface FinancialSpreadsheetProps {
  data: {
    balance?: {
      annual_reports?: any[];
    };
    cashflow?: {
      annual_reports?: any[];
    };
  };
  ticker: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

type SpreadsheetType = 'balance' | 'cashflow';

const FinancialSpreadsheet: React.FC<FinancialSpreadsheetProps> = ({
  data,
  ticker,
  onRefresh,
  isLoading = false
}) => {
  const [selectedType, setSelectedType] = useState<SpreadsheetType>('balance');

  // Format financial numbers with graceful handling
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return '$0';
    
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
      return `${sign}$${absNum.toFixed(0)}`;
    } else {
      return `${sign}$${absNum.toFixed(2)}`;
    }
  };

  // Get the financial data for the selected type
  const getFinancialData = () => {
    const reports = data?.[selectedType]?.annual_reports || [];
    return reports.slice(0, 5); // Get up to 5 years of data
  };

  // Define fields for each statement type
  const getFieldDefinitions = () => {
    if (selectedType === 'balance') {
      return [
        { key: 'totalAssets', label: 'Total Assets', category: 'Assets' },
        { key: 'totalCurrentAssets', label: 'Current Assets', category: 'Assets' },
        { key: 'cashAndCashEquivalentsAtCarryingValue', label: 'Cash & Cash Equivalents', category: 'Assets' },
        { key: 'inventory', label: 'Inventory', category: 'Assets' },
        { key: 'totalNonCurrentAssets', label: 'Non-Current Assets', category: 'Assets' },
        { key: 'propertyPlantEquipment', label: 'Property, Plant & Equipment', category: 'Assets' },
        { key: 'totalLiabilities', label: 'Total Liabilities', category: 'Liabilities' },
        { key: 'totalCurrentLiabilities', label: 'Current Liabilities', category: 'Liabilities' },
        { key: 'currentAccountsPayable', label: 'Accounts Payable', category: 'Liabilities' },
        { key: 'longTermDebt', label: 'Long-Term Debt', category: 'Liabilities' },
        { key: 'totalShareholderEquity', label: 'Total Shareholder Equity', category: 'Equity' },
        { key: 'retainedEarnings', label: 'Retained Earnings', category: 'Equity' },
        { key: 'commonStock', label: 'Common Stock', category: 'Equity' }
      ];
    } else {
      return [
        { key: 'operatingCashflow', label: 'Operating Cash Flow', category: 'Operating Activities' },
        { key: 'netIncomeFromContinuingOps', label: 'Net Income (Continuing Ops)', category: 'Operating Activities' },
        { key: 'depreciationDepletionAndAmortization', label: 'Depreciation & Amortization', category: 'Operating Activities' },
        { key: 'changeInWorkingCapital', label: 'Change in Working Capital', category: 'Operating Activities' },
        { key: 'cashflowFromInvestment', label: 'Cash Flow from Investing', category: 'Investing Activities' },
        { key: 'capitalExpenditures', label: 'Capital Expenditures', category: 'Investing Activities' },
        { key: 'investmentsInPropertyPlantAndEquipment', label: 'Investments in PPE', category: 'Investing Activities' },
        { key: 'cashflowFromFinancing', label: 'Cash Flow from Financing', category: 'Financing Activities' },
        { key: 'dividendsPaid', label: 'Dividends Paid', category: 'Financing Activities' },
        { key: 'proceedsFromRepaymentsOfShortTermDebt', label: 'Short-Term Debt Changes', category: 'Financing Activities' },
        { key: 'changeInCashAndCashEquivalents', label: 'Net Change in Cash', category: 'Net Change' },
        { key: 'cashAndCashEquivalentsAtBeginningOfPeriod', label: 'Cash at Beginning of Period', category: 'Net Change' }
      ];
    }
  };

  const fieldDefinitions = getFieldDefinitions();
  const financialData = getFinancialData();

  // Group fields by category
  const groupedFields = fieldDefinitions.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = [];
    }
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, typeof fieldDefinitions>);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">5-Year Financial Spreadsheet</h4>
          <div className="flex items-center gap-2 text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!financialData || financialData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-white">5-Year Financial Spreadsheet</h4>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Load Data
            </button>
          )}
        </div>
        <div className="text-center text-gray-400 py-8">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No {selectedType === 'balance' ? 'balance sheet' : 'cash flow'} data available</p>
          <p className="text-sm mt-2">Financial statement data may not be available for this symbol</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold text-white mb-2">5-Year Financial Spreadsheet</h4>
          <p className="text-sm text-gray-400">{ticker} • Annual Data • {financialData.length} years available</p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          {/* Statement Type Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setSelectedType('balance')}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                selectedType === 'balance'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Balance Sheet
            </button>
            <button
              onClick={() => setSelectedType('cashflow')}
              className={`flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                selectedType === 'cashflow'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Cash Flow
            </button>
          </div>
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left text-gray-400 font-medium py-3 px-2 min-w-[200px]">
                {selectedType === 'balance' ? 'Balance Sheet Items' : 'Cash Flow Items'}
              </th>
              {financialData.map((report, index) => (
                <th key={index} className="text-right text-gray-400 font-medium py-3 px-2 min-w-[120px]">
                  {report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear() : `Year ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedFields).map(([category, fields]) => (
              <React.Fragment key={category}>
                {/* Category Header */}
                <tr className="border-b border-gray-700">
                  <td colSpan={financialData.length + 1} className="py-3 px-2">
                    <div className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
                      {category}
                    </div>
                  </td>
                </tr>
                
                {/* Fields in Category */}
                {fields.map(field => (
                  <tr key={field.key} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="py-2 px-2 text-gray-300">
                      {field.label}
                    </td>
                    {financialData.map((report, index) => (
                      <td key={index} className="text-right py-2 px-2 text-white font-mono">
                        {formatNumber(report[field.key] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-xs text-gray-400 flex justify-between items-center">
        <span>Data sourced from Alpha Vantage annual reports</span>
        <span>All figures in USD</span>
      </div>
    </div>
  );
};

export default FinancialSpreadsheet;