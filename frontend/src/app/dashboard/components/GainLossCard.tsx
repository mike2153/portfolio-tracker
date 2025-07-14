'use client';

import { useQuery } from '@tanstack/react-query';
import { ListSkeleton } from './Skeletons';
import { GainerLoserRow } from '@/types/api';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboard } from '../contexts/DashboardContext';
import { useAuth } from '@/components/AuthProvider';

interface GainLossCardProps {
    type: 'gainers' | 'losers';
    title: string;
}

const GainLossCard = ({ type, title }: GainLossCardProps) => {
    const isGainers = type === 'gainers';
    const { userId } = useDashboard();
    const { user, session } = useAuth();

    // Use real API endpoint
    const queryFn = async () => {
        if (!session?.access_token) {
            throw new Error('No authentication token available');
        }
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/dashboard/${type}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${type}`);
        }
        
        return response.json();
    };
    
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['dashboard', type, userId],
        queryFn,
        enabled: !!session?.access_token,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return <ListSkeleton title={title} />;
    }
    
    if (isError) {
        return <div className="text-red-500">Error loading {type}</div>;
    }

    const items = data?.data?.items || [];

    // Add defensive function to safely format percentage
    const safeFormatPercent = (changePercent: any): string => {
        // Handle null/undefined
        if (changePercent == null) {
            return '0.00';
        }
        
        // If it's already a number
        if (typeof changePercent === 'number') {
            return changePercent.toFixed(2);
        }
        
        // If it's a string, try to parse it
        if (typeof changePercent === 'string') {
            const parsed = parseFloat(changePercent);
            if (!isNaN(parsed)) {
                return parsed.toFixed(2);
            } else {
                return changePercent;
            }
        }
        
        // Fallback for any other type
        return String(changePercent);
    };

    // Add defensive function to safely format currency value
    const safeFormatCurrency = (changeValue: any): string => {
        // Handle null/undefined
        if (changeValue == null) {
            return '0';
        }
        
        // If it's already a number
        if (typeof changeValue === 'number') {
            return changeValue.toLocaleString();
        }
        
        // If it's a string, try to parse it
        if (typeof changeValue === 'string') {
            const parsed = parseFloat(changeValue);
            if (!isNaN(parsed)) {
                return parsed.toLocaleString();
            } else {
                return changeValue;
            }
        }
        
        // Fallback for any other type
        return String(changeValue);
    };

    return (
        <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button className="text-sm text-blue-400 hover:underline">See all</button>
            </div>
            <ul className="space-y-4">
                {items.map((item: GainerLoserRow) => (
                    <li key={item.ticker} className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                            {/* Using a placeholder for logo */}
                            <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center font-bold text-white">
                                {item.ticker.charAt(0)}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.name}</p>
                            <p className="text-sm text-gray-400 truncate">{item.ticker}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold text-white">${safeFormatCurrency(item.value)}</p>
                            <div className={cn('flex items-center justify-end text-xs', isGainers ? 'text-green-400' : 'text-red-400')}>
                                {isGainers ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                <span>{safeFormatPercent(item.changePercent)}% (${safeFormatCurrency(item.changeValue)})</span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GainLossCard; 
