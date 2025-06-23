import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransactionsPage } from './page'; // Adjust the import path as necessary
import { transactionAPI } from '@/lib/api';

// Mock the transactionAPI
jest.mock('@/lib/api', () => ({
  transactionAPI: {
    getUserTransactions: jest.fn(),
    getTransactionSummary: jest.fn(),
    createTransaction: jest.fn(),
    updateCurrentPrices: jest.fn(),
  },
}));

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
  });

  test('renders the main header and summary cards', async () => {
    render(<TransactionsPage />);
    
    // Check for header
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    
    // Wait for summary data to be loaded and check for cards
    await waitFor(() => {
      expect(screen.getByText('Total Invested')).toBeInTheDocument();
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      expect(screen.getByText('Total Transactions')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
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

  test('opens and submits the "Add Transaction" form', async () => {
    render(<TransactionsPage />);
    
    // Open the form
    fireEvent.click(screen.getByText('Add Transaction'));
    expect(screen.getByText('Ticker Symbol')).toBeInTheDocument();

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Ticker Symbol/i), { target: { value: 'MSFT' } });
    fireEvent.change(screen.getByLabelText(/Number of Shares/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Price per Share/i), { target: { value: '300' } });

    // Submit the form
    fireEvent.click(screen.getByText('Add Transaction', { selector: 'button[type="submit"]' }));

    // Verify the API was called with the correct data
    await waitFor(() => {
      expect(transactionAPI.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
        ticker: 'MSFT',
        shares: 20,
        price_per_share: 300,
      }));
    });

    // Verify the form closes after submission
    expect(screen.queryByText('Ticker Symbol')).not.toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    // Mock a failed API call
    (transactionAPI.getUserTransactions as jest.Mock).mockResolvedValue({ ok: false, message: 'Internal Server Error' });
    
    render(<TransactionsPage />);
    
    // Wait for the error message to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
      expect(screen.getByText('Internal Server Error')).toBeInTheDocument();
    });
  });
});
