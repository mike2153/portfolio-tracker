-- Supabase initial schema for simplified portfolio tracker
-- Includes all tables, views, functions, and RLS policies

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create profiles table for extended user data
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create transactions table with all form fields
create table if not exists public.transactions (
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

-- Create stock symbols cache for autocomplete
create table if not exists public.stock_symbols (
  symbol text primary key,
  name text not null,
  exchange text,
  currency text default 'USD',
  type text default 'Equity',
  market_cap numeric,
  sector text,
  updated_at timestamp with time zone default now()
);

-- Create API cache table for Alpha Vantage responses
create table if not exists public.api_cache (
  cache_key text primary key,
  data jsonb not null,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null
);

-- Create indexes for performance
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_symbol on public.transactions(symbol);
create index if not exists idx_transactions_date on public.transactions(date desc);
create index if not exists idx_stock_symbols_name on public.stock_symbols(name);
create index if not exists idx_api_cache_expires on public.api_cache(expires_at);

-- Create function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_profiles_updated_at 
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_transactions_updated_at 
  before update on public.transactions
  for each row execute function public.update_updated_at();

-- Create portfolio view (calculated from transactions)
create or replace view public.portfolio as
select 
    user_id,
    symbol,
    sum(case 
        when transaction_type = 'Buy' then quantity 
        else -quantity 
    end) as total_shares,
    sum(case 
        when transaction_type = 'Buy' then (quantity * price + commission)
        else -(quantity * price - commission)
    end) as net_cost,
    sum(case 
        when transaction_type = 'Buy' then quantity * price
        else 0
    end) / nullif(sum(case when transaction_type = 'Buy' then quantity else 0 end), 0) as avg_buy_price
from public.transactions
group by user_id, symbol
having sum(case when transaction_type = 'Buy' then quantity else -quantity end) > 0.001;

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

-- RLS Policies for profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- RLS Policies for transactions
create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- Public access for stock symbols (no RLS needed)
grant select on public.stock_symbols to anon, authenticated;

-- API cache is only accessible via service role
grant all on public.api_cache to service_role;

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Function to clean expired cache entries
create or replace function public.clean_expired_cache()
returns void as $$
begin
  delete from public.api_cache
  where expires_at < now();
end;
$$ language plpgsql;

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant select on public.portfolio to authenticated;
grant all on public.profiles to authenticated;
grant all on public.transactions to authenticated; 