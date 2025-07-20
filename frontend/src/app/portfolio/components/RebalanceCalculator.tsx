'use client';

import React, { useState, useMemo } from 'react';
import { usePortfolioAllocation } from '@/hooks/usePortfolioAllocation';
import { RefreshCw, Info, Download } from 'lucide-react';

interface RebalanceItem {
  symbol: string;
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;
  targetValue: number;
  difference: number;
  shares: number;
  currentPrice: number;
  action: 'BUY' | 'SELL' | 'HOLD';
}

export default function RebalanceCalculator() {
  const { data, isLoading } = usePortfolioAllocation();
  const [targetAllocations, setTargetAllocations] = useState<Record<string, number>>({});
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  // Initialize target allocations from current allocations
  React.useEffect(() => {
    if (data?.allocations) {
      const initialTargets: Record<string, number> = {};
      data.allocations.forEach(item => {
        initialTargets[item.symbol] = parseFloat(item.allocation_percent.toFixed(2));
      });
      setTargetAllocations(initialTargets);
    }
  }, [data]);

  // Calculate rebalancing requirements
  const rebalanceData = useMemo(() => {
    if (!data) return [];

    const totalValue = data.summary.total_value;
    const items: RebalanceItem[] = [];

    data.allocations.forEach(allocation => {
      const targetPercent = targetAllocations[allocation.symbol] || 0;
      const targetValue = (targetPercent / 100) * totalValue;
      const difference = targetValue - allocation.current_value;
      const shares = Math.abs(difference) / allocation.current_price;
      
      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      if (difference > allocation.current_price) action = 'BUY';
      else if (difference < -allocation.current_price) action = 'SELL';

      items.push({
        symbol: allocation.symbol,
        currentValue: allocation.current_value,
        currentAllocation: allocation.allocation_percent,
        targetAllocation: targetPercent,
        targetValue,
        difference,
        shares: Math.floor(shares),
        currentPrice: allocation.current_price,
        action
      });
    });

    return items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [data, targetAllocations]);

  // Calculate total allocation percentage
  const totalAllocation = useMemo(() => {
    return Object.values(targetAllocations).reduce((sum, val) => sum + val, 0);
  }, [targetAllocations]);

  // Handle allocation change
  const handleAllocationChange = (symbol: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setTargetAllocations(prev => ({
      ...prev,
      [symbol]: Math.min(100, Math.max(0, numValue))
    }));
  };

  // Adjust to 100%
  const adjustTo100Percent = () => {
    const currentTotal = totalAllocation;
    if (currentTotal === 0) return;

    const adjustedAllocations: Record<string, number> = {};
    const factor = 100 / currentTotal;

    Object.entries(targetAllocations).forEach(([symbol, allocation]) => {
      adjustedAllocations[symbol] = parseFloat((allocation * factor).toFixed(2));
    });

    // Handle rounding errors by adjusting the largest position
    const adjustedTotal = Object.values(adjustedAllocations).reduce((sum, val) => sum + val, 0);
    if (adjustedTotal !== 100) {
      const largestSymbol = Object.entries(adjustedAllocations)
        .sort((a, b) => b[1] - a[1])[0][0];
      adjustedAllocations[largestSymbol] += (100 - adjustedTotal);
    }

    setTargetAllocations(adjustedAllocations);
  };

  // Export rebalancing plan
  const exportPlan = () => {
    if (!data) return;

    // Create comprehensive rebalancing plan with all requested columns
    const plan = rebalanceData.map(item => {
      // Find the original allocation data to get company name
      const allocation = data.allocations.find(a => a.symbol === item.symbol);
      
      return {
        'Symbol': item.symbol,
        'Company Name': allocation?.company_name || item.symbol,
        'Current Holdings ($)': item.currentValue.toFixed(2),
        'Current %': item.currentAllocation.toFixed(2),
        'Target %': item.targetAllocation.toFixed(2),
        'Target Value ($)': item.targetValue.toFixed(2),
        'Difference ($)': item.difference.toFixed(2),
        'Action': item.action === 'HOLD' ? '-' : item.action
      };
    });

    // Sort by absolute difference amount (largest first)
    plan.sort((a, b) => Math.abs(parseFloat(b['Difference ($)'])) - Math.abs(parseFloat(a['Difference ($)'])));

    // Generate CSV content with proper escaping
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = Object.keys(plan[0] || {});
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...plan.map(row => 
        headers.map(header => escapeCSV(String(row[header as keyof typeof row]))).join(',')
      )
    ].join('\n');

    // Add summary information at the bottom
    const totalBuy = rebalanceData.filter(item => item.action === 'BUY').reduce((sum, item) => sum + item.difference, 0);
    const totalSell = Math.abs(rebalanceData.filter(item => item.action === 'SELL').reduce((sum, item) => sum + item.difference, 0));
    
    const summaryContent = `\n\nSummary\nTotal Buy Amount,$${totalBuy.toFixed(2)}\nTotal Sell Amount,$${totalSell.toFixed(2)}\nGenerated,${new Date().toLocaleString()}`;
    
    const fullCSV = csvContent + summaryContent;

    // Create and download the file
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-rebalance-${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl bg-gray-800/50 p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredData = showOnlyChanges 
    ? rebalanceData.filter(item => item.action !== 'HOLD')
    : rebalanceData;

  return (
    <div className="mb-6">
      <div className="rounded-xl bg-gray-800/50 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Portfolio Rebalancer</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={adjustTo100Percent}
              disabled={totalAllocation === 100}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Adjust to 100%
            </button>
            <button
              onClick={exportPlan}
              disabled={rebalanceData.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export Plan
            </button>
          </div>
        </div>

        {/* Total allocation indicator */}
        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Total Allocation</span>
            <span className={`font-semibold ${
              totalAllocation === 100 ? 'text-green-400' : 
              totalAllocation > 100 ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {totalAllocation.toFixed(2)}%
            </span>
          </div>
          {totalAllocation !== 100 && (
            <p className="text-sm text-gray-400 mt-1">
              {totalAllocation > 100 ? 'Over-allocated' : 'Under-allocated'} by {Math.abs(100 - totalAllocation).toFixed(2)}%
            </p>
          )}
        </div>

        {/* Show only changes toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyChanges}
              onChange={(e) => setShowOnlyChanges(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm">Show only positions requiring action</span>
          </label>
        </div>

        {/* Rebalancing table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Symbol</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Current %</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Target %</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Action</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Shares</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr key={item.symbol} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <span className="font-medium text-white">{item.symbol}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">
                    {item.currentAllocation.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right">
                    <input
                      type="number"
                      value={item.targetAllocation}
                      onChange={(e) => handleAllocationChange(item.symbol, e.target.value)}
                      className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-right text-sm focus:border-blue-500 focus:outline-none"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.action === 'BUY' && (
                      <span className="text-green-400 font-medium">BUY</span>
                    )}
                    {item.action === 'SELL' && (
                      <span className="text-red-400 font-medium">SELL</span>
                    )}
                    {item.action === 'HOLD' && (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">
                    {item.action !== 'HOLD' ? item.shares.toLocaleString() : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {item.action !== 'HOLD' ? (
                      <span className={item.action === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                        ${Math.abs(item.difference).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 bg-gray-700/50 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium mb-1">Rebalancing Summary</p>
              <p>
                Total Buy: ${rebalanceData.filter(item => item.action === 'BUY').reduce((sum, item) => sum + item.difference, 0).toLocaleString()}
              </p>
              <p>
                Total Sell: ${Math.abs(rebalanceData.filter(item => item.action === 'SELL').reduce((sum, item) => sum + item.difference, 0)).toLocaleString()}
              </p>
              <p className="mt-2 text-gray-400">
                Note: This calculator provides estimates based on current prices. Always review orders before execution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}