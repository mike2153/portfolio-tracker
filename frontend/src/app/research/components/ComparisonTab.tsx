import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface ComparisonTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
  comparisonStocks: string[];
  onStockAdd: (ticker: string) => void;
  onStockRemove: (ticker: string) => void;
}

const ComparisonTab: React.FC<ComparisonTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Comparison</h3>
      <p>Comparison functionality coming soon.</p>
    </div>
  );
};

export default ComparisonTab;
