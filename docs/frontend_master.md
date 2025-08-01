# Frontend Master Documentation

## Overview

The Portfolio Tracker frontend is a modern **Next.js 15.3.5** application built with React 19.1.0, TypeScript 5.8.3, and Tailwind CSS 3.4.1. It provides a comprehensive financial analytics platform for investment portfolio management with real-time data visualization, portfolio tracking, and advanced analytics.

## Architecture Overview

### Technology Stack (Current)

**Core Framework:**
- **Next.js**: 15.3.5 with App Router
- **React**: 19.1.0 (latest)
- **TypeScript**: 5.8.3 with strict mode enabled
- **Node.js**: 18+ required

**State Management & Data:**
- **React Query**: @tanstack/react-query 5.81.5 for server state
- **Supabase Client**: @supabase/supabase-js 2.50.3 for auth and database

**UI & Styling:**
- **Tailwind CSS**: 3.4.1 with custom configuration
- **Charts**: ApexCharts 4.7.0 with react-apexcharts 1.7.0
- **Icons**: Heroicons, Lucide React, React Icons
- **Utilities**: clsx, tailwind-merge for conditional styling

**Build & Development:**
- **Bundle Analysis**: @next/bundle-analyzer for performance monitoring
- **Testing**: Jest 30.0.4 with Testing Library
- **Linting**: ESLint 9.30.1 with TypeScript support
- **Performance**: Bundle size limits (362KB target)

**Cross-Platform Shared Module:**
- **@portfolio-tracker/shared**: Unified API client and types
- **Mobile Support**: Shared components for React Native/Expo

### Design Patterns
- **App Router**: Next.js 13+ app directory structure with layout/page pattern
- **Server/Client Components**: Strategic separation of server and client components
- **Provider Pattern**: Context providers for authentication and React Query
- **Custom Hooks**: Centralized data fetching and state management
- **Component Composition**: Reusable UI components with consistent interfaces
- **Conditional Rendering**: Layout adaptation based on authentication state

## Project Structure

```
frontend/src/
├── app/                          # Next.js App Router pages
│   ├── analytics/               # Analytics dashboard page
│   ├── auth/                    # Authentication page
│   ├── dashboard/               # Main dashboard page
│   ├── portfolio/               # Portfolio management page
│   ├── research/                # Stock research page
│   ├── settings/                # User settings pages
│   ├── stock/[ticker]/          # Dynamic stock detail pages
│   ├── transactions/            # Transaction management page
│   ├── watchlist/               # Watchlist page
│   ├── globals.css              # Global CSS styles
│   ├── layout.tsx               # Root layout component
│   └── page.tsx                 # Home page component
├── components/                   # Reusable components
│   ├── charts/                  # Chart components (ApexCharts/Victory)
│   ├── ui/                      # Base UI components
│   ├── AuthGuard.tsx            # Route protection component
│   ├── AuthProvider.tsx         # Authentication context provider
│   ├── ConditionalLayout.tsx    # Layout switcher component
│   └── Providers.tsx            # React Query provider
├── hooks/                       # Custom React hooks
│   ├── useCompanyIcon.ts        # Company icon management
│   ├── usePerformance.ts        # Portfolio performance data
│   ├── usePortfolioAllocation.ts # Portfolio allocation data
│   └── usePriceData.ts          # Stock price data
├── lib/                         # Utility libraries
│   ├── config.ts                # Application configuration
│   ├── front_api_client.ts      # API client (re-exports from shared)
│   ├── supabaseClient.ts        # Supabase client configuration
│   ├── theme.ts                 # Theme configuration
│   ├── utils.ts                 # General utilities
│   └── validation.ts            # Data validation utilities
├── styles/                      # Additional styling
│   └── theme.ts                 # Theme constants
└── types/                       # TypeScript type definitions
    ├── api.ts                   # API response types
    ├── dividend.ts              # Dividend-specific types
    ├── index.ts                 # Main type exports
    └── stock-research.ts        # Research-specific types
```

## Component Hierarchy and Design Patterns

### Root Layout Structure
```
RootLayout
├── Providers (React Query)
│   ├── AuthProvider (Supabase Auth)
│   │   ├── ToastProvider (Notifications)
│   │   │   └── ConditionalLayout (Route-based layout)
│   │   │       ├── SimpleLayout (Home/Auth pages)
│   │   │       ├── AuthenticatedLayout (Main app)
│   │   │       │   ├── Header (Navigation bar)
│   │   │       │   └── Main (Page content)
│   │   │       └── UnauthenticatedLayout (Redirect to auth)
```

### Page Component Pattern
Each page follows a consistent structure:
```typescript
// Example: dashboard/page.tsx
export default function DashboardPage() {
  return (
    <DashboardProvider>        {/* Page-specific context */}
      <div className="space-y-6">
        <GradientText>Title</GradientText>
        <Suspense fallback={<Skeleton />}>
          <DataComponent />    {/* Data-fetching components */}
        </Suspense>
      </div>
    </DashboardProvider>
  )
}
```

### Component Design Patterns

#### 1. Data Fetching Components
Components that fetch data using React Query:
```typescript
// Example: KPIGrid component
function KPIGrid() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => front_api_client.getDashboardOverview()
  })
  
  if (isLoading) return <Skeleton />
  if (error) return <ErrorState />
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {data.metrics.map(metric => (
        <KPICard key={metric.label} {...metric} />
      ))}
    </div>
  )
}
```

#### 2. Chart Components
Chart components using ApexCharts:
```typescript
// Example: PortfolioChartApex
function PortfolioChartApex() {
  const { portfolioData, benchmarkData } = usePerformance('MAX', 'SPY')
  
  const chartOptions = useMemo(() => ({
    chart: { type: 'line', theme: { mode: 'dark' } },
    xaxis: { type: 'datetime' },
    // ... chart configuration
  }), [])
  
  return (
    <Chart
      options={chartOptions}
      series={series}
      type="line"
      height={400}
    />
  )
}
```

#### 3. UI Components
Reusable UI components with consistent theming:
```typescript
// Example: Button component
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

export function Button({ variant = 'primary', size = 'md', children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-md font-medium transition-colors',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-transparent border border-gray-300',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

## State Management with React Query

### Configuration
React Query is configured with optimized defaults in `Providers.tsx`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 10 * 60 * 1000,       // 10 minutes garbage collection
      retry: 1,                      // Single retry on failure
      refetchOnWindowFocus: false,   // Prevent excessive refetching
      refetchOnReconnect: false,     // Don't refetch on reconnect
      refetchInterval: false,        // Disable automatic refetching
    },
  },
})
```

### Data Fetching Patterns

#### 1. Custom Hooks Pattern
Each data domain has dedicated hooks:
```typescript
// usePerformance.ts - Portfolio performance data
export function usePerformance(
  range: RangeKey = 'MAX', 
  benchmark: BenchmarkTicker = 'SPY',
  options: UsePerformanceOptions = {}
): UsePerformanceResult {
  const { user } = useAuth()
  
  return useQuery({
    queryKey: ['performance', range, benchmark, user?.id],
    queryFn: async () => {
      const response = await front_api_client.front_api_get_performance(range, benchmark)
      // Data validation and sanitization
      return validateAndSanitizeResponse(response)
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000, // 30 minutes for chart data
    ...options
  })
}
```

#### 2. Query Key Patterns
Consistent query key naming:
```typescript
// Pattern: [domain, ...parameters, userId]
['performance', range, benchmark, userId]
['dashboard', 'overview', userId]
['portfolio', 'allocation', groupBy, userId]
['stock', ticker, 'quote']
```

#### 3. Error Handling
Consistent error handling across components:
```typescript
const { data, isLoading, error, refetch } = useQuery(...)

if (isLoading) return <LoadingSkeleton />
if (error) return <ErrorBoundary error={error} retry={refetch} />
```

## Authentication Flow and User Management

### Supabase Authentication Integration
Authentication is handled through Supabase with custom AuthProvider:

```typescript
// AuthProvider.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Initialize session
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        setSession(session)
      } else if (pathname !== '/auth' && pathname !== '/') {
        router.replace('/auth')
      }
      setIsLoading(false)
    }
    
    init()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          setSession(session)
        } else {
          setUser(null)
          setSession(null)
          if (pathname !== '/auth' && pathname !== '/') {
            router.replace('/auth')
          }
        }
        setIsLoading(false)
      }
    )
    
    return () => subscription.unsubscribe()
  }, [router, pathname])
  
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    router.push('/auth')
  }
  
  return (
    <AuthContext.Provider value={{ user, session, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Authentication States
1. **Loading State**: Shows spinner while checking authentication
2. **Authenticated**: Full app layout with navigation
3. **Unauthenticated**: Redirects to auth page or shows login prompt
4. **Public Routes**: Home page and auth page accessible without login

### Route Protection
Routes are protected through ConditionalLayout:
```typescript
export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { user, isLoading } = useAuth()
  const pathname = usePathname()
  
  if (isLoading) return <LoadingScreen />
  
  // Public routes
  if (pathname === '/auth' || pathname === '/') {
    return <div className="min-h-screen">{children}</div>
  }
  
  // Protected routes
  if (user) {
    return <AuthenticatedLayout>{children}</AuthenticatedLayout>
  }
  
  // Redirect to auth
  return <UnauthenticatedRedirect />
}
```

## UI Components and Styling Approach

### Tailwind CSS Implementation
The application uses a dark theme with consistent design tokens:

```css
/* globals.css */
:root {
  --bg-primary: #0D1117;
  --text-primary: #FFFFFF;
  --text-secondary: #8B949E;
  --button-bg: #FFFFFF;
  --button-text: #0D1117;
  --accent-green: #238636;
  --border-color: #30363D;
}

/* Component classes */
.btn-primary {
  @apply bg-white text-[#0D1117] px-4 py-2 rounded-md hover:bg-gray-100 transition-colors font-medium;
}

.card {
  @apply bg-[#0D1117] rounded-lg shadow-sm border border-[#30363D] p-6 text-white;
}
```

### Tailwind Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      animation: {
        'marquee-continuous': 'marquee-continuous 30s linear infinite',
        'shimmer': 'shimmer 2s infinite',
      },
    },
  },
}
```

### Component Library Structure
```
components/ui/
├── button.tsx          # Button variants
├── card.tsx           # Card container
├── input.tsx          # Form inputs
├── label.tsx          # Form labels
├── textarea.tsx       # Text areas
├── Toast.tsx          # Notification system
├── GradientText.tsx   # Gradient text component
└── CompanyIcon.tsx    # Company icon display
```

### Design Patterns

#### 1. Consistent Color Palette
- **Background**: `#0D1117` (GitHub dark theme)
- **Text Primary**: `#FFFFFF`
- **Text Secondary**: `#8B949E`
- **Borders**: `#30363D`
- **Accent**: Blue gradient (`#3b82f6` to `#2563eb`)

#### 2. Typography
- **Font**: Inter (Google Fonts)
- **Headings**: GradientText component with purple-blue gradient
- **Body**: Regular white text on dark background

#### 3. Spacing and Layout
- **Container**: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- **Grid**: Responsive grid with `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Spacing**: Consistent `space-y-6` between sections

## Data Visualization with Charts

### Chart Libraries
The application uses two main charting libraries:

#### 1. ApexCharts (Primary)
Used for complex financial charts:
```typescript
// Example: PortfolioChartApex.tsx
import Chart from 'react-apexcharts'

const chartOptions = {
  chart: {
    type: 'line',
    height: 400,
    background: 'transparent',
    theme: { mode: 'dark' }
  },
  stroke: {
    curve: 'smooth',
    width: 2
  },
  xaxis: {
    type: 'datetime',
    labels: { style: { colors: '#8B949E' } }
  },
  yaxis: {
    labels: { 
      style: { colors: '#8B949E' },
      formatter: (value) => formatCurrency(value)
    }
  },
  tooltip: {
    theme: 'dark',
    x: { format: 'MMM dd, yyyy' }
  }
}
```

#### 2. Victory.js (Secondary)
Used for simpler charts and specific visualizations:
```typescript
import { VictoryChart, VictoryLine, VictoryTheme } from 'victory'

<VictoryChart
  theme={VictoryTheme.material}
  height={300}
  padding={{ left: 80, top: 20, right: 40, bottom: 60 }}
>
  <VictoryLine
    data={chartData}
    x="date"
    y="value"
    style={{
      data: { stroke: "#3b82f6", strokeWidth: 2 }
    }}
  />
</VictoryChart>
```

### Chart Components

#### 1. Portfolio Performance Charts
- **PortfolioChartApex**: Main portfolio vs benchmark comparison
- **PortfolioPerformanceChart**: Historical performance visualization
- **AllocationTableApex**: Portfolio allocation breakdown

#### 2. Financial Analysis Charts
- **FinancialsChart**: Company financial data visualization
- **PriceChartApex**: Stock price movements
- **DividendChartApex**: Dividend tracking and forecasting

#### 3. Dashboard Charts  
- **KPIGrid**: Key performance indicators
- **DailyMovers**: Top gainers/losers visualization
- **FxTicker**: Foreign exchange rates ticker

### Chart Data Processing
Charts use custom hooks for data processing:
```typescript
// usePerformance hook processes raw API data
const { portfolioData, benchmarkData, metrics } = usePerformance('MAX', 'SPY')

// Data is sanitized and validated:
const sanitizeDataPoint = (point: any): PerformanceDataPoint => {
  return {
    date: point.date,
    value: typeof point.value === 'number' ? point.value : 0,
    total_value: typeof point.total_value === 'number' ? point.total_value : 0,
  }
}
```

## Routing and Navigation Patterns

### Next.js App Router Structure
The application uses Next.js 14 App Router with the following structure:

```
app/
├── layout.tsx              # Root layout (always rendered)
├── page.tsx               # Home page (/)
├── auth/
│   └── page.tsx          # Authentication (/auth)
├── dashboard/
│   ├── page.tsx          # Dashboard (/dashboard)
│   ├── components/       # Dashboard-specific components
│   └── contexts/         # Dashboard context providers
├── portfolio/
│   └── page.tsx          # Portfolio (/portfolio)
├── analytics/
│   └── page.tsx          # Analytics (/analytics)
├── research/
│   └── page.tsx          # Research (/research)
├── transactions/
│   └── page.tsx          # Transactions (/transactions)
├── watchlist/
│   └── page.tsx          # Watchlist (/watchlist)
├── settings/
│   ├── layout.tsx        # Settings layout
│   ├── profile/
│   │   └── page.tsx      # Profile settings (/settings/profile)
│   └── account/
│       └── page.tsx      # Account settings (/settings/account)
└── stock/
    └── [ticker]/
        └── page.tsx      # Dynamic stock pages (/stock/AAPL)
```

### Navigation Component
The main navigation is implemented in ConditionalLayout:

```typescript
const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { href: '/watchlist', icon: Star, label: 'Watchlist' },
  { href: '/transactions', icon: PlusCircle, label: 'Transactions' },
  { href: '/research', icon: Search, label: 'Research' },
]

// Desktop Navigation
<nav className="hidden md:flex items-center space-x-1">
  {navItems.map((item) => {
    const Icon = item.icon
    const isActive = pathname === item.href
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? 'bg-[#30363D] text-white'
            : 'text-[#8B949E] hover:text-white hover:bg-[#30363D]/50'
        }`}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    )
  })}
</nav>
```

### Route Protection
Routes are protected through the ConditionalLayout component:

1. **Public Routes**: `/` and `/auth` - accessible without authentication
2. **Protected Routes**: All other routes require authentication
3. **Redirect Logic**: Unauthenticated users are redirected to `/auth`

### Navigation State Management
- **Active Route**: Determined by `usePathname()` hook
- **Mobile Menu**: State managed with `useState` for responsive navigation
- **Dropdown Menus**: Settings and "Add" dropdowns with click-outside handling

## API Integration and Data Fetching

### API Client Architecture
The frontend uses a centralized API client that re-exports from a shared module:

```typescript
// frontend/src/lib/front_api_client.ts
// Re-export all API functions from the shared module
export * from '../../../shared/api/front_api_client';

// Re-export utilities and types
export * from '../../../shared/utils/formatters';
export * from '../../../shared/types/api-contracts';
```

### Shared API Client
The actual API client is located in the shared module:

```typescript
// shared/api/front_api_client.ts
import { getSupabase } from '../utils/supabaseClient';

// API Configuration
const apiConfig: APIConfig = {
  version: 'v1', // Default to v1 for backward compatibility
  autoTransform: true
};

// Helper functions
export function setAPIVersion(version: 'v1' | 'v2', autoTransform: boolean = true): void {
  apiConfig.version = version;
  apiConfig.autoTransform = autoTransform;
}
```

### Data Flow Pattern
The application follows a strict data flow pattern as specified in CLAUDE.md:

1. **Frontend → Backend → Supabase**: Standard flow for data that exists in Supabase
2. **Frontend → Backend → Alpha Vantage → Supabase → Backend → Frontend**: For external market data

### API Integration Patterns

#### 1. Authentication-Aware Requests
All API requests include JWT tokens from Supabase:
```typescript
const { user, session } = useAuth()

const { data } = useQuery({
  queryKey: ['dashboard', user?.id],
  queryFn: async () => {
    // Session token automatically included via Supabase client
    return await front_api_client.getDashboardOverview()
  },
  enabled: !!user
})
```

#### 2. Error Handling
Consistent error handling across all API calls:
```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['portfolio', userId],
  queryFn: () => fetchPortfolioData(userId),
  retry: (failureCount, error) => {
    // Don't retry on 401/403 errors
    if (error.status === 401 || error.status === 403) return false
    return failureCount < 3
  },
  onError: (error) => {
    if (error.status === 401) {
      // Redirect to auth on unauthorized
      router.push('/auth')
    }
  }
})
```

#### 3. Data Transformation
API responses are validated and transformed:
```typescript
// Example from usePerformance hook
const validateAndSanitizeResponse = (response: any): PerformanceResponse => {
  // Validate response structure
  if (!response?.success) {
    throw new Error('Invalid API response')
  }
  
  // Sanitize data points
  const sanitizedPortfolioData = response.portfolio_performance
    .map((point: any) => ({
      date: point.date,
      value: typeof point.value === 'number' ? point.value : 0,
      total_value: typeof point.total_value === 'number' ? point.total_value : 0,
    }))
    .filter((point: any) => point !== null)
  
  return {
    success: true,
    portfolio_performance: sanitizedPortfolioData,
    // ... other validated fields
  }
}
```

### Caching Strategy
React Query provides intelligent caching:

1. **Stale Time**: 5 minutes for most queries, 30 minutes for chart data
2. **Garbage Collection**: 10 minutes for query cleanup
3. **Background Refetching**: Disabled to prevent excessive API calls
4. **Query Invalidation**: Strategic invalidation on data mutations

## Future Architecture: Load Everything Once Pattern

### Planned Optimization
The frontend is being refactored to implement a "Load Everything Once" pattern to dramatically improve performance and reduce complexity:

**Current State (Multiple API Calls)**:
- Dashboard requires 7-8 separate API calls
- Individual hooks: `usePortfolioAllocation`, `usePerformance`, etc.
- Multiple React Query cache entries
- Slow page navigation due to new API calls

**Planned State (Single API Call)**:
- New `useSessionPortfolio` hook loads all data in one call
- Single `/api/portfolio/complete` endpoint
- 30-minute cache with cross-page persistence
- Instant page navigation after initial load

**Expected Improvements**:
- **87.5% reduction** in API calls (8 calls → 1 call)
- **80% faster** dashboard load times (3-5s → 0.5-1s)
- **Instant page navigation** after initial load
- **4,100+ lines of code eliminated** from data fetching complexity

**Implementation Strategy**:
```typescript
// New unified hook
const useSessionPortfolio = () => {
  return useQuery({
    queryKey: ['session-portfolio'],
    queryFn: () => apiClient.get('/api/portfolio/complete'),
    staleTime: 30 * 60 * 1000, // 30 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour in memory
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

// Derived hooks for specific data sections
const usePortfolioSummary = () => {
  const { data } = useSessionPortfolio();
  return { data: data?.portfolio_data };
};
```

### Current Data Flow vs. Planned
**Current**: Component → Individual Hook → API Call → Backend → Database
**Planned**: Component → Session Hook → Single API Call → Aggregated Backend → Cached Data

This architectural change will transform the application into a fast, maintainable system with significantly reduced complexity.

---

## Build Configuration and Deployment Setup

### Next.js Configuration
```javascript
// next.config.js
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Allows builds with type errors
  },
  eslint: {
    ignoreDuringBuilds: true, // Allows builds with ESLint errors
  },
  // Docker hot reload optimization
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
  // Transpile the shared module
  transpilePackages: ['@portfolio-tracker/shared'],
}
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "es2015",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Docker Configuration
The application includes Docker support for development and production:

#### Development Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

#### Production Dockerfile
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Configuration
The application uses environment variables for configuration:

```typescript
// lib/config.ts
export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'development',
  isDevelopment: process.env.NEXT_PUBLIC_ENVIRONMENT === 'development',
  isProduction: process.env.NEXT_PUBLIC_ENVIRONMENT === 'production',
} as const;
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_API_URL`
- `NEXT_PUBLIC_ENVIRONMENT`

### Build Scripts
```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  }
}
```

## Current Styling and Theming Approach

### Theme System
The application uses a consistent dark theme with GitHub-inspired colors:

#### Color Palette
```css
:root {
  --bg-primary: #0D1117;      /* Main background */
  --text-primary: #FFFFFF;     /* Primary text */
  --text-secondary: #8B949E;   /* Secondary text */
  --button-bg: #FFFFFF;        /* Button background */
  --button-text: #0D1117;      /* Button text */
  --accent-green: #238636;     /* Success/positive */
  --border-color: #30363D;     /* Borders and dividers */
}
```

#### Component Classes
```css
.btn-primary {
  @apply bg-white text-[#0D1117] px-4 py-2 rounded-md hover:bg-gray-100 transition-colors font-medium;
}

.btn-secondary {
  @apply bg-transparent text-white px-4 py-2 rounded-md border border-[#30363D] hover:bg-[#30363D] transition-colors;
}

.card {
  @apply bg-[#0D1117] rounded-lg shadow-sm border border-[#30363D] p-6 text-white;
}

.metric-card {
  @apply bg-[#0D1117] rounded-lg shadow-sm border border-[#30363D] p-4 text-center text-white;
}
```

### Gradient System
Special gradient text component for headings:
```typescript
// GradientText.tsx
export default function GradientText({ children, className = '' }: GradientTextProps) {
  return (
    <span 
      className={className}
      style={{
        background: 'linear-gradient(90deg, #8A2BE2 0%, #4B3CFA 50%, #4FC3F7 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </span>
  );
}
```

### Responsive Design
The theme includes comprehensive responsive design patterns:

#### Breakpoints
- **Mobile**: Default styles
- **Tablet**: `md:` prefix (768px+)
- **Desktop**: `lg:` prefix (1024px+)
- **Wide**: `xl:` prefix (1280px+)

#### Layout Patterns
```css
/* Container pattern */
.container {
  @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8;
}

/* Grid patterns */
.grid-responsive {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6;
}

/* Navigation patterns */
.nav-desktop {
  @apply hidden md:flex items-center space-x-1;
}

.nav-mobile {
  @apply md:hidden border-t border-[#30363D];
}
```

### Animation System
Custom animations for enhanced user experience:
```css
@keyframes marquee-continuous {
  0% { transform: translateX(0%); }
  100% { transform: translateX(-100%); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-marquee-continuous {
  animation: marquee-continuous 30s linear infinite;
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
```

## Key Implementation Examples

### 1. Dashboard KPI Grid
```typescript
// dashboard/components/KPIGrid.tsx
export default function KPIGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => front_api_client.getDashboardOverview(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) return <KPIGridSkeleton />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {data?.kpis.map((kpi) => (
        <KPICard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          change={kpi.change}
          changePercent={kpi.changePercent}
          trend={kpi.trend}
        />
      ))}
    </div>
  );
}
```

### 2. Portfolio Performance Chart
```typescript
// components/charts/PortfolioChartApex.tsx
export default function PortfolioChartApex() {
  const [range, setRange] = useState<RangeKey>('MAX');
  const [benchmark, setBenchmark] = useState<BenchmarkTicker>('SPY');
  
  const { portfolioData, benchmarkData, metrics, isLoading } = usePerformance(range, benchmark);

  const chartOptions = useMemo(() => ({
    chart: {
      type: 'line',
      height: 400,
      background: 'transparent',
      theme: { mode: 'dark' },
      toolbar: { show: false },
    },
    stroke: {
      curve: 'smooth',
      width: [3, 2],
    },
    colors: ['#3b82f6', '#f59e0b'],
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: '#8B949E' } },
    },
    yaxis: {
      labels: { 
        style: { colors: '#8B949E' },
        formatter: (value: number) => formatCurrency(value)
      },
    },
    tooltip: {
      theme: 'dark',
      shared: true,
      intersect: false,
    },
    legend: {
      labels: { colors: ['#FFFFFF'] },
    },
  }), []);

  const series = [
    {
      name: 'Portfolio',
      data: portfolioData.map(point => [new Date(point.date).getTime(), point.value]),
    },
    {
      name: `${benchmark} Benchmark`,
      data: benchmarkData.map(point => [new Date(point.date).getTime(), point.value]),
    },
  ];

  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <GradientText className="text-lg font-semibold">Portfolio Performance</GradientText>
        <div className="flex gap-2">
          {/* Range selector buttons */}
          {(['7D', '1M', '3M', '1Y', 'YTD', 'MAX'] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-sm rounded ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'text-[#8B949E] hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      
      <Chart options={chartOptions} series={series} type="line" height={400} />
      
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-sm text-[#8B949E]">Portfolio Return</div>
            <div className={`font-semibold ${metrics.portfolio_return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercentage(metrics.portfolio_return_pct)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-[#8B949E]">Benchmark Return</div>
            <div className={`font-semibold ${metrics.index_return_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercentage(metrics.index_return_pct)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-[#8B949E]">Outperformance</div>
            <div className={`font-semibold ${metrics.outperformance_pct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercentage(metrics.outperformance_pct)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-[#8B949E]">Absolute Difference</div>
            <div className={`font-semibold ${metrics.absolute_outperformance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(metrics.absolute_outperformance)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Authentication Form
```typescript
// auth/page.tsx
export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // Validate signup requirements
        if (!fullName.trim()) {
          setMessage('Full name is required');
          return;
        }
        
        if (password.length < 8) {
          setMessage('Password must be at least 8 characters long');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() }
          }
        });

        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        // AuthProvider will handle redirect
      }
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <GradientText className="text-3xl font-bold">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </GradientText>
          <p className="mt-2 text-[#8B949E]">
            {isSignUp 
              ? 'Join Portfolio Tracker today' 
              : 'Welcome back to Portfolio Tracker'
            }
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isSignUp && (
            <div>
              <label htmlFor="fullName" className="sr-only">Full Name</label>
              <input
                id="fullName"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-[#30363D] placeholder-[#8B949E] text-white bg-[#0D1117] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              type="email"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-[#30363D] placeholder-[#8B949E] text-white bg-[#0D1117] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-[#30363D] placeholder-[#8B949E] text-white bg-[#0D1117] focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {message && (
            <div className={`text-sm p-3 rounded ${
              message.includes('Check your email') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-[#0D1117] bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-blue-400 hover:text-blue-300 text-sm"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 4. Custom Hook Example
```typescript
// hooks/usePortfolioAllocation.ts
import { useQuery } from '@tanstack/react-query';
import { front_api_client } from '@/lib/front_api_client';
import { useAuth } from '@/components/AuthProvider';

export interface AllocationData {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

export function usePortfolioAllocation(groupBy: 'sector' | 'holding' = 'sector') {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['portfolio-allocation', groupBy, user?.id],
    queryFn: async (): Promise<AllocationData[]> => {
      const response = await front_api_client.getPortfolioAllocation(groupBy);
      
      // Transform API response to chart format
      return response.data.map((item: any, index: number) => ({
        label: item.name || item.symbol,
        value: item.current_value,
        percentage: item.percentage,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
];
```

## Summary

The Portfolio Tracker frontend is a modern, well-structured Next.js application that successfully implements:

1. **Modern Architecture**: Next.js 14 App Router with React 19 and TypeScript
2. **Consistent Design**: Dark theme with GitHub-inspired colors and responsive design
3. **Robust State Management**: React Query for server state with intelligent caching
4. **Secure Authentication**: Supabase Auth with proper route protection
5. **Rich Visualizations**: ApexCharts and Victory.js for financial data visualization
6. **Performance Optimization**: Strategic caching, lazy loading, and optimized re-renders
7. **Code Organization**: Clear separation of concerns with reusable components and custom hooks
8. **Type Safety**: Comprehensive TypeScript coverage with shared type definitions
9. **Developer Experience**: Hot reload, comprehensive tooling, and consistent patterns

The application follows modern React patterns and provides a solid foundation for a professional financial analytics platform.