// Lazy-loaded chart components for code splitting
import dynamic from 'next/dynamic';
import ChartLoadingSpinner from './ChartLazyWrapper';

// Dynamic imports with loading states
export const ApexChart = dynamic(() => import('./ApexChart'), {
  loading: () => <ChartLoadingSpinner height={350} />,
  ssr: false
});

export const StockChart = dynamic(() => import('./StockChart'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

export const PortfolioPerformanceChart = dynamic(() => import('./PortfolioPerformanceChart'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

export const FinancialBarChartApex = dynamic(() => import('./FinancialBarChartApex'), {
  loading: () => <ChartLoadingSpinner height={300} />,
  ssr: false
});

export const FinancialSpreadsheetApex = dynamic(() => import('./FinancialSpreadsheetApex'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

export const PriceChartApex = dynamic(() => import('./PriceChartApex'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

export const ResearchStockChart = dynamic(() => import('./ResearchStockChart'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

export const ApexListView = dynamic(() => import('./ApexListView'), {
  loading: () => <ChartLoadingSpinner height={200} />,
  ssr: false
});

export const PriceEpsChartApex = dynamic(() => import('./PriceEpsChartApex'), {
  loading: () => <ChartLoadingSpinner height={400} />,
  ssr: false
});

// Re-export the loading component
export { default as ChartLoadingSpinner } from './ChartLazyWrapper';