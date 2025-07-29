-- Migration: Fix Google Auth User Profile Creation
-- Date: 2025-07-28
-- Description: Creates user_profiles table and adds trigger for automatic profile creation

-- 1. Create user_profiles table if it doesn't exist
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

-- 2. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for user_profiles
CREATE POLICY "Users can view own profile" 
  ON public.user_profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.user_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.user_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 4. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  full_name text;
  first_name text;
  last_name text;
BEGIN
  -- Extract name from metadata
  full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.email
  );
  
  -- Split full name into first and last
  IF position(' ' in full_name) > 0 THEN
    first_name := split_part(full_name, ' ', 1);
    last_name := substring(full_name from position(' ' in full_name) + 1);
  ELSE
    first_name := full_name;
    last_name := '';
  END IF;
  
  -- Create user profile
  INSERT INTO public.user_profiles (
    user_id,
    first_name,
    last_name,
    country,
    base_currency
  ) VALUES (
    new.id,
    first_name,
    last_name,
    COALESCE(new.raw_user_meta_data->>'country', 'US'),
    COALESCE(new.raw_user_meta_data->>'base_currency', 'USD')
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Create profiles for existing users who don't have one
INSERT INTO public.user_profiles (user_id, first_name, last_name, country, base_currency)
SELECT 
  id,
  COALESCE(
    split_part(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email), ' ', 1),
    split_part(email, '@', 1)
  ),
  COALESCE(
    CASE 
      WHEN position(' ' in COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')) > 0 
      THEN substring(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') from position(' ' in COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')) + 1)
      ELSE ''
    END,
    ''
  ),
  'US',
  'USD'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles WHERE user_id IS NOT NULL)
  AND id IS NOT NULL;

-- 7. Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;

-- 8. Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Add trigger for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();