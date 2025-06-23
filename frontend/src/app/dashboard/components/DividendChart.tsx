'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { ChartSkeleton } from './Skeletons';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

const DividendChart = () => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['dividendForecast'],
        queryFn: () => dashboardAPI.getDividendForecast(),
    });

    if (isLoading) return <ChartSkeleton />;
    if (isError) return <div className="text-red-500">Error loading dividend forecast</div>;

    const chartData = data?.data?.forecast || [];
    const next12m = data?.data?.next12mTotal || 0;
    const monthlyAvg = data?.data?.monthlyAvg || 0;

    return (
        <div className="rounded-xl bg-gray-800/80 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Future payments</h3>
                    <div className="text-sm text-gray-400">Next 12m / Monthly</div>
                    <div className="text-xl font-bold text-white">${Number(next12m).toLocaleString()} / ${Number(monthlyAvg).toLocaleString()}</div>
                </div>
                <button className="text-sm text-blue-400 hover:underline">Calendar</button>
            </div>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                borderColor: '#374151',
                                color: '#e5e7eb',
                            }}
                            cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                        />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default DividendChart; 