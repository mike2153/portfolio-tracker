'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Loader2 } from 'lucide-react';

export interface ListViewColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface ListViewAction<T> {
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
  className?: string;
  disabled?: (item: T) => boolean;
}

export interface ApexListViewProps<T> {
  data: T[];
  columns: ListViewColumn<T>[];
  actions?: ListViewAction<T>[];
  title?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  itemsPerPage?: number;
  showSearch?: boolean;
  showPagination?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  onRefresh?: () => void;
  getItemKey?: (item: T, index: number) => string | number;
  categoryGroups?: Array<{
    key: string;
    label: string;
    items: Array<keyof T>;
  }>;
}

export default function ApexListView<T extends Record<string, any>>({
  data,
  columns,
  actions = [],
  title,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data available',
  itemsPerPage = 50,
  showSearch = true,
  showPagination = true,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
  onRefresh,
  getItemKey = (item, index) => index,
  categoryGroups
}: ApexListViewProps<T>) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  console.log('[ApexListView] Rendering with data:', {
    dataLength: data?.length,
    columnsCount: columns?.length,
    isLoading,
    error: error?.substring(0, 100)
  });

  // Filter and search data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    const searchableColumns = columns.filter(col => col.searchable !== false);
    
    return data.filter(item =>
      searchableColumns.some(col => {
        const value = item[col.key];
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      })
    );
  }, [data, searchTerm, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue === bValue) return 0;

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, showPagination]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  // Group data by categories if provided (moved above early returns)
  const groupedData = useMemo(() => {
    if (!categoryGroups) return [{ key: 'all', label: '', items: paginatedData }];
    const groups = categoryGroups.map(group => ({
      key: group.key,
      label: group.label,
      items: paginatedData.filter(item =>
        group.items.some(itemKey => item[itemKey])
      )
    }));
    return groups.filter(group => group.items.length > 0);
  }, [paginatedData, categoryGroups]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-gray-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading data...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-12 text-red-400">
          <div className="text-center">
            <p className="text-lg font-semibold">Failed to load data</p>
            <p className="text-sm mt-2">{error}</p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sort handler
  const handleSort = (key: keyof T) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;

    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon
  const getSortIcon = (key: keyof T) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 opacity-50" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />;
  };

  // Format cell value
  const formatCellValue = (column: ListViewColumn<T>, item: T) => {
    const value = item[column.key];
    
    if (column.render) {
      return column.render(value, item);
    }
    
    if (value === null || value === undefined) {
      return <span className="text-gray-500">—</span>;
    }
    
    return String(value);
  };

  return (
    <div className={`rounded-xl bg-gray-800/80 p-6 shadow-lg ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          {title && (
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          )}
          <span className="text-sm text-gray-400">
            {sortedData.length} {sortedData.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          )}
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {sortedData.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">{emptyMessage}</p>
          {searchTerm && (
            <p className="text-sm mt-2">
              No results found for "{searchTerm}"
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedData.map(group => (
            <div key={group.key}>
              {group.label && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wide">
                    {group.label}
                  </h4>
                </div>
              )}
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      {columns.map(column => (
                        <th
                          key={String(column.key)}
                          className={`text-left py-3 px-4 text-sm font-medium text-gray-400 ${
                            column.sortable ? 'cursor-pointer hover:text-white' : ''
                          } ${column.className || ''}`}
                          style={{ width: column.width }}
                          onClick={() => column.sortable && handleSort(column.key)}
                        >
                          <div className="flex items-center gap-2">
                            {column.label}
                            {column.sortable && getSortIcon(column.key)}
                          </div>
                        </th>
                      ))}
                      {actions.length > 0 && (
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, index) => (
                      <tr
                        key={getItemKey(item, index)}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                      >
                        {columns.map(column => (
                          <td
                            key={String(column.key)}
                            className={`py-3 px-4 text-sm text-white ${column.className || ''}`}
                          >
                            {formatCellValue(column, item)}
                          </td>
                        ))}
                        {actions.length > 0 && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {actions.map((action, actionIndex) => (
                                <button
                                  key={actionIndex}
                                  onClick={() => action.onClick(item)}
                                  disabled={action.disabled?.(item)}
                                  className={`p-2 rounded-md transition-colors ${
                                    action.className || 'text-gray-400 hover:text-white hover:bg-gray-600'
                                  } ${action.disabled?.(item) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title={action.label}
                                >
                                  {action.icon || <MoreHorizontal className="w-4 h-4" />}
                                </button>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {group.items.map((item, index) => (
                  <div
                    key={getItemKey(item, index)}
                    className="bg-gray-700/50 rounded-lg p-4"
                  >
                    {columns.map(column => (
                      <div key={String(column.key)} className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-400">{column.label}:</span>
                        <span className="text-sm text-white font-medium">
                          {formatCellValue(column, item)}
                        </span>
                      </div>
                    ))}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-600">
                        {actions.map((action, actionIndex) => (
                          <button
                            key={actionIndex}
                            onClick={() => action.onClick(item)}
                            disabled={action.disabled?.(item)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                              action.className || 'bg-gray-600 text-white hover:bg-gray-500'
                            } ${action.disabled?.(item) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-white transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-2">
          Debug: {paginatedData.length} items displayed, {totalPages} pages, Search: "{searchTerm}", Sort: {sortConfig.key ? `${String(sortConfig.key)} ${sortConfig.direction}` : 'none'}
        </div>
      )}
    </div>
  );
}