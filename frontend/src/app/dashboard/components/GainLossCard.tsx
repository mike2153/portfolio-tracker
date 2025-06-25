'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { ListSkeleton } from './Skeletons';
import { GainerLoserRow } from '@/types/api';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

interface GainLossCardProps {
    type: 'gainers' | 'losers';
}

const GainLossCard = ({ type }: GainLossCardProps) => {
    const isGainers = type === 'gainers';
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
            }
        };
        init();
    }, []);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['dashboard', type, userId],
        queryFn: () => isGainers ? dashboardAPI.getGainers() : dashboardAPI.getLosers(),
        enabled: !!userId,
    });

    const title = isGainers ? 'Top day gainers' : 'Top day losers';

    if (isLoading) return <ListSkeleton title={title} />;
    if (isError) return <div className="text-red-500">Error loading {type}</div>;

    const items = data?.data?.items || [];

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
                            <p className="text-sm font-semibold text-white">${Number(item.value).toLocaleString()}</p>
                            <div className={cn('flex items-center justify-end text-xs', isGainers ? 'text-green-400' : 'text-red-400')}>
                                {isGainers ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                <span>{item.changePercent.toFixed(2)}% (${item.changeValue.toLocaleString()})</span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GainLossCard; 
