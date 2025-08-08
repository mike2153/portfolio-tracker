# Frontend Development Guide - Portfolio Tracker

## Table of Contents
- [Overview](#overview)
- [Recent Fixes and Lessons Learned](#recent-fixes-and-lessons-learned)
- [Development Best Practices](#development-best-practices)
- [Pre-commit Validation](#pre-commit-validation)
- [Architecture Guidelines](#architecture-guidelines)
- [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)

---

## Overview

The Portfolio Tracker frontend is built with **Next.js 15.3.5**, **React 19.1.0**, and **TypeScript 5.8.3**. This guide covers recent fixes, best practices, and guidelines to maintain code quality and prevent common issues.

### Tech Stack
- **Framework**: Next.js 15.3.5 (App Router)
- **Runtime**: React 19.1.0
- **Language**: TypeScript 5.8.3 (strict mode enabled)
- **Styling**: Tailwind CSS 3.4.1
- **State Management**: TanStack React Query 5.81.5
- **Charts**: ApexCharts 4.7.0
- **Authentication**: Supabase Auth Helpers

---

## Recent Fixes and Lessons Learned

### 1. Type Safety Enforcement
**Issue**: Widespread use of `any` types and unsafe type casting
**Fix Applied**: Comprehensive type safety with zero tolerance for type errors

```typescript
// ❌ Before: Unsafe type casting
const user = data as unknown as User;

// ✅ After: Proper type guards and validation
function isValidUser(data: unknown): data is User {
  return data && typeof data === 'object' && 'id' in data;
}

const user = isValidUser(data) ? data : null;
```

**Key Learnings**:
- Never use `as unknown as` casting
- Create proper type guards for runtime validation
- Use strict TypeScript configuration with `noImplicitAny: true`

### 2. Date Handling Corrections
**Issue**: Date-only parsing treated as local time causing chart misalignments
**Fix Applied**: Proper UTC date parsing

```typescript
// ❌ Before: Local timezone parsing
new Date('2024-12-01') // Interpreted in local timezone

// ✅ After: Explicit UTC parsing
new Date('2024-12-01T00:00:00Z') // Explicitly UTC
```

**Key Learnings**:
- Always parse financial dates as UTC
- Use ISO format with timezone specification
- Create utility functions for consistent date handling

### 3. React Keys Optimization
**Issue**: Using array indexes as React keys causing reconciliation problems
**Fix Applied**: Stable, unique keys

```typescript
// ❌ Before: Index-based keys
{holdings.map((holding, index) => (
  <div key={index}>{holding.symbol}</div>
))}

// ✅ After: Stable unique keys
{holdings.map((holding) => (
  <div key={`${holding.symbol}-${holding.id}`}>{holding.symbol}</div>
))}
```

### 4. Environment Variable Standardization
**Issue**: Inconsistent environment variable naming
**Fix Applied**: Standardized to `NEXT_PUBLIC_BACKEND_URL`

```typescript
// ✅ Consistent environment variable usage
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
```

### 5. Async Parameter Handling in Client Components
**Issue**: Using `params: Promise<...>` in client components
**Fix Applied**: Proper hooks for parameter access

```typescript
// ❌ Before: Promise params in client component
export default function ClientPage({ params }: { params: Promise<{ ticker: string }> }) {
  params.then(({ ticker }) => { /* ... */ });
}

// ✅ After: Use useParams in client components
'use client';
import { useParams } from 'next/navigation';

export default function ClientPage() {
  const params = useParams();
  const ticker = params.ticker as string;
}
```

### 6. Production Logging Cleanup
**Issue**: Development console.log statements in production code
**Fix Applied**: Environment-guarded logging

```typescript
// ✅ Proper debug logging
const DEBUG_LOGGING = process.env.NODE_ENV === 'development';

const debugLog = (...args: any[]) => {
  if (DEBUG_LOGGING) {
    console.log(...args);
  }
};
```

### 7. Decimal Number Handling
**Issue**: Scattered `parseFloat` usage causing precision issues
**Fix Applied**: Centralized decimal utilities

```typescript
// ✅ Use centralized decimal utilities
import { safeParseNumber, formatCurrency } from '@/utils/decimal';

const value = safeParseNumber(input, 0); // Safe parsing with fallback
const formatted = formatCurrency(value, 'USD'); // Consistent formatting
```

---

## Development Best Practices

### TypeScript Configuration
Ensure your `tsconfig.json` has strict settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "allowJs": false,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Component Development Guidelines

#### 1. Always Use TypeScript Interfaces
```typescript
interface ComponentProps {
  title: string;
  value: number;
  currency: string;
  isLoading?: boolean;
}

export function KPICard({ title, value, currency, isLoading = false }: ComponentProps) {
  // Component implementation
}
```

#### 2. Implement Proper Error Boundaries
```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div role="alert" className="p-4 border border-red-300 rounded">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Wrap components with error boundaries
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <YourComponent />
</ErrorBoundary>
```

#### 3. Use React Query Properly
```typescript
// ✅ Proper React Query usage with types
import { useQuery } from '@tanstack/react-query';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

function usePortfolioData() {
  return useQuery<ApiResponse<PortfolioData>, Error>({
    queryKey: ['portfolio'],
    queryFn: () => fetchPortfolioData(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
}
```

### Styling Guidelines

#### 1. Use Tailwind with Design Tokens
```typescript
// ✅ Create design system constants
const theme = {
  colors: {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    danger: 'bg-red-600'
  },
  spacing: {
    card: 'p-4',
    section: 'py-8'
  }
};

// Use in components
<div className={`${theme.colors.primary} ${theme.spacing.card}`}>
```

#### 2. Avoid Dynamic Class Names
```typescript
// ❌ Dynamic classes that may be purged
<div className={`bg-${color}-500`} />

// ✅ Use safelist or map to static classes
const colorMap = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500'
};

<div className={colorMap[color]} />
```

---

## Pre-commit Validation

### Automated Quality Checks

Before any commit, ensure these validations pass:

#### 1. TypeScript Compilation
```bash
npx tsc --noEmit
```

#### 2. ESLint Validation
```bash
npm run lint
```

#### 3. Type Safety Verification
```bash
# Run validation script
npm run type-check
```

### Manual Checklist

- [ ] All TypeScript errors resolved
- [ ] No `console.log` statements in production code
- [ ] Proper error handling implemented
- [ ] React keys are stable and unique
- [ ] Environment variables are properly typed
- [ ] Date handling uses UTC parsing
- [ ] No `any` types used
- [ ] Components have proper TypeScript interfaces

---

## Architecture Guidelines

### File Organization
```
src/
├── app/                    # Next.js App Router pages
│   ├── (landing)/         # Route groups
│   ├── dashboard/         
│   └── portfolio/
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   └── charts/           # Chart components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

### Data Fetching Strategy

Use the centralized `useSessionPortfolio` hook for all portfolio data:

```typescript
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio';

function DashboardComponent() {
  const {
    portfolioData,
    performanceData,
    isLoading,
    error,
    hasData
  } = useSessionPortfolio();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay error={error} />;
  if (!hasData) return <EmptyState />;

  return <DashboardContent data={portfolioData} />;
}
```

### State Management Patterns

1. **React Query** for server state
2. **React Context** for global UI state
3. **Local useState** for component-specific state
4. **URL state** for shareable page state

---

## Common Pitfalls and Solutions

### 1. Async Component Issues
```typescript
// ❌ Don't mix server and client component patterns
// ❌ Don't use async in client components

// ✅ Use proper hooks in client components
'use client';
export function ClientComponent() {
  const { data, isLoading } = useQuery(/* ... */);
  
  if (isLoading) return <Loading />;
  return <div>{data}</div>;
}
```

### 2. Memory Leaks in Effects
```typescript
// ✅ Proper cleanup in useEffect
useEffect(() => {
  const controller = new AbortController();
  
  fetchData({ signal: controller.signal })
    .then(setData)
    .catch(handleError);
    
  return () => controller.abort();
}, []);
```

### 3. Form Handling
```typescript
// ✅ Proper form validation and handling
import { useForm } from 'react-hook-form';

interface FormData {
  symbol: string;
  quantity: number;
}

function TransactionForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    try {
      await submitTransaction(data);
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('symbol', { required: 'Symbol is required' })}
        type="text"
      />
      {errors.symbol && <span>{errors.symbol.message}</span>}
      
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## Performance Optimization

### 1. Code Splitting
```typescript
import dynamic from 'next/dynamic';

// Lazy load heavy components
const ChartComponent = dynamic(() => import('./ChartComponent'), {
  loading: () => <ChartSkeleton />
});
```

### 2. Memoization
```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoize expensive calculations
const ExpensiveComponent = memo(function ExpensiveComponent({ data }: Props) {
  const processedData = useMemo(() => {
    return heavyComputation(data);
  }, [data]);

  const handleClick = useCallback(() => {
    // Handle click
  }, []);

  return <div>{processedData}</div>;
});
```

### 3. React Query Optimization
```typescript
// Optimize caching strategy
const queryOptions = {
  staleTime: 5 * 60 * 1000,    // 5 minutes
  cacheTime: 10 * 60 * 1000,   // 10 minutes
  refetchOnWindowFocus: false,
  retry: 1
};
```

---

## Security Considerations

### 1. Environment Variables
```typescript
// ✅ Validate environment variables
const config = {
  apiUrl: process.env.NEXT_PUBLIC_BACKEND_URL || (() => {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is required');
  })(),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || (() => {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  })()
};
```

### 2. Input Validation
```typescript
// ✅ Validate all user inputs
import { z } from 'zod';

const schema = z.object({
  symbol: z.string().min(1).max(10),
  quantity: z.number().positive()
});

function validateInput(data: unknown) {
  return schema.safeParse(data);
}
```

### 3. Error Handling
```typescript
// ✅ Secure error handling
function handleError(error: Error) {
  // Log detailed error server-side
  console.error('Detailed error:', error);
  
  // Show user-friendly message client-side
  setUserError('Something went wrong. Please try again.');
}
```

---

## Conclusion

This guide serves as a comprehensive reference for frontend development on the Portfolio Tracker project. Always prioritize type safety, performance, and user experience. When in doubt, refer to the existing `useSessionPortfolio` hook as an example of best practices implementation.

For questions or clarifications, refer to the `CLAUDE.md` file for the overall development protocol and requirements.

---

**Last Updated**: August 8, 2025  
**Version**: 1.0