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
    const { user } = useAuth();

    // Note: Gainers/Losers API needs to be implemented in backend
    const queryFn = () => {
        console.log(`[GainLossCard] ${type} API not yet implemented, showing empty state`);
        return Promise.resolve({ data: { items: [] } });
    };
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['dashboard', type, userId],
        queryFn: async () => {
           //console.log(`[GainLossCard] Making API call for ${type}...`);
            const result = await queryFn();
            //console.log(`[GainLossCard] API response for ${type}:`, result);
            //console.log(`[GainLossCard] API response data type for ${type}:`, typeof result.data);
            //console.log(`[GainLossCard] API response items for ${type}:`, result?.data?.items);
            
            // Add debugging for each item's numeric fields
            if (result?.data?.items) {
                result.data.items.forEach((item: any, index: number) => {
                        console.log(`[GainLossCard] ${type} Item ${index} (${item.ticker}):`, {
                        changePercent: item.changePercent,
                        changePercentType: typeof item.changePercent,
                        changeValue: item.changeValue,
                        changeValueType: typeof item.changeValue,
                        canCallToFixed: typeof item.changePercent === 'number' || (typeof item.changePercent === 'string' && !isNaN(parseFloat(item.changePercent)))
                    });
                });
            }
            
            return result;
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    //debug(`[GainLossCard] Query state for ${type}:`, { data, isLoading, isError, error });

    if (isLoading) {
        //console.log(`[GainLossCard] Still loading ${type}, showing skeleton`);
        return <ListSkeleton title={title} />;
    }
    if (isError) {
        //console.log(`[GainLossCard] Error occurred for ${type}:`, error);
        return <div className="text-red-500">Error loading {type}</div>;
    }

    const items = data?.data?.items || [];
    //console.log(`[GainLossCard] Items for ${type}:`, items);
    //console.log(`[GainLossCard] Number of items for ${type}:`, items.length);

    // Add defensive function to safely format percentage
    const safeFormatPercent = (changePercent: any): string => {
        //console.log(`[GainLossCard] safeFormatPercent called with:`, changePercent, 'type:', typeof changePercent);
        
        // Handle null/undefined
        if (changePercent == null) {
            //console.log(`[GainLossCard] safeFormatPercent: changePercent is null/undefined, returning 0.00`);
            return '0.00';
        }
        
        // If it's already a number
        if (typeof changePercent === 'number') {
            //console.log(`[GainLossCard] safeFormatPercent: changePercent is number, using toFixed`);
            return changePercent.toFixed(2);
        }
        
        // If it's a string, try to parse it
        if (typeof changePercent === 'string') {
            //console.log(`[GainLossCard] safeFormatPercent: changePercent is string, attempting to parse`);
            const parsed = parseFloat(changePercent);
            if (!isNaN(parsed)) {
                //console.log(`[GainLossCard] safeFormatPercent: successfully parsed string to number:`, parsed);
                return parsed.toFixed(2);
            } else {
                //console.log(`[GainLossCard] safeFormatPercent: failed to parse string, returning raw value`);
                return changePercent;
            }
        }
        
        // Fallback for any other type
        //console.log(`[GainLossCard] safeFormatPercent: unknown type, converting to string`);
        return String(changePercent);
    };

    // Add defensive function to safely format currency value
    const safeFormatCurrency = (changeValue: any): string => {
        //console.log(`[GainLossCard] safeFormatCurrency called with:`, changeValue, 'type:', typeof changeValue);
        
        // Handle null/undefined
        if (changeValue == null) {
            //console.log(`[GainLossCard] safeFormatCurrency: changeValue is null/undefined, returning 0`);
            return '0';
        }
        
        // If it's already a number
        if (typeof changeValue === 'number') {
            //console.log(`[GainLossCard] safeFormatCurrency: changeValue is number, using toLocaleString`);
            return changeValue.toLocaleString();
        }
        
        // If it's a string, try to parse it
        if (typeof changeValue === 'string') {
            //console.log(`[GainLossCard] safeFormatCurrency: changeValue is string, attempting to parse`);
            const parsed = parseFloat(changeValue);
            if (!isNaN(parsed)) {
                //console.log(`[GainLossCard] safeFormatCurrency: successfully parsed string to number:`, parsed);
                return parsed.toLocaleString();
            } else {
                console.log(`[GainLossCard] safeFormatCurrency: failed to parse string, returning raw value`);
                return changeValue;
            }
        }
        
        // Fallback for any other type
        console.log(`[GainLossCard] safeFormatCurrency: unknown type, converting to string`);
        return String(changeValue);
    };

    return (
        <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button className="text-sm text-blue-400 hover:underline">See all</button>
            </div>
            <ul className="space-y-4">
                {items.map((item: GainerLoserRow) => {
                      /*  console.log(`[GainLossCard] Rendering ${type} item ${index}:`, item);
                        console.log(`[GainLossCard] ${type} Item ${index} numeric field details:`, {
                        changePercent: item.changePercent,
                        changePercentType: typeof item.changePercent,
                        changeValue: item.changeValue,
                        changeValueType: typeof item.changeValue
                    });
                    */
                    return (
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
                    );
                })}
            </ul>
        </div>
    );
};

export default GainLossCard; 
