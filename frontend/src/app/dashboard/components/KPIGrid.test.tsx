import React from 'react';
import { render, screen } from '@/lib/test-utils';
import KPIGrid from './KPIGrid';
import { DashboardOverview } from '@/types/api';
import '@testing-library/jest-dom';

const mockOverviewData: DashboardOverview = {
  marketValue: { value: 138214.02, sub_label: "AU$138,477.40 invested", is_positive: true },
  totalProfit: { value: 12257.01, sub_label: "+AU$178.07 daily", deltaPercent: 8.9, is_positive: true },
  irr: { value: 11.48, sub_label: "-0.33% current holdings", is_positive: false },
  passiveIncome: { value: 1.6, sub_label: "AU$2,022.86 annually", delta: 9, is_positive: true },
};

describe('KPIGrid', () => {
  it('renders four KPI cards with correct data', () => {
    render(<KPIGrid initialData={mockOverviewData} />);

    // Check for titles
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Total Return')).toBeInTheDocument();
    expect(screen.getByText('IRR')).toBeInTheDocument();
    expect(screen.getByText('Dividend Yield')).toBeInTheDocument();

    // Check for values
    expect(screen.getByText('AU$138,214.02')).toBeInTheDocument();
    expect(screen.getByText('+AU$12,257.01')).toBeInTheDocument();
    expect(screen.getByText('11.48%')).toBeInTheDocument();
    expect(screen.getByText('1.60%')).toBeInTheDocument();

    // Check for sub-labels
    expect(screen.getByText('AU$138,477.40 invested')).toBeInTheDocument();
    expect(screen.getByText('+AU$178.07 daily')).toBeInTheDocument();
  });

  it('renders skeleton when no initial data is provided', () => {
    render(<KPIGrid />);
    // The skeleton has 4 cards
    expect(screen.getAllByTestId('skeleton-card')).toHaveLength(4);
  });
}); 