'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@/types'
import { PlusCircle, Trash2, Edit, ChevronDown, ChevronUp } from 'lucide-react'

// Define interfaces for our data structures
interface Holding {
    id: number;
    ticker: string;
    company_name: string;
    shares: number;
    purchase_price: number;
    market_value: number;
    current_price: number;
}

interface PortfolioData {
    cash_balance: number;
    holdings: Holding[];
    summary: {
        total_holdings: number;
        total_value: number;
    };
}

// A single row in our holdings table
const HoldingRow = ({ holding }: { holding: Holding }) => {
    const costBasis = holding.shares * holding.purchase_price;
    const pnl = holding.market_value - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const pnlColor = pnl >= 0 ? 'text-green-600' : 'text-red-600';

    return (
        <tr className="border-b border-gray-200 hover:bg-gray-50">
            <td className="py-3 px-4">
                <div className="font-bold text-gray-800">{holding.ticker}</div>
                <div className="text-sm text-gray-500">{holding.company_name}</div>
            </td>
            <td className="py-3 px-4 text-right">{holding.shares.toLocaleString()}</td>
            <td className="py-3 px-4 text-right">{formatCurrency(holding.market_value)}</td>
            <td className="py-3 px-4 text-right">{formatCurrency(costBasis)}</td>
            <td className={`py-3 px-4 text-right font-medium ${pnlColor}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            </td>
            <td className={`py-3 px-4 text-right font-medium ${pnlColor}`}>
                <div className="flex items-center justify-end space-x-1">
                   <span>{pnl >= 0 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                   <span>{pnlPercent.toFixed(2)}%</span>
                </div>
            </td>
            <td className="py-3 px-4 text-center">
                <button className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                </button>
                <button className="text-gray-400 hover:text-blue-500 p-1">
                    <Edit size={16} />
                </button>
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
    const [tickerSuggestions, setTickerSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchCache, setSearchCache] = useState<Record<string, any[]>>({});

    const currencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CHF', 'CNY'];
    
    const initialFormState = {
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

    const [form, setForm] = useState(initialFormState);

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
        } finally {
            setLoading(false);
        }
    };

    const fetchPortfolioData = async (userId: string) => {
        console.log(`[API] Fetching portfolio data for user: ${userId}`);
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:8000/api/portfolios/${userId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }
            const data: PortfolioData = await response.json();
            console.log('[API] Successfully fetched portfolio data:', data);
            setPortfolioData(data);
            setError(null);
        } catch (e: any) {
            console.error('[API] Failed to fetch portfolio data:', e);
            setError(`Failed to load portfolio. ${e.message}`);
            setPortfolioData(null);
        } finally {
            setLoading(false);
        }
    };

    // --- Modal Management ---
    const openAddModal = () => {
        console.log('[Modal] Opening "Add Holding" modal.');
        setShowAddModal(true);
    };

    const closeAddModal = () => {
        console.log('[Modal] Closing "Add Holding" modal. Resetting form state.');
        setShowAddModal(false);
        setForm(initialFormState); // Reset form on close
        setTickerSuggestions([]);
        setShowSuggestions(false);
    };

    // --- Form Handling & Ticker Search ---
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        console.log(`[Form] Field '${name}' changed to:`, newValue);
        const updatedForm = { ...form, [name]: newValue };
        setForm(updatedForm);
        
        if (name === 'ticker') {
            if (value.length > 0) {
                console.log(`[Form] Calling debounced search for "${value}"`);
                debouncedSearchTickers(value);
            } else {
                console.log('[Form] Ticker is empty, hiding suggestions.');
                setShowSuggestions(false);
                setTickerSuggestions([]);
            }
        }

        // Only fetch price on date change if a stock has been selected
        if (name === 'purchase_date' && form.ticker && form.company_name) {
            console.log(`[Form] Date changed for selected ticker ${form.ticker}. Fetching new price.`);
            fetchStockPrice(form.ticker, value);
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
            const response = await fetch(`http://localhost:8000/api/symbols/search?q=${encodeURIComponent(trimmedQuery)}&limit=10`);
            if (response.ok) {
                const data = await response.json();
                const results = data.results || [];
                console.log(`[Search] Received ${results.length || 0} suggestions for "${trimmedQuery}":`, results);
                
                // Update cache only if results are found
                if (results.length > 0) {
                    setSearchCache(prevCache => ({...prevCache, [trimmedQuery]: results}));
                }

                setTickerSuggestions(results);
                setShowSuggestions(true);
            } else {
                console.error(`[Search] API error for query "${trimmedQuery}":`, response.status, response.statusText);
                setTickerSuggestions([]);
            }
        } catch (error) {
            console.error(`[Search] Network error searching for "${trimmedQuery}":`, error);
        } finally {
            setSearchLoading(false);
        }
    };
    
    const debouncedSearchTickers = useCallback(debounce(searchTickers, 300), [searchCache]);

    const selectTicker = (suggestion: any) => {
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
            const historicalResponse = await fetch(`http://localhost:8000/api/stocks/${ticker}/historical?period=5Y`);
            if (historicalResponse.ok) {
                const historicalData = await historicalResponse.json();
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
            const currentResponse = await fetch(`http://localhost:8000/api/stocks/${ticker}/overview`);
            if (currentResponse.ok) {
                const currentData = await currentResponse.json();
                const currentPrice = currentData.data?.price;
                if (currentPrice) {
                    console.log(`[Price] Found fallback current price for ${ticker}: ${currentPrice}`);
                    setForm(prev => ({ ...prev, purchase_price: currentPrice.toFixed(2) }));
                }
            }
        } catch (error) {
            console.error(`[Price] Error fetching stock price for ${ticker}:`, error);
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
        } finally {
            setLoadingFX(false);
        }
    };

    // --- Form Submission ---
    const handleAddHoldingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        console.log('[Submit] "Add Holding" form submitted.');

        if (!form.ticker || !form.shares || !form.purchase_price || !form.purchase_date) {
            alert('Please fill in all required fields.');
            console.warn('[Submit] Aborted: Missing required fields.');
            return;
        }

        const payload = {
            ...form,
            shares: parseFloat(form.shares),
            purchase_price: parseFloat(form.purchase_price),
            commission: form.commission ? parseFloat(form.commission) : 0,
            fx_rate: form.fx_rate ? parseFloat(form.fx_rate) : 1.0,
            use_cash_balance: !!form.use_cash_balance,
        };
        console.log('[Submit] Payload prepared for API:', payload);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('You must be signed in to add a holding.');
            console.error('[Submit] Aborted: User is not signed in.');
            return;
        }

        try {
            const res = await fetch(`http://localhost:8000/api/portfolios/${user.id}/holdings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                console.log('[Submit] Successfully added holding. Closing modal and reloading data.');
                closeAddModal();
                fetchPortfolioData(user.id); // Re-fetch data instead of reloading page
            } else {
                const err = await res.json();
                console.error('[Submit] API error on holding submission:', err);
                alert(err.message || 'Failed to add holding.');
            }
        } catch (error) {
            console.error('[Submit] Network error on holding submission:', error);
            alert('A network error occurred. Please try again.');
        }
    };

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
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <form
                        onSubmit={handleAddHoldingSubmit}
                        className="p-6 space-y-6"
                    >
                        <div className="relative">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Stock Ticker <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input 
                                    name="ticker" 
                                    value={form.ticker} 
                                    onChange={handleFormChange}
                                    onFocus={handleTickerFocus}
                                    onBlur={handleTickerBlur}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono uppercase"
                                    placeholder="e.g., AAPL, MSFT, GOOGL"
                                    required 
                                    autoComplete="off"
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
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Company Name</label>
                            <input 
                                name="company_name" 
                                value={form.company_name} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                                placeholder="Auto-filled from ticker search"
                                readOnly
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Exchange</label>
                            <input 
                                name="exchange" 
                                value={form.exchange} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                                placeholder="Auto-filled from ticker search"
                                readOnly
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Number of Shares <span className="text-red-500">*</span>
                            </label>
                            <input 
                                name="shares" 
                                type="number" 
                                min="0" 
                                step="any" 
                                value={form.shares} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="e.g., 100"
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Purchase Date <span className="text-red-500">*</span>
                            </label>
                            <input 
                                name="purchase_date" 
                                type="date" 
                                value={form.purchase_date} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Purchase Price <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</div>
                                <input 
                                    name="purchase_price" 
                                    type="number" 
                                    min="0" 
                                    step="0.01" 
                                    value={form.purchase_price} 
                                    onChange={handleFormChange}
                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="0.00"
                                    required 
                                    disabled={loadingPrice}
                                />
                                {loadingPrice && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                            </div>
                            {loadingPrice && <div className="text-xs text-blue-600 mt-1">Auto-filling price for selected date...</div>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Commission (Optional)</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</div>
                                <input 
                                    name="commission" 
                                    type="number" 
                                    min="0" 
                                    step="0.01" 
                                    value={form.commission} 
                                    onChange={handleFormChange}
                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Currency</label>
                            <select 
                                name="currency" 
                                value={form.currency} 
                                onChange={handleFormChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            >
                                {currencies.map((cur) => (
                                    <option key={cur} value={cur}>{cur}</option>
                                ))}
                            </select>
                        </div>

                        {form.currency !== 'USD' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Currency Conversion Rate (to USD)
                                </label>
                                <div className="relative">
                                    <input 
                                        name="fx_rate" 
                                        type="number" 
                                        min="0" 
                                        step="0.0001" 
                                        value={form.fx_rate} 
                                        onChange={handleFormChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        disabled={loadingFX}
                                    />
                                    {loadingFX && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                        </div>
                                    )}
                                </div>
                                {loadingFX && <div className="text-xs text-blue-600 mt-1">Fetching current exchange rate...</div>}
                            </div>
                        )}

                        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                            <input 
                                name="use_cash_balance" 
                                type="checkbox" 
                                checked={form.use_cash_balance} 
                                onChange={handleFormChange}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-3 text-sm font-medium text-gray-700">
                                Use cash balance to purchase shares
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button 
                                type="button" 
                                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors duration-200" 
                                onClick={closeAddModal}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
                            >
                                Add Holding
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
    
    // --- Main Component Rendering ---
    console.log(`[Render] Rendering PortfolioPage. State:`, { loading, error: !!error, user: !!user, portfolioData: !!portfolioData });

    if (loading && !portfolioData) { // Show full-page loader only on initial load
        return (
            <div className="text-center py-10">
                Loading portfolio...
                {addHoldingModal}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10 text-red-500">
                Error: {error}
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
                    <div className="metric-value text-blue-600">${summary.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Number of Holdings</div>
                    <div className="metric-value">{summary.total_holdings}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Cash Balance</div>
                    <div className="metric-value">${cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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