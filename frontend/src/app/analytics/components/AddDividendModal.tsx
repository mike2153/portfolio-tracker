"use client";

import React, { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { front_api_search_symbols } from '@/lib/front_api_client';
import { StockSymbol } from '@/types/api';
import { useToast } from '@/components/ui/Toast';

const debounce = <T extends (...args: Parameters<T>) => void>(func: T, delay = 300) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

export interface ManualDividendFormState {
    ticker: string;
    company_name: string;
    payment_date: string;
    total_received: string;
    amount_per_share: string;
    fee: string;
    tax: string;
    note: string;
    update_cash_balance: boolean;
}

interface AddDividendModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ManualDividendFormState, saveAndNew: boolean) => Promise<void>;
    isSubmitting: boolean;
}

export const AddDividendModal: React.FC<AddDividendModalProps> = ({ isOpen, onClose, onSave, isSubmitting }) => {
    const { addToast } = useToast();
    const initialFormState: ManualDividendFormState = useMemo(() => ({
        ticker: '',
        company_name: '',
        payment_date: new Date().toISOString().split('T')[0] as string,
        total_received: '',
        amount_per_share: '',
        fee: '0',
        tax: '0',
        note: '',
        update_cash_balance: true,
    }), []);

    const [form, setForm] = useState<ManualDividendFormState>(initialFormState);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tickerSuggestions, setTickerSuggestions] = useState<StockSymbol[]>([]);
    const [searchCache, setSearchCache] = useState<Record<string, StockSymbol[]>>({});
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm(initialFormState);
        }
    }, [isOpen, initialFormState]);

    const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isCheckbox = (e.target as HTMLInputElement).type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        setForm(prev => ({
            ...prev,
            [name]: isCheckbox ? checked : value
        }));
    };

    const searchFunction = useCallback(async (query: string) => {
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
            const response = await front_api_search_symbols({ query, limit: 10 });
            if (response?.ok && response?.data?.results) {
                setTickerSuggestions(response.data.results);
                setSearchCache(prev => ({ ...prev, [query]: response.data.results }));
            } else {
                setTickerSuggestions([]);
            }
        } catch {
            setTickerSuggestions([]);
        } finally {
            setSearchLoading(false);
        }
    }, [searchCache]);

    const handleTickerSearch = useMemo(
        () => debounce(searchFunction, 300),
        [searchFunction]
    );

    const handleSuggestionClick = (symbol: StockSymbol) => {
        setForm(prev => ({
            ...prev,
            ticker: symbol.symbol,
            company_name: symbol.name,
        }));
        setTickerSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSubmit = async (saveAndNew: boolean) => {
        if (!form.ticker) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Ticker is required.' });
            return;
        }
        if (!form.payment_date) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Payment date is required.' });
            return;
        }
        // Validate total_received with NaN check
        const totalReceivedNum = Number(form.total_received);
        if (isNaN(totalReceivedNum) || totalReceivedNum <= 0) {
            addToast({ type: 'error', title: 'Validation Error', message: 'Total Received must be a valid number greater than zero.' });
            return;
        }
        await onSave(form, saveAndNew);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-700">
                <h3 className="text-xl font-semibold text-white mb-6">Manually Add Dividend</h3>
                
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    {/* Ticker Search */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-400 mb-1">Ticker / Company</label>
                        <input
                            type="text"
                            name="ticker"
                            value={form.ticker}
                            onChange={(e) => { handleFormChange(e); handleTickerSearch(e.target.value); }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            placeholder="e.g., AAPL or Apple Inc."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            autoComplete="off"
                        />
                        {showSuggestions && (
                            <ul className="absolute z-10 w-full bg-gray-900 border border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto">
                                {searchLoading ? (
                                    <li className="px-3 py-2 text-gray-400">Searching...</li>
                                ) : tickerSuggestions.length > 0 ? (
                                    tickerSuggestions.map(s => (
                                        <li key={s.symbol} onMouseDown={() => handleSuggestionClick(s)} className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-white">
                                            <strong>{s.symbol}</strong> - <span className="text-gray-400">{s.name}</span>
                                        </li>
                                    ))
                                ) : form.ticker.length > 1 && !searchLoading ? (
                                    <li className="px-3 py-2 text-gray-400">No results found.</li>
                                ) : null}
                            </ul>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Payment Date</label>
                            <input type="date" name="payment_date" value={form.payment_date} onChange={handleFormChange} className="w-full input-class" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Total Received ($)</label>
                            <input type="number" name="total_received" value={form.total_received} onChange={handleFormChange} placeholder="e.g., 50.25" className="w-full input-class" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Amount / Share ($)</label>
                            <input type="number" name="amount_per_share" value={form.amount_per_share} onChange={handleFormChange} placeholder="Optional" className="w-full input-class" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Fee ($)</label>
                            <input type="number" name="fee" value={form.fee} onChange={handleFormChange} className="w-full input-class" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Tax ($)</label>
                            <input type="number" name="tax" value={form.tax} onChange={handleFormChange} className="w-full input-class" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Note</label>
                        <textarea name="note" value={form.note} onChange={handleFormChange} placeholder="Optional notes" rows={2} className="w-full input-class"></textarea>
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center space-x-2 text-sm text-gray-300">
                            <input
                                type="checkbox"
                                name="update_cash_balance"
                                checked={form.update_cash_balance}
                                onChange={handleFormChange}
                                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                            />
                            <span>Update Cash Balance (creates a transaction)</span>
                        </label>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-secondary">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit(true)}
                            disabled={isSubmitting}
                            className="btn-secondary flex items-center"
                        >
                            {isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                            Save and Add More
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit(false)}
                            disabled={isSubmitting}
                            className="btn-primary flex items-center"
                        >
                            {isSubmitting && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Add this helper style to a global CSS file or a style tag if needed
/*
.input-class {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background-color: #374151; // bg-gray-700
    border: 1px solid #4B5563; // border-gray-600
    border-radius: 0.375rem; // rounded-md
    color: white;
}
.input-class:focus {
    border-color: #3B82F6; // focus:border-blue-500
    --tw-ring-color: #3B82F6; // focus:ring-blue-500
    box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
}
*/