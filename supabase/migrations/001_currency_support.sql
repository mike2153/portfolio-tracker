-- Migration: Add Multi-Currency Support
-- Date: 2025-07-25
-- Description: Adds user profiles, forex rates, and API usage tracking tables

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  country VARCHAR(2) NOT NULL,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can view own profile" 
  ON public.user_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 2. Create forex_rates table
CREATE TABLE IF NOT EXISTS public.forex_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  date DATE NOT NULL,
  rate DECIMAL(20,10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, date)
);

-- Index for forex lookups
CREATE INDEX IF NOT EXISTS idx_forex_lookup 
  ON public.forex_rates(from_currency, to_currency, date);

-- 3. Create stocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  exchange VARCHAR(50),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add currency column to stocks table (if table exists but column doesn't)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'stocks' 
                 AND column_name = 'currency') THEN
    ALTER TABLE public.stocks ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
  END IF;
END $$;

-- 4. Update stock currencies based on symbol patterns
UPDATE public.stocks SET 
  currency = CASE 
    WHEN symbol LIKE '%.AX' THEN 'AUD'
    WHEN symbol LIKE '%.L' THEN 'GBP'
    WHEN symbol LIKE '%.TO' THEN 'CAD'
    WHEN symbol LIKE '%.PA' THEN 'EUR'
    WHEN symbol LIKE '%.DE' THEN 'EUR'
    WHEN symbol LIKE '%.MI' THEN 'EUR'
    WHEN symbol LIKE '%.MC' THEN 'EUR'
    WHEN symbol LIKE '%.AS' THEN 'EUR'
    WHEN symbol LIKE '%.BR' THEN 'EUR'
    WHEN symbol LIKE '%.SW' THEN 'CHF'
    WHEN symbol LIKE '%.T' THEN 'JPY'
    WHEN symbol LIKE '%.HK' THEN 'HKD'
    WHEN symbol LIKE '%.SI' THEN 'SGD'
    WHEN symbol LIKE '%.KL' THEN 'MYR'
    WHEN symbol LIKE '%.JK' THEN 'IDR'
    WHEN symbol LIKE '%.BK' THEN 'THB'
    WHEN symbol LIKE '%.NS' OR symbol LIKE '%.BO' THEN 'INR'
    WHEN symbol LIKE '%.KS' OR symbol LIKE '%.KQ' THEN 'KRW'
    WHEN symbol LIKE '%.TW' THEN 'TWD'
    WHEN symbol LIKE '%.NZ' THEN 'NZD'
    WHEN symbol LIKE '%.MX' THEN 'MXN'
    WHEN symbol LIKE '%.SA' THEN 'BRL'
    WHEN symbol LIKE '%.BA' THEN 'ARS'
    ELSE 'USD'
  END
WHERE currency = 'USD';

-- 5. Add exchange_rate column to transactions
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'transactions' 
                 AND column_name = 'exchange_rate') THEN
    ALTER TABLE public.transactions ADD COLUMN exchange_rate DECIMAL(20,10);
  END IF;
END $$;

-- 6. Create API usage tracking table
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  call_count INTEGER DEFAULT 0,
  UNIQUE(service, date)
);

-- Index for API usage lookups
CREATE INDEX IF NOT EXISTS idx_api_usage_lookup 
  ON public.api_usage(service, date);

-- 7. Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Add triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
  ON public.user_profiles FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Grant necessary permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.forex_rates TO authenticated;
GRANT ALL ON public.api_usage TO authenticated;

-- 10. Insert some initial fallback forex rates
INSERT INTO public.forex_rates (from_currency, to_currency, date, rate) VALUES
  ('USD', 'EUR', CURRENT_DATE, 0.92),
  ('EUR', 'USD', CURRENT_DATE, 1.09),
  ('USD', 'GBP', CURRENT_DATE, 0.79),
  ('GBP', 'USD', CURRENT_DATE, 1.27),
  ('USD', 'JPY', CURRENT_DATE, 150.0),
  ('JPY', 'USD', CURRENT_DATE, 0.0067),
  ('USD', 'AUD', CURRENT_DATE, 1.52),
  ('AUD', 'USD', CURRENT_DATE, 0.66),
  ('USD', 'CAD', CURRENT_DATE, 1.36),
  ('CAD', 'USD', CURRENT_DATE, 0.74)
ON CONFLICT (from_currency, to_currency, date) DO NOTHING;