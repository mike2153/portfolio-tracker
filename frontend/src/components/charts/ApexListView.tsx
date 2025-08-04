'use client';

import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Loader2 } from 'lucide-react';

export interface ListViewColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: unknown, item: T) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface ListViewAction<T> {
  label: string | ((item: T) => string);
  icon?: React.ReactNode | ((item: T) => React.ReactNode);
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

export default function ApexListView<T extends Record<string, unknown>>({
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
/*
  console.log('[ApexListView] Rendering with data:', {
    dataLength: data?.length,
    columnsCount: columns?.length,
    isLoading,
    error: error?.substring(0, 100)
  });
*/
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
      <div className={`card ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted">
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
      <div className={`card ${className}`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-12 text-red-400">
          <div className="text-center">
            <p className="text-lg font-semibold">Failed to load data</p>
            <p className="text-sm mt-2">{error}</p>
            {onRetry && (
              <button 
                onClick={onRetry}
                className="btn-primary mt-4"
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
      return <span className="text-muted">—</span>;
    }
    
    return String(value);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Hover gradient overlay - matches metric-card-enhanced */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl pointer-events-none"
           style={{
             background: 'linear-gradient(135deg, rgba(178, 165, 255, 0.08) 0%, rgba(197, 167, 228, 0.05) 50%, rgba(255, 186, 139, 0.08) 100%)'
           }}></div>
      
      {/* Content with relative z-index */}
      <div className="relative z-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          {title && (
            <h3 className="section-title group-hover:scale-105 transition-transform duration-300">{title}</h3>
          )}
          <span className="text-sm text-muted group-hover:text-white transition-colors duration-300">
            {sortedData.length} {sortedData.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-2xl text-sm transition-all duration-300 focus:outline-none"
                style={{
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-divider)',
                  color: 'var(--color-text-main)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-accent-purple)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(178, 165, 255, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-divider)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          )}
          
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="btn-secondary"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {sortedData.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="text-lg font-medium">{emptyMessage}</p>
          {searchTerm && (
            <p className="text-sm mt-2">
              No results found for &quot;{searchTerm}&quot;
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedData.map(group => (
            <div key={group.key}>
              {group.label && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wide">
                    {group.label}
                  </h4>
                </div>
              )}
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-divider)' }}>
                      {columns.map(column => (
                        <th
                          key={String(column.key)}
                          className={`text-left py-3 px-4 text-sm font-medium text-muted transition-colors duration-300 ${
                            column.sortable ? 'cursor-pointer' : ''
                          } ${column.className || ''}`}
                          onMouseEnter={(e) => {
                            if (column.sortable) {
                              e.currentTarget.style.color = 'var(--color-text-main)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (column.sortable) {
                              e.currentTarget.style.color = 'var(--color-text-muted)';
                            }
                          }}
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
                        <th className="text-right py-3 px-4 text-sm font-medium text-muted">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item, index) => (
                      <tr
                        key={getItemKey(item, index)}
                        className="transition-all duration-300"
                        style={{ borderBottom: '1px solid rgba(30, 30, 34, 0.5)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--color-bg-surface)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {columns.map(column => (
                          <td
                            key={String(column.key)}
                            className={`py-3 px-4 text-sm ${column.className || ''}`}
                            style={{ color: 'var(--color-text-main)' }}
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
                                  className={`p-2 rounded-xl transition-all duration-300 ${
                                    action.className || 'text-muted'
                                  } ${action.disabled?.(item) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onMouseEnter={(e) => {
                                    if (!action.disabled?.(item)) {
                                      e.currentTarget.style.background = 'var(--color-bg-surface)';
                                      if (!action.className) {
                                        e.currentTarget.style.color = 'var(--color-text-main)';
                                      }
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!action.disabled?.(item)) {
                                      e.currentTarget.style.background = 'transparent';
                                      if (!action.className) {
                                        e.currentTarget.style.color = 'var(--color-text-muted)';
                                      }
                                    }
                                  }}
                                  title={typeof action.label === 'function' ? action.label(item) : action.label}
                                >
                                  {typeof action.icon === 'function' ? action.icon(item) : (action.icon || <MoreHorizontal className="w-4 h-4" />)}
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
                    className="rounded-2xl p-4 transition-all duration-300"
                    style={{
                      background: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-divider)'
                    }}
                  >
                    {columns.map(column => (
                      <div key={String(column.key)} className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted">{column.label}:</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                          {formatCellValue(column, item)}
                        </span>
                      </div>
                    ))}
                    {actions.length > 0 && (
                      <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-divider)' }}>
                        {actions.map((action, actionIndex) => (
                          <button
                            key={actionIndex}
                            onClick={() => action.onClick(item)}
                            disabled={action.disabled?.(item)}
                            className={`px-3 py-1 text-xs rounded-xl transition-all duration-300 ${
                              action.className || 'btn-primary'
                            } ${action.disabled?.(item) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {typeof action.label === 'function' ? action.label(item) : action.label}
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
        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid var(--color-divider)' }}>
          <div className="text-sm text-muted">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 text-xs text-muted pt-2" style={{ borderTop: '1px solid var(--color-divider)' }}>
          Debug: {paginatedData.length} items displayed, {totalPages} pages, Search: &quot;{searchTerm}&quot;, Sort: {sortConfig.key ? `${String(sortConfig.key)} ${sortConfig.direction}` : 'none'}
        </div>
      )}

      {/* Hover reveal: Additional context - matches KPI cards */}
      <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500 mt-4 relative z-20">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-full"></div>
      </div>
      </div>
    </div>
  );
}