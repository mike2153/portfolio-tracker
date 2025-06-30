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