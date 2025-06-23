'use client'

import { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@/types'
import { PlusCircle, Trash2, Edit, ChevronDown, ChevronUp, MoreVertical, X, Loader2 } from 'lucide-react'
import { apiService } from '@/lib/api'
import { ValidationService } from '@/lib/validation'
import { useToast } from '@/components/ui/Toast'
import {
    PortfolioData,
    Holding,
    StockSymbol,
    AddHoldingFormData,
    AddHoldingPayload,
    FormErrors
} from '@/types/api'

interface HoldingRowProps {
    holding: Holding;
    onEdit: (holding: Holding) => void;
    onRemove: (holding: Holding) => void;
}

const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

export default function PortfolioPage() {
    const [user, setUser] = useState<User | null>(null);
    const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showHoldingModal, setShowHoldingModal] = useState(false);
    const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tickerSuggestions, setTickerSuggestions] = useState<StockSymbol[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchCache, setSearchCache] = useState<Record<string, StockSymbol[]>>({});
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    
    // Track the previous date value to determine if user actually changed the date
    const previousDateRef = useRef<string>('');

    const { addToast } = useToast();
    
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
    };

    const [form, setForm] = useState<AddHoldingFormData>(initialFormState);

    const fetchPortfolioData = useCallback(async (userId: string) => {
        try {
            setLoading(true);
            const response = await apiService.getPortfolio(userId);
            if (response.ok && response.data !== undefined) {
                setPortfolioData(response.data);
            } else {
                setError(response.error || 'Failed to fetch portfolio data');
                setPortfolioData(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setPortfolioData(null);
            addToast({
                type: 'error',
                title: 'Error Fetching Portfolio',
                message: err instanceof Error ? err.message : 'Could not load portfolio data.',
            });
        } finally {
            setLoading(false);
        }
    }, [addToast]);
    
    const checkUserAndFetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setUser(session.user);
            await fetchPortfolioData(session.user.id);
        } else {
            setLoading(false);
        }
    }, [fetchPortfolioData]);

    useEffect(() => {
        checkUserAndFetchData();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
                fetchPortfolioData(session.user.id);
            } else {
                setUser(null);
                setPortfolioData(null);
            }
        });
        return () => subscription.unsubscribe();
    }, [checkUserAndFetchData, fetchPortfolioData]);

    // Fetch closing price for the selected date when date picker is closed
    const fetchClosingPriceForDate = useCallback(async (ticker: string, date: string) => {
        if (!ticker || !date) return;
        
        setLoadingPrice(true);
        try {
            const response = await apiService.getHistoricalData(ticker, 'max');
            if (response.ok && response.data && response.data.data) {
                const match = response.data.data.find((d: any) => d.date === date);
                if (match) {
                    setForm(prev => ({ ...prev, purchase_price: match.close.toString() }));
                    addToast({
                        type: 'success',
                        title: 'Price Found',
                        message: `Set purchase price to closing price of $${match.close} for ${date}`,
                    });
                } else {
                    addToast({
                        type: 'warning',
                        title: 'Price Not Found',
                        message: `No closing price found for ${ticker} on ${date}. Please enter manually.`,
                    });
                }
            }
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Price Fetch Failed',
                message: `Could not fetch closing price for ${ticker} on ${date}`,
            });
        } finally {
            setLoadingPrice(false);
        }
    }, [addToast]);

    const openAddModal = () => {
        addToast({
            type: 'info',
            title: 'Action Moved',
            message: 'Please add new transactions from the Transactions page.',
        });
    };

    const openEditModal = (holding: Holding) => {
        setEditingHolding(holding);
        const purchaseDate = holding.purchase_date ? holding.purchase_date.split('T')[0] : '';
        setForm({
            ticker: holding.ticker,
            company_name: holding.company_name,
            exchange: '',
            shares: String(holding.shares),
            purchase_price: String(holding.purchase_price),
            purchase_date: purchaseDate,
            commission: String(holding.commission || '0'),
            currency: holding.currency || 'USD',
            fx_rate: String(holding.fx_rate || '1.0'),
            use_cash_balance: !!holding.used_cash_balance,
        });
        setShowHoldingModal(true);
        setFormErrors({});
        previousDateRef.current = purchaseDate;
    };

    const closeHoldingModal = () => {
        setShowHoldingModal(false);
        setEditingHolding(null);
        setForm(initialFormState);
        setTickerSuggestions([]);
        setShowSuggestions(false);
        setFormErrors({});
        previousDateRef.current = '';
    };

    const handleMenuToggle = (holdingId: number) => {
        setOpenMenuId(prevId => (prevId === holdingId ? null : holdingId));
    };

    const validateForm = (): boolean => {
        const errors: FormErrors = {};
        
        if (!form.ticker.trim()) {
            errors.ticker = 'Stock ticker is required';
        }
        
        if (!form.shares || Number(form.shares) <= 0) {
            errors.shares = 'Shares must be greater than 0';
        }
        
        if (!form.purchase_price || Number(form.purchase_price) <= 0) {
            errors.purchase_price = 'Purchase price must be greater than 0';
        }
        
        if (!form.purchase_date) {
            errors.purchase_date = 'Purchase date is required';
        }
        
        if (Number(form.commission) < 0) {
            errors.commission = 'Commission cannot be negative';
        }
        
        if (!form.fx_rate || Number(form.fx_rate) <= 0) {
            errors.fx_rate = 'Exchange rate must be greater than 0';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;
    
        setForm(prev => ({
            ...prev,
            [name]: isCheckbox ? checked : value
        }));

        // Clear specific field error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const previousDate = form.purchase_date;
        setForm(prev => ({ ...prev, purchase_date: value }));
        
        // Clear date error
        if (formErrors.purchase_date) {
            setFormErrors(prev => ({ ...prev, purchase_date: '' }));
        }

        // Store the previous date to compare on blur
        previousDateRef.current = previousDate;
    };

    const handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const currentDate = e.target.value;
        const previousDate = previousDateRef.current;
        const todayDate = new Date().toISOString().split('T')[0];
        
        // Only fetch closing price if:
        // 1. We have a ticker and purchase date
        // 2. The date actually changed from the previous value
        // 3. The selected date is not today's date
        // 4. User wants to fetch historical price (both add and edit modes)
        if (form.ticker && 
            currentDate && 
            currentDate !== previousDate && 
            currentDate !== todayDate) {
            fetchClosingPriceForDate(form.ticker, currentDate);
        }
    };

    const handleTickerSearch = useCallback(debounce(async (query: string) => {
        if (query.length < 1) {
            setTickerSuggestions([]);
            return;
        }
        if (searchCache[query]) {
            setTickerSuggestions(searchCache[query]);
            return;
        }
        setSearchLoading(true);
        try {
            const response = await apiService.searchSymbols(query);
            if (response.ok && response.data !== undefined) {
                setTickerSuggestions(response.data.results);
                setSearchCache(prev => ({ ...prev, [query]: response.data!.results }));
            } else {
                setTickerSuggestions([]);
            }
        } catch (error) {
            setTickerSuggestions([]);
        } finally {
            setSearchLoading(false);
        }
    }, 300), [searchCache]);

    const handleTickerFocus = () => setShowSuggestions(true);
    const handleTickerBlur = () => setTimeout(() => setShowSuggestions(false), 200);

    const handleSuggestionClick = async (symbol: StockSymbol) => {
        setForm(prev => ({
            ...prev,
            ticker: symbol.symbol,
            company_name: symbol.name,
            exchange: symbol.exchange,
            purchase_price: '',
        }));
        setTickerSuggestions([]);
        setShowSuggestions(false);
        
        // Clear ticker error
        if (formErrors.ticker) {
            setFormErrors(prev => ({ ...prev, ticker: '' }));
        }

        // Note: We don't automatically fetch price here anymore
        // Price will only be fetched when user changes the date via calendar
    };
    
    const handleAddHoldingSubmit = async () => {
        if (!user || !validateForm()) return;

        setIsSubmitting(true);
        try {
            const payload: AddHoldingPayload = {
                ticker: form.ticker.toUpperCase(),
                company_name: form.company_name,
                exchange: form.exchange,
                shares: Number(form.shares),
                purchase_price: Number(form.purchase_price),
                purchase_date: form.purchase_date,
                commission: Number(form.commission),
                currency: form.currency,
                fx_rate: Number(form.fx_rate),
                use_cash_balance: form.use_cash_balance,
            };

            const response = await apiService.addHolding(user.id, payload);
            
            if (response.ok) {
                addToast({
                    type: 'success',
                    title: 'Stock Added',
                    message: `Successfully added ${payload.shares} shares of ${payload.ticker}`,
                });
                closeHoldingModal();
                await fetchPortfolioData(user.id);
            } else {
                addToast({
                    type: 'error',
                    title: 'Failed to Add Stock',
                    message: response.error || 'Could not add stock to portfolio',
                });
            }
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Error',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateHoldingSubmit = async () => {
        if (!user || !editingHolding || !validateForm()) return;

        setIsSubmitting(true);
        try {
            const payload: AddHoldingPayload = {
                ticker: form.ticker.toUpperCase(),
                company_name: form.company_name,
                exchange: form.exchange,
                shares: Number(form.shares),
                purchase_price: Number(form.purchase_price),
                purchase_date: form.purchase_date,
                commission: Number(form.commission),
                currency: form.currency,
                fx_rate: Number(form.fx_rate),
                use_cash_balance: form.use_cash_balance,
            };

            const response = await apiService.updateHolding(user.id, editingHolding.id, payload);
            
            if (response.ok) {
                addToast({
                    type: 'success',
                    title: 'Stock Updated',
                    message: `Successfully updated ${payload.shares} shares of ${payload.ticker}`,
                });
                closeHoldingModal();
                await fetchPortfolioData(user.id);
            } else {
                addToast({
                    type: 'error',
                    title: 'Failed to Update Stock',
                    message: response.error || 'Could not update stock holding',
                });
            }
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Error',
                message: error instanceof Error ? error.message : 'An unexpected error occurred',
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingHolding) {
            await handleUpdateHoldingSubmit();
        } else {
            await handleAddHoldingSubmit();
        }
    };

    // Remove holding handler
    const handleRemoveHolding = async (holding: Holding) => {
        if (!user) return;
        const confirmed = window.confirm(`Remove ${holding.ticker}?`);
        if (!confirmed) return;
        const response = await apiService.deleteHolding(user.id, holding.id);
        if (response.ok) {
            addToast({ type: 'success', title: 'Removed', message: `${holding.ticker} removed.` });
            fetchPortfolioData(user.id);
        } else {
            addToast({ type: 'error', title: 'Error', message: response.error || 'Failed to remove holding.' });
        }
    };

    // Add helper for percent formatting if not present
    const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${ValidationService.formatNumber(value, 2)}%`;

    // Calculate total return $ and %
    const totalReturnDollars = portfolioData?.holdings.reduce((sum, h) => {
        const currentPrice = h.current_price || h.purchase_price;
        return sum + (currentPrice - h.purchase_price) * h.shares;
    }, 0) || 0;
    const totalCost = portfolioData?.holdings.reduce((sum, h) => sum + h.purchase_price * h.shares, 0) || 0;
    const totalReturnPercent = totalCost > 0 ? (totalReturnDollars / totalCost) * 100 : 0;

    const HoldingRow = ({ holding, onEdit, onRemove }: HoldingRowProps) => {
        const total_cost = holding.shares * holding.purchase_price;
        // Use the current_price from the holding data directly, fallback to purchase_price if not available
        const currentPrice = holding.current_price || holding.purchase_price;
        
        const pnl = holding.market_value - total_cost;
        const pnl_percent = total_cost > 0 ? (pnl / total_cost) * 100 : 0;
        const returnDollar = (currentPrice - holding.purchase_price) * holding.shares;
        const returnPercent = holding.purchase_price > 0 ? ((currentPrice - holding.purchase_price) / holding.purchase_price) * 100 : 0;
        const formatCurrency = (value: number) => ValidationService.formatCurrency(value);
        const isMenuOpen = openMenuId === holding.id;
    
        return (
            <tr className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{holding.ticker}</div>
                    <div className="text-sm text-gray-600 truncate">{holding.company_name}</div>
                </td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{ValidationService.formatNumber(holding.shares, 0)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(holding.purchase_price)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(currentPrice)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(holding.market_value)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(total_cost)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(returnDollar)}</td>
                <td className="text-right font-medium text-gray-800 px-4 py-3">{formatPercent(returnPercent)}</td>
                <td className={`text-right font-medium px-4 py-3 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</td>
                <td className={`text-right font-medium px-4 py-3 ${pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>{pnl_percent >= 0 ? '+' : ''}{ValidationService.formatNumber(pnl_percent, 2)}%</td>
                <td className="text-center px-4 py-3 relative">
                    <button 
                        onClick={() => handleMenuToggle(holding.id)} 
                        className="p-2 rounded-full hover:bg-gray-100"
                    >
                        <MoreVertical size={16} />
                    </button>
                    {isMenuOpen && (
                        <div 
                            className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border border-gray-100"
                            onMouseLeave={() => setOpenMenuId(null)}
                        >
                            <button 
                                onClick={() => { onEdit(holding); handleMenuToggle(holding.id); }} 
                                className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                                <Edit size={14} className="mr-2" />
                                Modify
                            </button>
                            <button 
                                onClick={() => { onRemove(holding); handleMenuToggle(holding.id); }} 
                                className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            >
                                <Trash2 size={14} className="mr-2" />
                                Remove
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    const holdings = portfolioData?.holdings || [];
    
    // Modal rendering logic
    const isEditing = !!editingHolding;
    const totalAmount = Number(form.shares) * Number(form.purchase_price);
    const holdingModal = showHoldingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Stock Holding' : 'Add Stock Holding'}</h2>
                        <button 
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1" 
                            onClick={closeHoldingModal}
                            disabled={isSubmitting}
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>
                <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
                    {/* Ticker Search */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock Ticker</label>
                        <div className="relative">
                            <input
                                name="ticker"
                                value={form.ticker}
                                onChange={e => {
                                    handleFormChange(e);
                                    if (!isEditing) handleTickerSearch(e.target.value);
                                }}
                                onFocus={handleTickerFocus}
                                onBlur={handleTickerBlur}
                                disabled={isEditing || isSubmitting}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono uppercase ${formErrors.ticker ? 'border-red-300' : 'border-gray-300'}`}
                                placeholder="e.g., AAPL, MSFT, GOOGL"
                                required
                                autoComplete="off"
                            />
                            {searchLoading && !isEditing && (
                                <div className="absolute right-3 top-3"><Loader2 className="animate-spin" size={18} /></div>
                            )}
                            {showSuggestions && tickerSuggestions.length > 0 && !isEditing && (
                                <ul className="absolute left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-20 max-h-48 overflow-y-auto">
                                    {tickerSuggestions.map(s => (
                                        <li
                                            key={s.symbol}
                                            className="px-4 py-2 cursor-pointer hover:bg-blue-50"
                                            onMouseDown={() => handleSuggestionClick(s)}
                                        >
                                            <span className="font-mono font-bold">{s.symbol}</span> <span className="text-gray-600">{s.name}</span> <span className="text-xs text-gray-400">{s.exchange} ({s.exchange_code})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {formErrors.ticker && <div className="text-xs text-red-500 mt-1">{formErrors.ticker}</div>}
                    </div>

                    {/* Purchase Date */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                        <input
                            name="purchase_date"
                            type="date"
                            value={form.purchase_date}
                            onChange={handleDateChange}
                            onBlur={handleDateBlur}
                            disabled={isSubmitting}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${formErrors.purchase_date ? 'border-red-300' : 'border-gray-300'}`}
                            required
                        />
                        {formErrors.purchase_date && <div className="text-xs text-red-500 mt-1">{formErrors.purchase_date}</div>}
                    </div>

                    {/* Purchase Price */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Purchase Price
                            {loadingPrice && <span className="ml-2 text-xs text-blue-600">(Fetching closing price...)</span>}
                        </label>
                        <div className="relative">
                            <input
                                name="purchase_price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.purchase_price}
                                onChange={handleFormChange}
                                disabled={isSubmitting || loadingPrice}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${formErrors.purchase_price ? 'border-red-300' : 'border-gray-300'} ${loadingPrice ? 'bg-gray-50' : ''}`}
                                placeholder="0.00"
                                required
                            />
                            {loadingPrice && (
                                <div className="absolute right-3 top-3"><Loader2 className="animate-spin" size={18} /></div>
                            )}
                        </div>
                        {formErrors.purchase_price && <div className="text-xs text-red-500 mt-1">{formErrors.purchase_price}</div>}
                        <div className="text-xs text-gray-500 mt-1">
                            {isEditing 
                                ? "Change the purchase date to automatically fetch the closing price for that day"
                                : "Select a purchase date to automatically fetch the closing price for that day"
                            }
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                        <input
                            name="shares"
                            type="number"
                            min="0"
                            step="1"
                            value={form.shares}
                            onChange={handleFormChange}
                            disabled={isSubmitting}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${formErrors.shares ? 'border-red-300' : 'border-gray-300'}`}
                            placeholder="0"
                            required
                        />
                        {formErrors.shares && <div className="text-xs text-red-500 mt-1">{formErrors.shares}</div>}
                    </div>

                    {/* Commission */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Commission</label>
                        <input
                            name="commission"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.commission}
                            onChange={handleFormChange}
                            disabled={isSubmitting}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${formErrors.commission ? 'border-red-300' : 'border-gray-300'}`}
                            placeholder="0.00"
                        />
                        {formErrors.commission && <div className="text-xs text-red-500 mt-1">{formErrors.commission}</div>}
                    </div>

                    {/* Use Cash Balance */}
                    <div className="mb-4 flex items-center">
                        <input
                            id="use_cash_balance"
                            name="use_cash_balance"
                            type="checkbox"
                            checked={form.use_cash_balance}
                            onChange={handleFormChange}
                            disabled={isSubmitting}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="use_cash_balance" className="ml-2 block text-sm text-gray-700">Use Cash Balance</label>
                    </div>

                    {/* Currency */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                        <select
                            name="currency"
                            value={form.currency}
                            onChange={handleFormChange}
                            disabled={isSubmitting}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="GBP">GBP</option>
                            <option value="JPY">JPY</option>
                            <option value="CAD">CAD</option>
                            <option value="AUD">AUD</option>
                            <option value="CHF">CHF</option>
                            <option value="HKD">HKD</option>
                            <option value="SGD">SGD</option>
                            <option value="CNY">CNY</option>
                        </select>
                    </div>

                    {/* Exchange Rate on Date */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Exchange Rate on Date</label>
                        <input
                            name="fx_rate"
                            type="number"
                            min="0"
                            step="0.0001"
                            value={form.fx_rate}
                            onChange={handleFormChange}
                            disabled={isSubmitting}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${formErrors.fx_rate ? 'border-red-300' : 'border-gray-300'}`}
                            placeholder="1.0"
                        />
                        {formErrors.fx_rate && <div className="text-xs text-red-500 mt-1">{formErrors.fx_rate}</div>}
                    </div>

                    {/* Total Amount */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                        <input
                            type="text"
                            value={isNaN(totalAmount) ? '' : totalAmount.toLocaleString(undefined, { style: 'currency', currency: form.currency || 'USD' })}
                            readOnly
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 font-semibold"
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <button 
                            type="button" 
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50" 
                            onClick={closeHoldingModal}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    {isEditing ? 'Updating...' : 'Adding...'}
                                </>
                            ) : (
                                isEditing ? 'Update Holding' : 'Confirm Stock'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" />
                        <p className="text-gray-600">Loading your portfolio...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Log In</h1>
                    <p className="text-gray-600">You need to be logged in to view your portfolio.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                    <p className="text-gray-600">{error}</p>
                    <button 
                        onClick={() => fetchPortfolioData(user.id)}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">My Portfolio</h1>
                <button className="btn-primary flex items-center" onClick={openAddModal}>
                    <PlusCircle className="mr-2" size={20} /> Add New Holding
                </button>
            </div>
            
            {holdings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">No Holdings Yet</h2>
                    <p className="text-gray-500 mb-6">Start building your portfolio by adding your first stock holding.</p>
                    <button className="btn-primary flex items-center mx-auto" onClick={openAddModal}>
                        <PlusCircle className="mr-2" size={20} /> Add Your First Stock
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="text-left px-4 py-3">Asset</th>
                                <th className="text-right px-4 py-3">Shares</th>
                                <th className="text-right px-4 py-3">Purchase Price</th>
                                <th className="text-right px-4 py-3">Current Price</th>
                                <th className="text-right px-4 py-3">Market Value</th>
                                <th className="text-right px-4 py-3">Total Cost</th>
                                <th className="text-right px-4 py-3">Return $</th>
                                <th className="text-right px-4 py-3">Return %</th>
                                <th className="text-right px-4 py-3">Gain / Loss</th>
                                <th className="text-right px-4 py-3">% Change</th>
                                <th className="text-center px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {holdings.map(holding => (
                                <HoldingRow 
                                    key={holding.id} 
                                    holding={holding}
                                    onEdit={openEditModal}
                                    onRemove={handleRemoveHolding}
                                />
                            ))}
                        </tbody>
                        {/* Summary row for total PnL */}
                        <tfoot>
                            <tr className="bg-gray-100 font-bold">
                                <td className="px-4 py-3 text-right" colSpan={6}>Total PnL</td>
                                <td className="text-right px-4 py-3">{ValidationService.formatCurrency(totalReturnDollars)}</td>
                                <td className="text-right px-4 py-3">{formatPercent(totalReturnPercent)}</td>
                                <td colSpan={3}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
            
            {holdingModal}
        </div>
    );
} 