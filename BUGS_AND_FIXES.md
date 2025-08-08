## Bugs and Fixes (Repository-wide)

### Frontend (Next.js)

1) Dynamic Tailwind class purging risk
- Affected: `frontend/src/app/dashboard/components/AllocationTableApex.tsx:105`
- Issue: `accentColorClass: bg-${color}-500` may be purged.
- Fix: Map `color` to a fixed whitelist and safelist in Tailwind config, or use inline `style={{ backgroundColor }}` with static utility classes.

2) Allocation data mapping breaks when array
- Affected: `AllocationTableApex.tsx:95-106`
- Issue: Uses `Object.entries(allocations)` even if `allocations` can be an array.
- Fix: If array, `allocations.map(...)`; if object, `Object.entries(...)`.

3) Weak list keys (index-based)
- Affected: Multiple (e.g., `frontend/src/app/stock/[ticker]/page.tsx:379`, `frontend/src/components/charts/FinancialSpreadsheetApex.tsx:281`, landing components).
- Issue: `key={index}` causes unstable reconciliation.
- Fix: Use stable ids (e.g., `id`, `symbol`, `date`).

4) Date-only parsing treated as local time
- Affected: `frontend/src/app/dashboard/components/PortfolioChartApex.tsx:229,245`, `frontend/src/app/dashboard/components/DividendChartApex.tsx:54,71`, others.
- Issue: `new Date('YYYY-MM-DD')` is local; misaligns charts.
- Fix: Parse as UTC (`new Date(date + 'T00:00:00Z')`) or pass timestamps.

5) Alpha Vantage news timestamp parsing
- Affected: `frontend/src/app/stock/[ticker]/page.tsx:399`
- Issue: `time_published` format `YYYYMMDDTHHMMSS` isn’t ISO.
- Fix: Convert to ISO before `new Date(...)`.

6) Environment variable mismatch
- Affected: multiple frontend files use `NEXT_PUBLIC_BACKEND_API_URL`; compose/docs use `NEXT_PUBLIC_BACKEND_URL`.
- Issue: Inconsistent env var names.
- Fix: Standardize to one (e.g., `NEXT_PUBLIC_BACKEND_URL`) and update code/env files.

7) Client page uses `params: Promise<...>`
- Affected: `frontend/src/app/stock/[ticker]/page.tsx:61-72`
- Issue: `params.then(...)` in client component.
- Fix: Use `useParams()` in client, or make page server component to receive `params` synchronously.

8) Excess dev logs in production paths
- Affected: many components (charts, `FeatureFlagProvider`, etc.).
- Issue: `console.log` without dev guards.
- Fix: Guard with `if (process.env.NODE_ENV === 'development')` or a central debug logger.

9) `any` and unsafe Apex types
- Affected: `frontend/src/components/charts/ApexChart.tsx` formatters and tooltip callbacks.
- Issue: `any` for `series/w` contexts invites runtime errors.
- Fix: Use `ApexOptions`, `ApexAxisChartSeries`, and typed callback signatures.

10) Double cast of Supabase user
- Affected: `frontend/src/app/transactions/page.tsx:413,419`, `frontend/src/app/portfolio/components/HoldingsTable.tsx:114`.
- Issue: `as unknown as User`.
- Fix: Narrow with proper SDK types and guards; set `User | null` directly.

11) Effect missing callback dependency
- Affected: `AllocationTableApex.tsx:37-43`.
- Issue: `loadWatchlistStatus` used in effect with empty deps.
- Fix: Wrap in `useCallback` and include in deps.

12) Numeric parsing with `parseFloat` scattered
- Affected: multiple files.
- Issue: NaN and locale risks; duplicated logic.
- Fix: Centralize via `frontend/src/utils/decimal.ts` helper and replace ad-hoc parsing.

13) Structured data injection risk
- Affected: `frontend/src/app/(landing)/components/StructuredData.tsx`.
- Issue: `dangerouslySetInnerHTML` is safe now (derived), but brittle if inputs change.
- Fix: Keep derived-only; if user-influenced, sanitize and validate schema.

14) Price chart heterogeneous point shape
- Affected: `frontend/src/components/charts/PriceChartApex.tsx:99-114`.
- Issue: Branchy `as any` field detection per point.
- Fix: Normalize input shape once in preprocessing.

15) Tooltip/formatter returns untyped
- Affected: `frontend/src/components/charts/ApexChart.tsx` tooltip `custom` and y-axis formatter.
- Issue: `any` use, silent failures.
- Fix: Add explicit types and null guards for empty data.

16) KPI formatting inconsistencies
- Affected: `frontend/src/app/dashboard/components/KPICard.tsx`.
- Issue: Mixed string/number formatting edge cases.
- Fix: Normalize data to numbers at API/hook layer; keep formatting at UI only.

### Backend (FastAPI)

17) Overbroad `except Exception` usage
- Affected: `backend/services/portfolio_metrics_manager.py`, `backend/services/dividend_service.py`.
- Issue: Masks root causes and control flow.
- Fix: Catch specific exceptions; add `exc_info=True` and structured context; re-raise where appropriate.

18) `_safe_decimal_to_float` naming/behavior mismatch
- Affected: `backend/services/portfolio_metrics_manager.py`.
- Issue: Returns `Decimal`, name implies float.
- Fix: Rename to `_to_decimal` (or return float consistently); rely on encoder at API boundary.

19) Placeholder metrics returned as real values
- Affected: volatility, max_drawdown, daily_change (zeros) in `PortfolioPerformance`.
- Issue: Misleading outputs.
- Fix: Omit until implemented or include `computed: false` metadata.

20) Sector allocation placeholder
- Affected: `_calculate_sector_allocation` in `portfolio_metrics_manager.py`.
- Issue: Hardcoded sectors.
- Fix: Return empty or compute via company info; add `sector_data_available` flag.

21) Base currency cache key too generic
- Affected: `get_user_base_currency`.
- Issue: Key `base_currency` may collide across users.
- Fix: Use `f"user:{user_id}:base_currency:v1"`.

22) Decimal-to-float conversion scattered
- Affected: multiple writes toward Supabase.
- Issue: Duplication and drift.
- Fix: Centralize a single `convert_decimals_to_float` and call everywhere before DB/API serialization.

23) Market status timezones
- Affected: `_get_market_status`.
- Issue: `fromisoformat` without tz normalization.
- Fix: Parse to aware datetime and normalize to UTC.

24) Circuit-breaker config placement
- Affected: `portfolio_metrics_manager.py` (assigned under wrong scope/indent).
- Issue: Initialization code placed after method return paths.
- Fix: Move `self._max_failures` and `self._recovery_timeout` into `__init__`.

25) Stock currency inference by suffixes
- Affected: `_get_stock_currency`.
- Issue: Non-standard suffixes likely misclassify.
- Fix: Maintain mapping table or DB-backed lookup; handle common suffix variations.

26) Holdings transformation lacks strict schema validation
- Affected: `_get_holdings_data`.
- Issue: Partial type checks; still processes bad shapes.
- Fix: Validate calculator output with Pydantic model and reject invalid entries early.

### Portfolio-Universal (React Native)

27) Widespread `any` usage in components/screens
- Issue: Type holes cause runtime errors.
- Fix: Introduce typed models (Holding, Transaction, Quote) and use generics where appropriate.

28) Debounce type for RN
- Affected: `portfolio-universal/app/hooks/useStockSearch.ts`.
- Issue: Uses `NodeJS.Timeout`; RN isn’t Node.
- Fix: Use `ReturnType<typeof setTimeout>`.

29) Global PropTypes polyfill
- Affected: `portfolio-universal/index.ts`.
- Issue: Brittle and unnecessary in modern RN.
- Fix: Remove; if needed, guard behind `__DEV__`.

30) Excess logs in RN
- Affected: `portfolio-universal/App.tsx`, screens.
- Issue: Performance noise in production.
- Fix: Guard logs behind `__DEV__` or app-level logger with level control.



Portfolio Tracker Codebase Review (August 7 2025)
1 Repository overview
Architecture – The project is split into a backend (Python/FastAPI), frontend (Next.js/React), a portfolio‑universal mobile app (Expo), and a docs folder. The backend exposes a set of REST API routes under /api, with a crown‑jewel /api/portfolio/complete endpoint that aggregates portfolio, dividend, price and analytics data into a single call. The frontend uses React and React Query to consume that endpoint via a useSessionPortfolio hook; the universal mobile app re‑uses the same API client.

Backend – A FastAPI application with a layered architecture and many design patterns (Singleton, Factory, Decorator, Repository, Aggregator, Circuit Breaker). It orchestrates Supabase database access, Alpha Vantage market data and background tasks. It uses an async lifespan context to run a dividend sync and assignment job at startup and schedules a nightly job via APScheduler. The middleware includes a custom JSON encoder to support Python Decimal types. The services layer contains modules such as UserPerformanceManager, PortfolioCalculator, PriceManager and DividendService and implements multi‑layer caching and distributed locking. However, numerous TODO comments remain (e.g., implementing cash balance tracking, daily change calculations, XIRR and Sharpe ratio metrics, proper currency conversion, distributed lock removal and audit‑log storage). The backend’s requirements.txt pins fastapi>=0.104.1, while the documentation claims version 0.116.1.

Frontend – Built with Next.js 15.3.5 and React 19.1.0. It uses React Query for data fetching, Supabase for auth, Tailwind CSS for styling and ApexCharts for charts. The project architecture follows the App Router structure with nested layouts. A centralized hook useSessionPortfolio fetches the complete portfolio from the backend, enabling a “load everything once” pattern. The package.json depends on @supabase/supabase‑js 2.50.3, @tanstack/react‑query 5.81.5 and other modern packages. The Dockerfiles for development and production are based on node:18‑alpine and python:3.11-slim images.

Docs – The docs folder contains comprehensive guides (backend_master.md, frontend_master.md, api_master.md, deployment‑operations.md, supabase.md, etc.) describing architecture, endpoints, design patterns, security and deployment. These documents serve as living documentation but occasionally diverge from the current code.

2 Accuracy of documentation vs. implementation
Document	Claimed details	Actual code / observations	Notes
backend_master.md	States the backend uses FastAPI 0.116.1 and Python 3.11. Describes a crown‑jewel /complete endpoint, multi‑layer caching, strict type safety, Row‑Level‑Security (RLS) and background jobs.	backend/requirements.txt requires fastapi>=0.104.1, an older version. Many advanced features described (e.g., IRR/XIRR, Sharpe ratio, multi‑currency cost‑basis tracking) are still marked with TODO comments in the services layer.	The architecture overview is largely accurate, but version numbers and completeness of features are overstated. Requirements should be updated to fastapi 0.116.1 (released July 11 2025
pypi.org
).
frontend_master.md	Claims the frontend uses Next.js 15.3.5, React 19.1.0, TypeScript 5.8.3 and Node.js 18+; emphasises a useSessionPortfolio hook and comprehensive caching.	frontend/package.json matches Next.js 15.3.5 and React 19.1.0. Dockerfiles and documentation require Node 18, but Node 18 reached end‑of‑life on 30 April 2025
endoflife.date
 and Supabase has announced it will drop Node 18 support after 31 Oct 2025
supabase.com
. Latest Node LTS versions are 20 (maintenance until Apr 30 2026) and 22 (active LTS until Oct 21 2025 and maintenance until Apr 30 2027)
endoflife.date
.	The documentation should be updated to recommend Node 20/22. Upgrade Dockerfiles to node:20‑alpine or node:22‑alpine and adjust @types/node accordingly.
api_master.md	Describes all API endpoints and request/response patterns.	Most endpoints exist, but some “legacy dashboard” routes are marked deprecated in the code. The docs reference the /complete endpoint correctly.	Largely accurate. Consider removing deprecated endpoints or clearly marking them as legacy.
deployment‑operations.md	Specifies prerequisites: Docker 20+, Docker Compose 2.0+, Node 18+, Python 3.11+. Provides sample docker‑compose configurations.	The runtime prerequisites still mention Node 18. As noted above, Node 18 is EOL
endoflife.date
.	Update the prerequisites to Node 20+ and adjust the Dockerfiles accordingly. Also update the Supabase library version in the example environment.
supabase.md	Details the RLS migration (008_comprehensive_rls_policies.sql) and states that 70 security policies fully isolate user data.	Without access to the actual migration file, the description appears reasonable. The backend code enforces row‑level filtering by using the Supabase service role and RLS policies.	Ensure the migrations repository actually contains the referenced policies; otherwise update the docs accordingly.

3 Comparison with latest upstream documentation
Node.js – According to the official Node.js release schedule, Node 18 (released April 19 2022) left maintenance on April 30 2025
endoflife.date
. The current LTS versions are Node 20 (maintenance ends April 30 2026) and Node 22 (active LTS ends October 21 2025; maintenance ends April 30 2027)
endoflife.date
. Supabase’s changelog explicitly states that support for Node 18 will be dropped in all Supabase libraries after 31 Oct 2025
supabase.com
. The project currently builds on Node 18; upgrade to Node 20 or Node 22 to remain supported. Node 22 also adds useful features like stable watch mode, pattern matching in fs, built‑in WebSocket client and the --run flag
blog.appsignal.com
.

FastAPI – The latest FastAPI version on PyPI is 0.116.1, released July 11 2025
pypi.org
. The backend requirements specify fastapi>=0.104.1, which is almost a year behind and lacks improvements like Pydantic v2 support and better lifespan hooks. Updating to FastAPI 0.116.1 will provide bug fixes and performance enhancements. Ensure the project’s type annotations and Pydantic models are compatible with version 2 of Pydantic.

Supabase (JavaScript client) – The npm page shows @supabase/supabase‑js 2.53.1 as the latest version (published four hours before this review). The client supports only active LTS Node versions and will drop Node 18 support as described above
supabase.com
. The project currently uses version 2.50.3; upgrade to the latest 2.53.x to benefit from bug fixes and maintain compatibility.

4 Identified issues and recommendations
4.1 Backend code quality
Outdated FastAPI version – The code uses fastapi>=0.104.1. Upgrade to 0.116.1
pypi.org
 and test the application for breaking changes (e.g., Pydantic v2). Update dependencies like pydantic (currently 2.5.0) as needed.

Unimplemented features – Many core financial metrics (IRR, XIRR, Sharpe ratio), cost‑basis tracking, daily change calculations, multi‑currency conversions, realized gains and audit‑log storage are marked as TODO. Prioritize implementing these to deliver the comprehensive analytics promised in the docs.

Distributed locking – The services use in‑memory locks with a TODO to switch to distributed locks. Implement PostgreSQL advisory locks or a Redis‑based lock to avoid race conditions across multiple instances.

Error and exception handling – The middleware/error_handler.py centralizes error handling, but ensure that all custom exceptions include structured error codes and that sensitive information is never exposed. Add more unit tests for edge cases.

Currency handling – The docs emphasise precise Decimal arithmetic and multi‑currency support. Current services use placeholders for currency conversion (TODO comments). Integrate a reliable FX API (e.g., Alpha Vantage FX or ExchangeRatesAPI) and implement caching strategies.

Background tasks – The startup hook triggers a full dividend sync for all users; this may be heavy. Consider moving heavy tasks to separate Celery or RQ workers and using a distributed scheduler to avoid duplicate runs.

4.2 Frontend code quality
Node EOL – Upgrade the development environment and Dockerfiles from node:18-alpine to node:20-alpine or node:22-alpine to comply with Supabase’s support policy
supabase.com
endoflife.date
.

Supabase client – Bump @supabase/supabase-js to 2.53.x to get bug fixes and ensure compatibility with future API changes.

TypeScript and React – React 19 and TS 5.8 are used correctly. Ensure strict mode remains enabled (ignoreBuildErrors: false) and keep dependencies up to date.

Performance – The crown‑jewel useSessionPortfolio hook fetches a large payload; implement error boundaries and loading states. Use React’s Suspense and useTransition (available in React 19) to improve UX. Consider code‑splitting heavy charts.

Testing – Expand unit/integration tests, especially around authentication flows, caching behaviour and hook logic. Add Playwright end‑to‑end tests for major user flows.

4.3 Documentation improvements
Update version references – Align all docs with actual dependencies: FastAPI 0.116.1, Node 20/22, Python 3.11 (or 3.12 if you upgrade), @supabase/supabase-js 2.53.x. Clarify that Node 18 is no longer supported
endoflife.date
supabase.com
.

State of implementation – Where features are still under development (e.g., IRR/XIRR, caching strategies), explicitly mark them as “in progress” rather than fully available. Move deprecated endpoints to a legacy section.

Deployment guide – In deployment‑operations.md, update the prerequisites to Node 20/22 and adjust docker‑compose examples. Provide guidance for multi‑platform deployments (e.g., separate worker containers for background jobs).

Security and compliance – Ensure the RLS policies described in supabase.md are kept in sync with the actual migrations. Document how to rotate Supabase keys and handle secrets.

5 Conclusion
The Portfolio Tracker project exhibits a robust architecture with a thoughtful separation of concerns, heavy use of design patterns and strong emphasis on type safety and security. However, several gaps exist between the documentation and the actual code. Most notably, the project still depends on Node 18, which has reached end‑of‑life and is no longer supported by Supabase
endoflife.date
supabase.com
, and it uses an outdated FastAPI version. The docs should be updated, and the codebase should be upgraded to supported versions of Node, FastAPI and @supabase/supabase-js. In addition, implementing the many TODO items in the backend will be necessary to deliver the rich analytics promised. Once these issues are addressed, the application will be well‑positioned for reliability, scalability and maintainability.

    1. Cash Balance Not Implemented
In analytics summary response (backend_api_analytics.py), "cash_balance": 0, # TODO: Implement cash tracking

Impact: Cash is always reported as zero, so portfolio analytics are inaccurate if users hold cash or settle transactions.

Fix: Implement real cash tracking in the portfolio DB and calculation layer.

2. IRR (XIRR) Calculation Not Complete
In the summary route:
# TODO: Add XIRR to PortfolioPerformance model in future

Impact: Only a basic IRR is returned, which is mathematically incorrect unless all transactions are spaced equally.

Fix: Implement date-sensitive XIRR for correct annualized returns.

3. No Currency Conversion or Multi-currency Support
Found as a TODO in portfolio calculation and metrics services.

Impact: If a portfolio contains holdings in multiple currencies, returns/profits are incorrect; no conversion logic applied.

Fix: Add robust currency conversion using FX rates at transaction and reporting time.

4. Distributed Locking Is Not Persistent
The system uses in-memory locks (utils/distributed_lock.py), but this doesn’t work in multi-worker or multi-instance deployments.

Impact: Data races and duplicate computation are possible in production.

Fix: Use database-level advisory locks or a cache (e.g., Redis) for cross-process locking.

5. No Audit Log Persistence
TODO found for “implement audit log storage in Supabase.”

Impact: Security, compliance, and debugging visibility are lost.

Fix: Implement persistent audit logging for all sensitive API actions and portfolio changes.

6. Cost Basis Not Tracked Per Holding
TODO: “Track and expose cost basis in portfolio metrics.”

Impact: Gain/loss and tax calculations are inaccurate, and reporting is incomplete.

Fix: Store and compute per-lot/per-holding cost basis, including corporate actions.

7. Realized/Unrealized P&L Not Accurate
The backend currently mixes up realized and unrealized profit/loss in reporting.

Impact: Users cannot distinguish between closed (realized) and open (unrealized) gains.

Fix: Distinguish and expose both types in APIs.

8. RLS (Row Level Security) Policy Drift
Docs reference RLS enforcement, but code does not always check per-user resource ownership, and policies may be outdated vs. Supabase schema.

Impact: Potential security breach (data leakage across users).

Fix: Enforce RLS at every query or use Supabase policies correctly.

9. Decimal Handling Is Not Always Enforced
Financial calculations sometimes use floats (float(portfolio_value) at serialization), risking rounding or precision loss.

Impact: User balances, P&L, or IRR can drift or mismatch.

Fix: Retain Decimal type as long as possible; only serialize to float in JSON response.

10. API Error Responses Not Standardized
API error handling is inconsistent (sometimes raises HTTPException, sometimes uses ResponseFactory.error).

Impact: Frontend cannot reliably parse errors, and bugs are harder to debug.

Fix: Standardize all error output to a single format with error code, message, and status.

Bonus: Stale or Incomplete Documentation
Docs say FastAPI is 0.116.1, but requirements.txt shows 0.104.1.

Impact: You may miss bug fixes, features, and security patches.

These bugs are not just style issues—they can cause real-world financial inaccuracies, compliance problems, and security risks.
If you want code samples or concrete step-by-step fixes for any of these, just ask!

Backend (EOD-only, types, safety)
Enforce EOD single-source-of-truth: adopt the simplification plan—one historical_prices table, fetched nightly; kill intraday/real-time branches.

Delete/disable realtime quote paths in services that diverge from EOD flow (keep fetch → normalize → upsert → read). (Rationale: fewer code paths; predictable calculations.)

Make API responses a single format (drop legacy v1/v2 duality) and always match APIResponse<T> from shared. That avoids double schemas in clients.

Decimal everywhere for money: validate in CI with your validate_decimal_usage.py and fail builds on violations. Wire it into CI. 

Remove in-endpoint casting to floats until the final serializer. Keep Decimal internally; serialize with one shared encoder. (Less rounding churn; consistent.) (You already have a decimal discipline doc—lean on it.) 

Centralize auth extraction & guards (already have helpers). Make every router use the same dependency + return model to avoid drift. (Tie to shared API types in #3.)

Delete analytics “temporary IRR” stubs and either: (a) commit a simple, EOD-based IRR/XIRR util, or (b) drop IRR from MVP to reduce paths that lead to cache invalidations.

Keep dividend flows lightweight (good call—no portfolio recalculation on confirm). Move that guarantee into a unit test. 【initial backend snippet shows this choice; keep it codified】

Rate-limit heavy syncs at DB (you’re already calling an RPC like check_rate_limit—great). Document & reuse that pattern for any multi-symbol sync. 【initial backend snippet references this pattern in sync-all】

Trim service surface area: combine portfolio_calculator, portfolio_performance_service, and user_performance_manager behind a one-file “PortfolioMetrics” façade that exposes only EOD entry points.

Remove unused endpoints (news/forex/anything non-EOD portfolio core), or feature-flag them off by default to shrink mental load.

Strict Pydantic models at the edges: fail fast on missing fields; never return ad-hoc dicts (keep parity with shared/types/api-contracts.ts).

Add “EOD data age” metadata on each response (timestamp of last EOD run) to make cache state obvious to clients. (Include in metadata.version/timestamp you already standardize.)

Kill per-request compute where possible: precompute daily aggregates after EOD load (portfolio value, gain/loss) and store per-user per-day rows. Clients read, not recompute.

One cache key per user per date (e.g., perf:{user}:{YYYY-MM-DD}) to keep cache invalidation trivial and stable at 100 users.

Database / Supabase
Schema: historical_prices (ticker, date, close, currency) with composite PK (ticker,date) + covering indexes for portfolio lookups.

Schema: user_daily_perf (user_id, date, total_value, total_cost, pnl, pnl_pct) computed nightly from transactions + EOD. Index (user_id,date).

Schema: dividends + user_dividends stays; keep idempotent upserts during sync. Use same RPC rate-limit pattern as dividends-all (item #9). 【initial backend snippet—sync-all shows RPC style】

RLS audit & auto-validate in CI (you already have validate_rls_policies.py). Make it blocking. 

Purge secrets from repo and rotate now: .env.test contains a real email, password, and actual Supabase/Alpha Vantage keys—this must be removed & rotated. 【.env.test shows test creds and keys: 3200163@proton.me / keys】【(You can see them referenced in tests too)】

Frontend (Next.js) — strong types, less code
Keep Next.js as the only web frontend. Treat the Expo app as optional/paused until web is stable. (See duplication later.)

Turn off allowJs in the web tsconfig to prevent untyped creep. It’s currently true. Set it to false.

Use generated/shared API contracts only. frontend/src/types/api.ts is marked DEPRECATED; delete and import from shared.

Charting: one library. You have Apex on web and multiple libs on mobile; pick one per surface. For web: Apex is fine—lazy-load and keep series typed. (Your Next config already chunks apex well.)

Remove dead chart types (e.g., PlotlyData if you don’t use Plotly). Slim chart-types.ts.

Central query hooks with typed results (useQuery<APIResponse<…>>) that always unwrap to the shared contract. Zero any. (You already have strict tsconfig—enforce at hooks.)

Feature flags provider: keep, but default all flags off to reduce code branches when solo. Make NEXT_PUBLIC_FEATURE_FLAGS_ENABLED false in prod; delete dead-flag code periodically.

UI theme constants already exist; move color literals scattered in components to theme files, and re-export one “design system” object.

Remove “v1 vs v2” response handling in UI—bind to shared APIResponse and single decode path (ties to backend #3).

Delete landing fluff not essential to the core (keep marketing simple). Less code = faster builds, less to maintain.

Mobile (Expo) — either pause or hard-scope
If you must keep mobile now, make these cuts so it doesn’t double your surface area:

One chart library only on mobile. You currently have react-native-chart-kit and victory-native—pick one (prefer Victory for typing) to halve chart code.

Share models: continue consuming @portfolio-tracker/shared types from mobile TSConfig paths (already set—good). Keep it the only source of truth.

Centralized React Query config in App.tsx (cache/stale times tuned for EOD cadence: hours/days, not seconds). (Your Expo app uses React Query; set globals there.)

Nativewind/Tailwind setup is fine—lock it and forbid inline magic numbers. Keep tokens only.

Make mobile optional at build via separate CI job so web is not blocked by RN deps.

Shared package (the “truth”)
Fix the dot-notation bug in shared/utils/formatters.ts (.NUMBER_FORMAT_OPTIONS.currency appears with a leading dot—typo). This will break at runtime/compile. 

shared/types/api-contracts.ts is excellent—lean harder on it: generate client DTOs and zod validators from it (or keep TS only but ensure backend stays mirrored).

Move all date/number formatting to shared/utils, delete per-app duplicates.

Provide one fetchJson<T>() in shared/api that wraps fetch + APIResponse<T> decode and error conversion—use on web & mobile.

Put EOD constants (market open/close, allowed backfill windows, cron hour) in shared/utils/constants.ts and reference everywhere. 

Tooling, CI/CD, and Secrets
Purge secrets + rotate now. .env.test and Playwright tests include a real email/password and real keys. Replace with local test creds, remove from repo, and rotate Supabase service/anons & AV key. 【.env.test shows real keys】

Wire these checks to fail builds (they exist—make them blocking):

validate_types.py (TS types)

validate_decimal_usage.py (Decimal)

validate_rls_policies.py (RLS)

detect_raw_sql.py (no raw SQL)
(They’re all in scripts/.) 

Drop doc-generation bloat you don’t actually use weekly. Keep one make docs target and delete the rest to reduce chore load. (See Makefile—nice, but keep it lean.)

Bundle-size discipline: your Next chunking is already configured for apex/react-query/icons—keep that, but add a CI threshold so PRs fail when bundle grows >X%.

E2E tests: sanitize login; use ephemeral user creation API (or magic link) in tests instead of hardcoded creds. Remove the static password from spec.

Workflow / architecture simplification (solo-dev friendly)
One “price ingestion” job (nightly) that: pulls EOD, upserts historical_prices, recomputes user_daily_perf, and invalidates that day’s cache. That’s it. (No per-request fetches.)

One “metrics facade” module in backend that the API uses—masks all other services. Solo dev debugs one place.

Kill all feature toggles not in use. Keep a plain object flag map for the 2–3 real toggles; delete the rest (or move to a JSON).

Remove parallel UIs that duplicate the same screens (e.g., portfolio dashboards across web + mobile) until web MVP is steady. Less churn, fewer bugs.

Document “daily cadence” as a product rule in docs/ so you won’t re-introduce realtime/complex caching later. Link the EOD plan.

Quick wins to do today
Remove secrets + rotate keys.

Flip allowJs: false in web tsconfig.

Delete frontend/src/types/api.ts (use shared imports).

Pick one mobile chart lib and uninstall the other.

Fix the formatters.ts leading-dot typo. 

Make scripts/*validate* fail the build (blocker). 

If you want, I can turn this into:

a PR checklist,

a one-week “cutover” plan from your current price system to EOD-only,

or a set of small issues with owner/ETA you can paste into GitHub.

