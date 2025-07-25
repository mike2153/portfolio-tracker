# Shared Module

This directory contains shared code between the Next.js frontend and the Expo mobile app.

## Structure

- `api/` - API client code for backend communication
  - `front_api_client.ts` - Main API client with all endpoint methods
  - `index.ts` - Barrel export

- `types/` - Shared TypeScript type definitions
  - `api.ts` - API response and data types
  - `index.ts` - Barrel export

- `utils/` - Shared utility functions
  - `supabaseClient.ts` - Supabase client configuration
  - `logger.ts` - Cross-platform logging utility
  - `index.ts` - Barrel export

## Environment Variables

The shared code supports both Next.js and Expo environment variables:

- Next.js: `NEXT_PUBLIC_*`
- Expo: `EXPO_PUBLIC_*`

Required variables:
- `NEXT_PUBLIC_BACKEND_API_URL` / `EXPO_PUBLIC_BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Usage

### In Frontend (Next.js)

The shared module is installed as a local dependency. Import like any npm package:

```typescript
// Import API client and functions
import { front_api_client, front_api_get_dashboard } from '@portfolio-tracker/shared';

// Import types
import { ApiResponse, DashboardOverview, AnalyticsSummary } from '@portfolio-tracker/shared';

// Import utilities and constants
import { supabase, formatCurrency, COLORS, API_ENDPOINTS } from '@portfolio-tracker/shared';
```

For backward compatibility, the frontend re-exports from `@/lib/front_api_client`.

### In Mobile (React Native/Expo)

Same import pattern:

```typescript
// Import API functions
import { front_api_get_portfolio, authFetch } from '@portfolio-tracker/shared';

// Import types
import { WatchlistItem, NewsItem, ResearchStockQuote } from '@portfolio-tracker/shared';

// Import utilities
import { formatPercentage, formatLargeNumber, validateAddHoldingForm } from '@portfolio-tracker/shared';
```

### Available Exports

**API Functions:**
- All `front_api_*` functions for backend communication
- `authFetch` for custom authenticated requests
- `supabase` client instance

**Types:**
- API response types: `ApiResponse`, `SymbolSearchResponse`, etc.
- Business types: `Holding`, `Portfolio`, `StockQuote`, etc.
- Mobile types: `WatchlistItem`, `NewsItem`, `MarketIndex`, etc.
- Form types: `AddHoldingFormData`, `ValidationResult`, etc.

**Utilities:**
- Formatters: `formatCurrency`, `formatPercentage`, `formatDate`, etc.
- Validators: `isValidEmail`, `isValidTicker`, `validateAddHoldingForm`, etc.
- Constants: `COLORS`, `API_ENDPOINTS`, `TIME_PERIODS`, etc.