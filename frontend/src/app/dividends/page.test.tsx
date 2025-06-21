import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DividendsPage from './page';
import { supabase } from '@/lib/supabaseClient';

// Mock dependencies
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

global.fetch = jest.fn();

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
};

const mockDividends = [
  {
    id: 1,
    ex_date: '2023-01-15',
    payment_date: '2023-02-15',
    amount_per_share: 0.5,
    total_amount: 50,
    confirmed_received: true,
    holding__ticker: 'AAPL',
    holding__company_name: 'Apple Inc.',
  },
  {
    id: 2,
    ex_date: '2023-01-20',
    payment_date: '2023-02-20',
    amount_per_share: 0.25,
    total_amount: 25,
    confirmed_received: true,
    holding__ticker: 'MSFT',
    holding__company_name: 'Microsoft Corp.',
  },
];

const mockSummary = {
  total_confirmed_dividends: 75,
  total_records: 2,
  confirmed_records: 2,
};

describe('DividendsPage', () => {
  beforeEach(() => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ 
      data: { user: mockUser } 
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        dividends: mockDividends, 
        summary: mockSummary 
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should display loading state initially', () => {
    render(<DividendsPage />);
    expect(screen.getByText('Loading dividends...')).toBeInTheDocument();
  });

  it('should display sign-in message when user is not authenticated', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ 
      data: { user: null } 
    });
    
    render(<DividendsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Please sign in to view your dividend history')).toBeInTheDocument();
    });
  });

  it('should display dividend data after loading', async () => {
    render(<DividendsPage />);
    
    // Wait for the component to load data
    await waitFor(() => {
      expect(screen.getByText('Dividend Tracker')).toBeInTheDocument();
    });

    // Check summary cards are displayed
    await waitFor(() => {
      expect(screen.getByText('$75.00')).toBeInTheDocument();
      expect(screen.getByText('Confirmed Dividends')).toBeInTheDocument();
    });

    // Check that filters section is displayed
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Stock')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    
    render(<DividendsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
}); 