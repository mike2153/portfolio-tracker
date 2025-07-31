'use client';

import React, { useState, useMemo } from 'react';
import { RefreshCw, DollarSign, TrendingUp } from 'lucide-react';
import _ApexListView from './ApexListView';
import type { ListViewColumn } from './ApexListView';

export interface FinancialSpreadsheetApexProps {
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

interface FinancialRowData {
  id: string;
  label: string;
  category: string;
  [year: string]: any; // Dynamic year columns
}

const FinancialSpreadsheetApex: React.FC<FinancialSpreadsheetApexProps> = ({
  data,
  ticker,
  onRefresh,
  isLoading = false
}) => {
  const [selectedType, setSelectedType] = useState<SpreadsheetType>('balance');

  console.log('[FinancialSpreadsheetApex] Rendering with data:', {
    ticker,
    selectedType,
    balanceReports: data?.balance?.annual_reports?.length || 0,
    cashflowReports: data?.cashflow?.annual_reports?.length || 0,
    isLoading
  });

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

  // Get the financial data for the selected type (reverse order to show newest on right)
  const getFinancialData = () => {
    const reports = data?.[selectedType]?.annual_reports || [];
    return reports.slice(0, 5).reverse(); // Get up to 5 years of data, newest on right
  };

  // Calculate growth rate for a specific metric between two periods
  const calculateGrowthRate = (current: number, previous: number): number => {
    if (!current && current !== 0) return 0;
    if (!previous && previous !== 0) return 0;
    if (isNaN(current) || isNaN(previous)) return 0;
    if (Math.abs(previous) < 1e-6) return 0; // Avoid division by nearly zero
    
    const growthRate = ((current - previous) / Math.abs(previous)) * 100;
    
    // Clamp extreme values to reasonable range
    if (Math.abs(growthRate) > 999) return 0; // Filter out unrealistic growth rates
    if (!isFinite(growthRate)) return 0;
    
    return growthRate;
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

  // Transform data for ApexListView
  const { listViewData, columns, _categoryGroups } = useMemo(() => {
    const fieldDefinitions = getFieldDefinitions();
    const financialData = getFinancialData();
    
    console.log('[FinancialSpreadsheetApex] Processing data:', {
      fieldsCount: fieldDefinitions.length,
      reportsCount: financialData.length,
      sampleReport: financialData[0],
      firstField: fieldDefinitions[0]
    });

    if (financialData.length === 0) {
      return { listViewData: [], columns: [], categoryGroups: [] };
    }

    // Create dynamic columns based on available years
    const yearColumns: ListViewColumn<FinancialRowData>[] = financialData.map((report, index) => ({
      key: `year_${index}` as keyof FinancialRowData,
      label: report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear().toString() : `Year ${index + 1}`,
      sortable: true,
      render: (value) => (
        <span className="text-white">
          {formatNumber(Number(value) || 0)}
        </span>
      ),
      width: '120px'
    }));

    const baseColumns: ListViewColumn<FinancialRowData>[] = [
      {
        key: 'label',
        label: selectedType === 'balance' ? 'Balance Sheet Items' : 'Cash Flow Items',
        sortable: true,
        searchable: true,
        render: (value) => (
          <span className="text-gray-300">{String(value)}</span>
        ),
        width: '250px'
      },
      ...yearColumns
    ];

    // Transform field definitions into row data
    const rowData: FinancialRowData[] = fieldDefinitions.map(field => {
      const row: FinancialRowData = {
        id: field.key,
        label: field.label,
        category: field.category
      };

      // Add year data
      financialData.forEach((report, index) => {
        row[`year_${index}`] = report[field.key] || 0;
      });

      return row;
    });

    // Group fields by category
    const groupedFields = fieldDefinitions.reduce((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category]!.push(field.key);
      return acc;
    }, {} as Record<string, string[]>);

    const categories = Object.entries(groupedFields).map(([category, fields]) => ({
      key: category.toLowerCase().replace(/\s+/g, '_'),
      label: category,
      items: fields as Array<keyof FinancialRowData>
    }));

    console.log('[FinancialSpreadsheetApex] Transformed data:', {
      rowDataLength: rowData.length,
      columnsLength: baseColumns.length,
      categoriesLength: categories.length,
      sampleRow: rowData[0],
      sampleColumn: baseColumns[0]
    });

    return {
      listViewData: rowData,
      columns: baseColumns,
      _categoryGroups: categories
    };
  }, [selectedType, data, getFieldDefinitions, getFinancialData]);

  const emptyMessage = `No ${selectedType === 'balance' ? 'balance sheet' : 'cash flow'} data available`;

  return (
    <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold text-white mb-2">5-Year Financial Spreadsheet</h4>
          <p className="text-sm text-gray-400">
            {ticker} • Annual Data • {getFinancialData().length} years available
          </p>
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

      {/* Financial Data Table */}
      {getFinancialData().length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left text-gray-300 font-semibold py-4 px-4 text-sm">
                  {selectedType === 'balance' ? 'Balance Sheet Items' : 'Cash Flow Items'}
                </th>
                {getFinancialData().map((report, index) => (
                  <th key={index} className="text-right text-gray-300 font-semibold py-4 px-4 min-w-[140px] text-sm">
                    {report.fiscalDateEnding ? new Date(report.fiscalDateEnding).getFullYear() : `Year ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getFieldDefinitions().map(field => {
                const reportData = getFinancialData();
                return (
                  <tr key={field.key} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                    <td className="py-4 px-4 text-gray-200 font-medium text-sm">
                      {field.label}
                    </td>
                    {reportData.map((report, index) => {
                      const currentValue = parseFloat(report[field.key]) || 0;
                      const previousValue = index > 0 ? parseFloat(reportData[index - 1][field.key]) || 0 : 0;
                      const growthRate = index > 0 ? calculateGrowthRate(currentValue, previousValue) : 0;
                      
                      return (
                        <td key={index} className="text-right py-4 px-4">
                          <div className="flex flex-col items-end">
                            <span className="text-white font-semibold text-sm">
                              {formatNumber(currentValue)}
                            </span>
                            {index > 0 && growthRate !== 0 && (
                              <span className={`text-xs font-medium mt-1 ${
                                growthRate > 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center text-gray-400 py-8">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-gray-700 text-xs text-gray-400 flex justify-between items-center">
        <span>Data sourced from Alpha Vantage annual reports</span>
        <span>All figures in USD</span>
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500">
          Debug: {listViewData.length} financial items, {columns.length} columns, Type: {selectedType}
        </div>
      )}
    </div>
  );
};

export default FinancialSpreadsheetApex;