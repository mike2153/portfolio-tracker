'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { transactionAPI, apiService } from '@/lib/api';
import { PlusCircle, Trash2, Edit, ChevronDown, ChevronUp, MoreVertical, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { StockSymbol, AddHoldingFormData, FormErrors } from '@/types/api';
import { supabase } from '@/lib/supabaseClient'
import { User } from '@/types'

// Debounce utility function
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Type definitions
interface Transaction {
  id: number;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND';
  ticker: string;
  company_name: string;
  shares: number;
  price_per_share: number;
  transaction_date: string;
  transaction_currency: string;
  commission: number;
  total_amount: number;
  daily_close_price?: number;
  notes: string;
  created_at: string;
}

interface TransactionSummary {
  total_transactions: number;
  buy_transactions: number;
  sell_transactions: number;
  dividend_transactions: number;
  unique_tickers: number;
  total_invested: number;
  total_received: number;
  total_dividends: number;
  net_invested: number;
}

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'DIVIDEND'>('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [tickerSuggestions, setTickerSuggestions] = useState<StockSymbol[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  const initialFormState: AddHoldingFormData = {
    ticker: '',
    company_name: '',
    exchange: '',
    shares: '',
    purchase_price: '',
    purchase_date: new Date().toISOString().split('T')[0],
    commission: '0',
    currency: 'USD',
    fx_rate: '1.0',
    use_cash_balance: true,
    notes: '',
    transaction_type: 'BUY'
  };

  const [form, setForm] = useState<AddHoldingFormData>(initialFormState);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const filters: any = { user_id: user.id };
      if (typeFilter !== 'ALL') {
        filters.transaction_type = typeFilter;
      }
      const response = await transactionAPI.getUserTransactions(filters);
      if (response.ok && response.data) {
        const txs = (response.data.transactions ?? []) as Transaction[];
        setTransactions(txs);
      } else {
        setError(response.message || 'Failed to load transactions');
      }
    } catch (err) {
      setError('Error fetching transactions');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, user]);

  const fetchSummary = useCallback(async () => {
    if (!user) return;
    try {
      const response = await transactionAPI.getTransactionSummary(user.id);
      if (response.ok && response.data) {
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [user]);

  useEffect(() => {
    // Fetch current session user then listen for auth changes
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user as unknown as User);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as unknown as User ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
    Promise.all([fetchTransactions(), fetchSummary()]);
    }
  }, [user, fetchTransactions, fetchSummary]);
  
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setTickerSuggestions([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await apiService.searchSymbols(query, 10);
        if (response.ok && response.data) {
          setTickerSuggestions(response.data.results);
        } else {
          setTickerSuggestions([]);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300),
    []
  );

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setForm(prev => ({ ...prev, ticker: value.toUpperCase() }));
      setShowSuggestions(true);
      debouncedSearch(value);
  };

  const handleSuggestionClick = (symbol: StockSymbol) => {
      setForm(prev => ({
          ...prev,
          ticker: symbol.symbol,
          company_name: symbol.name,
          currency: symbol.currency,
          exchange: symbol.exchange_code,
      }));
      setTickerSuggestions([]);
      setShowSuggestions(false);
  };
  
  const fetchClosingPriceForDate = useCallback(async (ticker: string, date: string) => {
      if (!ticker || !date) return;

      const selected = new Date(date);
      const diffYears = (Date.now() - selected.getTime()) / (1000 * 60 * 60 * 24 * 365);
      let period: string;
      if (diffYears <= 1) {
          period = '1Y';
      } else if (diffYears <= 5) {
          period = '5Y';
      } else {
          period = 'max';
      }

      setLoadingPrice(true);
      try {
          const response = await apiService.getHistoricalData(ticker, period);
          if (response.ok && response.data?.data) {
              const match = response.data.data.find((d: any) => d.date === date);
              if (match) {
                  setForm(prev => ({ ...prev, purchase_price: match.close.toString() }));
                  addToast({ type: 'success', title: 'Price Found', message: `Set purchase price to closing price of $${match.close} for ${date}` });
              } else {
                  addToast({ type: 'warning', title: 'Price Not Found', message: `No closing price found for ${ticker} on ${date}. Please enter manually.` });
              }
          }
      } catch (error) {
          addToast({ type: 'error', title: 'Price Fetch Failed', message: 'Could not fetch closing price.' });
      } finally {
          setLoadingPrice(false);
      }
  }, [addToast]);

  const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const { value } = e.target;
      if (form.ticker && value) {
          fetchClosingPriceForDate(form.ticker, value);
      }
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return; // Ensure a user is logged in
    setIsSubmitting(true);
    setError(null);
    try {
      const transactionData = {
          transaction_type: form.transaction_type || 'BUY',
          ticker: form.ticker.toUpperCase(),
          company_name: form.company_name || form.ticker.toUpperCase(),
          shares: parseFloat(form.shares),
          price_per_share: parseFloat(form.purchase_price),
          transaction_date: form.purchase_date,
          transaction_currency: form.currency,
          commission: parseFloat(form.commission || '0'),
          notes: form.notes || '',
          user_id: user.id,
      } as const;
      const response = await transactionAPI.createTransaction(transactionData);
      if (response.ok) {
        addToast({ type: 'success', title: 'Transaction Added', message: `${transactionData.ticker} has been added.` });
        setShowAddForm(false);
        await Promise.all([fetchTransactions(), fetchSummary()]);
      } else {
        setError(response.message || 'Failed to create transaction');
        addToast({ type: 'error', title: 'Submission Failed', message: response.message || 'Could not add transaction.' });
      }
    } catch (err: any) {
      setError(err.message || 'Error creating transaction');
      addToast({ type: 'error', title: 'Client-side Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchQuery === '' || 
      transaction.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
              <p className="text-gray-600">Track your investment activities and performance</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Transaction
              </button>
            </div>
          </div>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search by ticker or company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Total Invested</h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_invested)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Total Transactions</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.total_transactions}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Unique Stocks</h3>
              <p className="text-2xl font-bold text-purple-600">{summary.unique_tickers}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-gray-500">Net Invested</h3>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.net_invested)}</p>
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{transaction.ticker}</div><div className="text-sm text-gray-500">{transaction.company_name}</div></div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : transaction.transaction_type === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{transaction.transaction_type}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.shares}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(transaction.price_per_share, transaction.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(transaction.total_amount, transaction.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(transaction.transaction_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Transaction</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select name="transaction_type" value={form.transaction_type} onChange={handleFormChange} className="w-full p-2 border border-gray-300 rounded-lg" required>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                  <option value="DIVIDEND">Dividend</option>
                </select>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticker Symbol</label>
                <input type="text" name="ticker" value={form.ticker} onChange={handleTickerChange} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className={`w-full p-2 border ${formErrors.ticker ? 'border-red-500' : 'border-gray-300'} rounded-lg`} placeholder="e.g., AAPL" required autoComplete="off" />
                {formErrors.ticker && <p className="text-red-500 text-xs mt-1">{formErrors.ticker}</p>}
                {showSuggestions && (
                  <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
                    {searchLoading ? <div className="p-4 text-center">Loading...</div> : tickerSuggestions.length > 0 ? (
                      tickerSuggestions.map(s => (
                        <div key={s.symbol} onMouseDown={() => handleSuggestionClick(s)} className="p-2 hover:bg-gray-100 cursor-pointer">
                          <div className="font-bold">{s.symbol}</div>
                          <div className="text-sm text-gray-600">{s.name}</div>
                        </div>
                      ))
                    ) : <div className="p-4 text-center text-gray-500">No results found.</div>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Shares</label>
                  <input type="number" name="shares" step="0.000001" min="0" value={form.shares} onChange={handleFormChange} className={`w-full p-2 border ${formErrors.shares ? 'border-red-500' : 'border-gray-300'} rounded-lg`} required />
                  {formErrors.shares && <p className="text-red-500 text-xs mt-1">{formErrors.shares}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per Share</label>
                  <input type="number" name="purchase_price" step="0.01" min="0" value={form.purchase_price} onChange={handleFormChange} className={`w-full p-2 border ${formErrors.purchase_price ? 'border-red-500' : 'border-gray-300'} rounded-lg`} required />
                  {formErrors.purchase_price && <p className="text-red-500 text-xs mt-1">{formErrors.purchase_price}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Date</label>
                <input type="date" name="purchase_date" value={form.purchase_date} onChange={handleFormChange} onBlur={handleDateBlur} className={`w-full p-2 border ${formErrors.purchase_date ? 'border-red-500' : 'border-gray-300'} rounded-lg`} required />
                {formErrors.purchase_date && <p className="text-red-500 text-xs mt-1">{formErrors.purchase_date}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select name="currency" value={form.currency} onChange={handleFormChange} className="w-full p-2 border border-gray-300 rounded-lg">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission (optional)</label>
                  <input type="number" name="commission" step="0.01" min="0" value={form.commission} onChange={handleFormChange} className={`w-full p-2 border ${formErrors.commission ? 'border-red-500' : 'border-gray-300'} rounded-lg`} placeholder="0.00" />
                  {formErrors.commission && <p className="text-red-500 text-xs mt-1">{formErrors.commission}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea name="notes" value={form.notes} onChange={handleFormChange} className="w-full p-2 border border-gray-300 rounded-lg" rows={2} placeholder="Additional notes..." />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                  {isSubmitting ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;