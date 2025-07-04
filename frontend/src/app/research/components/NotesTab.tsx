import React from 'react';
import { StockResearchData } from '@/types/stock-research';

interface NotesTabProps {
  ticker: string;
  data: StockResearchData;
  isLoading: boolean;
  onRefresh: () => void;
}

const NotesTab: React.FC<NotesTabProps> = ({ isLoading }) => {
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-lg font-bold">Notes</h3>
      <p>Notes functionality coming soon.</p>
    </div>
  );
};

export default NotesTab;
