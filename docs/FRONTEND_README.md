# Portfolio Tracker Frontend

## Overview

The Portfolio Tracker frontend is a modern Next.js 14 application built with TypeScript, React Query, and Tailwind CSS. It provides a comprehensive portfolio management interface with real-time data visualization and strict type safety.

## Architecture

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **State Management**: React Query v5
- **Styling**: Tailwind CSS
- **Charts**: ApexCharts, Plotly.js
- **Authentication**: Supabase Auth
- **API Client**: Custom typed client with v2 API integration

### Project Structure
```
frontend/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── analytics/         # Analytics page & components
│   │   ├── auth/             # Authentication page
│   │   ├── dashboard/        # Dashboard page & components
│   │   ├── portfolio/        # Portfolio management
│   │   ├── research/         # Stock research tools
│   │   ├── settings/         # User settings
│   │   ├── transactions/     # Transaction management
│   │   └── watchlist/        # Watchlist management
│   ├── components/           # Shared components
│   │   ├── charts/          # Chart components (Apex, Plotly)
│   │   ├── ui/              # UI primitives
│   │   └── ...              # Feature-specific components
│   ├── hooks/               # Custom React hooks
│   │   └── api/            # API-specific hooks
│   ├── lib/                # Utilities and configuration
│   ├── types/              # TypeScript type definitions
│   └── styles/             # Global styles and theme
├── public/                 # Static assets
│   └── icons/             # Stock, crypto, forex icons
└── tests/                 # Test files
```

## V2 API Integration

### API Client Configuration

The frontend uses a centralized API client (`lib/front_api_client.ts`) that:
- Handles all HTTP requests to the backend
- Manages authentication headers automatically
- Provides consistent error handling
- Ensures type safety for all API calls

### Authentication Flow

```typescript
// Authentication is handled via Supabase
// The API client automatically includes auth headers from Supabase session
const { data: { session } } = await supabase.auth.getSession();
// Headers are automatically added to all API requests
```

### API Response Format

All API responses follow the standardized format defined in `shared/types/api-contracts.ts`:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata: {
    timestamp: string;
    version: string;
    [key: string]: any;
  };
}
```

### Common API Patterns

#### 1. Dashboard Data
```typescript
// Dashboard context manages data fetching
const { portfolioData, isLoading } = useDashboardData();

// Force refresh pattern
const refreshDashboard = async (forceRefresh = true) => {
  const response = await apiClient.get<DashboardData>(
    `/api/dashboard?force_refresh=${forceRefresh}`
  );
  return response.data;
};
```

#### 2. Portfolio Operations
```typescript
// Get portfolio holdings
const holdings = await apiClient.portfolio.getHoldings({
  page: 1,
  page_size: 50
});

// Add transaction
const transaction = await apiClient.portfolio.addTransaction({
  symbol: 'AAPL',
  quantity: 10,
  price: 150.00,
  type: 'BUY',
  date: new Date().toISOString()
});
```

#### 3. Research Features
```typescript
// Symbol search
const results = await apiClient.research.searchSymbols({
  query: 'AAPL',
  limit: 10
});

// Get stock details
const stockData = await apiClient.research.getStockOverview('AAPL');
```

## Type Safety Requirements

### Strict TypeScript Configuration

The project enforces strict type safety via `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Type Safety Rules

1. **No `any` Types**: All variables, parameters, and returns must be explicitly typed
   ```typescript
   // ❌ BAD
   const processData = (data: any) => data.value;
   
   // ✅ GOOD
   const processData = (data: StockData): number => data.value;
   ```

2. **Null Safety**: Use proper null checks and optional chaining
   ```typescript
   // ❌ BAD
   const price = data.quote.price;
   
   // ✅ GOOD
   const price = data?.quote?.price ?? 0;
   ```

3. **Type Imports**: Always use type imports for type-only imports
   ```typescript
   // ✅ GOOD
   import type { UserData } from '@/types';
   ```

4. **API Response Typing**: All API calls must specify response types
   ```typescript
   // ✅ GOOD
   const response = await apiClient.get<PortfolioData>('/api/portfolio');
   ```

## Component Patterns

### Dashboard Components
- **KPIGrid**: Displays key performance indicators
- **PortfolioChartApex**: Interactive portfolio value chart
- **DailyMovers**: Shows top gainers/losers
- **FxTicker**: Real-time forex rates

### Portfolio Components
- **HoldingsTable**: Sortable holdings with real-time prices
- **AllocationCharts**: Sector/asset allocation visualization
- **RebalanceCalculator**: Portfolio rebalancing tool

### Research Components
- **StockHeader**: Stock overview with real-time quote
- **FinancialsTab**: Financial statements display
- **NewsTab**: Latest news with sentiment analysis
- **ComparisonTab**: Multi-stock comparison

## Data Management

### React Query Configuration
```typescript
// Stale time and cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)
    }
  }
});
```

### Context Providers
- **AuthProvider**: Manages authentication state
- **DashboardContext**: Centralizes dashboard data management
- **ThemeContext**: Handles dark/light mode

## Performance Optimizations

1. **Code Splitting**: Dynamic imports for heavy components
2. **Image Optimization**: Next.js Image component for icons
3. **Memoization**: React.memo for expensive renders
4. **Virtual Scrolling**: For large data tables
5. **Debounced Search**: Prevents excessive API calls

## Development Guidelines

### Adding New Features

1. Define types in `shared/types/api-contracts.ts`
2. Create API client methods in appropriate service
3. Build components with proper TypeScript types
4. Add loading and error states
5. Write tests for critical paths

### Code Style
- Use functional components with hooks
- Prefer composition over inheritance
- Keep components focused and single-purpose
- Use proper error boundaries
- Follow naming conventions:
  - Components: PascalCase
  - Hooks: camelCase with 'use' prefix
  - Types/Interfaces: PascalCase
  - Constants: UPPER_SNAKE_CASE

### Testing Strategy
- Unit tests for utilities and hooks
- Integration tests for API interactions
- Component tests with React Testing Library
- E2E tests with Playwright

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
npm run test:watch
npm run test:e2e
```

## Environment Variables

Required environment variables (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Troubleshooting

### Common Issues

1. **Type Errors**: Run `npm run type-check` to identify issues
2. **API Errors**: Check network tab for response format
3. **Auth Issues**: Verify Supabase session is valid
4. **Build Errors**: Clear `.next` folder and rebuild

### Debug Mode
Enable debug logging:
```typescript
// In lib/logger.ts
export const DEBUG = process.env.NODE_ENV === 'development';
```

## Future Enhancements

- [ ] WebSocket support for real-time prices
- [ ] Progressive Web App capabilities
- [ ] Advanced charting with TradingView
- [ ] Multi-language support
- [ ] Accessibility improvements (WCAG 2.1 AA)