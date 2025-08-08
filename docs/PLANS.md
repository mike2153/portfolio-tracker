I've cloned and inspected your **`portfolio-tracker`** repository on the **`simplify`** branch, ran the linters/type‑checker, and reviewed the existing `BUGS_AND_FIXES.md` and code. Below is a consolidated summary of bugs, structural issues, security weaknesses, simplification ideas, and feature suggestions—along with pointers to specific code locations for context.

## Key Bugs & Technical Debt

| Area                                 | Issue & Evidence                                                                                                                                                | Recommendation                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React Key & Data Issues**          | List components use index-based keys (`key={index}`) causing unstable reconciliation. Allocation table uses `Object.entries(...)` on data that may be an array. | Use stable identifiers (e.g. record id or symbol) for keys, and branch on whether the data is an array vs. object.                                       |
| **Date Parsing & Timezones**         | Several chart components use `new Date('YYYY-MM-DD')`, which interprets dates in the user's local timezone.                                                     | Append `T00:00:00Z` to parse as UTC or pass timestamps; ensure charts align properly.                                                                    |
| **Unsafe Typing & Unused Variables** | Numerous `any` types and unused variables surfaced during linting and are documented in the review (e.g. ApexCharts callbacks, Supabase `User` casts).          | Strictly type callback parameters (`ApexOptions`, `ApexAxisChartSeries`), remove unused variables, and avoid double casting (e.g. `as unknown as User`). |
| **Env Variable Mismatches**          | The frontend sometimes uses `NEXT_PUBLIC_BACKEND_API_URL`, while docs/compose files use `NEXT_PUBLIC_BACKEND_URL`.                                              | Choose a single name (e.g. `NEXT_PUBLIC_BACKEND_URL`) and standardize usage across code, `.env` and deployment scripts.                                  |
| **Missing Module Resolution**        | `npm run type‑check` reports many `Cannot find module '@/lib/...` errors because the TypeScript path alias (`@/`) isn’t recognized.                             | Add `paths` configuration in `tsconfig.json` matching Next.js aliasing:                                                                                  |

````json
"compilerOptions": { "baseUrl": "./src", "paths": { "@/*": ["src/*"] } }
``` and update Jest/TS configs accordingly. |
| **Excess Console Logging** | Production builds include `console.log` calls throughout charts and providers:contentReference[oaicite:5]{index=5}. | Wrap logs in a check (e.g. `if (process.env.NODE_ENV === 'development')`) or use a centralized logger with levels. |
| **Outdated & Overbroad Backend Code** | Several services catch `Exception` indiscriminately:contentReference[oaicite:6]{index=6}, placeholders return zeros for metrics like volatility, max drawdown and daily change:contentReference[oaicite:7]{index=7}, and hard‑coded sector allocations exist:contentReference[oaicite:8]{index=8}. | Catch specific errors with `exc_info=True` for logging; either implement these calculations or omit them with metadata (e.g. `{value: 0, computed: false}`); compute sector allocations based on actual company info or return an empty field. |
| **Version Drift** | The backend `requirements.txt` pins `fastapi>=0.104.1` while docs reference FastAPI 0.116.1:contentReference[oaicite:9]{index=9}. Dockerfiles use Node 18 even though Node 18 reached end‑of‑life (April 2025):contentReference[oaicite:10]{index=10}. | Upgrade to FastAPI 0.116.x and update type annotations for Pydantic v2; bump Node to 20 or 22 (both active LTS versions) and update relevant images/dependencies. |
| **Secrets in Version Control** | `.env` and `.env.test` contain real Supabase service keys, anonymous keys, an Alpha Vantage key, and test user credentials. Committing these poses major security risks. | Remove sensitive keys from the repository. Create `.env.example` with placeholder values, and use secret injection (CI variables or `.gitignore`‑d `.env`) for deployments. Rotate any keys that have been exposed. |
| **Missing Schema Validation** | `_get_holdings_data` in the backend partially validates data and may process bad shapes:contentReference[oaicite:11]{index=11}. | Use a strict Pydantic model to validate holdings input and reject invalid data early. |
| **Test Gaps & Docs Drift** | Many TODOs (e.g. cash balance tracking, currency conversions, Sharpe ratio) remain unimplemented; the docs sometimes overstate completed work:contentReference[oaicite:12]{index=12}. | Maintain a synchronized changelog and treat docs as living documents; implement missing features or mark them clearly as future work in both docs and code. |

## Simplification & Maintainability Improvements

- **Centralize Helpers:** Numeric parsing (float/decimal conversions) is scattered across the frontend and backend:contentReference[oaicite:13]{index=13}; create a single helper module (e.g. `utils/decimal.ts` in the frontend and a `convert_decimal_to_float` in the backend) to avoid inconsistencies.
- **Normalize API Outputs:** Ensure all API endpoints return consistent data shapes (e.g. numbers vs. strings). UI issues like `null` strings in `KPIGrid` tests come from inconsistent typing.
- **Refactor Large Components:** Several pages (e.g. `transactions/page.tsx` with 600+ lines) could be decomposed into smaller, reusable components and hooks, making them easier to test and reason about.
- **Use TypeScript Generics:** For universal/mobile code, define shared models (`Holding`, `Transaction`, `Quote`) and use generics to type hooks and API clients:contentReference[oaicite:14]{index=14}.

## Security Hardening

- **Rotate Leaked Keys:** Immediately rotate all API keys and credentials found in the repository.  
- **Role‑Based Access Control:** Confirm your Supabase policies match your design (docs mention 70 RLS policies); ensure every query in the backend uses the service role only when necessary, and always apply filters by `user_id` to avoid data leakage.
- **Rate Limiting & Circuit‑Breaker:** Make sure the `RATE_LIMIT_PER_MINUTE` and circuit‑breaker parameters are enforced at the API gateway. Move circuit‑breaker initialization to `__init__`:contentReference[oaicite:15]{index=15}.
- **Input Sanitization:** Sanitize any user‑generated strings passed to `dangerouslySetInnerHTML` in the StructuredData component:contentReference[oaicite:16]{index=16}. Even though the current content is derived, future changes might introduce injection vectors.

## Feature & UX Ideas to Enhance the App

- **Real‑Time WebSockets:** Provide live portfolio updates and price ticks via WebSockets/SSE rather than polling.
- **AI‑Powered Insights:** Incorporate simple AI assistants—e.g. summarise portfolio performance or news events using your backend’s AI keys (but make sure to secure and meter usage).
- **Customizable Dashboards:** Allow users to choose which cards to display (e.g. risk metrics, ESG scores, sector exposure) and to save personalized layouts.
- **Scenario Analysis Tools:** Let users simulate trades or rebalances and see hypothetical impacts on allocations and returns.
- **Alerts & Notifications:** Add email or push notifications for dividend dates, significant price moves, or portfolio rebalancing thresholds.
- **Accessibility & Internationalization:** Ensure color‑contrast ratios meet WCAG guidelines (dark mode is strong, but test with accessibility tools). Provide localization support for dates/numbers.

By addressing the issues enumerated above and implementing some of the suggested enhancements, you can make the **portfolio tracker** more robust, secure, and user‑friendly. The `BUGS_AND_FIXES.md` in your repository already outlines many problems and should be treated as an actionable backlog:contentReference[oaicite:17]{index=17}, but additional hardening around secrets management and modernization of your dependencies will further strengthen the project.
````
