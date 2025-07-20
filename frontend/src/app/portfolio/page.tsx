'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { BarChart3, PieChart, Calculator, List, Loader2 } from 'lucide-react';
import PortfolioSummary from './components/PortfolioSummary';
import HoldingsTable from './components/HoldingsTable';
import AllocationCharts from './components/AllocationCharts';
import RebalanceCalculator from './components/RebalanceCalculator';

// Tab configuration
const tabs = [
  { id: 'overview', label: 'Overview', icon: List },
  { id: 'allocation', label: 'Allocation', icon: PieChart },
  { id: 'performance', label: 'Performance', icon: BarChart3 },
  { id: 'rebalance', label: 'Rebalance', icon: Calculator },
];

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
            <p className="text-gray-400">You need to be logged in to view your portfolio.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Portfolio Manager</h1>
          <p className="text-gray-400">Track, analyze, and optimize your investments</p>
        </div>

        {/* Tab Navigation - Mobile Optimized */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                      border-b-2 transition-colors duration-200
                      ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-500'
                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <PortfolioSummary />
              <HoldingsTable />
            </div>
          )}

          {activeTab === 'allocation' && (
            <div className="animate-fadeIn">
              <AllocationCharts />
              <div className="mt-6">
                <HoldingsTable />
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="animate-fadeIn">
              <div className="rounded-xl bg-gray-800/50 p-6 shadow-lg mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Performance Analysis</h2>
                <p className="text-gray-400">
                  For detailed performance analysis and portfolio vs benchmark comparison, 
                  please visit the <a href="/dashboard" className="text-blue-500 hover:text-blue-400">Dashboard</a> page.
                </p>
              </div>
              <PortfolioSummary />
            </div>
          )}

          {activeTab === 'rebalance' && (
            <div className="animate-fadeIn">
              <RebalanceCalculator />
            </div>
          )}
        </div>

        {/* Mobile-friendly info message */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-lg text-sm text-gray-400 sm:hidden">
          <p>Swipe or scroll horizontally to see all tabs</p>
        </div>
      </div>

      {/* Add CSS for animations and scrollbar hiding */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}