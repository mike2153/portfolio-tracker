'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Search, Filter, ArrowUpDown, ExternalLink } from 'lucide-react';
import CompanyIcon from '@/components/ui/CompanyIcon';
import { formatCurrency, formatPercentage } from '../../../../../shared/utils/formatters';

interface Holding {
  symbol: string;
  company_name?: string;
  quantity: number;
  current_price: number;
  current_value: number;
  avg_cost: number;
  unrealized_gain_loss: number;
  unrealized_gain_loss_percent: number;
  realized_gain_loss?: number;
  total_profit?: number;
  allocation_percent: number;
  dividend_yield?: number;
  daily_change?: number;
  daily_change_percent?: number;
}

interface EnhancedHoldingsTableProps {
  holdings: Holding[];
  isLoading?: boolean;
  onHoldingClick?: (symbol: string) => void;
}

type SortField = 'symbol' | 'current_value' | 'unrealized_gain_loss' | 'allocation_percent' | 'current_price';
type SortDirection = 'asc' | 'desc';

const EnhancedHoldingsTable: React.FC<EnhancedHoldingsTableProps> = ({
  holdings = [],
  isLoading = false,
  onHoldingClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('current_value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort holdings
  const filteredAndSortedHoldings = useMemo(() => {
    const filtered = holdings.filter(holding =>
      holding.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (holding.company_name && holding.company_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Sort holdings
    filtered.sort((a, b) => {
      const aValue = a[sortField] || 0;
      const bValue = b[sortField] || 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [holdings, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortDirection === 'asc' ? 
      <TrendingUp className="w-4 h-4 text-[#10B981]" /> : 
      <TrendingDown className="w-4 h-4 text-[#10B981]" />;
  };

  if (isLoading) {
    return (
      <div className="bg-transparent border border-[#30363D] rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-[#30363D] rounded mb-4"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4 border-b border-[#30363D]/50 last:border-b-0">
              <div className="w-8 h-8 bg-[#30363D] rounded-full"></div>
              <div className="flex-1 grid grid-cols-6 gap-4">
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="h-4 bg-[#30363D] rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent border border-[#30363D] rounded-xl overflow-hidden">
      {/* Header with Search and Filters */}
      <div className="p-6 border-b border-[#30363D]/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold gradient-text-green">Your Holdings</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-micro p-2 bg-transparent border border-[#30363D] rounded-lg hover-bg-transparent border border-[#30363D]"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8B949E]" />
            <input
              type="text"
              placeholder="Search holdings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#30363D]/50 border border-[#30363D] rounded-lg text-white placeholder-[#8B949E] focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981] transition-colors"
            />
          </div>
          <div className="text-sm text-[#8B949E]">
            {filteredAndSortedHoldings.length} of {holdings.length} holdings
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#1E293B]/30">
            <tr>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('symbol')}
                  className="flex items-center gap-2 text-xs font-medium text-[#8B949E] uppercase tracking-wider hover:text-white transition-colors"
                >
                  Holding {getSortIcon('symbol')}
                </button>
              </th>
              <th className="px-6 py-4 text-right">
                <button
                  onClick={() => handleSort('current_price')}
                  className="flex items-center gap-2 text-xs font-medium text-[#8B949E] uppercase tracking-wider hover:text-white transition-colors ml-auto"
                >
                  Current Price {getSortIcon('current_price')}
                </button>
              </th>
              <th className="px-6 py-4 text-right">
                <span className="text-xs font-medium text-[#8B949E] uppercase tracking-wider">
                  Purchase Price
                </span>
              </th>
              <th className="px-6 py-4 text-right">
                <button
                  onClick={() => handleSort('unrealized_gain_loss')}
                  className="flex items-center gap-2 text-xs font-medium text-[#8B949E] uppercase tracking-wider hover:text-white transition-colors ml-auto"
                >
                  Profit/Loss {getSortIcon('unrealized_gain_loss')}
                </button>
              </th>
              <th className="px-6 py-4 text-right">
                <button
                  onClick={() => handleSort('current_value')}
                  className="flex items-center gap-2 text-xs font-medium text-[#8B949E] uppercase tracking-wider hover:text-white transition-colors ml-auto"
                >
                  Value {getSortIcon('current_value')}
                </button>
              </th>
              <th className="px-6 py-4 text-right">
                <button
                  onClick={() => handleSort('allocation_percent')}
                  className="flex items-center gap-2 text-xs font-medium text-[#8B949E] uppercase tracking-wider hover:text-white transition-colors ml-auto"
                >
                  Allocation {getSortIcon('allocation_percent')}
                </button>
              </th>
              <th className="px-6 py-4 text-center">
                <span className="text-xs font-medium text-[#8B949E] uppercase tracking-wider">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30363D]/50">
            {filteredAndSortedHoldings.map((holding, index) => {
              const isPositive = holding.unrealized_gain_loss >= 0;
              const totalProfit = (holding.unrealized_gain_loss || 0) + (holding.realized_gain_loss || 0);
              const costBasis = holding.quantity * holding.avg_cost;
              
              return (
                <tr
                  key={holding.symbol}
                  className="hover:bg-[#30363D]/30 transition-colors duration-200 group animate-slide-in-bottom"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Holding Info */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <CompanyIcon
                        symbol={holding.symbol}
                        size={40}
                        fallback="initials"
                        className="flex-shrink-0"
                      />
                      <div>
                        <div className="font-medium text-white group-hover:text-[#10B981] transition-colors">
                          {holding.symbol}
                        </div>
                        <div className="text-sm text-[#8B949E]">
                          {holding.quantity.toLocaleString()} shares
                        </div>
                        {holding.company_name && (
                          <div className="text-xs text-[#8B949E] truncate max-w-[150px]">
                            {holding.company_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Current Price */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-white">
                      {formatCurrency(holding.current_price)}
                    </div>
                    {holding.daily_change_percent !== undefined && (
                      <div className={`text-sm flex items-center justify-end gap-1 ${
                        holding.daily_change_percent >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}>
                        {holding.daily_change_percent >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatPercentage(Math.abs(holding.daily_change_percent))}
                      </div>
                    )}
                  </td>

                  {/* Purchase Price */}
                  <td className="px-6 py-4 text-right">
                    <div className="text-white">
                      {formatCurrency(holding.avg_cost)}
                    </div>
                    <div className="text-xs text-[#8B949E]">
                      Avg cost
                    </div>
                  </td>

                  {/* Profit/Loss */}
                  <td className="px-6 py-4 text-right">
                    <div className={`font-medium ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {formatCurrency(holding.unrealized_gain_loss)}
                    </div>
                    <div className={`text-sm ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {formatPercentage(holding.unrealized_gain_loss_percent)}
                    </div>
                    {holding.realized_gain_loss !== undefined && (
                      <div className="text-xs text-[#8B949E]">
                        Total: {formatCurrency(totalProfit)}
                      </div>
                    )}
                  </td>

                  {/* Current Value */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-white">
                      {formatCurrency(holding.current_value)}
                    </div>
                    <div className="text-xs text-[#8B949E]">
                      Cost: {formatCurrency(costBasis)}
                    </div>
                  </td>

                  {/* Allocation */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium text-white">
                      {formatPercentage(holding.allocation_percent)}
                    </div>
                    {/* Mini allocation bar */}
                    <div className="mt-1">
                      <div className="w-full bg-[#30363D] rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669]"
                          style={{ width: `${Math.min(holding.allocation_percent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onHoldingClick?.(holding.symbol)}
                      className="btn-micro p-2 bg-transparent border border-[#30363D] rounded-lg hover-bg-transparent border border-[#30363D] opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`View ${holding.symbol} details`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredAndSortedHoldings.length === 0 && !isLoading && (
        <div className="p-12 text-center">
          <div className="text-[#8B949E] mb-2">No holdings found</div>
          {searchQuery && (
            <div className="text-sm text-[#8B949E]">
              Try adjusting your search query
            </div>
          )}
        </div>
      )}

      {/* Footer Summary */}
      {filteredAndSortedHoldings.length > 0 && (
        <div className="p-4 bg-[#1E293B]/20 border-t border-[#30363D]/50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-[#8B949E]">
              Showing {filteredAndSortedHoldings.length} holdings
            </div>
            <div className="flex items-center gap-4">
              <div className="text-[#8B949E]">
                Total Value: <span className="text-white font-medium">
                  {formatCurrency(filteredAndSortedHoldings.reduce((sum, h) => sum + h.current_value, 0))}
                </span>
              </div>
              <div className="text-[#8B949E]">
                Total P&L: <span className={`font-medium ${
                  filteredAndSortedHoldings.reduce((sum, h) => sum + h.unrealized_gain_loss, 0) >= 0 
                    ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}>
                  {formatCurrency(filteredAndSortedHoldings.reduce((sum, h) => sum + h.unrealized_gain_loss, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedHoldingsTable;