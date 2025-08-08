# Frontend Development Guidelines

## Table of Contents
1. [Recent Fixes and Lessons Learned](#recent-fixes-and-lessons-learned)
2. [Development Best Practices](#development-best-practices)
3. [Pre-commit Validation](#pre-commit-validation)
4. [Common Pitfalls and Solutions](#common-pitfalls-and-solutions)
5. [Architecture Guidelines](#architecture-guidelines)
6. [Performance Optimization](#performance-optimization)
7. [Security Considerations](#security-considerations)

---

## Recent Fixes and Lessons Learned

### 1. React Key Prop Issues
**Problem**: Components were using array indices as keys, causing React reconciliation issues.
```tsx
// ❌ BAD - Causes re-render issues
{items.map((item, index) => <Component key={index} />)}

// ✅ GOOD - Stable unique identifier
{items.map((item) => <Component key={item.id} />)}
```

**Why it happened**: Quick prototyping without considering React's reconciliation algorithm.

**Prevention**: 
- Always use unique, stable identifiers (database IDs, UUIDs, or unique property combinations)
- Add ESLint rule: `"react/no-array-index-key": "error"`

### 2. Date Parsing and Timezone Issues
**Problem**: Inconsistent date parsing led to timezone-related bugs in charts.
```tsx
// ❌ BAD - Timezone-dependent parsing
new Date('2024-01-15')  // Parsed as local timezone

// ✅ GOOD - UTC parsing
import { parseUTCDate } from '@/lib/dateUtils'
parseUTCDate('2024-01-15')  // Always UTC
```

**Why it happened**: JavaScript's Date constructor behavior is timezone-dependent.

**Prevention**:
- Always use the centralized `dateUtils` module
- Never use `new Date()` directly for date strings
- Use `getUTCTimestamp()` for chart data points

### 3. TypeScript Type Safety Issues
**Problem**: Unsafe type usage and unused variables cluttering the codebase.
```tsx
// ❌ BAD - Unsafe typing
const data: any = fetchData()
const { unused, value } = props  // unused never used

// ✅ GOOD - Strict typing
const data: PortfolioData = fetchData()
const { value } = props
```

**Why it happened**: Rapid development without strict type checking enabled.

**Prevention**:
- Enable strict TypeScript mode
- Run `npm run type-check` before committing
- Use underscore prefix for intentionally unused vars: `_unused`

### 4. Environment Variable Inconsistency
**Problem**: Multiple names for the same environment variable.
```bash
# ❌ BAD - Multiple names
NEXT_PUBLIC_BACKEND_API_URL
NEXT_PUBLIC_BACKEND_URL

# ✅ GOOD - Single consistent name
NEXT_PUBLIC_BACKEND_URL
```

**Why it happened**: Lack of documentation and multiple developers.

**Prevention**:
- Document all env vars in `.env.example`
- Use TypeScript types for process.env
- Single source of truth in `shared/globals.d.ts`

---

## Development Best Practices

### TypeScript Configuration
```json
// tsconfig.json - Required strict settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Component Development

#### 1. Always Define Proper Interfaces
```tsx
// ✅ GOOD - Clear interface definition
interface ComponentProps {
  id: string
  value: number
  onChange: (value: number) => void
  optional?: string  // Use ? for optional props
}

const Component: React.FC<ComponentProps> = ({ id, value, onChange, optional }) => {
  // Implementation
}
```

#### 2. Use Proper Hooks
```tsx
// ✅ GOOD - Centralized data fetching
import { useSessionPortfolio } from '@/hooks/useSessionPortfolio'

const Dashboard = () => {
  const { portfolio, isLoading, error } = useSessionPortfolio()
  
  if (isLoading) return <Skeleton />
  if (error) return <ErrorBoundary error={error} />
  
  return <PortfolioView data={portfolio} />
}
```

#### 3. Handle Async Operations Properly
```tsx
// ✅ GOOD - Proper async handling in client components
'use client'

import { useParams } from 'next/navigation'

export default function StockPage() {
  const params = useParams<{ ticker: string }>()
  const ticker = params?.ticker || ''
  
  // Never use dynamic imports for Next.js hooks
  // Always import at the top level
}
```

### Data Fetching Strategy
```tsx
// ✅ GOOD - Use React Query for all API calls
import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '@/lib/front_api_client'

const usePortfolioData = () => {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: () => fetchWithAuth('/api/portfolio'),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  })
}
```

---

## Pre-commit Validation

### Automated Checks (Add to package.json)
```json
{
  "scripts": {
    "pre-commit": "npm run lint && npm run type-check && npm run test",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "jest --passWithNoTests"
  }
}
```

### Manual Checklist
Before committing, ensure:
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] No console.log statements in production code
- [ ] All React components have proper keys
- [ ] All dates use UTC parsing utilities
- [ ] All API calls use proper error handling
- [ ] Environment variables are documented

### Git Hooks Setup
```bash
# Install husky for pre-commit hooks
npm install --save-dev husky
npx husky init
echo "npm run pre-commit" > .husky/pre-commit
```

---

## Common Pitfalls and Solutions

### 1. Async Component Parameters
```tsx
// ❌ BAD - Dynamic require
const params = (() => {
  const { useParams } = require('next/navigation')
  return useParams()
})()

// ✅ GOOD - Direct import
import { useParams } from 'next/navigation'
const params = useParams<{ id: string }>()
```

### 2. Memory Leaks in useEffect
```tsx
// ✅ GOOD - Proper cleanup
useEffect(() => {
  const timer = setTimeout(() => {
    // Action
  }, 1000)
  
  return () => clearTimeout(timer)  // Cleanup
}, [])
```

### 3. Proper Error Boundaries
```tsx
// ✅ GOOD - Error boundary component
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo)
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
```

### 4. Form Validation
```tsx
// ✅ GOOD - Use Zod for validation
import { z } from 'zod'

const TransactionSchema = z.object({
  symbol: z.string().min(1).max(10),
  quantity: z.number().positive(),
  price: z.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

type Transaction = z.infer<typeof TransactionSchema>
```

---

## Architecture Guidelines

### File Organization
```
frontend/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── (landing)/       # Route groups
│   │   ├── dashboard/
│   │   │   ├── components/  # Page-specific components
│   │   │   └── page.tsx
│   ├── components/          # Shared components
│   │   ├── ui/             # Generic UI components
│   │   └── charts/         # Chart components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and helpers
│   │   ├── dateUtils.ts   # Date handling
│   │   └── front_api_client.ts
│   └── types/              # TypeScript type definitions
```

### State Management
```tsx
// Use React Query for server state
const { data, error, isLoading } = useQuery({...})

// Use React Context for client state
const ThemeContext = createContext<ThemeContextType>()

// Use URL state for shareable state
const searchParams = useSearchParams()
```

---

## Performance Optimization

### 1. Code Splitting
```tsx
// ✅ GOOD - Dynamic imports for heavy components
const HeavyChart = dynamic(() => import('@/components/charts/HeavyChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
})
```

### 2. Memoization
```tsx
// ✅ GOOD - Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateExpensiveValue(data)
}, [data])

// ✅ GOOD - Memoize callbacks
const handleClick = useCallback((id: string) => {
  // Handle click
}, [])
```

### 3. React Query Optimization
```tsx
// ✅ GOOD - Proper cache configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes
      refetchOnWindowFocus: false,   // Disable for financial data
      retry: 2,                       // Retry failed requests twice
    }
  }
})
```

---

## Security Considerations

### 1. Environment Variables
```tsx
// ✅ GOOD - Validate env vars at startup
const requiredEnvVars = [
  'NEXT_PUBLIC_BACKEND_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
]

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required env var: ${varName}`)
  }
})
```

### 2. Input Validation
```tsx
// ✅ GOOD - Always validate user input
const validateSymbol = (symbol: string): boolean => {
  return /^[A-Z]{1,5}$/.test(symbol)
}

const handleSubmit = (symbol: string) => {
  if (!validateSymbol(symbol)) {
    throw new Error('Invalid symbol format')
  }
  // Process valid symbol
}
```

### 3. Error Handling
```tsx
// ✅ GOOD - Don't expose sensitive info
try {
  await riskyOperation()
} catch (error) {
  // Log full error internally
  console.error('Operation failed:', error)
  
  // Show generic message to user
  toast.error('Operation failed. Please try again.')
}
```

---

## Continuous Improvement

### Code Review Focus Areas
1. **Type Safety**: No `any` types, proper null checks
2. **Performance**: Proper memoization, no unnecessary re-renders
3. **Security**: Input validation, error handling
4. **Maintainability**: Clear naming, proper documentation
5. **Accessibility**: ARIA labels, keyboard navigation

### Monthly Audits
- Run `npm audit` for security vulnerabilities
- Update dependencies: `npm update`
- Review and update this documentation
- Check bundle size: `npm run analyze`

### Team Communication
- Document breaking changes in CHANGELOG.md
- Update README.md for new features
- Add JSDoc comments for complex functions
- Create ADRs (Architecture Decision Records) for major changes

---

## Quick Reference

### Essential Commands
```bash
# Development
npm run dev              # Start dev server
npm run lint            # Run linter
npm run type-check      # Check TypeScript types
npm run test            # Run tests

# Pre-commit
npm run pre-commit      # Run all checks

# Production
npm run build           # Build for production
npm run start           # Start production server
```

### Key Files
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - ESLint rules
- `.env.example` - Environment variables template
- `CLAUDE.md` - Project-wide development protocol

### Help Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [React Query Documentation](https://tanstack.com/query)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Last Updated: 2025-08-08
Version: 1.0.0