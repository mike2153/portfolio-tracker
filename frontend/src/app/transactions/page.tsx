"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import GradientText from '@/components/ui/GradientText';
import { useQueryClient } from "@tanstack/react-query";
import { front_api_client } from "@/lib/front_api_client";
import { Trash2, Edit, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { AddHoldingFormData } from "@/types/api";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@/types";
import { StockSearchInput } from "@/components/StockSearchInput";
import CompanyIcon from "@/components/ui/CompanyIcon";
import { useSearchParams } from 'next/navigation';
// Import centralized formatters from shared
import { formatCurrency, formatDate } from '../../../../shared/utils/formatters';

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------*/

interface Transaction {
  id: string; // keep uuid as string
  transaction_type: "BUY" | "SELL" | "DIVIDEND";
  ticker: string;
  company_name: string;
  shares: number;
  price_per_share: number;
  transaction_date: string; // ISO
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

// Shape returned by backend
interface BackendTx {
  id: string;
  transaction_type: 'Buy' | 'Sell';
  symbol: string;
  quantity: number | string | null;
  price: number | string | null;
  date: string;
  currency: string | null;
  commission: number | string | null;
  notes: string | null;
  created_at: string;
}

// Response shape from /api/transactions
interface TxApiResp {
  success: boolean;
  transactions: BackendTx[];
  message?: string;
}

/* ------------------------------------------------------------------
 * Utility helpers
 * ------------------------------------------------------------------*/

const parseNum = (v: unknown): number => {
  const n = parseFloat(v as string);
  return isNaN(n) ? 0 : n;
};

// Local wrapper for currency formatting with specific default
const formatTransactionCurrency = (amount: number, currency = "USD"): string =>
  formatCurrency(amount, { currency });

// Debounce utility function - As this is a small helper, it's fine to keep it here.
function _debounce<T extends unknown[]>(func: (...args: T) => void, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/* ------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------*/

const TransactionsPage = () => {
  /* ---------------- state ----------------*/
  const searchParams = useSearchParams();
  const [rawTransactions, setRawTransactions] = useState<BackendTx[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [_loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [_typeFilter, _setTypeFilter] = useState<"ALL" | "BUY" | "SELL" | "DIVIDEND">("ALL");
  const [showAddForm, setShowAddForm] = useState(false);
  // Form errors removed for simplicity - validation can be added later
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const { addToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  /* ---------------- derived ----------------*/
  const transactions: Transaction[] = useMemo(() => {
    const mapped = rawTransactions.map((tx) => {
      const shares = parseNum(tx.quantity);
      const pricePerShare = parseNum(tx.price);
      const commission = parseNum(tx.commission);
      const totalAmount =
        tx.transaction_type === "Sell"
          ? shares * pricePerShare - commission
          : shares * pricePerShare + commission;

      return {
        id: tx.id,
        transaction_type: tx.transaction_type.toUpperCase() as Transaction["transaction_type"],
        ticker: tx.symbol,
        company_name: "", // Not provided by backend yet
        shares,
        price_per_share: pricePerShare,
        transaction_date: tx.date,
        transaction_currency: tx.currency || "USD",
        commission,
        total_amount: totalAmount,
        notes: tx.notes || "",
        created_at: tx.created_at,
      };
    });

    return mapped;
  }, [rawTransactions]);

  /* ---------------- form state ----------------*/
  const initialFormState: AddHoldingFormData = {
    ticker: "",
    company_name: "",
    exchange: "",
    shares: "",
    purchase_price: "",
    purchase_date: "",  // Start with empty date
    commission: "0",
    currency: "USD",
    fx_rate: "1.0",
    use_cash_balance: true,
    notes: "",
    transaction_type: "BUY",
  };
  const [form, setForm] = useState<AddHoldingFormData>(initialFormState);

  /* ------------------------------------------------------------------
   * Fetching helpers
   * ----------------------------------------------------------------*/
  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // TODO: Migrate to consolidated hooks - this is a legacy API call
      // For now, using direct API call since individual transactions aren't in consolidated endpoint
      const response = await front_api_client.get('/api/transactions') as TxApiResp;
      // Commenting out verbose debug logs
      // console.log("FETCH_TRANSACTIONS", response);
      if (response.success) {
        setRawTransactions(response.transactions);
      } else {
        setError(response.message || "Failed to load transactions");
      }
    } catch {
      setError("Error fetching transactions");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSummary = useCallback(() => {
    if (!user) return;
    const basicSummary: TransactionSummary = {
      total_transactions: transactions.length,
      buy_transactions: transactions.filter((t) => t.transaction_type === "BUY").length,
      sell_transactions: transactions.filter((t) => t.transaction_type === "SELL").length,
      dividend_transactions: transactions.filter((t) => t.transaction_type === "DIVIDEND").length,
      unique_tickers: new Set(transactions.map((t) => t.ticker)).size,
      total_invested: transactions
        .filter((t) => t.transaction_type === "BUY")
        .reduce((sum, t) => sum + t.total_amount, 0),
      total_received: transactions
        .filter((t) => t.transaction_type === "SELL")
        .reduce((sum, t) => sum + t.total_amount, 0),
      total_dividends: transactions
        .filter((t) => t.transaction_type === "DIVIDEND")
        .reduce((sum, t) => sum + t.total_amount, 0),
      net_invested: 0,
    };
    basicSummary.net_invested = basicSummary.total_invested - basicSummary.total_received;
    setSummary(basicSummary);
  }, [user, transactions]);

  const refreshData = useCallback(async () => {
    try {
      fetchTransactions();
      fetchSummary();
      
      await queryClient.invalidateQueries({ queryKey: ['dashboard'], exact: false });
      
      await queryClient.invalidateQueries({ queryKey: ['performance'], exact: false });
      
      await queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      if (user?.id) {
        await queryClient.refetchQueries({ queryKey: ['performance'] });
      }
      
      addToast({ 
        type: "success", 
        title: "Data Refreshed", 
        message: "Portfolio, dashboard, and chart data updated successfully!" 
      });
      
    } catch {
      // Commenting out verbose debug logs
      // console.error('[RefreshData] ❌ Error during data refresh:', error);
      addToast({ 
        type: "error", 
        title: "Refresh Failed", 
        message: "Failed to refresh some data. Please try again." 
      });
    }
  }, [fetchTransactions, fetchSummary, queryClient, addToast, user?.id]);

  /**
   * Fetch historical closing price for a specific stock on a specific date
   */
  const fetchClosingPriceForDate = useCallback(async (ticker: string, date: string) => {
      if (!ticker || typeof ticker !== 'string') {
          return;
      }
      if (!date || typeof date !== 'string') {
          return;
      }
      
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate > today) {
          addToast({
              type: 'warning',
              title: 'Future Date Selected',
              message: 'Cannot fetch historical prices for future dates. Please enter price manually.',
          });
          return;
      }

      const upperTicker = ticker.toUpperCase();

      setLoadingPrice(true);
      try {
          const response = await front_api_client.front_api_get_historical_price(
              upperTicker,
              date
          ) as { success: boolean; price_data?: { close: number } };
          
          if (response && response.success === true) {
              if (response.price_data && typeof response.price_data.close !== 'undefined') {
                  const closingPrice = response.price_data.close;
                  setForm(prev => ({ 
                      ...prev, 
                      purchase_price: closingPrice.toString() 
                  }));
                  const message = `Found closing price: $${closingPrice} for ${ticker}`;
                  addToast({ type: 'success', title: 'Price Fetched', message: message });
              } else {
                  addToast({ type: 'error', title: 'Price Data Invalid', message: `Received invalid price data for ${ticker}.`});
              }
          } else {
              const errorMessage = `Could not fetch price for ${ticker}.`;
              addToast({ type: 'error', title: 'Price Fetch Failed', message: errorMessage });
          }
      } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addToast({ type: 'error', title: 'Price Fetch Error', message: `Error fetching price: ${errorMessage}.` });
      } finally {
          setLoadingPrice(false);
      }
  }, [addToast]);

  const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const hasValidTicker = form.ticker && form.ticker.trim() !== '';
      const hasValidDate = value && value.trim() !== '';
      if (hasValidTicker && hasValidDate) {
          fetchClosingPriceForDate(form.ticker, value);
      }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const isCheckbox = type === 'checkbox';
      // @ts-expect-error - checkbox property exists on input elements
      const val = isCheckbox ? e.target.checked : value;
      setForm(prev => ({ ...prev, [name]: val }));
  };

  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    const transactionData = {
        transaction_type: form.transaction_type === 'BUY' ? 'Buy' as const : 
                         form.transaction_type === 'SELL' ? 'Sell' as const : 
                         form.transaction_type === 'DIVIDEND' ? 'Buy' as const : 'Buy' as const, // DIVIDEND handled as BUY in backend
        symbol: form.ticker.toUpperCase(),
        quantity: parseFloat(form.shares),
        price: parseFloat(form.purchase_price),
        date: form.purchase_date,
        currency: form.currency,
        commission: parseFloat(form.commission || '0'),
        notes: form.notes || '',
        amount_invested: amountInvested, // Add the calculated amount_invested field
    };

    // Debug logging for amount_invested submission


    const isEditing = !!editingTransaction;
    try {
      addToast({ type: 'info', title: 'Submitting', message: `${isEditing ? 'Updating' : 'Adding'} transaction...` });
      
      let _response;
      if (isEditing) {
        _response = await front_api_client.front_api_update_transaction(editingTransaction.id.toString(), transactionData);
      } else {
        _response = await front_api_client.front_api_add_transaction(transactionData);
      }

      addToast({ type: 'success', title: `Transaction ${isEditing ? 'Updated' : 'Added'}`, message: `${transactionData.symbol} has been successfully processed.` });
      setShowAddForm(false);

      setEditingTransaction(null);

      await refreshData();

    } catch (err: unknown) {
      console.error('[Submit] ERROR CAUGHT:', err);
      const errorMessage = err instanceof Error ? err.message : `Error ${isEditing ? 'creating' : 'updating'} transaction`;
      setError(errorMessage);
      addToast({ type: 'error', title: 'Submission Failed', message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------------------------------------------
   * Row action handlers (edit / delete)
   * ----------------------------------------------------------------*/
  const handleEditClick = (txn: Transaction) => {
    setEditingTransaction(txn);
    setForm({
      ticker: txn.ticker,
      company_name: txn.company_name,
      exchange: '', // Not available on transaction object
      shares: txn.shares.toString(),
      purchase_price: txn.price_per_share.toString(),
      purchase_date: txn.transaction_date.split('T')[0] || txn.transaction_date, // Format for date input
      commission: txn.commission.toString(),
      currency: txn.transaction_currency,
      fx_rate: '1.0', // Default value
      use_cash_balance: false, // Default value
      notes: txn.notes,
      transaction_type: txn.transaction_type
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = async (txnId: string) => {
    if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      try {
        addToast({ type: 'info', title: 'Deleting...', message: 'Removing transaction.' });
        const _response = await front_api_client.front_api_delete_transaction(txnId);
        addToast({ type: 'success', title: 'Transaction Deleted', message: 'The transaction has been removed.' });
        await refreshData();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        addToast({ type: 'error', title: 'Client-side Error', message: errorMessage });
      }
    }
  };

  /* ---------------- auth listener ----------------*/
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) setUser(session.user as unknown as User);
    };
    init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user as unknown as User ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ---------------- initial fetch & updates ----------------*/
  // Fetch transactions once when user changes (login / logout)
  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Recompute summary whenever transactions change
  useEffect(() => {
    if (user) {
      fetchSummary();
    }
  }, [user, transactions, fetchSummary]);

  // Handle URL parameters for opening form
  useEffect(() => {
    const shouldAdd = searchParams.get('add') === 'true';
    const type = searchParams.get('type');
    
    if (shouldAdd) {
      setShowAddForm(true);
      if (type === 'dividend') {
        setForm(prev => ({ ...prev, transaction_type: 'DIVIDEND' }));
      }
    }
  }, [searchParams]);

  const filteredTransactions = useMemo(() => transactions.filter(transaction => {
    const matchesSearch = searchQuery === '' || 
      transaction.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.company_name && transaction.company_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  }), [transactions, searchQuery]);

  // Calculate amount invested for the form
  const amountInvested = useMemo(() => {
    const shares = parseFloat(form.shares || '0');
    const price = parseFloat(form.purchase_price || '0');
    const amount = shares * price;

    return isNaN(amount) ? 0 : amount;
  }, [form.shares, form.purchase_price]);

  /* ------------------------------------------------------------------
   * JSX
   * ----------------------------------------------------------------*/

  return (
    <div className="min-h-screen bg-transparent p-6 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="bg-transparent rounded-lg shadow-sm p-6 mb-6 text-white border border-[#30363D]">
          <div className="flex justify-between items-center">
            <div>
              <GradientText className="text-3xl font-bold">Transactions</GradientText>
              <p className="text-[#8B949E]">Track your investment activities and performance</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setForm(initialFormState);
                  setShowAddForm(true);
                }}
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
              className="w-full max-w-md px-4 py-2 border border-[#30363D] bg-transparent text-white rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-transparent border border-[#30363D] p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-[#8B949E]">Total Invested</h3>
              <p className="text-2xl font-bold text-green-400">{formatTransactionCurrency(summary.total_invested)}</p>
            </div>
            <div className="bg-transparent border border-[#30363D] p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-[#8B949E]">Total Transactions</h3>
              <p className="text-2xl font-bold text-blue-400">{summary.total_transactions}</p>
            </div>
            <div className="bg-transparent border border-[#30363D] p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-[#8B949E]">Unique Stocks</h3>
              <p className="text-2xl font-bold text-purple-400">{summary.unique_tickers}</p>
            </div>
            <div className="bg-transparent border border-[#30363D] p-4 rounded-lg shadow-sm">
              <h3 className="text-sm font-medium text-[#8B949E]">Net Invested</h3>
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {formatTransactionCurrency(summary.net_invested)}
              </p>
            </div>
          </div>
        )}
        
        <div className="bg-transparent rounded-lg shadow-sm text-white border border-[#30363D]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-transparent">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Holding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Shares</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-[#30363D] text-white">
                  {filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-[#30363D]/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <CompanyIcon 
                            symbol={t.ticker} 
                            size={32} 
                            fallback="initials"
                            className="flex-shrink-0"
                          />
                          <div>
                            <div className="text-sm font-medium text-white">{t.ticker}</div>
                            <div className="text-sm text-[#8B949E]">{t.company_name || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${t.transaction_type === 'BUY' ? 'bg-green-900 text-green-300' : t.transaction_type === 'SELL' ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'}`}>{t.transaction_type}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{Math.round(t.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatTransactionCurrency(t.price_per_share, t.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatTransactionCurrency(t.total_amount, t.transaction_currency)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{formatDate(t.transaction_date)}</td>
                      <td className="px-6 py-4 whitespace-nowrap flex space-x-2">
                        <Edit onClick={() => handleEditClick(t)} className="h-5 w-5 cursor-pointer text-[#8B949E] hover:text-white" />
                        <Trash2 onClick={() => handleDeleteClick(t.id)} className="h-5 w-5 cursor-pointer text-[#8B949E] hover:text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-transparent rounded-lg max-w-md w-full p-6 text-white border border-[#30363D] shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{editingTransaction ? 'Edit' : 'Add'} Transaction</h3>
              <button onClick={() => { setShowAddForm(false); setEditingTransaction(null); }} className="text-[#8B949E] hover:text-white"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8B949E] mb-1">Transaction Type</label>
                <select name="transaction_type" value={form.transaction_type} onChange={handleFormChange} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg" required>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                  <option value="DIVIDEND">Dividend</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8B949E] mb-1">Ticker Symbol</label>
                <StockSearchInput
                  value={form.ticker}
                  onChange={(value) => setForm(prev => ({ ...prev, ticker: value }))}
                  onSelectSymbol={(symbol) => {
                    setForm(prev => ({
                      ...prev,
                      ticker: symbol.symbol,
                      company_name: symbol.name,
                      currency: symbol.currency || 'USD',
                      exchange: symbol.region || '',
                    }));
                    // Don't automatically fetch price - wait for user to select date
                  }}
                  placeholder="e.g., AAPL"
                  inputClassName="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg"
                  required
                  error=""
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#8B949E] mb-1">
                    {form.transaction_type === 'DIVIDEND' ? 'Total Shares Owned' : 'Number of Shares'}
                  </label>
                  <input type="number" name="shares" step="1" min="0" value={form.shares} onChange={handleFormChange} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg" required />
                                  </div>
                <div>
                  <label className="block text-sm font-medium text-[#8B949E] mb-1">
                    {form.transaction_type === 'DIVIDEND' ? 'Dividend per Share' : 'Price per Share'}
                    {loadingPrice && <span className="text-blue-400 text-xs ml-2">(fetching...)</span>}
                  </label>
                  <div className="relative">
                    <input 
                      type="number" 
                      name="purchase_price" 
                      step="0.01" 
                      min="0" 
                      value={form.purchase_price} 
                      onChange={handleFormChange} 
                      className={`w-full p-2 bg-transparent border border-[#30363D] rounded-lg ${loadingPrice ? 'opacity-50' : ''}`} 
                      disabled={loadingPrice}
                      required 
                    />
                    {loadingPrice && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      </div>
                    )}
                  </div>
                                  </div>
              </div>
              {/* Amount Invested (read-only) */}
              <div>
                <label className="block text-sm font-medium text-[#8B949E] mb-1">
                  {form.transaction_type === 'DIVIDEND' ? 'Total Dividend' : 'Amount Invested'}
                </label>
                <input
                  type="text"
                  value={formatTransactionCurrency(amountInvested, form.currency || 'USD')}
                  readOnly
                  tabIndex={-1}
                  className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg text-[#8B949E] opacity-80 cursor-not-allowed"
                  aria-readonly="true"
                />
                <p className="text-xs text-[#8B949E] mt-1">Calculated as shares × price per share. This value is sent to the backend for accurate record-keeping.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8B949E] mb-1">Transaction Date</label>
                <input type="date" name="purchase_date" value={form.purchase_date} onChange={handleFormChange} onBlur={handleDateBlur} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg" required />
                              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-[#8B949E] mb-1">Currency</label>
                    <select name="currency" value={form.currency} onChange={handleFormChange} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg">
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="AUD">AUD</option>
                        <option value="CAD">CAD</option>
                        <option value="CHF">CHF</option>
                        <option value="CNY">CNY</option>
                        <option value="JPY">JPY</option>
                    </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#8B949E] mb-1">Commission</label>
                  <input type="number" name="commission" step="0.01" min="0" value={form.commission} onChange={handleFormChange} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg" placeholder="0.00" />
                                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#8B949E] mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleFormChange} className="w-full p-2 bg-transparent border border-[#30363D] rounded-lg" rows={2} placeholder="e.g., Bought on market dip" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setShowAddForm(false); setEditingTransaction(null); }} className="flex-1 px-4 py-2 border border-[#30363D] rounded-lg text-[#8B949E] hover:bg-[#30363D] font-medium">Cancel</button>
                <button type="submit" disabled={isSubmitting || loadingPrice} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                  {isSubmitting ? (editingTransaction ? 'Updating...' : 'Adding...') : (editingTransaction ? 'Update Transaction' : 'Add Transaction')}
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
