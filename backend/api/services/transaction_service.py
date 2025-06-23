"""
Transaction Service - Core business logic for transaction management.

This service handles:
- Creating transactions with historical data fetching
- Calculating portfolio holdings from transactions
- Rate limiting and caching
- Currency conversions
- Real-time price updates
"""

import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from django.db.models import Q, Sum, Count, Min, Max
from django.db import transaction as db_transaction
from django.utils import timezone
from django.core.cache import cache

from ..models import (
    Transaction, DailyPriceCache, UserApiRateLimit, UserSettings, 
    ExchangeRate, Portfolio, Holding
)
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

class TransactionService:
    """
    Core service for managing investment transactions.
    Handles creation, validation, historical data fetching, and portfolio calculations.
    """
    
    def __init__(self):
        self.alpha_vantage = get_alpha_vantage_service()
        logger.debug("[TransactionService] Initialized with Alpha Vantage service")
    
    def create_transaction(self, user_id: str, transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new transaction with comprehensive validation and historical data fetching.
        
        Args:
            user_id: Supabase user ID
            transaction_data: Transaction details dict
            
        Returns:
            Dict with transaction ID and status
        """
        logger.info(f"[TransactionService] Creating transaction for user {user_id}")
        logger.debug(f"[TransactionService] Transaction data: {transaction_data}")
        
        try:
            with db_transaction.atomic():
                # Validate transaction data
                self._validate_transaction_data(transaction_data)
                logger.debug(f"[TransactionService] Transaction data validated successfully")
                
                # Create transaction record
                transaction_record = Transaction.objects.create(
                    user_id=user_id,
                    transaction_type=transaction_data['transaction_type'],
                    ticker=transaction_data['ticker'].upper(),
                    company_name=transaction_data['company_name'],
                    exchange=transaction_data.get('exchange', ''),
                    shares=Decimal(str(transaction_data['shares'])),
                    price_per_share=Decimal(str(transaction_data['price_per_share'])),
                    transaction_date=transaction_data['transaction_date'],
                    transaction_currency=transaction_data.get('transaction_currency', 'USD'),
                    fx_rate_to_usd=Decimal(str(transaction_data.get('fx_rate_to_usd', '1.0'))),
                    commission=Decimal(str(transaction_data.get('commission', '0.0'))),
                    notes=transaction_data.get('notes', ''),
                    used_cash_balance=transaction_data.get('used_cash_balance', False)
                )
                
                logger.info(f"[TransactionService] Created transaction {transaction_record.id} for {transaction_record.ticker}")
                
                # Fetch and cache historical data if needed
                if transaction_data['transaction_type'] in ['BUY', 'SELL']:
                    self._fetch_historical_data_for_transaction(user_id, transaction_record)
                
                # Update portfolio calculations
                self._update_portfolio_from_transactions(user_id)
                
                logger.info(f"[TransactionService] Transaction {transaction_record.id} created successfully")
                
                return {
                    'success': True,
                    'transaction_id': transaction_record.id,
                    'ticker': transaction_record.ticker,
                    'message': f'{transaction_record.transaction_type} transaction created successfully'
                }
                
        except Exception as e:
            logger.error(f"[TransactionService] Error creating transaction: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to create transaction'
            }
    
    def _validate_transaction_data(self, data: Dict[str, Any]) -> None:
        """Validate transaction data with comprehensive checks"""
        logger.debug(f"[TransactionService] Validating transaction data")
        
        required_fields = ['transaction_type', 'ticker', 'shares', 'price_per_share', 'transaction_date']
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate transaction type
        if data['transaction_type'] not in ['BUY', 'SELL', 'DIVIDEND']:
            raise ValueError(f"Invalid transaction type: {data['transaction_type']}")
        
        # Validate numeric fields
        try:
            shares = Decimal(str(data['shares']))
            price = Decimal(str(data['price_per_share']))
            
            if shares <= 0:
                raise ValueError("Shares must be greater than 0")
            if price <= 0:
                raise ValueError("Price per share must be greater than 0")
                
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid numeric value: {e}")
        
        # Validate date
        if isinstance(data['transaction_date'], str):
            try:
                datetime.strptime(data['transaction_date'], '%Y-%m-%d')
            except ValueError:
                raise ValueError("Invalid date format. Use YYYY-MM-DD")
        
        logger.debug(f"[TransactionService] Transaction data validation passed")
    
    def _fetch_historical_data_for_transaction(self, user_id: str, transaction: Transaction) -> None:
        """
        Fetch historical price data based on user's transaction needs.
        Only fetches data from the earliest transaction date for this stock.
        """
        logger.info(f"[TransactionService] Fetching historical data for {transaction.ticker}")
        
        try:
            # Find user's earliest transaction for this ticker
            earliest_transaction = Transaction.objects.filter(
                user_id=user_id,
                ticker=transaction.ticker,
                transaction_type__in=['BUY', 'SELL']
            ).order_by('transaction_date').first()
            
            if not earliest_transaction:
                logger.warning(f"[TransactionService] No transactions found for {transaction.ticker}")
                return
            
            start_date = earliest_transaction.transaction_date
            logger.debug(f"[TransactionService] Earliest transaction date for {transaction.ticker}: {start_date}")
            
            # Check what data we already have cached
            existing_data = DailyPriceCache.objects.filter(
                ticker=transaction.ticker,
                date__gte=start_date
            ).aggregate(
                earliest_cached=Min('date'),
                latest_cached=Max('date'),
                count=Count('id')
            )
            
            logger.debug(f"[TransactionService] Existing cache data for {transaction.ticker}: {existing_data}")
            
            # Determine if we need to fetch new data
            need_fetch = False
            fetch_from_date = start_date
            
            if existing_data['count'] == 0:
                need_fetch = True
                logger.debug(f"[TransactionService] No cached data, fetching from {start_date}")
            elif existing_data['earliest_cached'] > start_date:
                need_fetch = True
                fetch_from_date = start_date
                logger.debug(f"[TransactionService] Need earlier data, fetching from {start_date}")
            
            if need_fetch:
                self._fetch_and_cache_daily_prices(transaction.ticker, fetch_from_date, user_id)
            
            # Update transaction with the close price for its date
            self._update_transaction_with_close_price(transaction)
            
        except Exception as e:
            logger.error(f"[TransactionService] Error fetching historical data for {transaction.ticker}: {e}", exc_info=True)
            # Don't fail the transaction creation if historical data fetch fails
    
    def _fetch_and_cache_daily_prices(self, ticker: str, from_date: date, user_id: str) -> None:
        """Fetch daily prices from Alpha Vantage and cache them"""
        logger.info(f"[TransactionService] Fetching daily prices for {ticker} from {from_date}")
        
        try:
            # Fetch historical data from Alpha Vantage
            historical_data = self.alpha_vantage.get_daily_adjusted(ticker)
            
            if not historical_data or not historical_data.get('data'):
                logger.warning(f"[TransactionService] No historical data returned for {ticker}")
                return
            
            logger.debug(f"[TransactionService] Retrieved {len(historical_data['data'])} price records for {ticker}")
            
            # Filter and cache data from the required date
            cached_count = 0
            for price_data in historical_data['data']:
                price_date = datetime.strptime(price_data['date'], '%Y-%m-%d').date()
                
                if price_date >= from_date:
                    # Create or update cache entry
                    cache_entry, created = DailyPriceCache.objects.get_or_create(
                        ticker=ticker,
                        date=price_date,
                        defaults={
                            'open_price': Decimal(str(price_data['open'])),
                            'high_price': Decimal(str(price_data['high'])),
                            'low_price': Decimal(str(price_data['low'])),
                            'close_price': Decimal(str(price_data['close'])),
                            'adjusted_close': Decimal(str(price_data['adjusted_close'])),
                            'volume': int(price_data['volume']),
                            'source': 'AlphaVantage',
                            'requested_by_user': user_id
                        }
                    )
                    
                    if created:
                        cached_count += 1
            
            logger.info(f"[TransactionService] Cached {cached_count} new price records for {ticker}")
            
        except Exception as e:
            logger.error(f"[TransactionService] Error fetching/caching prices for {ticker}: {e}", exc_info=True)
    
    def _update_transaction_with_close_price(self, transaction: Transaction) -> None:
        """Update transaction with the closing price for its date"""
        try:
            price_cache = DailyPriceCache.objects.filter(
                ticker=transaction.ticker,
                date=transaction.transaction_date
            ).first()
            
            if price_cache:
                transaction.daily_close_price = price_cache.close_price
                transaction.daily_volume = price_cache.volume
                transaction.save(update_fields=['daily_close_price', 'daily_volume'])
                logger.debug(f"[TransactionService] Updated transaction {transaction.id} with close price ${price_cache.close_price}")
            else:
                logger.warning(f"[TransactionService] No price data found for {transaction.ticker} on {transaction.transaction_date}")
                
        except Exception as e:
            logger.error(f"[TransactionService] Error updating transaction with close price: {e}", exc_info=True)
    
    def get_user_transactions(self, user_id: str, transaction_type: Optional[str] = None, 
                            ticker: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get user's transactions with optional filtering"""
        logger.debug(f"[TransactionService] Getting transactions for user {user_id}")
        
        try:
            queryset = Transaction.objects.filter(user_id=user_id)
            
            if transaction_type:
                queryset = queryset.filter(transaction_type=transaction_type)
            if ticker:
                queryset = queryset.filter(ticker__iexact=ticker)
            
            transactions = list(queryset.values(
                'id', 'transaction_type', 'ticker', 'company_name', 'shares',
                'price_per_share', 'transaction_date', 'transaction_currency',
                'commission', 'total_amount', 'daily_close_price', 'notes',
                'created_at'
            ))
            
            logger.debug(f"[TransactionService] Retrieved {len(transactions)} transactions")
            return transactions
            
        except Exception as e:
            logger.error(f"[TransactionService] Error getting transactions: {e}", exc_info=True)
            return []
    
    def _update_portfolio_from_transactions(self, user_id: str) -> None:
        """Update/create portfolio holdings based on transactions (legacy compatibility)"""
        logger.info(f"[TransactionService] Updating portfolio from transactions for user {user_id}")
        
        try:
            # Get or create portfolio
            portfolio, created = Portfolio.objects.get_or_create(user_id=user_id)
            
            # Calculate current holdings from transactions
            holdings_data = self._calculate_holdings_from_transactions(user_id)
            
            # Clear existing holdings (we'll rebuild from transactions)
            portfolio.holdings.all().delete()
            
            # Create new holdings from transaction calculations
            for ticker, holding_data in holdings_data.items():
                if holding_data['total_shares'] > 0:  # Only create if user has shares
                    Holding.objects.create(
                        portfolio=portfolio,
                        ticker=ticker,
                        company_name=holding_data['company_name'],
                        shares=holding_data['total_shares'],
                        purchase_price=holding_data['average_cost'],
                        purchase_date=holding_data['earliest_purchase_date'],
                        commission=Decimal('0.0'),  # Commission is tracked in transactions
                        currency=holding_data.get('currency', 'USD'),
                        fx_rate=holding_data.get('fx_rate', Decimal('1.0'))
                    )
            
            logger.info(f"[TransactionService] Updated portfolio with {len(holdings_data)} holdings")
            
        except Exception as e:
            logger.error(f"[TransactionService] Error updating portfolio from transactions: {e}", exc_info=True)
    
    def _calculate_holdings_from_transactions(self, user_id: str) -> Dict[str, Dict[str, Any]]:
        """Calculate current holdings and cost basis from transactions"""
        logger.debug(f"[TransactionService] Calculating holdings from transactions for user {user_id}")
        
        holdings = {}
        
        try:
            transactions = Transaction.objects.filter(user_id=user_id).order_by('transaction_date')
            
            for txn in transactions:
                ticker = txn.ticker
                
                if ticker not in holdings:
                    holdings[ticker] = {
                        'total_shares': Decimal('0'),
                        'total_cost': Decimal('0'),
                        'average_cost': Decimal('0'),
                        'company_name': txn.company_name,
                        'earliest_purchase_date': txn.transaction_date,
                        'currency': txn.transaction_currency,
                        'fx_rate': txn.fx_rate_to_usd
                    }
                
                if txn.transaction_type == 'BUY':
                    # Add shares and cost
                    holdings[ticker]['total_shares'] += txn.shares
                    holdings[ticker]['total_cost'] += txn.total_amount
                    
                elif txn.transaction_type == 'SELL':
                    # Remove shares, reduce cost basis proportionally
                    if holdings[ticker]['total_shares'] > 0:
                        sell_ratio = txn.shares / holdings[ticker]['total_shares']
                        cost_reduction = holdings[ticker]['total_cost'] * sell_ratio
                        
                        holdings[ticker]['total_shares'] -= txn.shares
                        holdings[ticker]['total_cost'] -= cost_reduction
                
                # Update average cost
                if holdings[ticker]['total_shares'] > 0:
                    holdings[ticker]['average_cost'] = holdings[ticker]['total_cost'] / holdings[ticker]['total_shares']
                else:
                    holdings[ticker]['average_cost'] = Decimal('0')
            
            # Filter out holdings with zero shares
            holdings = {k: v for k, v in holdings.items() if v['total_shares'] > 0}
            
            logger.debug(f"[TransactionService] Calculated {len(holdings)} holdings from transactions")
            return holdings
            
        except Exception as e:
            logger.error(f"[TransactionService] Error calculating holdings: {e}", exc_info=True)
            return {}


class PriceUpdateService:
    """
    Service for handling real-time price updates with rate limiting.
    """
    
    def __init__(self):
        self.alpha_vantage = get_alpha_vantage_service()
        logger.debug("[PriceUpdateService] Initialized")
    
    def update_user_current_prices(self, user_id: str) -> Dict[str, Any]:
        """
        Update current prices for all user's holdings with rate limiting.
        """
        logger.info(f"[PriceUpdateService] Updating current prices for user {user_id}")
        
        try:
            # Check rate limiting
            rate_limit, created = UserApiRateLimit.objects.get_or_create(user_id=user_id)
            
            if not rate_limit.can_fetch_prices():
                logger.warning(f"[PriceUpdateService] Rate limit exceeded for user {user_id}")
                return {
                    'success': False,
                    'error': 'rate_limited',
                    'message': 'Please wait 1 minute between price updates',
                    'retry_after': 60
                }
            
            # Get user's unique tickers from transactions
            user_tickers = Transaction.objects.filter(
                user_id=user_id,
                transaction_type__in=['BUY', 'SELL']
            ).values_list('ticker', flat=True).distinct()
            
            logger.debug(f"[PriceUpdateService] Found {len(user_tickers)} unique tickers for user")
            
            current_prices = {}
            successful_fetches = 0
            failed_fetches = 0
            
            # Fetch current prices for all tickers
            for ticker in user_tickers:
                try:
                    logger.debug(f"[PriceUpdateService] Fetching current price for {ticker}")
                    quote = self.alpha_vantage.get_global_quote(ticker)
                    
                    if quote and quote.get('price'):
                        current_prices[ticker] = {
                            'price': float(quote['price']),
                            'change': float(quote.get('change', 0)),
                            'change_percent': float(quote.get('change_percent', 0)),
                            'volume': int(quote.get('volume', 0)),
                            'timestamp': timezone.now().isoformat()
                        }
                        successful_fetches += 1
                        logger.debug(f"[PriceUpdateService] ✅ {ticker}: ${quote['price']}")
                    else:
                        logger.warning(f"[PriceUpdateService] ❌ No price data for {ticker}")
                        failed_fetches += 1
                        
                except Exception as e:
                    logger.error(f"[PriceUpdateService] Error fetching price for {ticker}: {e}")
                    failed_fetches += 1
            
            # Cache results
            cache_key = f"current_prices_{user_id}"
            cache.set(cache_key, current_prices, timeout=300)  # 5 minute cache
            
            # Record the price fetch
            rate_limit.record_price_fetch()
            
            logger.info(f"[PriceUpdateService] Updated prices: {successful_fetches} successful, {failed_fetches} failed")
            
            return {
                'success': True,
                'prices': current_prices,
                'stats': {
                    'successful_fetches': successful_fetches,
                    'failed_fetches': failed_fetches,
                    'total_tickers': len(user_tickers)
                },
                'cached_until': (timezone.now() + timedelta(minutes=5)).isoformat()
            }
            
        except Exception as e:
            logger.error(f"[PriceUpdateService] Error updating prices for user {user_id}: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to update current prices'
            }
    
    def get_cached_prices(self, user_id: str) -> Dict[str, Any]:
        """Get cached current prices for user"""
        cache_key = f"current_prices_{user_id}"
        cached_prices = cache.get(cache_key, {})
        
        logger.debug(f"[PriceUpdateService] Retrieved {len(cached_prices)} cached prices for user {user_id}")
        
        return {
            'success': True,
            'prices': cached_prices,
            'is_cached': True
        }


# Service instances
transaction_service = TransactionService()
price_update_service = PriceUpdateService()

def get_transaction_service() -> TransactionService:
    """Get transaction service instance"""
    return transaction_service

def get_price_update_service() -> PriceUpdateService:
    """Get price update service instance"""
    return price_update_service 