import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mocks need to be declared before component imports
jest.mock('@/lib/api', () => ({
  transactionAPI: {
    getUserTransactions: jest.fn(),
    getTransactionSummary: jest.fn(),
    createTransaction: jest.fn(),
    updateCurrentPrices: jest.fn(),
  },
  apiService: {
    getHistoricalData: jest.fn(),
    searchSymbols: jest.fn(),
  },
}));

jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ addToast: jest.fn(), removeToast: jest.fn() }),
}));

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
    },
  },
}));

import TransactionsPage from './page';
import { transactionAPI, apiService } from '@/lib/api';

const mockTransactions = [
  { id: 1, transaction_type: 'BUY', ticker: 'AAPL', company_name: 'Apple Inc.', shares: 10, price_per_share: 150, transaction_date: '2023-01-15', total_amount: 1500, transaction_currency: 'USD', commission: 0, notes: '', created_at: '' },
  { id: 2, transaction_type: 'SELL', ticker: 'GOOG', company_name: 'Alphabet Inc.', shares: 5, price_per_share: 2800, transaction_date: '2023-01-20', total_amount: 14000, transaction_currency: 'USD', commission: 0, notes: '', created_at: '' },
];

const mockSummary = {
  total_transactions: 2,
  buy_transactions: 1,
  sell_transactions: 1,
  dividend_transactions: 0,
  unique_tickers: 2,
  total_invested: 1500,
  total_received: 14000,
  total_dividends: 0,
  net_invested: -12500,
};

describe('TransactionsPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (transactionAPI.getUserTransactions as jest.Mock).mockResolvedValue({ ok: true, data: { transactions: mockTransactions } });
    (transactionAPI.getTransactionSummary as jest.Mock).mockResolvedValue({ ok: true, data: { summary: mockSummary } });
    (transactionAPI.createTransaction as jest.Mock).mockResolvedValue({ ok: true, data: {} });
    (transactionAPI.updateCurrentPrices as jest.Mock).mockResolvedValue({ ok: true, data: {} });
    (apiService.getHistoricalData as jest.Mock).mockResolvedValue({ ok: true, data: { data: [] } });
    (apiService.searchSymbols as jest.Mock).mockResolvedValue({ ok: true, data: { results: [] } });
  });

  test('renders the main header and summary cards', async () => {
    render(<TransactionsPage />);
    
    // Check for header
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    
    // Wait for summary data to be loaded and check for cards
    await waitFor(() => {
      expect(screen.getByText('Total Invested')).toBeInTheDocument();
      expect(screen.getAllByText('$1,500.00').length).toBeGreaterThan(0);
      expect(screen.getByText('Total Transactions')).toBeInTheDocument();
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  test('fetches and displays a list of transactions', async () => {
    render(<TransactionsPage />);
    
    // Wait for transactions to be loaded and check for table rows
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOG')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    });
  });

  test('filters transactions when using the search bar', async () => {
    render(<TransactionsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by ticker or company name...');
    fireEvent.change(searchInput, { target: { value: 'GOOG' } });

    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByText('GOOG')).toBeInTheDocument();
  });

  test.skip('opens and submits the "Add Transaction" form', async () => {
    render(<TransactionsPage />);
    
    // Open the form
    fireEvent.click(screen.getByText('Add Transaction'));
    expect(screen.getByText('Ticker Symbol')).toBeInTheDocument();

    // Fill out the form
    fireEvent.change(screen.getByPlaceholderText('e.g., AAPL'), { target: { value: 'MSFT' } });
    const sharesInput = document.querySelector("input[name='shares']") as HTMLInputElement;
    fireEvent.change(sharesInput, { target: { value: '20' } });
    const priceInput = document.querySelector("input[name='purchase_price']") as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '300' } });

    // Submit the form
    fireEvent.click(screen.getByText('Add Transaction', { selector: 'button[type="submit"]' }));

    await waitFor(() => {
      expect(screen.queryByText('Ticker Symbol')).not.toBeInTheDocument();
    });
  });

  test('fetchClosingPriceForDate uses 1Y period for recent dates', async () => {
    const recent = new Date();
    recent.setMonth(recent.getMonth() - 2);
    const dateStr = recent.toISOString().split('T')[0];
    (apiService.getHistoricalData as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: [{ date: dateStr, close: 100 }] }
    });

    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('Add Transaction'));
    fireEvent.change(screen.getByPlaceholderText('e.g., AAPL'), { target: { value: 'AAPL' } });
    const dateInput = document.querySelector("input[name='purchase_date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: dateStr } });
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(apiService.getHistoricalData).toHaveBeenCalledWith('AAPL', '1Y');
    });
  });

  test('fetchClosingPriceForDate uses 5Y period for midrange dates', async () => {
    const mid = new Date();
    mid.setFullYear(mid.getFullYear() - 3);
    const dateStr = mid.toISOString().split('T')[0];
    (apiService.getHistoricalData as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: [{ date: dateStr, close: 100 }] }
    });

    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('Add Transaction'));
    fireEvent.change(screen.getByPlaceholderText('e.g., AAPL'), { target: { value: 'AAPL' } });
    const dateInput = document.querySelector("input[name='purchase_date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: dateStr } });
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(apiService.getHistoricalData).toHaveBeenCalledWith('AAPL', '5Y');
    });
  });

  test('fetchClosingPriceForDate uses max period for old dates', async () => {
    const old = new Date();
    old.setFullYear(old.getFullYear() - 10);
    const dateStr = old.toISOString().split('T')[0];
    (apiService.getHistoricalData as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { data: [{ date: dateStr, close: 100 }] }
    });

    render(<TransactionsPage />);
    fireEvent.click(screen.getByText('Add Transaction'));
    fireEvent.change(screen.getByPlaceholderText('e.g., AAPL'), { target: { value: 'AAPL' } });
    const dateInput = document.querySelector("input[name='purchase_date']") as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: dateStr } });
    fireEvent.blur(dateInput);

    await waitFor(() => {
      expect(apiService.getHistoricalData).toHaveBeenCalledWith('AAPL', 'max');
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock a failed API call
    (transactionAPI.getUserTransactions as jest.Mock).mockResolvedValue({ ok: false, message: 'Internal Server Error' });

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
  });
});
