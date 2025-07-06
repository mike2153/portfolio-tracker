# Stock Research Page - Technical Requirements

Refer to the **COMPREHENSIVE_SYSTEM_DOCUMENTATION** for a high level overview of the project and existing conventions.

## Context & Stack
- **Frontend**: Next.js, React, TypeScript, Tailwind
- **Backend**: FastAPI (Python), Supabase (PostgreSQL)
- **External API**: Alpha Vantage
- **Auth**: Supabase Auth

## Success Criteria
- [ ] User can search and view stock data for any valid ticker
- [ ] User can save and manage personal notes with buy/hold/sell tags
- [ ] News displays with sentiment analysis
- [ ] Page loads in <2 seconds and gracefully handles errors
- [ ] Integrates seamlessly with existing app UI and patterns

## MVP Implementation Order
1. Basic stock overview (ticker → company data)
2. Notes CRUD with database persistence
3. News integration with error handling
4. Sentiment analysis integration
5. Watchlist auto-tagging

## Priority Levels
### MVP (Must Have)
- Stock overview with basic metrics
- Simple notes functionality
- Basic error handling
- Financial analysis of balance sheets and cash flow statements
- Widgets showing PE, EPS, growth rates, P/S using the last closing price

### Phase 2 (Should Have)
- News integration with sentiment
- Advanced watchlist features

### Phase 3 (Nice to Have)
- Advanced analytics
- Bulk operations

## Technical Stack & Architecture
- Next.js frontend communicating with FastAPI backend
- Supabase provides PostgreSQL database with Row Level Security
- Alpha Vantage supplies stock data which is cached in the database for 15 minutes

## Database Schema Requirements
```sql
CREATE TABLE stocks_research (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  ticker VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  ticker VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  tag VARCHAR(10) CHECK (tag IN ('buy', 'hold', 'sell')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Integration Specs
```typescript
interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  priceChange: number;
  marketCap: number;
  // ... other fields
}
```
- **Overview**: use the `OVERVIEW` function for company data
- **Quote**: use `GLOBAL_QUOTE` for real-time price
- **News**: use `NEWS_SENTIMENT` for articles with sentiment
- **Rate limit**: 25 requests/day on the free tier
- **Caching**: responses cached for at least 15 minutes

## UI/UX Requirements
- Follow existing design patterns and component structure
- Responsive layout with tabs for overview, notes and news
- Display skeleton loaders while fetching data

## Implementation Steps
1. Apply the SQL migrations before running the app
2. Build API calls to Alpha Vantage with caching logic
3. Create React components for overview, notes and news
4. Connect components to backend endpoints and Supabase
5. Add validation and error handling to the UI

## Error Handling Strategy
- On API failures show cached data with a "stale data" warning
- Queue additional requests when hitting rate limits and inform the user
- Retry network errors with exponential backoff
- Display a friendly message when a ticker is invalid

## Performance Requirements
- Initial page load should take less than 2 seconds
- Tab switching should complete in under 500 ms
- News loads in the background with skeleton placeholders
- Add indexes on `user_id` and `ticker` columns for quick queries

## File Structure
Keep the existing project structure. New code should fit under the respective
frontend or backend directories without introducing extra folders.

## Testing Requirements
- Unit tests for API utility functions
- Integration tests for database operations
- Manual testing checklist for main UI flows
- Error scenario testing (network failures, invalid tickers)

## Input Validation
- Ticker symbols: 1‑5 uppercase letters only
- Notes: 1‑2000 characters and must not contain `<script>` tags
- Sanitize all user input before storing in the database

## Environment & Configuration
- `ALPHA_VANTAGE_API_KEY=your_key_here`
- `NEXT_PUBLIC_SUPABASE_URL=existing`
- `SUPABASE_SERVICE_KEY=existing`

Run the SQL schema above before implementation and ensure RLS policies mirror the
existing patterns in the project.
