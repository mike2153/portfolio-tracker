"""
Price Data Service

Handles historical stock price data with intelligent caching:
1. Check database for existing price data
2. Identify gaps or missing recent data
3. Fetch missing data from Alpha Vantage API
4. Store new data in database
5. Return complete dataset

This service builds a comprehensive price database for the application.
"""

import logging
import asyncio
from datetime import datetime, timedelta, date
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal

from debug_logger import DebugLogger
from supa_api.supa_api_historical_prices import supa_api_get_historical_prices, supa_api_store_historical_prices_batch
from vantage_api.vantage_api_quotes import vantage_api_get_daily_adjusted

logger = logging.getLogger(__name__)

class PriceDataService:
    """Service for managing historical price data with caching"""
    
    def __init__(self):
        self.max_gap_days = 7  # Max days gap to consider data complete
        self.cache_duration_days = 1  # Consider data stale after 1 day
    
    async def get_historical_prices(
        self, 
        symbol: str, 
        years_back: int = 5,
        user_token: str = None,
        start_date: date = None,
        end_date: date = None
    ) -> Dict[str, Any]:
        """
        Get historical price data with intelligent caching
        
        Args:
            symbol: Stock ticker symbol
            years_back: Number of years of historical data
            user_token: JWT token for database access
            start_date: Optional start date override
            end_date: Optional end date override
            
        Returns:
            Dict with success, data, and metadata
        """
        try:
            symbol = symbol.upper().strip()
            
            # Calculate date range
            if start_date is None or end_date is None:
                end_date = date.today()
                start_date = end_date - timedelta(days=years_back * 365)
            
            # Ensure we have date objects
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            logger.info(f"[PriceDataService] Fetching {symbol} prices from {start_date} to {end_date}")
            
            # Step 1: Check database for existing data
            db_data = await self._get_db_price_data(symbol, start_date, end_date, user_token)
            
            # Step 2: Analyze gaps and determine what to fetch
            gaps_analysis = await self._analyze_price_gaps(db_data, start_date, end_date)
            
            # Step 3: Fetch missing data from Alpha Vantage if needed
            api_data = []
            if gaps_analysis["needs_api_fetch"]:
                logger.info(f"[PriceDataService] Fetching missing data from Alpha Vantage for {symbol}")
                api_data = await self._fetch_missing_price_data(symbol, gaps_analysis)
                
                # Step 4: Store new data in database
                if api_data:
                    await self._store_price_data(symbol, api_data, user_token)
            
            # Step 5: Combine and format final dataset
            final_data = await self._combine_price_data(db_data, api_data, start_date, end_date)
            
            # Calculate metadata
            metadata = {
                "cache_status": "hit" if not gaps_analysis["needs_api_fetch"] else "partial",
                "data_sources": self._get_data_sources(db_data, api_data),
                "gaps_filled": len(api_data),
                "last_updated": datetime.utcnow().isoformat(),
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "requested_years": years_back
                }
            }
            
            return {
                "success": True,
                "data": {
                    "price_data": final_data,
                    "years_available": self._calculate_years_available(final_data),
                    "symbol": symbol
                },
                "metadata": metadata
            }
            
        except Exception as e:
            DebugLogger.log_error(
                file_name="price_data_service.py",
                function_name="get_historical_prices",
                error=e,
                symbol=symbol,
                years_back=years_back
            )
            return {
                "success": False,
                "error": str(e),
                "data": None,
                "metadata": {}
            }
    
    async def _get_db_price_data(
        self, 
        symbol: str, 
        start_date: date, 
        end_date: date,
        user_token: str
    ) -> List[Dict[str, Any]]:
        """Get existing price data from database"""
        try:
            db_prices = await supa_api_get_historical_prices(
                symbol=symbol,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
                user_token=user_token
            )
            
            logger.info(f"[PriceDataService] Found {len(db_prices)} existing price records for {symbol}")
            return db_prices
            
        except Exception as e:
            logger.warning(f"[PriceDataService] Error fetching DB data for {symbol}: {e}")
            return []
    
    async def _analyze_price_gaps(
        self, 
        db_data: List[Dict[str, Any]], 
        start_date: date, 
        end_date: date
    ) -> Dict[str, Any]:
        """Analyze price data gaps and determine what needs to be fetched"""
        
        if not db_data:
            return {
                "needs_api_fetch": True,
                "missing_ranges": [(start_date, end_date)],
                "gap_count": 1,
                "data_completeness": 0.0
            }
        
        # Convert DB data to date set for gap analysis
        existing_dates = set()
        for record in db_data:
            try:
                record_date = datetime.strptime(record["date"], "%Y-%m-%d").date()
                existing_dates.add(record_date)
            except (ValueError, KeyError):
                continue
        
        # Find missing date ranges (simplified - just check if we have recent data)
        latest_date = max(existing_dates) if existing_dates else start_date
        days_behind = (end_date - latest_date).days
        
        # Consider data stale if more than cache_duration_days old
        needs_fetch = days_behind > self.cache_duration_days
        
        # Calculate data completeness
        total_days = (end_date - start_date).days
        existing_days = len(existing_dates)
        completeness = existing_days / total_days if total_days > 0 else 0
        
        return {
            "needs_api_fetch": needs_fetch,
            "missing_ranges": [(latest_date + timedelta(days=1), end_date)] if needs_fetch else [],
            "gap_count": 1 if needs_fetch else 0,
            "data_completeness": completeness,
            "latest_date": latest_date.isoformat() if existing_dates else None,
            "days_behind": days_behind
        }
    
    async def _fetch_missing_price_data(
        self, 
        symbol: str, 
        gaps_analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Fetch missing price data from Alpha Vantage"""
        try:
            # For now, fetch full daily adjusted data
            # In production, you might want to optimize this based on gaps
            raw_data = await vantage_api_get_daily_adjusted(symbol)
            
            if not raw_data:
                logger.warning(f"[PriceDataService] No data returned from Alpha Vantage for {symbol}")
                return []
            
            # Convert Alpha Vantage format to our standard format
            formatted_data = []
            for date_str, price_data in raw_data.items():
                try:
                    formatted_data.append({
                        "symbol": symbol,
                        "date": date_str,
                        "open": float(price_data.get("1. open", 0)),
                        "high": float(price_data.get("2. high", 0)),
                        "low": float(price_data.get("3. low", 0)),
                        "close": float(price_data.get("4. close", 0)),
                        "adjusted_close": float(price_data.get("5. adjusted close", 0)),
                        "volume": int(price_data.get("6. volume", 0)),
                        "dividend_amount": float(price_data.get("7. dividend amount", 0)),
                        "split_coefficient": float(price_data.get("8. split coefficient", 1))
                    })
                except (ValueError, KeyError) as e:
                    logger.warning(f"[PriceDataService] Error parsing price data for {date_str}: {e}")
                    continue
            
            logger.info(f"[PriceDataService] Fetched {len(formatted_data)} new price records from Alpha Vantage for {symbol}")
            return formatted_data
            
        except Exception as e:
            logger.error(f"[PriceDataService] Error fetching from Alpha Vantage for {symbol}: {e}")
            return []
    
    async def _store_price_data(
        self, 
        symbol: str, 
        price_data: List[Dict[str, Any]], 
        user_token: str
    ) -> bool:
        """Store new price data in database"""
        try:
            if not price_data:
                return True
            
            # Store in database
            success = await supa_api_store_historical_prices_batch(
                price_data=price_data,
                user_token=user_token
            )
            
            if success:
                logger.info(f"[PriceDataService] Successfully stored {len(price_data)} price records for {symbol}")
            else:
                logger.warning(f"[PriceDataService] Failed to store price data for {symbol}")
                
            return success
            
        except Exception as e:
            logger.error(f"[PriceDataService] Error storing price data for {symbol}: {e}")
            return False
    
    async def _combine_price_data(
        self, 
        db_data: List[Dict[str, Any]], 
        api_data: List[Dict[str, Any]],
        start_date: date,
        end_date: date
    ) -> List[Dict[str, Any]]:
        """Combine database and API data into final dataset"""
        
        # Combine all data
        all_data = {}
        
        # Add database data
        for record in db_data:
            date_key = record["date"]
            all_data[date_key] = {
                "time": date_key,
                "open": float(record.get("open", 0)),
                "high": float(record.get("high", 0)),
                "low": float(record.get("low", 0)),
                "close": float(record.get("close", 0)),
                "volume": int(record.get("volume", 0))
            }
        
        # Add API data (overwrites duplicates with fresh data)
        for record in api_data:
            date_key = record["date"]
            all_data[date_key] = {
                "time": date_key,
                "open": record["open"],
                "high": record["high"],
                "low": record["low"],
                "close": record["close"],
                "volume": record["volume"]
            }
        
        # Filter to requested date range and sort
        filtered_data = []
        for date_str, price_data in all_data.items():
            try:
                record_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                if start_date <= record_date <= end_date:
                    filtered_data.append(price_data)
            except ValueError:
                continue
        
        # Sort by date (newest first for chart compatibility)
        filtered_data.sort(key=lambda x: x["time"], reverse=True)
        
        return filtered_data
    
    def _get_data_sources(self, db_data: List, api_data: List) -> List[str]:
        """Determine data sources used"""
        sources = []
        if db_data:
            sources.append("database")
        if api_data:
            sources.append("alpha_vantage")
        return sources
    
    def _calculate_years_available(self, price_data: List[Dict[str, Any]]) -> float:
        """Calculate how many years of data are available"""
        if not price_data or len(price_data) < 2:
            return 0.0
        
        try:
            # Assuming data is sorted newest first
            newest = datetime.strptime(price_data[0]["time"], "%Y-%m-%d")
            oldest = datetime.strptime(price_data[-1]["time"], "%Y-%m-%d")
            
            days_diff = (newest - oldest).days
            years_available = days_diff / 365.25
            
            return round(years_available, 2)
            
        except (ValueError, KeyError, IndexError):
            return 0.0