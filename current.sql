-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.company_financials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol character varying NOT NULL,
  data_type character varying NOT NULL,
  financial_data jsonb NOT NULL,
  last_updated timestamp without time zone DEFAULT now(),
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT company_financials_pkey PRIMARY KEY (id)
);
CREATE TABLE public.forex_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_currency character varying NOT NULL,
  to_currency character varying NOT NULL,
  date date NOT NULL,
  rate numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT forex_rates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.historical_prices (
  id bigint NOT NULL DEFAULT nextval('historical_prices_id_seq'::regclass),
  symbol character varying NOT NULL,
  date date NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  adjusted_close numeric NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  dividend_amount numeric DEFAULT 0,
  split_coefficient numeric DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT historical_prices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.market_holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exchange character varying NOT NULL,
  holiday_date date NOT NULL,
  holiday_name character varying,
  market_status character varying DEFAULT 'closed'::character varying,
  early_close_time time without time zone,
  late_open_time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT market_holidays_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (upper(transaction_type) = ANY (ARRAY['BUY'::text, 'SELL'::text, 'DEPOSIT'::text, 'WITHDRAWAL'::text, 'DIVIDEND'::text])),
  symbol text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  price numeric NOT NULL CHECK (price > 0::numeric),
  date date NOT NULL,
  currency text NOT NULL DEFAULT 'USD'::text,
  commission numeric DEFAULT 0 CHECK (commission >= 0::numeric),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  amount_invested numeric,
  market_region character varying DEFAULT 'United States'::character varying,
  market_open time without time zone DEFAULT '09:30:00'::time without time zone,
  market_close time without time zone DEFAULT '16:00:00'::time without time zone,
  market_timezone character varying DEFAULT 'UTC-05'::character varying,
  market_currency character varying DEFAULT 'USD'::character varying,
  exchange_rate numeric,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_dividends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  symbol character varying NOT NULL,
  user_id uuid,
  ex_date date NOT NULL,
  pay_date date,
  declaration_date date,
  record_date date,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  currency character varying DEFAULT 'USD'::character varying CHECK (currency::text = ANY (ARRAY['USD'::character varying, 'EUR'::character varying, 'GBP'::character varying, 'CAD'::character varying, 'AUD'::character varying]::text[])),
  shares_held_at_ex_date numeric CHECK (shares_held_at_ex_date IS NULL OR shares_held_at_ex_date >= 0::numeric),
  current_holdings numeric CHECK (current_holdings IS NULL OR current_holdings >= 0::numeric),
  total_amount numeric CHECK (total_amount IS NULL OR total_amount >= 0::numeric),
  confirmed boolean DEFAULT false,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'edited'::character varying]::text[])),
  dividend_type character varying DEFAULT 'cash'::character varying CHECK (dividend_type::text = ANY (ARRAY['cash'::character varying, 'stock'::character varying, 'drp'::character varying]::text[])),
  source character varying DEFAULT 'alpha_vantage'::character varying CHECK (source::text = ANY (ARRAY['alpha_vantage'::character varying, 'manual'::character varying, 'broker'::character varying]::text[])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  rejected boolean DEFAULT false,
  CONSTRAINT user_dividends_pkey PRIMARY KEY (id),
  CONSTRAINT user_dividends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  country character varying NOT NULL,
  base_currency character varying NOT NULL DEFAULT 'USD'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.watchlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  symbol character varying NOT NULL,
  notes text,
  target_price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT watchlist_pkey PRIMARY KEY (id),
  CONSTRAINT watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);