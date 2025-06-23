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
        refetchInterval: 30000, // Refetch every 30 seconds
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
    const isPositive = rate.change >= 0;
    const TrendArrow = isPositive ? ArrowUp : ArrowDown;

    return (
        <div className="flex items-center space-x-2 text-sm">
            <span className="font-medium text-gray-400">{rate.pair}</span>
            <span className="font-semibold text-white">${rate.rate.toFixed(2)}</span>
            <span className={cn('flex items-center text-xs', isPositive ? 'text-green-400' : 'text-red-400')}>
                <TrendArrow className="h-3 w-3" />
                <span>{rate.change.toFixed(2)}%</span>
            </span>
        </div>
    );
}


export default FxTicker; 