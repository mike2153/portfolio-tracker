import React from 'react';

interface ComparisonTabProps {
  isLoading: boolean;
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
