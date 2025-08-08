# Research Page Revamp — In-Depth Summary

## 1) Vision & Goals

We’re turning the **Research** view into a clean, modular analytics surface that’s easy to extend and hard to break. The page will be split into focused tabs with **Tremor (Recharts-based) charts**, strict data adapters, and formatting that respects financial precision.

**Objectives**

* Make financial insights scannable with **bar charts** grouped by topic.
* Overlay **EPS releases** on a **daily price** “mountain” chart for context.
* Enforce **precision discipline** (strings from API, numbers only at the chart edge).
* Create structure so future additions are one selector + one card (no spelunking).

---

## 2) Scope (What we will ship)

* **Tabs**

  * **Income** (new): Revenue, Operating Income, Net Income, EPS (3 charts per row layout).
  * **Balance Sheet** (new): Total Assets, Total Liabilities, Shareholder Equity, Cash & ST Inv., Long-term Debt, Current Liabilities (pick 6–9).
  * **Financial Statement** (existing): left as-is for now (later we can convert charts to Tremor).
  * *(Optional later)* **Profitability** summary tab that reuses Income metrics.
* **Price + EPS Overlay**

  * Daily price as an **Area (“mountain”)** line.
  * **EPS bars only on release dates**, dual y-axes.

Out of scope (for now): ratios (margin %, ROE/ROA), multi-symbol compare, currency conversion.

---

## 3) Data & Contracts

**Back end → Front end**

* **Prices**: `[{ date: "YYYY-MM-DD", close: "123.45" }, ...]`
* **Income (quarterly)**: rows include `fiscalDateEnding`, `reportedCurrency`, `totalRevenue`, `operatingIncome`, `netIncome`, `grossProfit`, `researchAndDevelopment`, `sellingGeneralAndAdministrative`, `ebit`, `ebitda` (values as strings, sometimes `"None"`).
* **EPS**: `[{ date: "YYYY-MM-DD", eps: "1.23" }, ...]`

**Rules**

* Backend continues to send **strings** for numeric fields.
* **Selectors** (front-end adapters) convert strings → numbers **only for chart props**.
* Handle `"None"`/missing as either **0** or filter out (policy chosen per chart).

---

## 4) Architecture & Folder Layout

```
frontend/src/app/research/
  ResearchPage.tsx
  components/
    ResearchTabs.tsx
    IncomeTab.tsx
    BalanceSheetTab.tsx
    PriceWithEPS.tsx
  selectors/
    selectIncome.ts
    selectBalanceSheet.ts
    mergeDailyPriceWithEPS.ts
  charts/
    BarChart.tsx          // Tremor copy-paste
    ComboChart.tsx        // Tremor copy-paste (optional if we use Recharts directly)
    useOnWindowResize.ts  // Tremor utility
  lib/
    chartUtils.ts         // Tremor utility
    numberFormat.ts       // moneyFmt(), epsFmt(), auto-scale helpers
```

**Separation of concerns**

* **Selectors**: the only place we parse, coerce, sort, and normalize data.
* **Components**: purely presentational (Tremor/Recharts + formatting).
* **Utils**: shared formatters and Tremor helpers.

---

## 5) UI/UX Guidelines

* **Layout**: 3 charts per row on desktop, 1–2 on smaller screens (Tailwind grid).
* **Color & Theme**: inherit Tailwind/Tremor tokens; charts readable in dark mode.
* **Axis & Units**: auto-scale large numbers to **M/B/T**; show currency in subtitles.
* **Ordering**: chronological (oldest → newest) by default; reversing is trivial if desired.
* **Tooltips**: number formatters for clarity; hide EPS tooltip when `eps === null`.
* **Dual axes**: use bi-axial for mixed-scale charts (price vs EPS) to avoid flattening.
* **Accessibility**: ensure contrast; rely on tooltips for exact values; sensible aria labels.

---

## 6) Charts We Will Render

### Income Tab (Quarterly)

* **Revenue** — Bar
* **Operating Income** — Bar
* **Net Income** — Bar
* **EPS** — Bar (row 2; optional if EPS is separate payload)

### Balance Sheet Tab (Quarterly or Annual)

Pick 6–9 (Bar):

* Total Assets, Total Liabilities, Shareholder Equity
* Cash & ST Investments, Long-term Debt, Current Liabilities
* *(Optional)* Receivables, PPE, Inventory (if available and useful)

### Price + EPS Overlay

* **Area** (daily close) + **Bar** (EPS on release days), **dual y-axes**, brush/zoom optional.

---

## 7) Precision & Formatting

* **Never** perform financial math in the browser beyond display formatting.
* **moneyFmt**: scale to M/B/T; keep short labels (e.g., `123.4B`).
* **epsFmt**: `toFixed(2)`.
* If values are massive (mega-caps), default to **B** scale for readability.
* Expose unit choice (auto/manual) via a tiny helper for future flexibility.

---

## 8) Implementation Strategy

1. **Install Tremor + Recharts & Tailwind config** (already standard in the project).
2. **Copy Tremor chart components** (BarChart, ComboChart) + utilities.
3. **Write selectors**:

   * `selectIncome`: parse strings, coerce `"None"`, derive `period` labels (`Qn YYYY`), return array for Tremor `BarChart`.
   * `selectBalanceSheet`: same idea for chosen metrics.
   * `mergeDailyPriceWithEPS`: map daily price and inject `eps | null` on release dates.
4. **Build tabs & cards**:

   * `IncomeTab`: 3-per-row grid, 3 bars (Revenue/OpInc/NetInc) + EPS card.
   * `BalanceSheetTab`: 3-per-row grid of selected metrics.
   * `PriceWithEPS`: Area + Bar (either via Tremor ComboChart or Recharts ComposedChart).
5. **Hook into ResearchPage**: fetch existing endpoints, pass JSONs to `ResearchTabs`.
6. **Finish with formatters** and light polish (subtitles show currency).

---

## 9) Best Practices / Guardrails

* **Type boundaries**: strings from API → numbers in selectors → chart props only.
* **Missing data**: pick one policy (zero or filter) per chart and keep consistent.
* **Release alignment**: EPS on **report date**; if non-trading day, snap to **next trading day** (server preferred; selector fallback acceptable).
* **Lazy-load heavy charts**: `dynamic(..., { ssr: false })` if bundle matters.
* **Memoization**: memoize selector outputs per symbol/data payload to avoid rework.
* **Theming**: centralize colors/tokens; avoid inline hard-coded colors unless needed.

---

## 10) Testing & CI (to stop regressions)

* **Unit tests (selectors)**:

  * String/“None” → numeric coercion correctness.
  * Period labeling & sorting.
  * EPS merge correctness (bars only on release days).
* **Render smoke tests**:

  * Tremor BarChart mounts with `index` and `categories`.
  * Overlay chart renders both series with dual axes.
* **Snapshot (“golden”)**:

  * Persist **sample input JSON → expected selector rows** for Income/Balance/EPS merge.
  * Any change to keys/order/values fails CI.
* **CI checks**:

  * Back end: forbid floats in financial fields (must be strings).
  * Front end: lint to disallow passing strings directly to chart `categories`.

---

## 11) Risks & Mitigations

* **Inconsistent field names** across tickers → **selectors** isolate key mapping; add per-provider adapters if needed.
* **Currency differences** → surface `reportedCurrency` in subtitles; future: normalize server-side.
* **Sparse/missing data** → decide per chart: zero vs filter; document policy.
* **Performance on very long histories** → daily is fine; add **Brush** for quick zoom if needed; consider downsampling for 15y+.

---

## 12) Rollout Plan & Timeline

* **Day 1–2**: Install Tremor, copy components, create selectors, wire **Income** tab with 3 charts; add formatters.
* **Day 3**: **Balance Sheet** tab with 6 charts; initial tests (selectors + smoke).
* **Day 4**: **Price + EPS** overlay; dual axis; finalize styles.
* **Day 5**: Tests & snapshots; CI rules; QA on 3–5 symbols; PR.

*(Parallelizable if needed. Financial Statement tab remains as-is and can be migrated later.)*

---

## 13) Acceptance Criteria (Definition of Done)

* **Functional**

  * Research page shows **Income** and **Balance Sheet** tabs, each with 3-per-row bar charts, correctly formatted and ordered.
  * **Price + EPS overlay** displays daily price and EPS bars only on release dates with dual y-axes.
* **Data correctness**

  * All numeric values are **strings over the wire**, **numbers in chart props** only.
  * EPS bars render **only** on release dates; none elsewhere.
* **Quality**

  * Selector unit tests + snapshot tests pass.
  * CI guardrails in place to prevent floats in API and string leakage into charts.
* **UX**

  * Dark mode looks correct; axis labels readable; tooltips formatted.
  * Layout responsive across mobile/tablet/desktop.

---

## 14) Future Enhancements (nice to have)

* **Ratios** (Gross/Operating/Net margin, EPS growth).
* **Toggle Quarterly/Annual** with shared selectors.
* **Currency normalization** (server-side).
* **Brush/zoom** on price chart; date range presets.
* **Compare mode** (multi-symbol) with stacked/grouped bars.

---

This summary captures the **what**, **why**, and **how**. With the selectors + chart components in place, adding new metrics becomes trivial: add a field to a selector, drop a `<Card><BarChart … /></Card>` into the grid, and you’re done.


# Research Page Revamp — Tremor Charts Implementation Plan

## Goals

* Split current **Research** view into tabs:

  * **Income** (quarterly bars)
  * **Balance Sheet** (quarterly/annual bars)
  * **Financial Statement** (keep current layout for now)
  * *(Optional later)* **Profitability** (Revenue, Operating Income, Net Income, EPS)
* Keep **daily price** chart. Allow overlay of **EPS bars on release dates** over a filled **mountain** (area) price line.
* Use **Tremor** charts (copy-paste components powered by **Recharts**) with strict data adapters so LLM edits don’t break types/precision.

---

# 1) Installation & Setup

## 1.1 Dependencies

```bash
# Tremor UI library (cards, tabs, etc.)
npm i @tremor/react

# Recharts (Tremor’s chart components rely on it)
npm i recharts
```

Tremor requires **React 18.2+** and **Tailwind 3.4+**. Configure Tailwind and include Tremor’s module path in `content` so classes aren’t purged. ([Tremor NPM][4])

**Tailwind config (snippet):**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}", // <-- Tremor
  ],
  theme: { /* (use Tremor’s suggested theme/dark tokens if you like) */ },
  plugins: [forms],
};

export default config;
```

(Tremor provides a full example theme and a safelist for chart colors if you want perfect parity.) ([Tremor NPM][4])

## 1.2 Tremor chart components (copy & paste)

Tremor’s visualizations are **copy-paste components** that wrap Recharts. For each chart we use (Bar, Combo), copy the component code from the docs into `src/components/charts/…`. They reference a small `chartUtils.ts` and a `useOnWindowResize` hook—copy those too. ([tremor.so][1])

* **BarChart** docs (props & component code). ([tremor.so][1])
* **ComboChart** (bar + line, single/dual axis). ([tremor.so][5])
* **AreaChart** (if you want a “mountain” fill directly). ([Tremor NPM][2])
* **chartUtils.ts** for consistent colors and axis domain helpers. ([tremor.so][6])

> If you prefer, you can skip ComboChart and build your own **Recharts `ComposedChart`** (Area + Bar) to get a filled line with EPS bars and dual y-axes (`yAxisId="left"`/`"right"`). ([GitHub][3])

---

# 2) Folder Structure (research page)

```
frontend/src/app/research/
  ResearchPage.tsx
  components/
    ResearchTabs.tsx
    IncomeTab.tsx
    BalanceSheetTab.tsx
    PriceWithEPS.tsx
  selectors/
    selectIncome.ts
    selectBalanceSheet.ts
    mergeDailyPriceWithEPS.ts
  charts/
    BarChart.tsx          // from Tremor docs
    ComboChart.tsx        // from Tremor docs (if used)
    useOnWindowResize.ts  // from Tremor docs
  lib/
    chartUtils.ts         // from Tremor docs
    numberFormat.ts       // moneyFmt, epsFmt, etc.
```

---

# 3) Data Contracts (front-end inputs)

> **Invariant:** Backend sends **strings** for all money/price fields to preserve precision. Front-end **selectors** convert to JS numbers **only** for chart props. (Do not do arithmetic beyond formatting in the browser.)

### 3.1 Daily Prices (already received on Research page)

```ts
type PricePoint = { date: string; close: string }; // ISO date; price as string
```

### 3.2 Quarterly Income JSON (example keys)

Matches what you pasted, e.g.:

```ts
type IncomeApiRow = {
  fiscalDateEnding: string;           // "2023-09-30"
  reportedCurrency?: string;          // "USD"
  totalRevenue?: string;              // "56517000000"
  operatingIncome?: string;           // "26895000000"
  netIncome?: string;                 // "22291000000"
  ebit?: string;                      // "27809000000"
  ebitda?: string;                    // "31730000000"
  grossProfit?: string;
  costOfRevenue?: string;
  researchAndDevelopment?: string;
  sellingGeneralAndAdministrative?: string;
  // ...others, some may be "None"
};
```

### 3.3 EPS releases

```ts
type EpsRelease = { date: string; eps: string }; // date = report date (ISO)
```

---

# 4) Selectors (LLM-safe adapters)

## 4.1 Income selector → Tremor `BarChart` rows

```ts
// selectors/selectIncome.ts
export type IncomeRow = {
  period: string;                 // "Q3 2023"
  Revenue: number;
  "Operating Income": number;
  "Net Income": number;
  EPS?: number;                   // merged if available
  currency?: string;
};

const toQuarterLabel = (iso: string) => {
  const d = new Date(iso);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
};

const toNum = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (v.toLowerCase?.() === "none") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export function selectIncome(quarterly: IncomeApiRow[]): IncomeRow[] {
  return quarterly
    .map(r => ({
      period: toQuarterLabel(r.fiscalDateEnding),
      Revenue: toNum(r.totalRevenue),
      "Operating Income": toNum(r.operatingIncome),
      "Net Income": toNum(r.netIncome),
      currency: r.reportedCurrency ?? "USD",
    }))
    .sort((a,b) => a.period.localeCompare(b.period));
}
```

## 4.2 Balance sheet selector (pattern)

```ts
// selectors/selectBalanceSheet.ts
type BalanceApiRow = {
  fiscalDateEnding: string;
  totalAssets?: string;
  totalLiabilities?: string;
  totalShareholderEquity?: string;
  cashAndShortTermInvestments?: string;
  longTermDebt?: string;
  currentLiabilities?: string;
  // ...
};

export type BalanceRow = {
  period: string;
  "Total Assets": number;
  "Total Liabilities": number;
  "Shareholder Equity": number;
  "Cash & ST Inv.": number;
  "Long-term Debt": number;
  "Current Liabilities": number;
  currency?: string;
};

export function selectBalance(rows: BalanceApiRow[]): BalanceRow[] {
  const toNum = (v: any) => (v && v !== "None" ? Number(v) : 0);
  const toQuarterLabel = (iso: string) => {
    const d = new Date(iso); const q = Math.floor(d.getUTCMonth()/3)+1;
    return `Q${q} ${d.getUTCFullYear()}`;
  };
  return rows.map(r => ({
    period: toQuarterLabel(r.fiscalDateEnding),
    "Total Assets": toNum(r.totalAssets),
    "Total Liabilities": toNum(r.totalLiabilities),
    "Shareholder Equity": toNum(r.totalShareholderEquity),
    "Cash & ST Inv.": toNum(r.cashAndShortTermInvestments),
    "Long-term Debt": toNum(r.longTermDebt),
    "Current Liabilities": toNum(r.currentLiabilities),
  }));
}
```

## 4.3 Merge daily price + EPS for overlay chart

```ts
// selectors/mergeDailyPriceWithEPS.ts
type Price = { date: string; close: string };
type EPS   = { date: string; eps: string };
export type PriceEpsRow = { date: string; close: number; eps: number | null };

export function mergeDailyWithEPS(daily: Price[], eps: EPS[]): PriceEpsRow[] {
  const epsMap = new Map(eps.map(e => [e.date, Number(e.eps)]));
  return daily.map(p => ({
    date: p.date,
    close: Number(p.close),
    eps: epsMap.get(p.date) ?? null,   // only bars on release dates
  }));
}
```

---

# 5) Components

## 5.1 Research tabs shell

```tsx
// components/ResearchTabs.tsx
"use client";

import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";
import IncomeTab from "./IncomeTab";
import BalanceSheetTab from "./BalanceSheetTab";
// FinancialStatementTab = existing page for now

export default function ResearchTabs(props: {
  income: any[]; balance: any[]; prices: any[]; eps: any[];
}) {
  return (
    <TabGroup>
      <TabList>
        <Tab>Income</Tab>
        <Tab>Balance Sheet</Tab>
        <Tab>Financial Statement</Tab>
      </TabList>
      <TabPanels>
        <TabPanel><IncomeTab financials={props.income} /></TabPanel>
        <TabPanel><BalanceSheetTab financials={props.balance} /></TabPanel>
        <TabPanel>{/* existing layout here */}</TabPanel>
      </TabPanels>
    </TabGroup>
  );
}
```

## 5.2 Income (3 charts per row)

```tsx
// components/IncomeTab.tsx
"use client";
import { Card, Title, Subtitle, BarChart } from "@tremor/react";
import { selectIncome } from "../selectors/selectIncome";
import { moneyFmt, epsFmt } from "../lib/numberFormat";

export default function IncomeTab({ financials }: { financials: any[] }) {
  const data = selectIncome(financials);
  const currency = data[0]?.currency ?? "USD";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <Title>Revenue</Title><Subtitle>Quarterly — {currency}</Subtitle>
        <BarChart className="mt-4 h-64" data={data} index="period"
          categories={["Revenue"]} valueFormatter={moneyFmt} yAxisWidth={56} />
      </Card>

      <Card>
        <Title>Operating Income</Title><Subtitle>Quarterly — {currency}</Subtitle>
        <BarChart className="mt-4 h-64" data={data} index="period"
          categories={["Operating Income"]} valueFormatter={moneyFmt} yAxisWidth={56} />
      </Card>

      <Card>
        <Title>Net Income</Title><Subtitle>Quarterly — {currency}</Subtitle>
        <BarChart className="mt-4 h-64" data={data} index="period"
          categories={["Net Income"]} valueFormatter={moneyFmt} yAxisWidth={56} />
      </Card>

      {/* Optional second row */}
      <Card>
        <Title>EPS</Title><Subtitle>Quarterly</Subtitle>
        <BarChart className="mt-4 h-64" data={data} index="period"
          categories={["EPS"]} valueFormatter={epsFmt} yAxisWidth={56} />
      </Card>
    </div>
  );
}
```

**Tremor `BarChart` key props** we rely on:

* `data: object[]` — rows
* `index: string` — x-axis key (e.g., `"period"`)
* `categories: string[]` — one or more series keys
* `valueFormatter?: (n:number)=>string` — label/tooltip formatter
* `className?`, `yAxisWidth?`, legend/interaction options
  (See docs; the copy-paste component exposes these props.) ([tremor.so][1])

## 5.3 Balance Sheet (same 3-per-row pattern)

Replicate `IncomeTab` with your chosen metrics (e.g., Total Assets, Total Liabilities, Equity, Cash & ST Inv., LT Debt, Current Liabilities).

## 5.4 Price + EPS overlay (“mountain + bars”)

### Option A — Tremor **ComboChart** (line + bars; dual axis)

```tsx
// components/PriceWithEPS.tsx
"use client";
import { ComboChart } from "../charts/ComboChart"; // from Tremor docs
import { mergeDailyWithEPS } from "../selectors/mergeDailyPriceWithEPS";

export default function PriceWithEPS({ prices, eps }: { prices: any[]; eps: any[] }) {
  const data = mergeDailyWithEPS(prices, eps);
  return (
    <div className="h-80">
      <ComboChart
        data={data}
        index="date"
        enableBiaxial
        barSeries={{ categories: ["eps"], yAxisLabel: "EPS" }}
        lineSeries={{ categories: ["close"], yAxisLabel: "Price", showYAxis: true, yAxisWidth: 56 }}
      />
    </div>
  );
}
```

(ComboChart supports single/dual axis via `enableBiaxial` and separates `barSeries`/`lineSeries` configs.) ([tremor.so][5])

### Option B — **Recharts `ComposedChart`** (Area “mountain” + Bar + dual y-axes)

```tsx
"use client";
import {
  ComposedChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Area, Bar, Legend,
} from "recharts";
import { mergeDailyWithEPS } from "../selectors/mergeDailyPriceWithEPS";

export function PriceWithEPSComposed({ prices, eps }: { prices: any[]; eps: any[] }) {
  const data = mergeDailyWithEPS(prices, eps);
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeOpacity={0.15} vertical={false} />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left"  tickMargin={8} />              {/* Price */}
          <YAxis yAxisId="right" orientation="right" />         {/* EPS */}
          <Tooltip />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="close" dot={false} fillOpacity={0.2} strokeOpacity={0.9} />
          <Bar  yAxisId="right" dataKey="eps" barSize={6} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

(Dual axes use `yAxisId`. That’s the canonical approach in Recharts.) ([GitHub][3])

---

# 6) Formatting helpers

```ts
// lib/numberFormat.ts
export const moneyFmt = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n/1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `${(n/1e9).toFixed(2)}B`;
  if (a >= 1e6)  return `${(n/1e6).toFixed(0)}M`;
  return n.toLocaleString();
};
export const epsFmt = (n: number) => n.toFixed(2);
```

---

# 7) Best Practices / Guardrails

1. **Precision discipline:** Server sends **strings**. In selectors only, cast to numbers for visualization. Do not do financial math in the browser.
2. **Missing data:** Treat `"None"` or null as **0** for bars **or** filter rows out; choose one policy per chart for consistency.
3. **Units:** Use **B**/**M** scaling for readability; don’t render raw 11-digit numbers.
4. **Sorting:** Show chronological order (oldest→newest) unless UX prefers newest first (then reverse).
5. **Dual axes:** Use **bi-axial** for mixed-scale charts (price vs EPS) so neither series flattens the other. ([tremor.so][5])
6. **Release dates:** EPS bars only on **release dates**; if date falls on a non-trading day, snap to next trading day on the server (or preprocessed client selector if needed).
7. **Dark mode:** Tremor inherits Tailwind colors; adopt Tremor’s theme tokens or your own to keep contrast. ([Tremor NPM][4])
8. **Lazy-load charts:** If bundle size matters, `dynamic(() => import('...'), { ssr: false })` for chart heavy components.

---

# 8) Testing

## 8.1 Selector unit tests (no DOM)

* `selectIncome` returns sorted rows, numeric values, and proper labels.
* `"None"` and missing fields → 0 (or filtered).
* `mergeDailyWithEPS` produces `eps: null` for non-release dates.

## 8.2 Render smoke tests (React Testing Library)

* Bar charts mount with expected `index` and `categories`.
* Tooltip formatter returns expected strings for a sample value.

## 8.3 Snapshot (“golden JSON”)

* Persist **5 fixtures** per chart type. Any change in output rows or prop names fails CI.

---

# 9) CI checks

* **Disallow floats** in back-end API responses for financial numbers (should be strings).
* **Frontend:** lint rule to fail if charts get anything but numbers (selector enforces it).
* Run selector tests + render smoke on every PR.

---

# 10) LLM Implementation Checklist (copy into your PR template)

* [ ] Install `@tremor/react` and `recharts`; update Tailwind config. ([Tremor NPM][4])
* [ ] Copy Tremor **BarChart** and **ComboChart** components, `chartUtils.ts`, `useOnWindowResize.ts`. ([tremor.so][1])
* [ ] Create `selectors/selectIncome.ts`, `selectors/selectBalanceSheet.ts`, `selectors/mergeDailyPriceWithEPS.ts` from this doc.
* [ ] Build `IncomeTab`, `BalanceSheetTab`, `ResearchTabs` as shown.
* [ ] Wire **Profitability** (optional): reuse Income selector, show 4 cards (Revenue, Operating Income, Net Income, EPS).
* [ ] Replace price chart with **ComboChart** (line + bars) or **ComposedChart** (Area + Bar) for EPS overlay.
* [ ] Add `numberFormat.ts` and use formatters in charts.
* [ ] Write tests:

  * Selector unit tests.
  * One render smoke test per tab.
  * Snapshot JSON fixtures.
* [ ] Confirm dark mode + responsive behavior.

---

# 11) Reference props you’ll use most

## BarChart (Tremor copy-paste component)

* `data: object[]`
* `index: string`
* `categories: string[]`
* `valueFormatter?: (n:number)=>string`
* `className?`, `yAxisWidth?`, legend and interaction callbacks
  (See embedded code/props in docs “Code” panel.) ([tremor.so][1])

## ComboChart (Tremor)

* `data`, `index`, `enableBiaxial?`
* `barSeries: { categories: string[]; yAxisLabel?: string }`
* `lineSeries: { categories: string[]; showYAxis?: boolean; yAxisLabel?: string; colors?: string[]; yAxisWidth?: number }` ([tremor.so][5])

## Recharts (for custom Area + Bar)

* Use `ComposedChart`, two `YAxis` with `yAxisId="left" | "right"`, `Area` for price, `Bar` for EPS. ([GitHub][3])

---

# 12) Example: Wire it into the page

```tsx
// ResearchPage.tsx (server or client depending on your app)
import ResearchTabs from "./components/ResearchTabs";

export default async function ResearchPage({ params: { symbol } }) {
  const prices = await fetch(`/api/prices?symbol=${symbol}`).then(r => r.json());
  const income  = await fetch(`/api/financials/income?symbol=${symbol}`).then(r => r.json());
  const balance = await fetch(`/api/financials/balance?symbol=${symbol}`).then(r => r.json());
  const eps     = await fetch(`/api/earnings?symbol=${symbol}`).then(r => r.json());

  return <ResearchTabs income={income} balance={balance} prices={prices} eps={eps} />;
}
```

---

That’s everything you need. If you want, I can turn this into a PR with the folders scaffolded and the first tab (Income) fully wired so you can see it working end-to-end.

[1]: https://tremor.so/docs/visualizations/bar-chart "Bar Chart - Tremor"
[2]: https://npm.tremor.so/docs/visualizations/area-chart?utm_source=chatgpt.com "Area Chart • Docs • Tremor NPM"
[3]: https://github.com/recharts/recharts/issues/174?utm_source=chatgpt.com "Allow for 2 YAxis · Issue #174 · recharts/recharts · GitHub"
[4]: https://npm.tremor.so/docs/getting-started/installation "Installation • Docs • Tremor NPM"
[5]: https://tremor.so/docs/visualizations/combo-chart "Combo Chart - Tremor"
[6]: https://tremor.so/docs/utilities/chartUtils "chartUtils - Tremor"
