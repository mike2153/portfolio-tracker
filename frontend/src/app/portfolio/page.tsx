'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@/types'
import { PlusCircle, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react'
import { apiService } from '@/lib/api'
import { ValidationService } from '@/lib/validation'
import { useToast } from '@/components/ui/Toast'
import {
  PortfolioData,
  Holding,
  StockSymbol,
  AddHoldingFormData,
  FormErrors
} from '@/types/api'

interface HoldingRowProps {
    holding: Holding;
}

const HoldingRow = ({ holding }: HoldingRowProps) => {
    const total_cost = holding.shares * holding.purchase_price;
    const pnl = holding.market_value - total_cost;
    const pnl_percent = total_cost > 0 ? (pnl / total_cost) * 100 : 0;

    const formatCurrency = (value: number) => ValidationService.formatCurrency(value);

    return (
        <tr className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-4 py-3">
                <div className="font-bold text-gray-900">{holding.ticker}</div>
                <div className="text-sm text-gray-600 truncate">{holding.company_name}</div>
            </td>
            <td className="text-right font-medium text-gray-800 px-4 py-3">{ValidationService.formatNumber(holding.shares, 0)}</td>
            <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(holding.market_value)}</td>
            <td className="text-right font-medium text-gray-800 px-4 py-3">{formatCurrency(total_cost)}</td>
            <td className={`text-right font-medium px-4 py-3 ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            </td>
            <td className={`text-right font-medium px-4 py-3 ${pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnl_percent >= 0 ? '+' : ''}{ValidationService.formatNumber(pnl_percent, 2)}%
            </td>
            <td className="text-center px-4 py-3">
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
            </td>
        </tr>
    );
};

// Debounce function
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<F>): Promise<ReturnType<F>> => {
        return new Promise(resolve => {
            if (timeout) {
                clearTimeout(timeout);
            }

            timeout = setTimeout(() => resolve(func(...args)), waitFor);
        });
    };
};

// The main component for the portfolio page
export default function PortfolioPage() {
    const [user, setUser] = useState<User | null>(null);
    const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loadingPrice, setLoadingPrice] = useState(false);
    const [loadingFX, setLoadingFX] = useState(false);
    const [tickerSuggestions, setTickerSuggestions] = useState<StockSymbol[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchCache, setSearchCache] = useState<Record<string, StockSymbol[]>>({});
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { addToast } = useToast();

    const currencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'CNY'];
    
    const initialFormState: AddHoldingFormData = {
        ticker: '',
        company_name: '',
        exchange: '',
        shares: '',
        purchase_price: '',
        purchase_date: new Date().toISOString().split('T')[0],
        commission: '',
        currency: 'USD',
        fx_rate: '1.0',
        use_cash_balance: false,
    };

    const [form, setForm] = useState<AddHoldingFormData>(initialFormState);

    // --- Core Data Fetching ---
    useEffect(() => {
        console.log('[PortfolioPage] Component did mount. Starting user check.');
        checkUserAndFetchData();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('[Auth] Auth state changed. New session:', session);
            const currentUser = session?.user || null;
            setUser(currentUser);
            if (currentUser) {
                fetchPortfolioData(currentUser.id);
            } else {
                setPortfolioData(null);
                setLoading(false);
            }
        });

        return () => {
            console.log('[PortfolioPage] Component will unmount. Cleaning up auth listener.');
            authListener.subscription.unsubscribe();
        };
    }, []);

    const checkUserAndFetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            console.log('[Auth] Initial user check:', user);
            setUser(user);
            if (user) {
                await fetchPortfolioData(user.id);
            }
        } catch (e: any) {
            console.error('[Auth] Error checking user session:', e);
            setError('Failed to check user session.');
            addToast({
                type: 'error',
                title: 'Authentication Error',
                message: 'Failed to check user session. Please try refreshing the page.',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchPortfolioData = async (userId: string) => {
        console.log(`[API] Fetching portfolio data for user: ${userId}`);
        setLoading(true);
        try {
            const response = await apiService.getPortfolio(userId);
            if (response.ok && response.data) {
                console.log('[API] Successfully fetched portfolio data:', response.data);
                setPortfolioData(response.data);
                setError(null);
            } else {
                throw new Error(response.error || 'Failed to fetch portfolio data');
            }
        } catch (e: any) {
            console.error('[API] Failed to fetch portfolio data:', e);
            const errorMessage = `Failed to load portfolio. ${e.message}`;
            setError(errorMessage);
            setPortfolioData(null);
            addToast({
                type: 'error',
                title: 'Portfolio Load Error',
                message: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    // --- Modal Management ---
    const openAddModal = () => {
        console.log('[Modal] Opening "Add Holding" modal.');
        setShowAddModal(true);
        setFormErrors({});
    };

    const closeAddModal = () => {
        console.log('[Modal] Closing "Add Holding" modal. Resetting form state.');
        setShowAddModal(false);
        setForm(initialFormState);
        setTickerSuggestions([]);
        setShowSuggestions(false);
        setFormErrors({});
    };

    // --- Form Handling & Ticker Search ---
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let newValue: string | boolean;
        
        if (type === 'checkbox') {
            newValue = (e.target as HTMLInputElement).checked;
        } else if (name === 'shares' || name === 'purchase_price' || name === 'commission' || name === 'fx_rate') {
            // Sanitize numeric inputs
            newValue = ValidationService.sanitizeNumericInput(value);
        } else {
            newValue = value;
        }
        
        console.log(`[Form] Field '${name}' changed to:`, newValue);
        const updatedForm = { ...form, [name]: newValue };
        setForm(updatedForm);

        // Clear field-specific error when user starts typing
        if (formErrors[name]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
        
        if (name === 'ticker') {
            if (typeof newValue === 'string' && newValue.length > 0) {
                console.log(`[Form] Calling debounced search for "${newValue}"`);
                debouncedSearchTickers(newValue);
            } else {
                console.log('[Form] Ticker is empty, hiding suggestions.');
                setShowSuggestions(false);
                setTickerSuggestions([]);
            }
        }

        // Only fetch price on date change if a stock has been selected
        if (name === 'purchase_date' && form.ticker && form.company_name) {
            console.log(`[Form] Date changed for selected ticker ${form.ticker}. Fetching new price.`);
            fetchStockPrice(form.ticker, value as string);
        }
    };

    const handleTickerFocus = () => {
        if (form.ticker.length > 0 && tickerSuggestions.length > 0) {
            console.log('[Form] Ticker input focused, showing suggestions.');
            setShowSuggestions(true);
        }
    };

    const handleTickerBlur = () => {
        // Delay hiding suggestions to allow for click on a suggestion
        setTimeout(() => {
            console.log('[Form] Ticker input blurred, hiding suggestions.');
            setShowSuggestions(false);
        }, 150);
    };

    const searchTickers = async (query: string) => {
        const trimmedQuery = query.trim().toUpperCase();
        if (trimmedQuery.length < 1) return;

        // Check cache first
        if (searchCache[trimmedQuery]) {
            console.log(`[Search-Cache] Found results for "${trimmedQuery}" in cache.`);
            setTickerSuggestions(searchCache[trimmedQuery]);
            setShowSuggestions(true);
            return;
        }
        
        console.log(`[Search] Searching for ticker: "${trimmedQuery}"`);
        setSearchLoading(true);
        try {
            const response = await apiService.searchSymbols(trimmedQuery, 10);
            if (response.ok && response.data) {
                const results = response.data.results || [];
                console.log(`[Search] Received ${results.length} suggestions for "${trimmedQuery}":`, results);
                
                // Update cache only if results are found
                if (results.length > 0) {
                    setSearchCache(prevCache => ({...prevCache, [trimmedQuery]: results}));
                }

                setTickerSuggestions(results);
                setShowSuggestions(true);
            } else {
                console.error(`[Search] API error for query "${trimmedQuery}":`, response.error);
                setTickerSuggestions([]);
                addToast({
                    type: 'warning',
                    title: 'Search Error',
                    message: `Failed to search for "${trimmedQuery}". ${response.error}`,
                });
            }
        } catch (error) {
            console.error(`[Search] Network error searching for "${trimmedQuery}":`, error);
            addToast({
                type: 'error',
                title: 'Network Error',
                message: 'Failed to search for stocks. Please check your connection.',
            });
        } finally {
            setSearchLoading(false);
        }
    };
    
    const debouncedSearchTickers = useCallback(debounce(searchTickers, 300), [searchCache]);

    const selectTicker = (suggestion: StockSymbol) => {
        console.log('[Form] Ticker selected from suggestions:', suggestion);
        const newFormState = {
            ...form,
            ticker: suggestion.symbol,
            company_name: suggestion.name,
            exchange: suggestion.exchange || suggestion.exchange_code,
        };
        setForm(newFormState);
        setShowSuggestions(false);
        setTickerSuggestions([]);

        // Fetch price immediately on ticker selection
        console.log(`[Form] Ticker selected. Fetching price for ${suggestion.symbol} on ${newFormState.purchase_date}.`);
        fetchStockPrice(suggestion.symbol, newFormState.purchase_date);
    };

    // --- Price & FX Rate Fetching ---
    const fetchStockPrice = async (ticker: string, purchase_date: string) => {
        if (!ticker || !purchase_date) return;
        
        console.log(`[Price] Fetching price for ${ticker} on ${purchase_date}`);
        setLoadingPrice(true);
        try {
            const historicalResponse = await apiService.getHistoricalData(ticker, '5Y');
            if (historicalResponse.ok && historicalResponse.data) {
                const historicalData = historicalResponse.data;
                const targetDate = new Date(purchase_date);
                
                let closestPrice: number | null = null;
                let closestDateDiff = Infinity;
                
                for (const dataPoint of historicalData.data || []) {
                    const dataDate = new Date(dataPoint.date);
                    const diffDays = Math.abs((targetDate.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < closestDateDiff && dataDate <= targetDate) {
                        closestDateDiff = diffDays;
                        closestPrice = dataPoint.close;
                    }
                }
                
                if (closestPrice !== null) {
                    console.log(`[Price] Found historical price for ${ticker}: ${closestPrice} (off by ${closestDateDiff.toFixed(0)} days)`);
                    setForm(prev => ({ ...prev, purchase_price: closestPrice!.toFixed(2) }));
                    setLoadingPrice(false);
                    return;
                }
            }
            
            console.log(`[Price] No historical price found for ${ticker} on ${purchase_date}. Falling back to current quote.`);
            const currentResponse = await apiService.getStockOverview(ticker);
            if (currentResponse.ok && currentResponse.data) {
                const currentPrice = currentResponse.data.data?.price;
                if (currentPrice) {
                    console.log(`[Price] Found fallback current price for ${ticker}: ${currentPrice}`);
                    setForm(prev => ({ ...prev, purchase_price: currentPrice.toFixed(2) }));
                }
            }
        } catch (error) {
            console.error(`[Price] Error fetching stock price for ${ticker}:`, error);
            addToast({
                type: 'warning',
                title: 'Price Fetch Error',
                message: `Could not fetch price for ${ticker}. Please enter manually.`,
            });
        } finally {
            setLoadingPrice(false);
        }
    };

    const fetchFXRate = async () => {
        if (form.currency === 'USD') {
            console.log('[FX] Currency is USD, setting rate to 1.0');
            setForm(prev => ({ ...prev, fx_rate: '1.0' }));
            return;
        }
        
        console.log(`[FX] Fetching exchange rate for ${form.currency}`);
        setLoadingFX(true);
        try {
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
            if (response.ok) {
                const data = await response.json();
                const rate = data.rates[form.currency];
                if (rate) {
                    const fxRate = (1 / rate).toFixed(4);
                    console.log(`[FX] Successfully fetched rate for ${form.currency}: ${fxRate}`);
                    setForm(prev => ({ ...prev, fx_rate: fxRate }));
                }
            }
        } catch (error) {
            console.error(`[FX] Error fetching FX rate for ${form.currency}:`, error);
            addToast({
                type: 'warning',
                title: 'Exchange Rate Error',
                message: `Could not fetch exchange rate for ${form.currency}. Please enter manually.`,
            });
        } finally {
            setLoadingFX(false);
        }
    };

    useEffect(() => { 
        fetchFXRate(); 
    }, [form.currency]);

    // --- Form Submission ---
    const handleAddHoldingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log('[Submit] "Add Holding" form submitted.');

        // Validate form
        const errors = ValidationService.validateAddHoldingForm(form);
        if (ValidationService.hasErrors(errors)) {
            console.warn('[Submit] Validation errors found:', errors);
            setFormErrors(errors);
            addToast({
                type: 'error',
                title: 'Validation Error',
                message: 'Please correct the errors in the form.',
            });
            return;
        }

        setIsSubmitting(true);
        const payload = {
            ticker: form.ticker.toUpperCase(),
            company_name: form.company_name,
            exchange: form.exchange,
            shares: parseFloat(form.shares),
            purchase_price: parseFloat(form.purchase_price),
            purchase_date: form.purchase_date,
            commission: form.commission ? parseFloat(form.commission) : 0,
            currency: form.currency,
            fx_rate: form.fx_rate ? parseFloat(form.fx_rate) : 1.0,
            use_cash_balance: form.use_cash_balance,
        };
        console.log('[Submit] Payload prepared for API:', payload);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            addToast({
                type: 'error',
                title: 'Authentication Required',
                message: 'You must be signed in to add a holding.',
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const response = await apiService.addHolding(user.id, payload);

            if (response.ok) {
                console.log('[Submit] Successfully added holding. Closing modal and reloading data.');
                addToast({
                    type: 'success',
                    title: 'Holding Added',
                    message: `Successfully added ${form.shares} shares of ${form.ticker}.`,
                });
                closeAddModal();
                fetchPortfolioData(user.id);
            } else {
                console.error('[Submit] API error on holding submission:', response.error);
                addToast({
                    type: 'error',
                    title: 'Failed to Add Holding',
                    message: response.error || 'An error occurred while adding the holding.',
                });
            }
        } catch (error) {
            console.error('[Submit] Network error on holding submission:', error);
            addToast({
                type: 'error',
                title: 'Network Error',
                message: 'A network error occurred. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Helper Components ---
    const FormField = ({ 
        label, 
        name, 
        children, 
        required = false, 
        error 
    }: { 
        label: string; 
        name: string; 
        children: React.ReactNode; 
        required?: boolean; 
        error?: string; 
    }) => (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );

    // --- Modal Rendering Logic ---
    let addHoldingModal = null;
    if (showAddModal) {
        console.log(`[Render-Modal] Rendering AddHoldingModal. Suggestions visible: ${showSuggestions}, Count: ${tickerSuggestions.length}`);
        addHoldingModal = (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Add Stock Holding</h2>
                            <button 
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1" 
                                onClick={closeAddModal}
                                disabled={isSubmitting}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleAddHoldingSubmit} className="p-6 space-y-6">
                        {/* Ticker Search */}
                        <FormField 
                            label="Stock Ticker" 
                            name="ticker" 
                            required 
                            error={formErrors.ticker}
                        >
                            <div className="relative">
                                <input 
                                    name="ticker" 
                                    value={form.ticker} 
                                    onChange={handleFormChange}
                                    onFocus={handleTickerFocus}
                                    onBlur={handleTickerBlur}
                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono uppercase ${
                                        formErrors.ticker ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder="e.g., AAPL, MSFT, GOOGL"
                                    required 
                                    autoComplete="off"
                                    disabled={isSubmitting}
                                />
                                {searchLoading && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                            </div>
                            
                            {showSuggestions && tickerSuggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {tickerSuggestions.map((suggestion, index) => (
                                        <div
                                            key={index}
                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                            onClick={() => selectTicker(suggestion)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-semibold text-gray-900 font-mono">{suggestion.symbol}</div>
                                                    <div className="text-sm text-gray-600 line-clamp-2">{suggestion.name}</div>
                                                </div>
                                                <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                                    {suggestion.exchange_code}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </FormField>

                        {/* Company Name */}
                        <FormField label="Company Name" name="company_name">
                            <input 
                                name="company_name" 
                                value={form.company_name} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                                placeholder="Auto-filled from ticker search"
                                readOnly
                            />
                        </FormField>

                        {/* Exchange */}
                        <FormField label="Exchange" name="exchange">
                            <input 
                                name="exchange" 
                                value={form.exchange} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                                placeholder="Auto-filled from ticker search"
                                readOnly
                            />
                        </FormField>

                        {/* Shares */}
                        <FormField 
                            label="Number of Shares" 
                            name="shares" 
                            required 
                            error={formErrors.shares}
                        >
                            <input 
                                name="shares" 
                                type="text"
                                value={form.shares} 
                                onChange={handleFormChange}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                    formErrors.shares ? 'border-red-300' : 'border-gray-300'
                                }`}
                                placeholder="e.g., 100"
                                required 
                                disabled={isSubmitting}
                            />
                        </FormField>

                        {/* Purchase Date */}
                        <FormField 
                            label="Purchase Date" 
                            name="purchase_date" 
                            required 
                            error={formErrors.purchase_date}
                        >
                            <input 
                                name="purchase_date" 
                                type="date" 
                                value={form.purchase_date} 
                                onChange={handleFormChange}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                    formErrors.purchase_date ? 'border-red-300' : 'border-gray-300'
                                }`}
                                required 
                                disabled={isSubmitting}
                            />
                        </FormField>

                        {/* Purchase Price */}
                        <FormField 
                            label="Purchase Price" 
                            name="purchase_price" 
                            required 
                            error={formErrors.purchase_price}
                        >
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</div>
                                <input 
                                    name="purchase_price" 
                                    type="text"
                                    value={form.purchase_price} 
                                    onChange={handleFormChange}
                                    className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                        formErrors.purchase_price ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder="0.00"
                                    required 
                                    disabled={loadingPrice || isSubmitting}
                                />
                                {loadingPrice && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                            </div>
                            {loadingPrice && <div className="text-xs text-blue-600 mt-1">Auto-filling price for selected date...</div>}
                        </FormField>

                        {/* Commission */}
                        <FormField 
                            label="Commission (Optional)" 
                            name="commission" 
                            error={formErrors.commission}
                        >
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</div>
                                <input 
                                    name="commission" 
                                    type="text"
                                    value={form.commission} 
                                    onChange={handleFormChange}
                                    className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                        formErrors.commission ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                    placeholder="0.00"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </FormField>

                        {/* Currency */}
                        <FormField label="Currency" name="currency">
                            <select 
                                name="currency" 
                                value={form.currency} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                disabled={isSubmitting}
                            >
                                {currencies.map((cur) => (
                                    <option key={cur} value={cur}>{cur}</option>
                                ))}
                            </select>
                        </FormField>

                        {/* FX Rate */}
                        {form.currency !== 'USD' && (
                            <FormField 
                                label="Currency Conversion Rate (to USD)" 
                                name="fx_rate" 
                                error={formErrors.fx_rate}
                            >
                                <div className="relative">
                                    <input 
                                        name="fx_rate" 
                                        type="text"
                                        value={form.fx_rate} 
                                        onChange={handleFormChange}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                            formErrors.fx_rate ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                        disabled={loadingFX || isSubmitting}
                                    />
                                    {loadingFX && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                        </div>
                                    )}
                                </div>
                                {loadingFX && <div className="text-xs text-blue-600 mt-1">Fetching current exchange rate...</div>}
                            </FormField>
                        )}

                        {/* Use Cash Balance */}
                        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                            <input 
                                name="use_cash_balance" 
                                type="checkbox" 
                                checked={form.use_cash_balance} 
                                onChange={handleFormChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                disabled={isSubmitting}
                            />
                            <label className="ml-3 text-sm font-medium text-gray-700">
                                Use cash balance to purchase shares
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button 
                                type="button" 
                                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50" 
                                onClick={closeAddModal}
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
                                        Adding...
                                    </>
                                ) : (
                                    'Add Holding'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
    
    // --- Main Component Rendering ---
    console.log(`[Render] Rendering PortfolioPage. State:`, { loading, error: !!error, user: !!user, portfolioData: !!portfolioData });

    if (loading && !portfolioData) {
        return (
            <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                Loading portfolio...
                {addHoldingModal}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10 text-red-500">
                <div className="mb-4">
                    <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error: {error}
                </div>
                <button 
                    onClick={() => user && fetchPortfolioData(user.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Retry
                </button>
                {addHoldingModal}
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-10">
                <p>Please sign in to view your portfolio.</p>
                {addHoldingModal}
            </div>
        );
    }

    if (!portfolioData || portfolioData.holdings.length === 0) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold mb-2">Your portfolio is empty.</h2>
                <p className="text-gray-600 mb-4">Add your first holding to get started.</p>
                <button className="btn-primary" onClick={openAddModal}>
                    <PlusCircle className="mr-2" size={20} /> Add Holding
                </button>
                {addHoldingModal}
            </div>
        );
    }

    const { holdings, summary, cash_balance } = portfolioData;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">My Portfolio</h1>
                <button className="btn-primary flex items-center" onClick={openAddModal}>
                    <PlusCircle className="mr-2" size={20} /> Add New Holding
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="metric-card">
                    <div className="metric-label">Total Portfolio Value</div>
                    <div className="metric-value text-blue-600">{ValidationService.formatCurrency(summary.total_value)}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Number of Holdings</div>
                    <div className="metric-value">{summary.total_holdings}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Cash Balance</div>
                    <div className="metric-value">{ValidationService.formatCurrency(cash_balance)}</div>
                </div>
            </div>

            {/* Holdings Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left font-semibold text-gray-600 px-4 py-3">Stock</th>
                            <th className="text-right font-semibold text-gray-600 px-4 py-3">Quantity</th>
                            <th className="text-right font-semibold text-gray-600 px-4 py-3">Market Value</th>
                            <th className="text-right font-semibold text-gray-600 px-4 py-3">Cost Basis</th>
                            <th className="text-right font-semibold text-gray-600 px-4 py-3">P/L ($)</th>
                            <th className="text-right font-semibold text-gray-600 px-4 py-3">% Gain/Loss</th>
                            <th className="text-center font-semibold text-gray-600 px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {holdings.map(holding => (
                            <HoldingRow key={holding.id} holding={holding} />
                        ))}
                    </tbody>
                </table>
            </div>

            {addHoldingModal}
        </div>
    );
} 