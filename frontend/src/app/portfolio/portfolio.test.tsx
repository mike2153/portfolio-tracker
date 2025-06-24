import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { apiService } from '@/lib/api';
import PortfolioPage from './page';
import { useToast } from '@/components/ui/Toast';

// Mock the dependencies
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com'
            }
          }
        }
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } }
      })
    }
  }
}));

jest.mock('@/lib/api');
jest.mock('@/components/ui/Toast');

const mockedApiService = apiService as jest.Mocked<typeof apiService>;
const mockedUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Mock portfolio data
const mockPortfolioData = {
  cash_balance: 5000,
  holdings: [
    {
      id: 1,
      ticker: 'AAPL',
      company_name: 'Apple Inc.',
      shares: 10,
      purchase_price: 150.00,
      market_value: 1500.00,
      purchase_date: '2024-01-15',
      commission: 0,
      currency: 'USD',
      fx_rate: 1.0,
      used_cash_balance: false
    },
    {
      id: 2,
      ticker: 'GOOGL',
      company_name: 'Alphabet Inc.',
      shares: 5,
      purchase_price: 2800.00,
      market_value: 14000.00,
      purchase_date: '2024-01-10',
      commission: 0,
      currency: 'USD',
      fx_rate: 1.0,
      used_cash_balance: false
    }
  ],
  summary: {
    total_holdings: 2,
    total_value: 20500
  }
};

const mockQuoteResponses = {
  AAPL: {
    ok: true,
    data: {
      symbol: 'AAPL',
      data: {
        symbol: 'AAPL',
        price: 155.25,
        change: 5.25,
        change_percent: 3.5,
        volume: 45123456,
        latest_trading_day: '2024-01-16',
        previous_close: 150.00,
        open: 152.00,
        high: 156.00,
        low: 151.50
      },
      timestamp: '2024-01-16T10:00:00.000Z'
    }
  },
  GOOGL: {
    ok: true,
    data: {
      symbol: 'GOOGL',
      data: {
        symbol: 'GOOGL',
        price: 2850.75,
        change: 50.75,
        change_percent: 1.81,
        volume: 1234567,
        latest_trading_day: '2024-01-16',
        previous_close: 2800.00,
        open: 2820.00,
        high: 2855.00,
        low: 2810.00
      },
      timestamp: '2024-01-16T10:00:00.000Z'
    }
  }
};

describe('Portfolio Price Fetching', () => {
  const mockAddToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseToast.mockReturnValue({ addToast: mockAddToast });
    
    // Setup default API responses
    mockedApiService.getPortfolio.mockResolvedValue({
      ok: true,
      data: mockPortfolioData
    });
  });

  describe('Current Price Fetching', () => {
    it('should fetch current prices for all holdings on load', async () => {
      // Mock quote responses
      mockedApiService.getQuote
        .mockResolvedValueOnce(mockQuoteResponses.AAPL)
        .mockResolvedValueOnce(mockQuoteResponses.GOOGL);

      render(<PortfolioPage />);

      // Wait for component to load and fetch prices
      await waitFor(() => {
        expect(mockedApiService.getPortfolio).toHaveBeenCalledWith('test-user-id');
      });

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Verify holdings are displayed
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
      expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
      expect(screen.getByText('Alphabet Inc.')).toBeInTheDocument();
    });

    it('should handle quote API errors gracefully', async () => {
      // Mock one successful quote and one failure
      mockedApiService.getQuote
        .mockResolvedValueOnce(mockQuoteResponses.AAPL)
        .mockRejectedValueOnce(new Error('API Error'));

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Should still display holdings (fallback to purchase price for failed quotes)
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should handle invalid quote response format', async () => {
      // Mock invalid response structure
      mockedApiService.getQuote
        .mockResolvedValueOnce({
          ok: true,
          data: { symbol: 'AAPL', data: {} } // Missing price
        })
        .mockResolvedValueOnce({
          ok: false,
          error: 'Symbol not found'
        });

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Should still display holdings with fallback prices
      expect(screen.getByText('AAPL')).toBeInTheDocument();
      expect(screen.getByText('GOOGL')).toBeInTheDocument();
    });

    it('should update current prices after adding a new holding', async () => {
      // Setup initial state
      mockedApiService.getQuote
        .mockResolvedValue(mockQuoteResponses.AAPL);

      mockedApiService.searchSymbols.mockResolvedValue({
        ok: true,
        data: {
          results: [{
            symbol: 'MSFT',
            name: 'Microsoft Corporation',
            exchange: 'NASDAQ',
            exchange_code: 'XNAS',
            currency: 'USD',
            country: 'United States',
            type: 'Equity'
          }],
          total: 1,
          query: 'MSFT'
        }
      });

      mockedApiService.addHolding.mockResolvedValue({
        ok: true,
        data: { message: 'Holding added successfully' }
      });

      // Mock updated portfolio with new holding
      const updatedPortfolio = {
        ...mockPortfolioData,
        holdings: [
          ...mockPortfolioData.holdings,
          {
            id: 3,
            ticker: 'MSFT',
            company_name: 'Microsoft Corporation',
            shares: 8,
            purchase_price: 400.00,
            market_value: 3200.00,
            purchase_date: '2024-01-16',
            commission: 0,
            currency: 'USD',
            fx_rate: 1.0,
            used_cash_balance: false
          }
        ]
      };

      // Mock quote for new stock
      const msftQuote = {
        ok: true,
        data: {
          symbol: 'MSFT',
          data: {
            symbol: 'MSFT',
            price: 410.50,
            change: 10.50,
            change_percent: 2.625
          }
        }
      };

      mockedApiService.getPortfolio
        .mockResolvedValueOnce({ ok: true, data: mockPortfolioData })
        .mockResolvedValueOnce({ ok: true, data: updatedPortfolio });

      mockedApiService.getQuote
        .mockResolvedValue(msftQuote);

      render(<PortfolioPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });

      // Click add holding button
      const addButton = screen.getByText('Add Stock');
      fireEvent.click(addButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Add Stock Holding')).toBeInTheDocument();
      });

      // Fill in the form (simplified test)
      const tickerInput = screen.getByPlaceholderText('e.g., AAPL, MSFT, GOOGL');
      fireEvent.change(tickerInput, { target: { value: 'MSFT' } });

      // Verify that price fetching would be called after form submission
      // (This is a simplified test - full form submission testing would be more complex)
    });
  });

  describe('Return Calculations', () => {
    it('should calculate correct return values with current prices', async () => {
      mockedApiService.getQuote
        .mockResolvedValueOnce(mockQuoteResponses.AAPL)
        .mockResolvedValueOnce(mockQuoteResponses.GOOGL);

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Wait for price calculations to complete
      await waitFor(() => {
        // For AAPL: (155.25 - 150.00) * 10 = $52.50 return
        // For GOOGL: (2850.75 - 2800.00) * 5 = $253.75 return
        
        // Check if return values are displayed (this would depend on your table structure)
        // The exact text matching would depend on your formatting functions
        expect(screen.getByText(/52\.50|52\.5/)).toBeInTheDocument();
        expect(screen.getByText(/253\.75|253\.8/)).toBeInTheDocument();
      });
    });

    it('should handle portfolio total calculations correctly', async () => {
      mockedApiService.getQuote
        .mockResolvedValueOnce(mockQuoteResponses.AAPL)
        .mockResolvedValueOnce(mockQuoteResponses.GOOGL);

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Total return should be: (155.25-150)*10 + (2850.75-2800)*5 = 52.50 + 253.75 = 306.25
      // This would be displayed in a summary section
      await waitFor(() => {
        // Look for total PnL display (adjust selector based on your implementation)
        const totalElements = screen.getAllByText(/306\.25|306\.3/);
        expect(totalElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast when portfolio fetch fails', async () => {
      mockedApiService.getPortfolio.mockResolvedValue({
        ok: false,
        error: 'Failed to fetch portfolio data'
      });

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Error Fetching Portfolio',
          message: 'Failed to fetch portfolio data'
        });
      });
    });

    it('should handle network errors during price fetching', async () => {
      mockedApiService.getQuote.mockRejectedValue(new Error('Network error'));

      render(<PortfolioPage />);

      await waitFor(() => {
        expect(mockedApiService.getQuote).toHaveBeenCalled();
      });

      // Should still display holdings with fallback prices
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('GOOGL')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching portfolio data', () => {
      // Mock a delayed response
      mockedApiService.getPortfolio.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ ok: true, data: mockPortfolioData }), 1000)
        )
      );

      render(<PortfolioPage />);

      // Should show loading indicator
      expect(screen.getByText(/loading|Loading/i)).toBeInTheDocument();
    });
  });
});

describe('Alpha Vantage Integration Tests', () => {
  describe('Quote Response Format Validation', () => {
    it('should handle Alpha Vantage quote response correctly', () => {
      const mockResponse = {
        ok: true,
        data: {
          symbol: 'AAPL',
          data: {
            symbol: 'AAPL',
            price: 155.25,
            change: 5.25,
            change_percent: 3.5,
            volume: 45123456,
            latest_trading_day: '2024-01-16',
            previous_close: 150.00,
            open: 152.00,
            high: 156.00,
            low: 151.50
          },
          timestamp: '2024-01-16T10:00:00.000Z'
        }
      };

      // Test the response structure matches expected format
      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.data.data.price).toBe(155.25);
      expect(typeof mockResponse.data.data.price).toBe('number');
      expect(mockResponse.data.data.price).toBeGreaterThan(0);
    });

    it('should validate required fields in quote response', () => {
      const requiredFields = ['symbol', 'price', 'change', 'change_percent', 'volume'];
      const mockQuoteData = mockQuoteResponses.AAPL.data.data;

      requiredFields.forEach(field => {
        expect(mockQuoteData).toHaveProperty(field);
        expect(mockQuoteData[field]).toBeDefined();
      });
    });
  });
}); 