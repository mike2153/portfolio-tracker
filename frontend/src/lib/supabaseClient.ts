import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database schema
export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  subscription_status: string | null
  paddle_customer_id: string | null
}

export interface Portfolio {
  id: number
  user_id: string
  name: string
  created_at: string
}

export interface Holding {
  id: number
  portfolio_id: number
  user_id: string
  ticker: string
  company_name: string | null
  exchange: string | null
  shares: number
  purchase_price: number
  purchase_date: string
  commission: number
  created_at: string
  updated_at: string
} 