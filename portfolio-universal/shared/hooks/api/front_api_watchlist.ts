/**
 * Frontend API client functions for watchlist operations.
 * Handles all HTTP requests to the watchlist backend endpoints.
 */
import { supabase } from '../../api/supabase';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_API_URL ?? 'http://localhost:8000';

/**
 * A wrapper around fetch that automatically adds the Supabase auth token.
 */
async function authFetch(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  
  if ((init.method === 'POST' || init.method === 'PUT') && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  const fullUrl = `${API_BASE}${path}`;
  const requestConfig = {
    credentials: 'include' as RequestCredentials,
    ...init,
    headers,
  };
  
  return fetch(fullUrl, requestConfig);
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  notes?: string;
  target_price?: number;
  created_at: string;
  updated_at: string;
  // Optional fields when quotes are included
  current_price?: number;
  change?: number;
  change_percent?: number;
  volume?: number;
}

export interface WatchlistResponse {
  success: boolean;
  watchlist: WatchlistItem[];
  count: number;
}

export interface WatchlistStatusResponse {
  success: boolean;
  is_in_watchlist: boolean;
}

/**
 * Get the user's watchlist with optional price quotes.
 * @param includeQuotes Whether to include current price data (default: true)
 * @returns Watchlist response with items and count
 */
export async function front_api_get_watchlist(includeQuotes: boolean = true): Promise<WatchlistResponse> {
  try {
    const response = await authFetch(`/api/watchlist?include_quotes=${includeQuotes}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Failed to fetch watchlist");
    }
    
    return data;
  } catch (error) {
    console.error('[front_api_watchlist] Error fetching watchlist:', error);
    throw error;
  }
}

/**
 * Add a stock to the watchlist.
 * @param symbol Stock symbol to add
 * @param notes Optional notes about the stock
 * @param targetPrice Optional target price
 * @returns Success response with message
 */
export async function front_api_add_to_watchlist(
  symbol: string,
  notes?: string,
  targetPrice?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authFetch(`/api/watchlist/${symbol}`, {
      method: 'POST',
      body: JSON.stringify({ symbol, notes, target_price: targetPrice })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Failed to add to watchlist");
    }
    
    return data;
  } catch (error) {
    console.error('[front_api_watchlist] Error adding to watchlist:', error);
    throw error;
  }
}

/**
 * Remove a stock from the watchlist.
 * @param symbol Stock symbol to remove
 * @returns Success response with message
 */
export async function front_api_remove_from_watchlist(
  symbol: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authFetch(`/api/watchlist/${symbol}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Failed to remove from watchlist");
    }
    
    return data;
  } catch (error) {
    console.error('[front_api_watchlist] Error removing from watchlist:', error);
    throw error;
  }
}

/**
 * Update a watchlist item (notes, target price).
 * @param symbol Stock symbol to update
 * @param notes Optional updated notes
 * @param targetPrice Optional updated target price
 * @returns Success response with message
 */
export async function front_api_update_watchlist_item(
  symbol: string,
  notes?: string,
  targetPrice?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await authFetch(`/api/watchlist/${symbol}`, {
      method: 'PUT',
      body: JSON.stringify({ notes, target_price: targetPrice })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Failed to update watchlist item");
    }
    
    return data;
  } catch (error) {
    console.error('[front_api_watchlist] Error updating watchlist item:', error);
    throw error;
  }
}

/**
 * Check if a stock is in the user's watchlist.
 * @param symbol Stock symbol to check
 * @returns Status response indicating if stock is in watchlist
 */
export async function front_api_check_watchlist_status(
  symbol: string
): Promise<WatchlistStatusResponse> {
  try {
    const response = await authFetch(`/api/watchlist/${symbol}/status`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || data.error || "Failed to check watchlist status");
    }
    
    return data;
  } catch (error) {
    console.error('[front_api_watchlist] Error checking watchlist status:', error);
    throw error;
  }
}