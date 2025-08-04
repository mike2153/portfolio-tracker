'use client';

import { ListSkeleton } from './Skeletons';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionPortfolio, GainerLoserItem } from '@/hooks/useSessionPortfolio';
import GradientText from '@/components/ui/GradientText';
import CompanyIcon from '@/components/ui/CompanyIcon';

interface GainLossCardProps {
    type: 'gainers' | 'losers';
    title: string;
}

const GainLossCard = ({ type, title }: GainLossCardProps) => {
    const isGainers = type === 'gainers';
    
    // Use consolidated portfolio data
    const { topGainers, topLosers, isLoading, isError } = useSessionPortfolio();

    if (isLoading) {
        return <ListSkeleton title={title} />;
    }
    
    if (isError) {
        return <div className="text-red-500">Error loading {type}</div>;
    }

    const items: GainerLoserItem[] = isGainers ? (topGainers || []) : (topLosers || []);

    // Add defensive function to safely format percentage
    const safeFormatPercent = (changePercent: unknown): string => {
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
    const safeFormatCurrency = (changeValue: unknown): string => {
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
        <div className="metric-card-enhanced animate-stagger-reveal group relative overflow-hidden" 
             style={{ animationDelay: '750ms' }}>
            {/* Subtle background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#10B981]/5 via-transparent to-[#1E3A8A]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
            
            <div className="flex items-center justify-between mb-4 relative z-10">
                <h3 className="section-title">{title}</h3>
                <button className="text-sm text-white hover:bg-white hover:text-[#0D1117] px-3 py-1 rounded transition-colors">See all</button>
            </div>
            <ul className="space-y-4 relative z-10">
                {items.map((item: GainerLoserItem, index) => (
                    <li key={item.ticker} 
                        className="flex items-center space-x-4 hover:bg-[#30363D]/20 rounded-lg p-2 -m-2 transition-all duration-300 hover:scale-[1.02] group/item animate-stagger-reveal"
                        style={{ animationDelay: `${800 + index * 100}ms` }}>
                        <div className="flex-shrink-0">
                            <CompanyIcon 
                                symbol={item.ticker} 
                                size={40}
                                className="rounded-full transition-all duration-300 group-hover/item:scale-110 group-hover/item:shadow-lg group-hover/item:shadow-[#10B981]/25"
                                fallback="initials"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate group-hover/item:text-[#10B981] transition-colors duration-300">{item.name}</p>
                            <p className="text-sm text-[#8B949E] truncate group-hover/item:text-gray-300 transition-colors duration-300">{item.ticker}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-semibold gradient-text-value animate-number-reveal">${safeFormatCurrency(item.value)}</p>
                            <div className={cn('flex items-center justify-end text-xs transition-all duration-300', 
                                isGainers ? 'text-green-400 group-hover/item:text-[#34D399]' : 'text-red-400 group-hover/item:text-[#FF6B6B]')}>
                                {isGainers ? 
                                    <ArrowUp className="h-3 w-3 transition-all duration-300 group-hover/item:scale-110 animate-pulse-glow" /> : 
                                    <ArrowDown className="h-3 w-3 transition-all duration-300 group-hover/item:scale-110" />
                                }
                                <span className="animate-number-reveal">{safeFormatPercent(item.changePercent)}% (${safeFormatCurrency(item.changeValue)})</span>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GainLossCard; 
