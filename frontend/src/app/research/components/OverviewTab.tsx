import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface OverviewTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!data || !data.overview) {
    return <div>No overview data available.</div>;
  }

  const { name, description, exchange, currency, country, sector, industry } = data.overview;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{name}</h3>
      <p className="text-sm text-gray-400">{description}</p>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="font-semibold">Exchange:</span> {exchange}</div>
        <div><span className="font-semibold">Currency:</span> {currency}</div>
        <div><span className="font-semibold">Country:</span> {country}</div>
        <div><span className="font-semibold">Sector:</span> {sector}</div>
        <div><span className="font-semibold">Industry:</span> {industry}</div>
      </div>
    </div>
  );
};

export default OverviewTab;
