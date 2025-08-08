# EOD‑Only Hardening Plan & Patches

**Author:** Senior Engineer Proposal • **Date:** 7 Aug 2025 • **Scope:** Convert the app to a simpler, safer **End‑Of‑Day (EOD)** architecture, tighten typing, reduce code paths, and ensure easy solo‑dev maintenance while scaling to 100 users.

---

## Goals

- **EOD single‑source‑of‑truth:** nightly price ingestion, no intraday logic.
- **Type safety:** strict at the edges (Pydantic/TS), `Decimal` for money.
- **Solo‑dev maintainability:** fewer toggles, fewer libs, one clear workflow.
- **Performance:** precompute daily aggregates; clients read, not recompute.

---

## Phase 0 — Safety & Secrets (Do First)

### 0.1 Purge real secrets from repo

**Problem:** `.env.test` contains real email/password and production‑class API keys.\
**Fix:** Remove file, rotate keys, add `.env.example`.

```diff
--- a/.env.test
+++ /dev/null
@@
-# Test Environment - REAL credentials for automated testing
-TEST_USER_EMAIL=3200163@proton.me
-TEST_USER_PASSWORD=12345678
-VANTAGE_API_KEY=...
-SUPA_API_URL=...
-SUPA_API_ANON_KEY=...
```

```diff
--- /dev/null
+++ b/.env.example
+SUPA_API_URL=
+SUPA_API_ANON_KEY=
+SUPA_SERVICE_ROLE_KEY=
+ALPHA_VANTAGE_API_KEY=
+NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
+EXPO_PUBLIC_BACKEND_API_URL=http://10.0.2.2:8000
```

### 0.2 Lock Node & FastAPI versions

**Problem:** Node 18 is EOL; FastAPI is behind docs.\
**Fix:** Upgrade Dockerfiles & pin dependencies to Node 20/22 and FastAPI ≥ 0.116.x.

```diff
--- a/frontend/Dockerfile
+++ b/frontend/Dockerfile
-FROM node:18-alpine
+FROM node:20-alpine
```

```diff
--- a/backend/requirements.txt
+++ b/backend/requirements.txt
-fastapi>=0.104.1
+fastapi>=0.116.1
+pydantic>=2.8.0
```

---

## Phase 1 — Frontend (Next.js)

### 1.1 Tailwind dynamic class purge risk

**Location:** `frontend/src/app/dashboard/components/AllocationTableApex.tsx`\
**Problem:** `accentColorClass: \`bg-\${color}-500\`\` may be purged.\
**Fix:** Map symbols → fixed classes and **safelist** in Tailwind config.

```diff
--- a/frontend/tailwind.config.js
+++ b/frontend/tailwind.config.js
 module.exports = {
   content: [ ... ],
+  safelist: [
+    'bg-blue-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-violet-500',
+    'bg-slate-500','bg-cyan-500','bg-fuchsia-500','bg-lime-500'
+  ],
   theme: { ... }
 }
```

```diff
--- a/frontend/src/app/dashboard/components/AllocationTableApex.tsx
+++ b/frontend/src/app/dashboard/components/AllocationTableApex.tsx
@@
-      accentColorClass: `bg-${(data as any)?.color || 'blue'}-500`
+      accentColorClass: ({
+        blue: 'bg-blue-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500',
+        amber: 'bg-amber-500', violet: 'bg-violet-500', slate: 'bg-slate-500',
+        cyan: 'bg-cyan-500', fuchsia: 'bg-fuchsia-500', lime: 'bg-lime-500',
+      } as const)[(data as any)?.color || 'blue']
```

### 1.2 Allocation mapping: array vs object

**Location:** `AllocationTableApex.tsx`\
**Problem:** Uses `Object.entries(allocations)` even when `allocations` can be an array.\
**Fix:** Branch on type.

```diff
@@
-const transformedData: AllocationRowExtended[] = Object.entries(allocations).map(([symbol, data], index) => ({
+const transformedData: AllocationRowExtended[] = Array.isArray(allocations)
+  ? allocations.map((row, index) => ({
+      symbol: row.symbol,
+      ...row,
+      id: row.symbol || `row_${index}`,
+    }))
+  : Object.entries(allocations).map(([symbol, data], index) => ({
+      symbol,
+      ...(data as any),
+      id: symbol || `row_${index}`,
+    }));
```

### 1.3 Stable React keys

**Locations:**

- `frontend/src/app/stock/[ticker]/page.tsx`
- `frontend/src/components/charts/FinancialSpreadsheetApex.tsx`

**Problem:** `key={index}` → unstable reconciliation.\
**Fix:** Prefer `key={item.id || item.date || item.url}`.

```diff
--- a/frontend/src/app/stock/[ticker]/page.tsx
+++ b/frontend/src/app/stock/[ticker]/page.tsx
-  news.map((item, index) => (
-    <div key={index} className="card ...">
+  news.map((item) => (
+    <div key={item.url ?? item.title} className="card ...">
```

```diff
--- a/frontend/src/components/charts/FinancialSpreadsheetApex.tsx
+++ b/frontend/src/components/charts/FinancialSpreadsheetApex.tsx
-  <th key={index} ...>
+  <th key={col.date ?? `${col.label}-${i}` } ...>
```

### 1.4 Parse date‑only strings as UTC

**Locations:**

- `PortfolioChartApex.tsx` (multiple)
- `DividendChartApex.tsx` (multiple)

**Problem:** `new Date('YYYY-MM-DD')` is local‑time; shifts chart points.\
**Fix:** Normalize via helper that appends `T00:00:00Z` when no time present.

```diff
--- a/frontend/src/lib/date.ts
+++ b/frontend/src/lib/date.ts
+export function toUtcMillis(d: string | number | Date): number {
+  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
+    return new Date(`${d}T00:00:00Z`).getTime();
+  }
+  return new Date(d as any).getTime();
+}
```

```diff
--- a/frontend/src/app/dashboard/components/PortfolioChartApex.tsx
+++ b/frontend/src/app/dashboard/components/PortfolioChartApex.tsx
@@
-const timestamp = new Date(point.date).getTime();
+const timestamp = toUtcMillis(point.date);
```

```diff
--- a/frontend/src/app/dashboard/components/DividendChartApex.tsx
+++ b/frontend/src/app/dashboard/components/DividendChartApex.tsx
@@
-const timestamp = new Date(item.date).getTime();
+const timestamp = toUtcMillis(item.date);
```

### 1.5 Alpha Vantage news timestamp

**Location:** `frontend/src/app/stock/[ticker]/page.tsx`\
**Problem:** `time_published` is `YYYYMMDDTHHMMSS` (not ISO).\
**Fix:** Convert to ISO first.

```diff
--- a/frontend/src/app/stock/[ticker]/page.tsx
+++ b/frontend/src/app/stock/[ticker]/page.tsx
+const avToIso = (s: string) => `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`;
@@
-<span>{new Date(item.time_published).toLocaleDateString()}</span>
+<span>{new Date(avToIso(item.time_published)).toLocaleDateString()}</span>
```

### 1.6 Env var normalization

**Problem:** Inconsistent `NEXT_PUBLIC_BACKEND_*` names.\
**Fix:** Standardize on `NEXT_PUBLIC_BACKEND_API_URL` (already used by the shared client). Update `.env` files and docs; remove other variants.

### 1.7 Client params misuse (Promise)

**Location:** `frontend/src/app/stock/[ticker]/page.tsx`\
**Problem:** `params` typed as `Promise` and resolved in effect.\
**Fix:** Use `useParams()` in client, or make the page a server component. (Below keeps it client.)

```diff
--- a/frontend/src/app/stock/[ticker]/page.tsx
+++ b/frontend/src/app/stock/[ticker]/page.tsx
-import interface StockAnalysisPageProps { params: Promise<{ ticker: string }> }
-export default function StockAnalysisPage({ params }: StockAnalysisPageProps) {
-  const [ticker, setTicker] = useState<string>('')
-  useEffect(() => { params.then(({ ticker }) => setTicker(ticker)) }, [params])
+export default function StockAnalysisPage() {
+  const { ticker } = useParams<{ ticker: string }>()
```

### 1.8 Guard development logs

**Problem:** Unconditional `console.log` in production.\
**Fix:** Central debug wrapper.

```ts
// frontend/src/lib/debug.ts
export const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV === 'development') console.log(...args);
};
```

```diff
- console.log('Loaded portfolio', data)
+ debug('Loaded portfolio', data)
```

### 1.9 Stronger Apex types & callbacks

**Location:** `frontend/src/components/charts/ApexChart.tsx`\
**Problem:** `any` in `ChartComponent` and tooltip formatters.\
**Fix:** Type generics and callback signatures.

```diff
--- a/frontend/src/components/charts/ApexChart.tsx
+++ b/frontend/src/components/charts/ApexChart.tsx
-const [ChartComponent, setChartComponent] = useState<React.ComponentType<any> | null>(null);
+type ApexReact = typeof import('react-apexcharts');
+const [ChartComponent, setChartComponent] = useState<React.ComponentType<import('react-apexcharts').Props> | null>(null);
@@
-formatter: (value: number, { seriesIndex, series: _series, w }: any) => {
+formatter: (value: number, ctx: { seriesIndex: number; series: number[][]; w: ApexOptions }) => {
@@
-custom: ({ series, seriesIndex: _seriesIndex, dataPointIndex, w }: any) => {
+custom: (ctx: { series: number[][]; seriesIndex: number; dataPointIndex: number; w: ApexOptions }) => {
```

### 1.10 Supabase user double‑cast

**Locations:** `frontend/src/app/transactions/page.tsx` (twice)\
**Problem:** `session.user as unknown as User`.\
**Fix:** Proper types.

```diff
- if (session?.user) setUser(session.user as unknown as User);
+ setUser(session?.user ?? null);
@@
- setUser(session?.user as unknown as User ?? null);
+ setUser(session?.user ?? null);
```

### 1.11 Effect dependency hygiene

**Location:** `AllocationTableApex.tsx`\
**Problem:** Effect calls a non‑memoized function and has empty deps.\
**Fix:** Memoize and depend.

```diff
@@
- useEffect(() => { loadWatchlistStatus(); }, []);
+ const loadWatchlistStatus = useCallback(async () => { /* ... */ }, []);
+ useEffect(() => { loadWatchlistStatus(); }, [loadWatchlistStatus]);
```

### 1.12 Centralized numeric parsing

**Problem:** Scattered `parseFloat` leads to NaN/locale issues.\
**Fix:** A small helper and targeted refactors (example: `KPICard.tsx`).

```ts
// frontend/src/utils/decimal.ts
export const toNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
```

```diff
--- a/frontend/src/app/dashboard/components/KPICard.tsx
+++ b/frontend/src/app/dashboard/components/KPICard.tsx
- const parsed = parseFloat(val);
+ const parsed = toNumber(val);
```

### 1.13 Strict TS: disallow JS in TS projects

**Location:** `frontend/tsconfig.json`\
**Fix:** Disable `allowJs`.

```diff
-  "allowJs": true,
+  "allowJs": false,
```

### 1.14 Remove deprecated frontend API types

**Location:** `frontend/src/types/api.ts`\
**Fix:** Delete file and import from `@portfolio-tracker/shared` everywhere (already used).

```diff
--- a/frontend/src/types/api.ts
+++ /dev/null
@@
-/* DEPRECATED */
```

---

## Phase 1b — Mobile (Expo)

### 1b.1 Debounce type for RN

**Location:** `portfolio-universal/app/hooks/useStockSearch.ts`\
**Fix:** Avoid `NodeJS.Timeout`.

```diff
- let timeoutId: NodeJS.Timeout;
+ let timeoutId: ReturnType<typeof setTimeout>;
```

### 1b.2 PropTypes polyfill

**Location:** `portfolio-universal/index.ts`\
**Fix:** Remove or guard behind `__DEV__`.

```diff
--- a/portfolio-universal/index.ts
+++ b/portfolio-universal/index.ts
-import PropTypes from 'prop-types';
-// ... global React.PropTypes wiring
+if (__DEV__) {
+  const PropTypes = require('prop-types');
+  if (!(global as any).React) (global as any).React = require('react');
+  if (!(global as any).React.PropTypes) (global as any).React.PropTypes = PropTypes;
+}
```

### 1b.3 Guard RN logs

**Location:** `portfolio-universal/App.tsx`\
**Fix:** Only log in dev.

```diff
-console.log('🚀 Portfolio Tracker App starting...');
+if (__DEV__) console.log('🚀 Portfolio Tracker App starting...');
```

### 1b.4 One chart lib on mobile

**Action:** Keep `victory-native` (typed) and remove `react-native-chart-kit`. Update affected screens/components accordingly.

---

## Phase 2 — Backend (FastAPI)

### 2.1 Overbroad exception handling

**Problem:** `except Exception` masks root causes.\
**Fix:** Catch specific exceptions (e.g., `HTTPException`, `InvalidOperation`, `KeyError`) and include `exc_info=True`. Example below.

```diff
--- a/backend/services/portfolio_metrics_manager.py
+++ b/backend/services/portfolio_metrics_manager.py
@@
- except Exception as e:
-   logger.error(f"Error invalidating cache for user {user_id}: {e}")
-   return 0
+ except (KeyError, ValueError, InvalidOperation) as e:
+   logger.error("Error invalidating cache for user %s", user_id, exc_info=True)
+   return 0
+ except Exception:
+   logger.exception("Unexpected error invalidating cache for user %s", user_id)
+   return 0
```

### 2.2 Misnamed Decimal helper

**Problem:** `_safe_decimal_to_float` returns `Decimal`.\
**Fix:** Rename & document.

```diff
- def _safe_decimal_to_float(self, value: Any) -> Decimal:
+ def _to_decimal(self, value: Any) -> Decimal:
@@
- self._safe_decimal_to_float(...)
+ self._to_decimal(...)
```

### 2.3 Placeholder metrics should be flagged or omitted

**Problem:** `volatility`, `max_drawdown`, `daily_change` placeholders (various responses).\
**Fix:** Either compute correctly or omit + add `computed: false` metadata. Example response snippet:

```py
return APIResponse.success({
  "performance": {
    "total_value": total_value,
    "total_cost": total_cost,
    # ...
  },
  "metadata": { "eod_timestamp": eod_ts, "volatility_computed": False }
})
```

### 2.4 Sector allocation placeholder

**Location:** `_calculate_sector_allocation`\
**Fix:** Return empty map and a flag until real sector data is in place.

```diff
- return { "Technology": 40.0, "Finance": 25.0, ... }
+ return {}
```

### 2.5 Market status timezone safety

**Location:** `_get_market_status`\
**Problem:** `datetime.fromisoformat(...)` may parse naive strings.\
**Fix:** Normalize to UTC.

```diff
+def _parse_iso_utc(s: str | None) -> datetime | None:
+    if not s: return None
+    dt = datetime.fromisoformat(s)
+    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
@@
- next_open=datetime.fromisoformat(status["next_open"]) if status.get("next_open") else None,
- next_close=datetime.fromisoformat(status["next_close"]) if status.get("next_close") else None,
+ next_open=_parse_iso_utc(status.get("next_open")),
+ next_close=_parse_iso_utc(status.get("next_close")),
```

### 2.6 Holdings strict validation

**Problem:** Ad‑hoc dict → model conversion swallows errors.\
**Fix:** Pydantic model + `parse_obj_as`.

```py
class HoldingIn(BaseModel):
    symbol: str
    shares: Decimal
    price: Decimal
    price_date: Optional[str]
    # ...

items = [HoldingIn.model_validate(h) for h in raw_holdings]
```

### 2.7 Realized vs Unrealized P&L

**Action:** Track and expose separately in the response models. Update serializers and client types accordingly.

### 2.8 Cash balance tracking

**Location:** `backend_api_analytics.py`\
**Fix:** Implement cash in DB + include in daily aggregates (see Phase 3.2) and replace `cash_balance: 0` with real value.

### 2.9 Currency conversion

**Action:** Add FX lookup (nightly) and store rates to apply at transaction & reporting time. Keep it EOD.

### 2.10 Distributed locks

**Problem:** In‑memory locks are per‑process.\
**Fix:** PostgreSQL advisory locks wrapper.

```py
from contextlib import contextmanager

@contextmanager
def pg_advisory_lock(conn, key: int):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

### 2.11 Standardize API error schema

**Action:** Ensure all routes return `APIResponse`/`ErrorResponse` format. Centralize `ResponseFactory.error` usage.

---

## Phase 3 — Database & EOD Workflow

### 3.1 EOD price schema

**Fix:** One table for nightly closes.

```sql
CREATE TABLE IF NOT EXISTS historical_prices (
  ticker TEXT NOT NULL,
  date   DATE NOT NULL,
  close  NUMERIC(18,6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON historical_prices (ticker, date DESC);
```

### 3.2 Precomputed daily performance

**Fix:** **Persist per‑user daily aggregates for fast reads.**

```sql
CREATE TABLE IF NOT EXISTS user_daily_perf (
  user_id UUID NOT NULL,
  date    DATE NOT NULL,
  total_value NUMERIC(18,6) NOT NULL,
  total_cost  NUMERIC(18,6) NOT NULL,
  pnl         NUMERIC(18,6) NOT NULL,
  pnl_pct     NUMERIC(9,6)  NOT NULL,
  PRIMARY KEY (user_id, date)
);
```

### 3.3 Nightly job (single source of truth)

**Action:** APScheduler task: fetch EOD → upsert prices → recompute `user_daily_perf` → invalidate cache keys for `YYYY‑MM‑DD`.

```py
@scheduler.scheduled_job('cron', hour=2)
async def nightly_eod_job():
    # 1) fetch EOD, 2) upsert historical_prices, 3) recompute user_daily_perf, 4) invalidate
    ...
```

---

## Phase 4 — CI/CD & Tooling

### 4.1 Make validation scripts blocking

**Action:** Wire scripts into CI to fail builds on violations.

```yaml
- name: Type & Security Checks
  run: |
    python scripts/validate_types.py
    python scripts/validate_decimal_usage.py
    python scripts/validate_rls_policies.py
    python scripts/detect_raw_sql.py
```

### 4.2 Bundle size budget

**Action:** Add a bundle size check (e.g., `@next/bundle-analyzer` or custom script) and enforce a threshold.

---

## Appendix — Additional Small Patches

- **Feature flags:** Default OFF in prod; prune unused toggles monthly.
- **Theme tokens:** Centralize colors in theme files; no magic numbers.
- **Shared fetch helper:** `shared/api/fetchJson.ts` to wrap fetch + `APIResponse<T>` decoding.
- **EOD constants:** Put cron hour, market open/close in `shared/utils/constants.ts` and import everywhere.

---

## Rollout Plan (1 week)

1. **Day 1:** Secrets rotation, CI blocking checks, Tailwind safelist, `tsconfig` hardening.
2. **Day 2:** Frontend date/keys/env fixes; RN quick fixes.
3. **Day 3:** Backend exception hygiene; sector allocation; error schema.
4. **Day 4–5:** DB migrations for `historical_prices` + `user_daily_perf`; nightly job.
5. **Day 6:** Cash/XIRR scope decision; if deferred, mark as `computed:false`.
6. **Day 7:** Docs update; remove deprecated files; tag release.

---

## Why This Works

- **Deterministic:** EOD removes timing races and reduces cache complexity.
- **Typed & precise:** `Decimal` internally, typed contracts at edges.
- **Maintainable:** One ingestion job, one metrics façade, one schema for prices.
- **Scalable to 100 users:** Precomputed daily rows; O(Users×Days) storage; reads are O(1) per chart.

