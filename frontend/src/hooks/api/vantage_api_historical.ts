/**
 * Helper functions for historical price data calculations.
 */
import { front_api_client } from "@/lib/front_api_client";

/**
 * Calculate Year-to-Date (YTD) return for a stock.
 * @param symbol Stock symbol
 * @returns YTD return percentage or undefined if calculation fails
 */
export async function vantage_api_calculate_ytd_return(symbol: string): Promise<number | undefined> {
  try {
    const currentYear = new Date().getFullYear();
    const jan1Date = `${currentYear}-01-01`;
    
    // Get historical prices including Jan 1st
    const response = await front_api_client.get(`/api/historical/${symbol}?outputsize=full`);
    
    if (!response.success || !response.data || response.data.length === 0) {
      console.error(`Failed to fetch historical data for ${symbol}`);
      return undefined;
    }
    
    // Find the price on Jan 1st or the first trading day after
    let jan1Price: number | undefined;
    let jan1Index = -1;
    
    for (let i = 0; i < response.data.length; i++) {
      if (response.data[i].date >= jan1Date) {
        jan1Price = response.data[i].close;
        jan1Index = i;
      }
    }
    
    if (jan1Price === undefined || jan1Index === -1) {
      console.error(`No price data found for ${symbol} from ${jan1Date}`);
      return undefined;
    }
    
    // Get the most recent price
    const currentPrice = response.data[0].close;
    
    // Calculate YTD return
    const ytdReturn = ((currentPrice - jan1Price) / jan1Price) * 100;
    
    return ytdReturn;
  } catch (error) {
    console.error(`Error calculating YTD return for ${symbol}:`, error);
    return undefined;
  }
}