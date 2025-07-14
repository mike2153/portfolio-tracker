import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface NewsTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const NewsTab: React.FC<NewsTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">News</h3>
      <p>News data coming soon.</p>
    </div>
  );
};

export default NewsTab;
