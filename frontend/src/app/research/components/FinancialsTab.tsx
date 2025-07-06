import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface FinancialsTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const FinancialsTab: React.FC<FinancialsTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Financials</h3>
      <p>Financials data coming soon.</p>
    </div>
  );
};

export default FinancialsTab;
