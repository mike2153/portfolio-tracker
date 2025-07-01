'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { front_api_client } from '@/lib/front_api_client';
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

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
      const response = await front_api_client.front_api_get_transactions();
      if (response.ok && response.data) {
        const txs = (response.data.transactions ?? []) as Transaction[];
        setTransactions(txs);
      } else {
        setError(response.error || 'Failed to load transactions');
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
      // Note: Transaction summary API needs to be implemented in backend
      // For now, calculate basic summary from transactions
      const basicSummary = {
        total_transactions: transactions.length,
        buy_transactions: transactions.filter(t => t.transaction_type === 'BUY').length,
        sell_transactions: transactions.filter(t => t.transaction_type === 'SELL').length,
        dividend_transactions: transactions.filter(t => t.transaction_type === 'DIVIDEND').length,
        unique_tickers: new Set(transactions.map(t => t.ticker)).size,
        total_invested: transactions.filter(t => t.transaction_type === 'BUY').reduce((sum, t) => sum + t.total_amount, 0),
        total_received: transactions.filter(t => t.transaction_type === 'SELL').reduce((sum, t) => sum + t.total_amount, 0),
        total_dividends: transactions.filter(t => t.transaction_type === 'DIVIDEND').reduce((sum, t) => sum + t.total_amount, 0),
        net_invested: 0
      };
      basicSummary.net_invested = basicSummary.total_invested - basicSummary.total_received;
      const response = { ok: true, data: { summary: basicSummary } };
      if (response.ok && response.data) {
        setSummary(response.data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [user]);

  const refreshData = useCallback(() => {
    fetchTransactions();
    fetchSummary();
    queryClient.invalidateQueries(); // Invalidate all queries to refresh dashboard
    addToast({ type: 'info', title: 'Refreshing Data', message: 'Updating dashboard and transactions...' });
  }, [fetchTransactions, fetchSummary, queryClient, addToast]);

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
  
  const latestQueryRef = React.useRef('');

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 1) {
        setTickerSuggestions([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await front_api_client.front_api_search_symbols({ query, limit: 50 });
        if (latestQueryRef.current === query) {
          if (response.ok && response.data) {
            setTickerSuggestions(response.data.results);
          } else {
            setTickerSuggestions([]);
          }
        }
      } finally {
        setSearchLoading(false);
      }
    }, 500),
    []
  );

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setForm(prev => ({ ...prev, ticker: value.toUpperCase() }));
      latestQueryRef.current = value;
      setTickerSuggestions([]);
      setShowSuggestions(true);
      debouncedSearch(value);
  };

  const handleSuggestionClick = (symbol: StockSymbol) => {
      const newForm = {
          ...form,
          ticker: symbol.symbol,
          company_name: symbol.name,
          currency: symbol.currency,
          exchange: symbol.exchange_code,
      };
      
      setForm(newForm);
      setTickerSuggestions([]);
      setShowSuggestions(false);
      
      // If a date is already selected, automatically fetch the historical price
      if (newForm.purchase_date && symbol.symbol) {
          console.log(`[handleSuggestionClick] Auto-triggering price lookup for ${symbol.symbol} on ${newForm.purchase_date}`);
          fetchClosingPriceForDate(symbol.symbol, newForm.purchase_date);
      }
  };
  
  /**
   * Fetch historical closing price for a specific stock on a specific date
   * This function is called when both ticker and date are selected in the transaction form
   * It auto-populates the "Price per Share" field with the historical closing price
   */
  const fetchClosingPriceForDate = useCallback(async (ticker: string, date: string) => {
      console.log(`
========== PRICE LOOKUP REQUEST ==========
FILE: transactions/page.tsx
FUNCTION: fetchClosingPriceForDate
TICKER: ${ticker}
DATE: ${date}
TIMESTAMP: ${new Date().toISOString()}
=========================================`);
      
      if (!ticker || !date) {
          console.log('[fetchClosingPriceForDate] Missing ticker or date, skipping price lookup');
          return;
      }

      // Validate date is not in the future
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare just dates
      
      if (selectedDate > today) {
          console.log('[fetchClosingPriceForDate] Date is in the future, skipping price lookup');
          addToast({
              type: 'warning',
              title: 'Future Date Selected',
              message: 'Cannot fetch historical prices for future dates. Please enter price manually.',
          });
          return;
      }

      setLoadingPrice(true);
      try {
          console.log(`[fetchClosingPriceForDate] Calling API for ${ticker} on ${date}`);
          
          const response = await front_api_client.front_api_get_historical_price({
              symbol: ticker.toUpperCase(),
              date: date
          });
          
          if (response.ok && response.data?.success) {
              const priceData = response.data;
              const closingPrice = priceData.price_data.close;
              
              console.log(`
========== PRICE LOOKUP SUCCESS ==========
TICKER: ${ticker}
REQUESTED_DATE: ${date}
ACTUAL_DATE: ${priceData.actual_date}
CLOSING_PRICE: $${closingPrice}
IS_EXACT_DATE: ${priceData.is_exact_date}
=========================================`);
              
              // Update the form with the fetched price
              setForm(prev => ({ 
                  ...prev, 
                  purchase_price: closingPrice.toString() 
              }));
              
              // Show success message to user
              const message = priceData.is_exact_date 
                  ? `Found closing price: $${closingPrice} on ${priceData.actual_date}`
                  : `Found closing price: $${closingPrice} on ${priceData.actual_date} (closest trading day to ${date})`;
                  
              addToast({
                  type: 'success',
                  title: 'Price Fetched Successfully',
                  message: message
              });
              
          } else {
              console.error(`[fetchClosingPriceForDate] API call failed:`, response.error || response.data?.error);
              
              addToast({
                  type: 'error',
                  title: 'Price Fetch Failed',
                  message: response.error || response.data?.error || `Could not fetch historical price for ${ticker} on ${date}. Please enter manually.`
              });
          }
          
      } catch (error: any) {
          console.error(`[fetchClosingPriceForDate] Exception occurred:`, error);
          
          addToast({ 
              type: 'error', 
              title: 'Price Fetch Error', 
              message: `Error fetching price for ${ticker}: ${error.message || 'Unknown error'}. Please enter manually.`
          });
      } finally {
          setLoadingPrice(false);
          console.log(`[fetchClosingPriceForDate] Price lookup completed for ${ticker} on ${date}`);
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
      const isCheckbox = type === 'checkbox';
      // @ts-ignore
      const val = isCheckbox ? e.target.checked : value;
      setForm(prev => ({ ...prev, [name]: val }));
  };

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    // Map form data to the format expected by front_api_client
    const transactionData = {
        transaction_type: form.transaction_type === 'BUY' ? 'Buy' as const : 
                         form.transaction_type === 'SELL' ? 'Sell' as const : 'Buy' as const,
        symbol: form.ticker.toUpperCase(),
        quantity: parseFloat(form.shares),
        price: parseFloat(form.purchase_price),
        date: form.purchase_date,
        currency: form.currency,
        commission: parseFloat(form.commission || '0'),
        notes: form.notes || '',
    };

    try {
      const isEditing = !!editingTransaction;
      addToast({ type: 'info', title: 'Submitting', message: `${isEditing ? 'Updating' : 'Adding'} transaction...` });
      
      let response;
      if (isEditing) {
        response = await front_api_client.front_api_update_transaction(editingTransaction.id.toString(), transactionData);
      } else {
        response = await front_api_client.front_api_add_transaction(transactionData);
      }

      if (response.ok) {
        addToast({ type: 'success', title: `Transaction ${isEditing ? 'Updated' : 'Added'}`, message: `${transactionData.symbol} has been successfully ${isEditing ? 'updated' : 'added'}.` });
        setShowAddForm(false);
        setEditingTransaction(null);
        refreshData();
      } else {
        setError(response.message || 'Failed to process transaction');
        addToast({ type: 'error', title: 'Submission Failed', message: response.message || `Could not ${isEditing ? 'update' : 'add'} transaction.` });
      }
    } catch (err: any) {
      setError(err.message || `Error ${editingTransaction ? 'updating' : 'creating'} transaction`);
      addToast({ type: 'error', title: 'Client-side Error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (txn: Transaction) => {
    setEditingTransaction(txn);
    setForm({
      ticker: txn.ticker,
      company_name: txn.company_name,
      exchange: '',
      shares: txn.shares.toString(),
      purchase_price: txn.price_per_share.toString(),
      purchase_date: txn.transaction_date,
      commission: txn.commission.toString(),
      currency: txn.transaction_currency,
      fx_rate: '1.0',
      use_cash_balance: false,
      notes: txn.notes,
      transaction_type: txn.transaction_type
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = async (txnId: number) => {
    if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        addToast({ type: 'info', title: 'Deleting...', message: 'Removing transaction.' });
        const response = await front_api_client.front_api_delete_transaction(txnId.toString());
        if (response.ok) {
          addToast({ type: 'success', title: 'Transaction Deleted', message: 'The transaction has been removed.' });
          refreshData();
        } else {
          addToast({ type: 'error', title: 'Deletion Failed', message: response.error || 'Could not delete the transaction.' });
        }
      } catch (err: any) {
        addToast({ type: 'error', title: 'Client-side Error', message: err.message });
      }
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
    <div className="min-h-screen bg-gray-900 p-6 text-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900 rounded-lg shadow-sm p-6 mb-6 text-gray-100 border border-gray-700">
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
            <div className="bg-gray-900 p-4 rounded-lg shadow-sm text-gray-100 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-500">Total Invested</h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_invested)}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg shadow-sm text-gray-100 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-500">Total Transactions</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.total_transactions}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg shadow-sm text-gray-100 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-500">Unique Stocks</h3>
              <p className="text-2xl font-bold text-purple-600">{summary.unique_tickers}</p>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg shadow-sm text-gray-100 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-500">Net Invested</h3>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {formatCurrency(summary.net_invested)}
              </p>
            </div>
          </div>
        )}
        
        <div className="bg-gray-900 rounded-lg shadow-sm text-gray-100 border border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700 text-gray-100">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-100">{transaction.ticker}</div><div className="text-sm text-gray-400">{transaction.company_name}</div></div></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${transaction.transaction_type === 'BUY' ? 'bg-green-100 text-green-800' : transaction.transaction_type === 'SELL' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{transaction.transaction_type}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{Math.round(transaction.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{formatCurrency(transaction.price_per_share, transaction.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{formatCurrency(transaction.total_amount, transaction.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-100">{formatDate(transaction.transaction_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                        <Edit onClick={() => handleEditClick(transaction)} className="h-5 w-5 cursor-pointer text-gray-400 hover:text-gray-200" />
                        <Trash2 onClick={() => handleDeleteClick(transaction.id)} className="h-5 w-5 cursor-pointer text-gray-400 hover:text-gray-200" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 text-gray-100 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingTransaction ? 'Edit' : 'Add'} Transaction</h3>
              <button onClick={() => { setShowAddForm(false); setEditingTransaction(null); }} className="text-gray-400 hover:text-gray-200"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Transaction Type</label>
                <select name="transaction_type" value={form.transaction_type} onChange={handleFormChange} className="w-full p-2 border border-gray-600 rounded-lg" required>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                  <option value="DIVIDEND">Dividend</option>
                </select>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Ticker Symbol</label>
                <input type="text" name="ticker" value={form.ticker} onChange={handleTickerChange} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className={`w-full p-2 border ${formErrors.ticker ? 'border-red-500' : 'border-gray-600'} rounded-lg`} placeholder="e.g., AAPL" required autoComplete="off" />
                {formErrors.ticker && <p className="text-red-500 text-xs mt-1">{formErrors.ticker}</p>}
                {showSuggestions && (
                  <div className="absolute z-10 w-full bg-gray-900 border border-gray-700 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto text-gray-100">
                    {searchLoading ? <div className="p-4 text-center">Loading...</div> : tickerSuggestions.length > 0 ? (
                      tickerSuggestions.map(s => (
                        <div key={s.symbol} onMouseDown={() => handleSuggestionClick(s)} className="p-2 hover:bg-gray-700/50 cursor-pointer">
                          <div className="font-bold text-gray-100">{s.symbol}</div>
                          <div className="text-sm text-gray-400">{s.name}</div>
                        </div>
                      ))
                    ) : <div className="p-4 text-center text-gray-500">No results found.</div>}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Number of Shares</label>
                  <input type="number" name="shares" step="1" min="0" value={form.shares} onChange={handleFormChange} className={`w-full p-2 border ${formErrors.shares ? 'border-red-500' : 'border-gray-600'} rounded-lg`} required />
                  {formErrors.shares && <p className="text-red-500 text-xs mt-1">{formErrors.shares}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">
                    Price per Share
                    {loadingPrice && <span className="text-blue-600 text-xs ml-2">(fetching historical price...)</span>}
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      name="purchase_price" 
                      step="0.01" 
                      min="0" 
                      value={form.purchase_price} 
                      onChange={handleFormChange} 
                      className={`w-full p-2 border ${formErrors.purchase_price ? 'border-red-500' : 'border-gray-600'} rounded-lg ${loadingPrice ? 'bg-gray-100' : ''}`} 
                      disabled={loadingPrice}
                      required 
                    />
                    {loadingPrice && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                  {formErrors.purchase_price && <p className="text-red-500 text-xs mt-1">{formErrors.purchase_price}</p>}
                  {!loadingPrice && form.ticker && form.purchase_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Price will auto-populate based on historical closing price for {form.ticker} on {form.purchase_date}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Transaction Date</label>
                <input type="date" name="purchase_date" value={form.purchase_date} onChange={handleFormChange} onBlur={handleDateBlur} className={`w-full p-2 border ${formErrors.purchase_date ? 'border-red-500' : 'border-gray-600'} rounded-lg`} required />
                {formErrors.purchase_date && <p className="text-red-500 text-xs mt-1">{formErrors.purchase_date}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Currency</label>
                    <select name="currency" value={form.currency} onChange={handleFormChange} className="w-full p-2 border border-gray-600 rounded-lg">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="AUD">AUD</option>
                        <option value="CAD">CAD</option>
                        <option value="CHF">CHF</option>
                        <option value="CNY">CNY</option>
                        <option value="JPY">JPY</option>
                        <option value="KRW">KRW</option>
                        <option value="MXN">MXN</option>
                        <option value="NZD">NZD</option>
                        <option value="RUB">RUB</option>
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Commission (optional)</label>
                  <input type="number" name="commission" step="0.01" min="0" value={form.commission} onChange={handleFormChange} className={`w-full p-2 border ${formErrors.commission ? 'border-red-500' : 'border-gray-600'} rounded-lg`} placeholder="0.00" />
                  {formErrors.commission && <p className="text-red-500 text-xs mt-1">{formErrors.commission}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1 text-on-white">Notes (optional)</label>
                <textarea name="notes" value={form.notes} onChange={handleFormChange} className="w-full p-2 border border-gray-600 rounded-lg" rows={2} placeholder="Additional notes..." />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowAddForm(false); setEditingTransaction(null); }} className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-200 hover:bg-gray-700 font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                  {isSubmitting ? (editingTransaction ? 'Updating...' : 'Adding...') : (editingTransaction ? 'Update' : 'Add') + ' Transaction'}
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