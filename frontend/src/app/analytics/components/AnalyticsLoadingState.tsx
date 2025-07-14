"use client";

import React from 'react';

interface AnalyticsLoadingStateProps {
  title?: string;
  description?: string;
}

const SkeletonCard = () => (
  <div className="bg-gray-800/80 rounded-xl border border-gray-700/50 p-6 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 bg-gray-700 rounded w-24"></div>
      <div className="w-8 h-8 bg-gray-700 rounded-lg"></div>
    </div>
    <div className="h-8 bg-gray-700 rounded w-32 mb-2"></div>
    <div className="h-4 bg-gray-700 rounded w-20"></div>
  </div>
);

const SkeletonTable = () => (
  <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden animate-pulse">
    <div className="p-6 border-b border-gray-700/50">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-gray-700 rounded w-40"></div>
        <div className="h-4 bg-gray-700 rounded w-24"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 bg-gray-700 rounded w-20 mb-1"></div>
            <div className="h-5 bg-gray-700 rounded w-16"></div>
          </div>
        ))}
      </div>
    </div>
    
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-gray-700 rounded w-32"></div>
        <div className="h-10 bg-gray-700 rounded w-64"></div>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-6 gap-4 pb-3 border-b border-gray-700/30">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-700 rounded w-full"></div>
        ))}
      </div>
      
      {/* Table Rows */}
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-6 gap-4 py-3">
          {Array.from({ length: 6 }).map((_, colIndex) => (
            <div key={colIndex}>
              {colIndex === 0 ? (
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-700 rounded w-24"></div>
                    <div className="h-3 bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="h-4 bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default function AnalyticsLoadingState({ 
  title = "Analytics",
  description = "Loading your portfolio analytics..."
}: AnalyticsLoadingStateProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-400">{description}</p>
        </div>

        {/* KPI Cards Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>

        {/* Tab Navigation Loading */}
        <div className="mb-6">
          <div className="border-b border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div 
                  key={i}
                  className="py-4 px-1 animate-pulse"
                >
                  <div className="h-5 bg-gray-700 rounded w-20"></div>
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Table Loading */}
        <div className="mb-8">
          <SkeletonTable />
        </div>
      </div>
    </div>
  );
}