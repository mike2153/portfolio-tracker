'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { FxTickerSkeleton } from './Skeletons';
import { FxRate } from '@/types/api';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FxTicker = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['fxRates'],
        queryFn: () => dashboardAPI.getFxRates(),
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
        refetchInterval: false, // Disable automatic refetching
        refetchOnWindowFocus: false, // Disable refetch on window focus
    });

    if (isLoading) return <FxTickerSkeleton />;
    if (isError) return null; // Don't show anything on error

    const rates = data?.data?.rates || [];

    return (
        <div className="relative overflow-hidden">
            <div className="flex animate-marquee-continuous space-x-8">
                {rates.map((rate, index) => (
                    <FxRateItem key={index} rate={rate} />
                ))}
                {/* Duplicate for seamless loop */}
                {rates.map((rate, index) => (
                    <FxRateItem key={`dup-${index}`} rate={rate} />
                ))}
            </div>
        </div>
    );
};

const FxRateItem = ({ rate }: { rate: FxRate }) => {
    const rateValue = typeof rate.rate === 'number' ? rate.rate : Number(rate.rate);
    const changeValue = typeof rate.change === 'number' ? rate.change : Number(rate.change);
    const isPositive = changeValue >= 0;
    const TrendArrow = isPositive ? ArrowUp : ArrowDown;

    return (
        <div className="flex items-center space-x-2 text-sm">
            <span className="font-medium text-gray-400">{rate.pair}</span>
            <span className="font-semibold text-white">
                {isNaN(rateValue) ? 'N/A' : `$${rateValue.toFixed(2)}`}
            </span>
            <span className={cn('flex items-center text-xs', isPositive ? 'text-green-400' : 'text-red-400')}>
                <TrendArrow className="h-3 w-3" />
                <span>{isNaN(changeValue) ? 'N/A' : `${changeValue.toFixed(2)}%`}</span>
            </span>
        </div>
    );
}


export default FxTicker; 