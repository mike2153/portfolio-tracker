'use client'

import { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { User } from '@/types'
import { PlusCircle, Trash2, Edit, MoreVertical, Loader2 } from 'lucide-react'
import { front_api_get_portfolio, front_api_get_quote, front_api_search_symbols } from '@/lib/front_api_client'
import { useToast } from '@/components/ui/Toast'
import {
    Holding,
    StockSymbol,
    AddHoldingFormData,
    AddHoldingPayload,
    FormErrors
} from '@/types/api'

const debounce = <T extends (...args: any[]) => void>(func: T, delay = 300) => {
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
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [portfolioLoading, setPortfolioLoading] = useState(true);
    const [quotesLoading, setQuotesLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, setShowHoldingModal] = useState(false);
    const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
    const [, setLoadingPrice] = useState(false);
    const [, setShowSuggestions] = useState(false);
    const [, setTickerSuggestions] = useState<StockSymbol[]>([]);
    const [searchCache, setSearchCache] = useState<Record<string, StockSymbol[]>>({});
    const [, setSearchLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [, setIsSubmitting] = useState(false);
    
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

    const fetchPortfolioData = useCallback(async (_userId: string) => {
        setPortfolioLoading(true);
        setError(null);
        try {
            const portfolioResponse: any = await front_api_get_portfolio();
            
            if (!portfolioResponse.ok || !portfolioResponse.data) {
                const msg = portfolioResponse.error || 'Failed to fetch portfolio data';
                setError(msg);
                setHoldings([]);
                addToast({ type: 'error', title: 'Error Fetching Portfolio', message: msg });
                return;
            }

            // The backend returns a PortfolioMetrics object. We access the 'holdings' property from it.
            // The API client wraps the response, so the metrics object is in portfolioResponse.data.
            const portfolioMetrics = portfolioResponse.data as any;
            const initialHoldings: Holding[] = portfolioMetrics?.holdings || [];

            setHoldings(initialHoldings);

            if (initialHoldings.length > 0) {
                setQuotesLoading(true);
                const holdingsWithQuotes = await Promise.all(
                    initialHoldings.map(async (holding: Holding) => {
                        try {
                            const res: any = await front_api_get_quote(holding.ticker);
                            if (res.ok && res.data?.data?.price) {
                                const price = res.data.data.price as number;
                                return {
                                    ...holding,
                                    current_price: price,
                                    market_value: price * holding.shares,
                                };
                            }
                        } catch (_err) {
                            console.error(`Failed to fetch quote for ${holding.ticker}`, _err);
                        }
                        return holding;
                    })
                );
                setHoldings(holdingsWithQuotes);
                setQuotesLoading(false);
            }
        } catch (_err) {
            const msg = _err instanceof Error ? _err.message : 'An unknown error occurred';
            setError(msg);
            setHoldings([]);
            addToast({ type: 'error', title: 'Error Fetching Portfolio', message: msg });
        } finally {
            setPortfolioLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        const checkUserSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchPortfolioData(session.user.id);
            } else {
                setPortfolioLoading(false);
            }
        };
        
        checkUserSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user;
            setUser(currentUser ?? null);
            if (event === 'SIGNED_IN' && currentUser) {
                await fetchPortfolioData(currentUser.id);
            } else if (event === 'SIGNED_OUT') {
                setHoldings([]);
                setPortfolioLoading(false);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [fetchPortfolioData]);

    const fetchClosingPriceForDate = useCallback(async (ticker: string, date: string) => {
        if (!ticker || !date) return;
        
        setLoadingPrice(true);
        try {
            // Note: Historical data API needs to be implemented in front_api_client
            // For now, just show a message that this feature is temporarily unavailable
            addToast({
                type: 'info',
                title: 'Feature Temporarily Unavailable',
                message: 'Historical price lookup is being migrated. Please enter price manually.',
            });
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

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined) return '-';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const formatPercent = (value: number | undefined) => {
        if (value === undefined || !isFinite(value)) return '-';
        return `${value.toFixed(2)}%`;
    };

    const openAddModal = () => {
        setShowHoldingModal(true);
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

    const _handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;
    
        setForm(prev => ({
            ...prev,
            [name]: isCheckbox ? checked : value
        }));

        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const _handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        const previousDate = form.purchase_date;
        setForm(prev => ({ ...prev, purchase_date: value }));
        
        if (formErrors.purchase_date) {
            setFormErrors(prev => ({ ...prev, purchase_date: '' }));
        }

        previousDateRef.current = previousDate;
    };

    const _handleDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const currentDate = e.target.value;
        const previousDate = previousDateRef.current;
        const todayDate = new Date().toISOString().split('T')[0];
        
        if (form.ticker && 
            currentDate && 
            currentDate !== previousDate && 
            currentDate !== todayDate) {
            fetchClosingPriceForDate(form.ticker, currentDate);
        }
    };

    const _handleTickerSearch = useCallback(debounce(async (query: string) => {
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
            const response: any = await front_api_search_symbols({ query, limit: 50 });
            if ((response as any)?.ok && (response as any)?.data) {
                setTickerSuggestions((response as any)?.data?.results);
                setSearchCache((prev: Record<string, StockSymbol[]>) => ({ ...prev, [query]: (response as any)?.data?.results }));
            } else {
                setTickerSuggestions([]);
            }
        } catch (error) {
            setTickerSuggestions([]);
        } finally {
            setSearchLoading(false);
        }
    }, 500), [searchCache]);

    const _handleTickerFocus = () => setShowSuggestions(true);
    const _handleTickerBlur = () => setTimeout(() => setShowSuggestions(false), 200);

    const _handleSuggestionClick = useCallback((symbol: StockSymbol) => {
        setForm(prev => ({
            ...prev,
            ticker: symbol.symbol,
            company_name: symbol.name,
            exchange: symbol.exchange ?? '',
            purchase_price: '', // Clear price initially
        }));
        setTickerSuggestions([]);
        setShowSuggestions(false);
        
        if (formErrors.ticker) {
            setFormErrors(prev => ({ ...prev, ticker: '' }));
        }

        // Automatically fetch the current price for the selected symbol
        const fetchPrice = async () => {
            setLoadingPrice(true);
            try {
                const res: any = await front_api_get_quote(symbol.symbol);
                if (res.ok && res.data?.data?.price) {
                    const price = res.data.data.price as number;
                    setForm(prev => ({
                        ...prev,
                        purchase_price: String(price.toFixed(2)),
                    }));
                } else {
                    addToast({
                        type: 'warning',
                        title: 'Could Not Fetch Price',
                        message: `Could not fetch current price for ${symbol.symbol}. Please enter manually.`,
                    });
                }
            } catch (err) {
                addToast({
                    type: 'error',
                    title: 'Price Fetch Failed',
                    message: `An error occurred fetching the price for ${symbol.symbol}.`,
                });
                console.error(`Failed to fetch quote for ${symbol.symbol}`, err);
            } finally {
                setLoadingPrice(false);
            }
        };

        fetchPrice();
    }, [formErrors.ticker, addToast]);
    
    const _handleAddHoldingSubmit = async () => {
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

            // Note: Add holding API needs to be implemented as add transaction
            // For now, show message that this needs to be done via transactions page
            addToast({
                type: 'info',
                title: 'Use Transactions Page',
                message: 'Please add holdings via the Transactions page - Add Transaction with type "Buy"',
            });
            closeHoldingModal();
            return;
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

    const _handleUpdateHoldingSubmit = async () => {
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

            // Note: Update holding API needs to be implemented as update transaction
            // For now, show message that this needs to be done via transactions page
            addToast({
                type: 'info',
                title: 'Use Transactions Page',
                message: 'Please edit holdings via the Transactions page - Edit the transaction directly',
            });
            closeHoldingModal();
            return;
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
    
    const _handleFormSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (editingHolding) {
            await _handleUpdateHoldingSubmit();
        } else {
            await _handleAddHoldingSubmit();
        }
    };

    const _handleRemoveHolding = async (holding: Holding) => {
        if (!user) return;
        if (!window.confirm(`Are you sure you want to remove all holdings for ${holding.ticker}? This will delete all associated transactions.`)) {
            return;
        }

        try {
            // Note: Remove holding API needs to be implemented as delete transactions
            // For now, show message that this needs to be done via transactions page
            addToast({
                type: 'info',
                title: 'Use Transactions Page',
                message: 'Please remove holdings via the Transactions page - Delete the associated transactions',
            });
            return;
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Error',
                message: 'An unexpected error occurred while removing the holding.',
            });
        }
    };

    if (portfolioLoading) {
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
                {/* Removed Add Stock button as requested */}
            </div>
            
            {quotesLoading && (
                <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Updating live market data...</p>
                </div>
            )}

            {holdings.length === 0 && !portfolioLoading ? (
                <div className="text-center py-12 bg-gray-900 rounded-lg shadow border border-gray-700 text-gray-100">
                    <h2 className="text-xl font-semibold text-gray-100 mb-2">No Holdings Yet</h2>
                    <p className="text-gray-400 mb-6">Start building your portfolio by adding your first stock holding.</p>
                    <button className="btn-primary flex items-center mx-auto" onClick={openAddModal}>
                        <PlusCircle className="mr-2" size={20} /> Add Your First Stock
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-700/50 text-xs uppercase text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Ticker</th>
                                <th scope="col" className="px-6 py-3">Shares</th>
                                <th scope="col" className="px-6 py-3 text-right">Avg Cost</th>
                                <th scope="col" className="px-6 py-3 text-right">Cost Basis</th>
                                <th scope="col" className="px-6 py-3 text-right">Current Price</th>
                                <th scope="col" className="px-6 py-3 text-right">Market Value</th>
                                <th scope="col" className="px-6 py-3 text-right">Open PNL</th>
                                <th scope="col" className="px-6 py-3 text-right">Open PNL %</th>
                                <th scope="col" className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map((holding) => {
                                const costBasis = holding.shares * holding.purchase_price;
                                const avgCost = holding.purchase_price;
                                const openPnl = (holding.market_value ?? holding.shares * holding.purchase_price) - costBasis;
                                const openPnlPercent = costBasis > 0 ? (openPnl / costBasis) * 100 : 0;
                                const isGain = openPnl >= 0;

                                return (
                                    <tr key={holding.id} className="border-b border-gray-700 bg-gray-800 hover:bg-gray-700/50">
                                        <th scope="row" className="whitespace-nowrap px-6 py-4 font-medium text-white">
                                            <div className="flex items-center">
                                                <div className="mr-2 h-8 w-8 rounded-full bg-gray-600"></div>
                                                <div>
                                                    <div className="font-bold">{holding.ticker}</div>
                                                    <div className="text-xs text-gray-400">{holding.company_name}</div>
                                                </div>
                                            </div>
                                        </th>
                                        <td className="px-6 py-4">{Math.round(holding.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                        <td className="px-6 py-4 text-right">{formatCurrency(avgCost)}</td>
                                        <td className="px-6 py-4 text-right">{formatCurrency(costBasis)}</td>
                                        <td className="px-6 py-4 text-right">{formatCurrency(holding.current_price)}</td>
                                        <td className="px-6 py-4 text-right">{formatCurrency(holding.market_value)}</td>
                                        <td className={`px-6 py-4 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatCurrency(openPnl)}
                                        </td>
                                        <td className={`px-6 py-4 text-right font-medium ${isGain ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatPercent(openPnlPercent)}
                                        </td>
                                        <td className="relative px-6 py-4 text-center">
                                            <button onClick={() => handleMenuToggle(holding.id)} className="rounded-md p-1.5 hover:bg-gray-600">
                                                <MoreVertical size={20} />
                                            </button>
                                            {openMenuId === holding.id && (
                                                <div className="absolute right-12 top-10 z-20 w-48 rounded-md border border-gray-600 bg-gray-700 shadow-lg">
                                                    <button
                                                        onClick={() => {
                                                            openEditModal(holding);
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex w-full items-center px-4 py-2 text-left text-sm hover:bg-gray-600"
                                                    >
                                                        <Edit size={16} className="mr-2" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            _handleRemoveHolding(holding)
                                                            setOpenMenuId(null);
                                                        }}
                                                        className="flex w-full items-center px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-600"
                                                    >
                                                        <Trash2 size={16} className="mr-2" /> Remove
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            
            {holdings.length > 0 && (
                <div className="mt-4 text-right font-medium">
                    Total PnL: {formatCurrency(
                        holdings.reduce((acc, h) => acc + ((h.market_value ?? h.shares * h.purchase_price) - h.shares * h.purchase_price), 0)
                    )}
                </div>
            )}
        </div>
    );
} 