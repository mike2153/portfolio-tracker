import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Map Next.js environment variables to Expo
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  )
}

// Create Supabase client with AsyncStorage for cross-platform session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable for React Native
  },
})

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