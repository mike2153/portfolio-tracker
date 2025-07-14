import React from 'react';

import InformationCircleIcon from './InformationCircleIcon';
import CheckIcon from './CheckIcon';

interface FinancialMetric {
  key: string;
  label: string;
  description: string;
  values: Record<string, number>;
  section: string;
}

interface FinancialsTableProps {
  financialData: FinancialMetric[];
  selectedRows: string[];
  years: string[];
  onRowToggle: (metricKey: string) => void;
}

/**
 * FinancialsTable Component
 * 
 * Renders an interactive financial metrics table with grouped sections.
 * Supports multi-select rows that add/remove series from the chart.
 * Features hover effects, selection indicators, and tooltips.
 */
const FinancialsTable: React.FC<FinancialsTableProps> = ({
  financialData,
  selectedRows,
  years,
  onRowToggle
}) => {
  // Format financial values for display
  const formatValue = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1e9) {
      return `${sign}${(absValue / 1e9).toFixed(1)}B`;
    } else if (absValue >= 1e6) {
      return `${sign}${(absValue / 1e6).toFixed(1)}M`;
    } else if (absValue >= 1e3) {
      return `${sign}${(absValue / 1e3).toFixed(1)}K`;
    }
    return `${sign}${absValue.toFixed(0)}`;
  };

  // Group financial data by section
  const groupedData = financialData.reduce((groups, metric) => {
    const section = metric.section;
    if (!groups[section]) {
      groups[section] = [];
    }
    groups[section].push(metric);
    return groups;
  }, {} as Record<string, FinancialMetric[]>);

  // Tooltip component for metric descriptions
  const MetricTooltip: React.FC<{ description: string }> = ({ description }) => (
    <div className="group relative inline-block">
      <InformationCircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-300 cursor-help" />
      <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-xs rounded-lg p-2 -top-12 left-1/2 transform -translate-x-1/2 w-48 shadow-lg border border-gray-700">
        {description}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden">
      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead>
            <tr className="bg-gray-700 border-b border-gray-600">
              <th className="text-left py-3 px-4 text-gray-300 font-semibold text-sm">
                Metric
              </th>
              {years.map((year) => (
                <th key={year} className="text-right py-3 px-4 text-gray-300 font-semibold text-sm min-w-20">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          
          {/* Table Body with Grouped Sections */}
          <tbody>
            {Object.entries(groupedData).map(([sectionName, metrics]) => (
              <React.Fragment key={sectionName}>
                {/* Section Header */}
                <tr className="bg-gray-750 border-b border-gray-600">
                  <td 
                    colSpan={years.length + 1} 
                    className="py-3 px-4 text-gray-300 font-bold text-sm bg-gray-700"
                  >
                    {sectionName}
                  </td>
                </tr>
                
                {/* Section Metrics */}
                {metrics.map((metric) => {
                  const isSelected = selectedRows.includes(metric.key);
                  
                  return (
                    <tr
                      key={metric.key}
                      className={`
                        cursor-pointer transition-colors duration-150 border-b border-gray-700/50
                        ${isSelected 
                          ? 'bg-blue-900/40 hover:bg-blue-900/50' 
                          : 'hover:bg-gray-700/50'
                        }
                      `}
                      onClick={() => onRowToggle(metric.key)}
                    >
                      {/* Metric Label with Selection Indicator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          {/* Selection Indicator */}
                          <div className="w-5 mr-3 flex justify-center">
                            {isSelected && (
                              <CheckIcon className="w-4 h-4 text-blue-400" />
                            )}
                          </div>
                          
                          {/* Metric Label */}
                          <span className={`text-sm font-medium ${
                            isSelected ? 'text-blue-300' : 'text-gray-200'
                          }`}>
                            {metric.label}
                          </span>
                          
                          {/* Info Tooltip */}
                          <div className="ml-2">
                            <MetricTooltip description={metric.description} />
                          </div>
                        </div>
                      </td>
                      
                      {/* Metric Values for Each Year */}
                      {years.map((year) => (
                        <td key={year} className="text-right py-3 px-4">
                          <span className={`text-sm font-mono ${
                            isSelected ? 'text-blue-200' : 'text-gray-200'
                          }`}>
                            {formatValue(metric.values[year])}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Selection Summary */}
      {selectedRows.length > 0 && (
        <div className="bg-gray-700 px-4 py-3 border-t border-gray-600">
          <div className="text-sm text-gray-300">
            <span className="font-medium">{selectedRows.length}</span> metric{selectedRows.length !== 1 ? 's' : ''} selected for chart display
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialsTable;