'use client'

import { useState, useEffect } from 'react'
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


// The main component for the portfolio page
export default function PortfolioPage() {
    const [user, setUser] = useState<User | null>(null);
    const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkUserAndFetchData = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                console.log('Auth check result:', { user, error: userError }); // Debug log
                
                if (userError) {
                    throw new Error(userError.message);
                }
                
                setUser(user);
                
                if (user?.id) {
                    await fetchPortfolioData(user.id);
                } else {
                    setError('No authenticated user found');
                    setLoading(false);
                }
            } catch (err: any) {
                console.error('Error in checkUserAndFetchData:', err); // Debug log
                setError(err.message);
                setLoading(false);
            }
        };
        
        checkUserAndFetchData();
    }, []);

    const fetchPortfolioData = async (userId: string) => {
        try {
            setError(null);
            console.log('Fetching portfolio data for user:', userId); // Debug log
            const response = await fetch(`http://localhost:8000/api/portfolios/${userId}`);
            console.log('API Response:', response.status, response.statusText); // Debug log
            
            if (!response.ok) {
                // Log and display the full error body
                const errorBody = await response.text();
                console.error('API Error Body:', errorBody);
                let detail = '';
                try {
                    const parsed = JSON.parse(errorBody);
                    detail = parsed.detail || errorBody;
                } catch {
                    detail = errorBody;
                }
                throw new Error(detail || `Failed to fetch portfolio data. Status: ${response.status}`);
            }
            
            const data: PortfolioData = await response.json();
            console.log('Portfolio data received:', data); // Debug log
            setPortfolioData(data);
            setLoading(false);
        } catch (err: any) {
            console.error('Error in fetchPortfolioData:', err); // Debug log
            setError(err.message);
            setPortfolioData(null);
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="text-center py-10">Loading portfolio...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-500">Error: {error}</div>;
    }

    if (!user) {
        return (
            <div className="text-center py-10">
                <p>Please sign in to view your portfolio.</p>
                {/* Optional: Add a sign-in button here */}
            </div>
        );
    }

    if (!portfolioData || portfolioData.holdings.length === 0) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold mb-2">Your portfolio is empty.</h2>
                <p className="text-gray-600 mb-4">Add your first holding to get started.</p>
                <button className="btn-primary">
                    <PlusCircle className="mr-2" size={20} /> Add Holding
                </button>
            </div>
        );
    }

    const { holdings, summary, cash_balance } = portfolioData;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">My Portfolio</h1>
                <button className="btn-primary flex items-center">
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
        </div>
    );
} 