import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface DividendsTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const DividendsTab: React.FC<DividendsTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Dividends</h3>
      <p>Dividends data coming soon.</p>
    </div>
  );
};

export default DividendsTab;
