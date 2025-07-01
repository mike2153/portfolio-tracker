-- Supabase handles users via auth.users, no need for custom table
-- But we'll create a profiles table for additional user data if needed

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Main transactions table with all form fields
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  transaction_type text not null check (transaction_type in ('Buy', 'Sell')),
  symbol text not null,
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price > 0),
  date date not null,
  currency text not null default 'USD',
  commission numeric default 0 check (commission >= 0),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions table
-- Allow users to read only their own transactions
CREATE POLICY "Users can read own transactions" ON transactions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Allow users to insert only their own transactions  
CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update only their own transactions
CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete only their own transactions
CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Allow service role full access (for admin operations)
CREATE POLICY "Service role full access to transactions" ON transactions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Stock symbols cache for autocomplete
create table if not exists stock_symbols (
  symbol text primary key,
  name text not null,
  exchange text,
  currency text default 'USD',
  type text default 'Equity',
  market_cap numeric,
  sector text,
  updated_at timestamp with time zone default now()
);

-- Alpha Vantage API cache to avoid rate limits
create table if not exists api_cache (
  cache_key text primary key,
  data jsonb not null,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null
);

-- Historical Stock Prices Table
-- Stores daily historical price data for all stocks that users have transactions in
-- This data is essential for portfolio calculations and transaction price lookups
CREATE TABLE IF NOT EXISTS historical_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 4) NOT NULL,
    high DECIMAL(12, 4) NOT NULL,
    low DECIMAL(12, 4) NOT NULL,
    close DECIMAL(12, 4) NOT NULL,
    adjusted_close DECIMAL(12, 4) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    dividend_amount DECIMAL(10, 4) DEFAULT 0,
    split_coefficient DECIMAL(10, 4) DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure no duplicate entries for same symbol/date
    UNIQUE(symbol, date)
);

-- Index for fast lookups by symbol and date range
CREATE INDEX IF NOT EXISTS idx_historical_prices_symbol_date ON historical_prices(symbol, date DESC);

-- Index for fast lookups by date for portfolio calculations
CREATE INDEX IF NOT EXISTS idx_historical_prices_date ON historical_prices(date DESC);

-- Index for fast symbol lookups
CREATE INDEX IF NOT EXISTS idx_historical_prices_symbol ON historical_prices(symbol);

-- RLS policies for historical_prices
ALTER TABLE historical_prices ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (historical prices are public data)
CREATE POLICY "Allow read access to historical prices" ON historical_prices
    FOR SELECT TO authenticated
    USING (true);

-- Allow insert/update only to service role (for data seeding)
CREATE POLICY "Allow service role to manage historical prices" ON historical_prices
    FOR ALL TO service_role
    USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_historical_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_historical_prices_updated_at
    BEFORE UPDATE ON historical_prices
    FOR EACH ROW
    EXECUTE PROCEDURE update_historical_prices_updated_at();

-- Function to get price data for a symbol on a specific date (or closest trading day)
CREATE OR REPLACE FUNCTION get_historical_price_for_date(
    p_symbol TEXT,
    p_date DATE
)
RETURNS TABLE (
    symbol TEXT,
    date DATE,
    open DECIMAL,
    high DECIMAL,
    low DECIMAL,
    close DECIMAL,
    adjusted_close DECIMAL,
    volume BIGINT,
    is_exact_date BOOLEAN
) AS $$
DECLARE
    exact_match historical_prices%ROWTYPE;
    closest_match historical_prices%ROWTYPE;
BEGIN
    -- First try to find exact date match
    SELECT * INTO exact_match
    FROM historical_prices hp
    WHERE hp.symbol = p_symbol 
    AND hp.date = p_date;
    
    IF FOUND THEN
        -- Return exact match
        RETURN QUERY SELECT 
            exact_match.symbol::TEXT,
            exact_match.date,
            exact_match.open,
            exact_match.high,
            exact_match.low,
            exact_match.close,
            exact_match.adjusted_close,
            exact_match.volume,
            true as is_exact_date;
        RETURN;
    END IF;
    
    -- If no exact match, find closest previous trading day (within 7 days)
    SELECT * INTO closest_match
    FROM historical_prices hp
    WHERE hp.symbol = p_symbol 
    AND hp.date <= p_date
    AND hp.date >= (p_date - INTERVAL '7 days')
    ORDER BY hp.date DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Return closest match
        RETURN QUERY SELECT 
            closest_match.symbol::TEXT,
            closest_match.date,
            closest_match.open,
            closest_match.high,
            closest_match.low,
            closest_match.close,
            closest_match.adjusted_close,
            closest_match.volume,
            false as is_exact_date;
        RETURN;
    END IF;
    
    -- No data found
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
create index idx_transactions_user_id on transactions(user_id);
create index idx_transactions_symbol on transactions(symbol);
create index idx_transactions_date on transactions(date desc);
create index idx_stock_symbols_name on stock_symbols(name);
create index idx_api_cache_expires on api_cache(expires_at);

-- Function to update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger update_transactions_updated_at before update on transactions
  for each row execute function update_updated_at(); 

  -- Migration: Add Historical Prices Table and Functions
-- Created: 2025-01-02
-- Description: Adds historical_prices table for storing stock price data and supporting functions

-- Historical Stock Prices Table
-- Stores daily historical price data for all stocks that users have transactions in
-- This data is essential for portfolio calculations and transaction price lookups
CREATE TABLE IF NOT EXISTS historical_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 4) NOT NULL,
    high DECIMAL(12, 4) NOT NULL,
    low DECIMAL(12, 4) NOT NULL,
    close DECIMAL(12, 4) NOT NULL,
    adjusted_close DECIMAL(12, 4) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    dividend_amount DECIMAL(10, 4) DEFAULT 0,
    split_coefficient DECIMAL(10, 4) DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure no duplicate entries for same symbol/date
    UNIQUE(symbol, date)
);

-- Index for fast lookups by symbol and date range
CREATE INDEX IF NOT EXISTS idx_historical_prices_symbol_date ON historical_prices(symbol, date DESC);

-- Index for fast lookups by date for portfolio calculations
CREATE INDEX IF NOT EXISTS idx_historical_prices_date ON historical_prices(date DESC);

-- Index for fast symbol lookups
CREATE INDEX IF NOT EXISTS idx_historical_prices_symbol ON historical_prices(symbol);

-- RLS policies for historical_prices
ALTER TABLE historical_prices ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (historical prices are public data)
CREATE POLICY "Allow read access to historical prices" ON historical_prices
    FOR SELECT TO authenticated
    USING (true);

-- Allow insert/update only to service role (for data seeding)
CREATE POLICY "Allow service role to manage historical prices" ON historical_prices
    FOR ALL TO service_role
    USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_historical_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_historical_prices_updated_at
    BEFORE UPDATE ON historical_prices
    FOR EACH ROW
    EXECUTE PROCEDURE update_historical_prices_updated_at();

-- Function to get price data for a symbol on a specific date (or closest trading day)
CREATE OR REPLACE FUNCTION get_historical_price_for_date(
    p_symbol TEXT,
    p_date DATE
)
RETURNS TABLE (
    symbol TEXT,
    date DATE,
    open DECIMAL,
    high DECIMAL,
    low DECIMAL,
    close DECIMAL,
    adjusted_close DECIMAL,
    volume BIGINT,
    is_exact_date BOOLEAN
) AS $$
DECLARE
    exact_match historical_prices%ROWTYPE;
    closest_match historical_prices%ROWTYPE;
BEGIN
    -- First try to find exact date match
    SELECT * INTO exact_match
    FROM historical_prices hp
    WHERE hp.symbol = p_symbol 
    AND hp.date = p_date;
    
    IF FOUND THEN
        -- Return exact match
        RETURN QUERY SELECT 
            exact_match.symbol::TEXT,
            exact_match.date,
            exact_match.open,
            exact_match.high,
            exact_match.low,
            exact_match.close,
            exact_match.adjusted_close,
            exact_match.volume,
            true as is_exact_date;
        RETURN;
    END IF;
    
    -- If no exact match, find closest previous trading day (within 7 days)
    SELECT * INTO closest_match
    FROM historical_prices hp
    WHERE hp.symbol = p_symbol 
    AND hp.date <= p_date
    AND hp.date >= (p_date - INTERVAL '7 days')
    ORDER BY hp.date DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Return closest match
        RETURN QUERY SELECT 
            closest_match.symbol::TEXT,
            closest_match.date,
            closest_match.open,
            closest_match.high,
            closest_match.low,
            closest_match.close,
            closest_match.adjusted_close,
            closest_match.volume,
            false as is_exact_date;
        RETURN;
    END IF;
    
    -- No data found
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 