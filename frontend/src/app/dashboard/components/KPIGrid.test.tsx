import React from 'react';
import { render, screen } from '@/lib/test-utils';
import KPIGrid from './KPIGrid';
import { DashboardAPIResponse } from '@/types/dashboard';
import '@testing-library/jest-dom';

const mockOverviewData: DashboardAPIResponse = {
  success: true,
  portfolio: {
    total_value: 138214.02,
    total_cost: 138477.40,
    total_gain_loss: 12257.01,
    total_gain_loss_percent: 8.9,
    cash_balance: 5000.00,
  },
  metadata: {
    timestamp: '2024-01-16T10:00:00.000Z',
    version: '1.0',
  },
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