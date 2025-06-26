import logging
import numpy as np
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
from django.db.models import Q
from asgiref.sync import sync_to_async

from ..models import Transaction
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

class AdvancedFinancialMetricsService:
    """
    Service for calculating advanced financial metrics with comprehensive error handling
    """
    
    def __init__(self):
        """Initialize the service with debugging enabled"""
        logger.info("[AdvancedFinancialMetrics] Service initialized")
        self.av_service = get_alpha_vantage_service()
        logger.debug(f"[AdvancedFinancialMetrics] Alpha Vantage service loaded: {self.av_service}")
    
    async def calculate_enhanced_kpi_metrics(self, user_id: str, benchmark_symbol: str = "SPY") -> Dict[str, Any]:
        """
        Calculate all enhanced KPI metrics with extensive debugging and fallbacks
        
        Args:
            user_id: User identifier
            benchmark_symbol: Benchmark ticker (default: SPY)
            
        Returns:
            Dictionary containing all KPI metrics with fallbacks
        """
        print(f"[AdvancedFinancialMetrics] 🚀 Starting enhanced KPI calculation for user: {user_id}")
        print(f"[AdvancedFinancialMetrics] 🎯 Using benchmark: {benchmark_symbol}")
        logger.info(f"[AdvancedFinancialMetrics] Starting enhanced KPI calculation for user: {user_id}")
        logger.debug(f"[AdvancedFinancialMetrics] Using benchmark: {benchmark_symbol}")
        
        try:
            # Get user transactions with error handling
            print(f"[AdvancedFinancialMetrics] 🔍 Step 1: Getting user transactions...")
            transactions = await self._get_user_transactions_safe(user_id)
            if not transactions:
                print(f"[AdvancedFinancialMetrics] ❌ No transactions found for user {user_id}, returning default values")
                logger.warning(f"[AdvancedFinancialMetrics] No transactions found for user {user_id}, returning default values")
                return self._get_default_kpi_metrics()
            
            logger.info(f"[AdvancedFinancialMetrics] Found {len(transactions)} transactions for user {user_id}")
            
            # Calculate portfolio value and PNL
            portfolio_metrics = await self._calculate_portfolio_value_safe(transactions)
            logger.debug(f"[AdvancedFinancialMetrics] Portfolio metrics calculated: {portfolio_metrics}")
            
            # Calculate IRR with benchmark comparison
            irr_metrics = await self._calculate_irr_safe(transactions, benchmark_symbol)
            logger.debug(f"[AdvancedFinancialMetrics] IRR metrics calculated: {irr_metrics}")
            
            # Calculate dividend yield
            dividend_metrics = await self._calculate_dividend_yield_safe(transactions)
            logger.debug(f"[AdvancedFinancialMetrics] Dividend metrics calculated: {dividend_metrics}")
            
            # Calculate portfolio beta
            beta_metrics = await self._calculate_portfolio_beta_safe(transactions, benchmark_symbol)
            logger.debug(f"[AdvancedFinancialMetrics] Beta metrics calculated: {beta_metrics}")
            
            # Combine all metrics
            enhanced_metrics = {
                "marketValue": {
                    "value": str(portfolio_metrics["market_value"]),
                    "sub_label": f"{portfolio_metrics['pnl_display']} ({portfolio_metrics['pnl_percent_display']})",
                    "is_positive": portfolio_metrics["is_positive"]
                },
                "irr": {
                    "value": f"{irr_metrics['irr_percent']:.2f}%",
                    "sub_label": f"vs {benchmark_symbol}: {irr_metrics['benchmark_comparison']}",
                    "is_positive": irr_metrics["outperforming"]
                },
                "dividendYield": {
                    "value": f"AU${dividend_metrics['total_dividends_received']:.2f}",
                    "sub_label": f"{dividend_metrics['annual_yield_percent']:.2f}% yield (AU${dividend_metrics['annual_dividends']:.2f} annual)",
                    "is_positive": dividend_metrics["yield_above_average"]
                },
                "portfolioBeta": {
                    "value": f"{beta_metrics['beta']:.2f}",
                    "sub_label": f"vs {benchmark_symbol}",
                    "is_positive": beta_metrics["beta"] >= 1.0
                }
            }
            
            logger.debug(f"[AdvancedFinancialMetrics] 📋 Enhanced metrics structure:")
            logger.debug(f"[AdvancedFinancialMetrics]   ✓ marketValue: {enhanced_metrics['marketValue']}")
            logger.debug(f"[AdvancedFinancialMetrics]   ✓ irr: {enhanced_metrics['irr']}")
            logger.debug(f"[AdvancedFinancialMetrics]   ✓ dividendYield: {enhanced_metrics['dividendYield']}")
            logger.debug(f"[AdvancedFinancialMetrics]   ✓ portfolioBeta: {enhanced_metrics['portfolioBeta']}")
            
            logger.info(f"[AdvancedFinancialMetrics] ✅ Enhanced KPI metrics calculated successfully for user {user_id}")
            logger.debug(f"[AdvancedFinancialMetrics] Final metrics: {enhanced_metrics}")
            
            return enhanced_metrics
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] ❌ Critical error in enhanced KPI calculation: {e}", exc_info=True)
            logger.warning(f"[AdvancedFinancialMetrics] Returning default metrics due to error")
            return self._get_default_kpi_metrics()
    
    async def _get_user_transactions_safe(self, user_id: str) -> List[Any]:
        """Safely get user transactions with comprehensive error handling"""
        print(f"[AdvancedFinancialMetrics] 🔍 Getting transactions for user {user_id}")
        logger.debug(f"[AdvancedFinancialMetrics] Getting transactions for user {user_id}")
        
        try:
            transactions = await sync_to_async(list)(
                Transaction.objects.filter(user_id=user_id).order_by('transaction_date')
            )
            print(f"[AdvancedFinancialMetrics] 📊 Retrieved {len(transactions)} transactions from database")
            logger.debug(f"[AdvancedFinancialMetrics] Retrieved {len(transactions)} transactions from database")
            
            if len(transactions) == 0:
                print(f"[AdvancedFinancialMetrics] ⚠️ No transactions found for user {user_id}")
                return []
            
            # Log some sample transactions for debugging
            print(f"[AdvancedFinancialMetrics] 📝 Sample transactions:")
            for i, txn in enumerate(transactions[:3]):
                print(f"[AdvancedFinancialMetrics]   [{i+1}] {txn.transaction_type} {txn.shares} {txn.ticker} @ ${txn.price_per_share} = ${txn.total_amount}")
            
            # Validate transactions
            valid_transactions = []
            for txn in transactions:
                if self._validate_transaction(txn):
                    valid_transactions.append(txn)
                else:
                    print(f"[AdvancedFinancialMetrics] ❌ Invalid transaction found: {txn.id}, skipping")
                    logger.warning(f"[AdvancedFinancialMetrics] Invalid transaction found: {txn.id}, skipping")
            
            print(f"[AdvancedFinancialMetrics] ✅ Validated {len(valid_transactions)}/{len(transactions)} transactions")
            logger.info(f"[AdvancedFinancialMetrics] Validated {len(valid_transactions)}/{len(transactions)} transactions")
            return valid_transactions
            
        except Exception as e:
            print(f"[AdvancedFinancialMetrics] ❌ Error getting user transactions: {e}")
            logger.error(f"[AdvancedFinancialMetrics] Error getting user transactions: {e}", exc_info=True)
            return []
    
    def _validate_transaction(self, txn: Any) -> bool:
        """Validate individual transaction with comprehensive checks"""
        try:
            # Check required fields
            if not all([txn.ticker, txn.transaction_type, txn.shares, txn.price_per_share, txn.transaction_date]):
                logger.debug(f"[AdvancedFinancialMetrics] Transaction {txn.id} missing required fields")
                return False
            
            # Check numeric values
            if txn.shares <= 0 or txn.price_per_share <= 0:
                logger.debug(f"[AdvancedFinancialMetrics] Transaction {txn.id} has invalid numeric values")
                return False
            
            # Check transaction type
            if txn.transaction_type not in ['BUY', 'SELL', 'DIVIDEND']:
                logger.debug(f"[AdvancedFinancialMetrics] Transaction {txn.id} has invalid type: {txn.transaction_type}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error validating transaction: {e}")
            return False
    
    async def _calculate_portfolio_value_safe(self, transactions: List[Any]) -> Dict[str, Any]:
        """Calculate portfolio value and PNL with comprehensive error handling"""
        logger.debug(f"[AdvancedFinancialMetrics] Calculating portfolio value from {len(transactions)} transactions")
        
        try:
            # Calculate holdings from transactions
            holdings = defaultdict(lambda: {'shares': Decimal('0'), 'invested': Decimal('0')})
            
            for txn in transactions:
                try:
                    ticker = txn.ticker
                    shares = Decimal(str(txn.shares))
                    amount = Decimal(str(txn.total_amount))
                    
                    if txn.transaction_type == 'BUY':
                        holdings[ticker]['shares'] += shares
                        holdings[ticker]['invested'] += amount
                        logger.debug(f"[AdvancedFinancialMetrics] BUY: {ticker} +{shares} shares, +${amount}")
                        
                    elif txn.transaction_type == 'SELL':
                        holdings[ticker]['shares'] -= shares
                        holdings[ticker]['invested'] -= amount
                        logger.debug(f"[AdvancedFinancialMetrics] SELL: {ticker} -{shares} shares, -${amount}")
                        
                except Exception as e:
                    logger.error(f"[AdvancedFinancialMetrics] Error processing transaction {txn.id}: {e}")
                    continue
            
            # Get current prices and calculate market value
            total_market_value = Decimal('0')
            total_invested = Decimal('0')
            
            for ticker, holding in holdings.items():
                if holding['shares'] <= 0:
                    continue
                
                try:
                    # Get current price with fallback
                    current_price = await self._get_current_price_safe(ticker)
                    if current_price is None:
                        logger.warning(f"[AdvancedFinancialMetrics] Could not get price for {ticker}, skipping from portfolio value")
                        continue
                    
                    market_value = holding['shares'] * current_price
                    total_market_value += market_value
                    total_invested += holding['invested']
                    
                    logger.debug(f"[AdvancedFinancialMetrics] {ticker}: {holding['shares']} shares @ ${current_price} = ${market_value}")
                    
                except Exception as e:
                    logger.error(f"[AdvancedFinancialMetrics] Error calculating value for {ticker}: {e}")
                    continue
            
            # Calculate PNL
            pnl = total_market_value - total_invested
            pnl_percent = (pnl / total_invested * 100) if total_invested > 0 else Decimal('0')
            
            # Format display strings
            pnl_display = f"+AU${pnl:.2f}" if pnl >= 0 else f"-AU${abs(pnl):.2f}"
            pnl_percent_display = f"+{pnl_percent:.2f}%" if pnl_percent >= 0 else f"{pnl_percent:.2f}%"
            
            result = {
                "market_value": float(total_market_value),
                "invested": float(total_invested),
                "pnl": float(pnl),
                "pnl_percent": float(pnl_percent),
                "pnl_display": pnl_display,
                "pnl_percent_display": pnl_percent_display,
                "is_positive": pnl >= 0
            }
            
            logger.info(f"[AdvancedFinancialMetrics] ✅ Portfolio value calculated: Market=${total_market_value:.2f}, Invested=${total_invested:.2f}, PNL=${pnl:.2f} ({pnl_percent:.2f}%)")
            return result
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error calculating portfolio value: {e}", exc_info=True)
            return {
                "market_value": 0.0,
                "invested": 0.0,
                "pnl": 0.0,
                "pnl_percent": 0.0,
                "pnl_display": "+AU$0.00",
                "pnl_percent_display": "+0.00%",
                "is_positive": True
            }
    
    async def _get_current_price_safe(self, ticker: str) -> Optional[Decimal]:
        """Get current price with error handling and fallbacks"""
        logger.debug(f"[AdvancedFinancialMetrics] Getting current price for {ticker}")
        
        try:
            quote = await sync_to_async(self.av_service.get_global_quote)(ticker)
            if quote and quote.get('price'):
                price = Decimal(str(quote['price']))
                logger.debug(f"[AdvancedFinancialMetrics] Got price for {ticker}: ${price}")
                return price
            else:
                logger.warning(f"[AdvancedFinancialMetrics] No price data returned for {ticker}")
                return None
                
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error getting price for {ticker}: {e}")
            return None
    
    async def _calculate_irr_safe(self, transactions: List[Any], benchmark_symbol: str) -> Dict[str, Any]:
        """Calculate IRR with benchmark comparison and error handling"""
        logger.debug(f"[AdvancedFinancialMetrics] Calculating IRR with benchmark {benchmark_symbol}")
        
        try:
            # Get date range
            first_transaction_date = min(txn.transaction_date for txn in transactions)
            days_invested = (date.today() - first_transaction_date).days
            
            if days_invested < 1:
                logger.warning(f"[AdvancedFinancialMetrics] Less than 1 day of investment history, using simple return")
                return {"irr_percent": 0.0, "benchmark_comparison": "+0.0%", "outperforming": False}
            
            logger.debug(f"[AdvancedFinancialMetrics] Investment period: {days_invested} days ({days_invested/365.25:.2f} years)")
            
            # Calculate time-weighted returns (simplified approach)
            # For a more accurate IRR, we would need historical portfolio values
            initial_investment = sum(
                Decimal(str(txn.total_amount)) for txn in transactions 
                if txn.transaction_type == 'BUY'
            )
            
            # Get current portfolio value
            portfolio_metrics = await self._calculate_portfolio_value_safe(transactions)
            current_value = Decimal(str(portfolio_metrics["market_value"]))
            
            if initial_investment <= 0:
                logger.warning(f"[AdvancedFinancialMetrics] No initial investment found")
                return {"irr_percent": 0.0, "benchmark_comparison": "+0.0%", "outperforming": False}
            
            # Calculate simple annualized return
            total_return = (current_value - initial_investment) / initial_investment
            
            if days_invested >= 365:
                # Annualized return for periods >= 1 year
                years = days_invested / 365.25
                irr_annual = (((current_value / initial_investment) ** (1 / years)) - 1) * 100
            else:
                # Project return for periods < 1 year
                irr_annual = (total_return * 365.25 / days_invested) * 100
            
            logger.debug(f"[AdvancedFinancialMetrics] IRR calculated: {irr_annual:.2f}%")
            
            # Get benchmark return for same period
            benchmark_return = await self._get_benchmark_return_safe(benchmark_symbol, first_transaction_date)
            
            # Calculate outperformance
            outperformance = irr_annual - benchmark_return
            comparison_text = f"+{outperformance:.1f}%" if outperformance >= 0 else f"{outperformance:.1f}%"
            
            result = {
                "irr_percent": float(irr_annual),
                "benchmark_return": float(benchmark_return),
                "outperformance": float(outperformance),
                "benchmark_comparison": comparison_text,
                "outperforming": outperformance >= 0,
                "days_invested": days_invested
            }
            
            logger.info(f"[AdvancedFinancialMetrics] ✅ IRR calculated: {irr_annual:.2f}%, Benchmark: {benchmark_return:.2f}%, Outperformance: {outperformance:.2f}%")
            return result
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error calculating IRR: {e}", exc_info=True)
            return {"irr_percent": 0.0, "benchmark_comparison": "+0.0%", "outperforming": False}
    
    async def _get_benchmark_return_safe(self, benchmark_symbol: str, start_date: date) -> float:
        """Get benchmark return for the period with error handling"""
        logger.debug(f"[AdvancedFinancialMetrics] Getting benchmark return for {benchmark_symbol} since {start_date}")
        
        try:
            # This is simplified - in production, you'd fetch historical data
            # For now, return a reasonable default based on typical S&P 500 returns
            days = (date.today() - start_date).days
            
            if benchmark_symbol.upper() in ['SPY', 'SPX', '^GSPC']:
                # Approximate S&P 500 return (~10% annually)
                annual_return = 10.0
            else:
                # Default market return
                annual_return = 8.0
            
            if days >= 365:
                years = days / 365.25
                benchmark_return = annual_return
            else:
                # Project annual return
                benchmark_return = annual_return
            
            logger.debug(f"[AdvancedFinancialMetrics] Estimated benchmark return: {benchmark_return:.2f}%")
            return benchmark_return
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error getting benchmark return: {e}")
            return 8.0  # Default market return
    
    async def _calculate_dividend_yield_safe(self, transactions: List[Any]) -> Dict[str, Any]:
        """Calculate dividend yield with comprehensive error handling"""
        logger.debug(f"[AdvancedFinancialMetrics] Calculating dividend yield from transactions")
        
        try:
            # Get dividend transactions
            dividend_transactions = [txn for txn in transactions if txn.transaction_type == 'DIVIDEND']
            logger.debug(f"[AdvancedFinancialMetrics] Found {len(dividend_transactions)} dividend transactions")
            
            if not dividend_transactions:
                logger.info(f"[AdvancedFinancialMetrics] No dividend transactions found")
                return {
                    "total_dividends_received": 0.0,
                    "annual_dividends": 0.0,
                    "annual_yield_percent": 0.0,
                    "yield_above_average": False
                }
            
            # Calculate total dividends received
            total_dividends = sum(
                Decimal(str(txn.total_amount)) for txn in dividend_transactions
            )
            
            # Calculate time period for annualization
            first_dividend_date = min(txn.transaction_date for txn in dividend_transactions)
            days_receiving_dividends = max(1, (date.today() - first_dividend_date).days)
            
            # Annualize dividend income
            if days_receiving_dividends >= 365:
                years = days_receiving_dividends / 365.25
                annual_dividends = total_dividends / Decimal(str(years))
            else:
                # Project annual dividends
                annual_dividends = total_dividends * Decimal('365.25') / Decimal(str(days_receiving_dividends))
            
            # Calculate current portfolio value for yield calculation
            portfolio_metrics = await self._calculate_portfolio_value_safe(transactions)
            current_portfolio_value = Decimal(str(portfolio_metrics["market_value"]))
            
            # Calculate yield percentage
            if current_portfolio_value > 0:
                annual_yield_percent = (annual_dividends / current_portfolio_value) * 100
            else:
                annual_yield_percent = Decimal('0')
            
            # Determine if above average (typical dividend yield is 1.5-3%)
            yield_above_average = annual_yield_percent >= 2.0
            
            result = {
                "total_dividends_received": float(total_dividends),
                "annual_dividends": float(annual_dividends),
                "annual_yield_percent": float(annual_yield_percent),
                "yield_above_average": yield_above_average,
                "dividend_transactions_count": len(dividend_transactions),
                "days_receiving_dividends": days_receiving_dividends
            }
            
            logger.info(f"[AdvancedFinancialMetrics] ✅ Dividend yield calculated: Total=${total_dividends:.2f}, Annual=${annual_dividends:.2f}, Yield={annual_yield_percent:.2f}%")
            return result
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error calculating dividend yield: {e}", exc_info=True)
            return {
                "total_dividends_received": 0.0,
                "annual_dividends": 0.0,
                "annual_yield_percent": 0.0,
                "yield_above_average": False
            }
    
    async def _calculate_portfolio_beta_safe(self, transactions: List[Any], benchmark_symbol: str) -> Dict[str, Any]:
        """Calculate portfolio beta with error handling"""
        logger.debug(f"[AdvancedFinancialMetrics] Calculating portfolio beta vs {benchmark_symbol}")
        
        try:
            # This is a simplified beta calculation
            # In production, you'd need historical price correlations
            
            # Get unique tickers from transactions
            tickers = set(txn.ticker for txn in transactions if txn.transaction_type in ['BUY', 'SELL'])
            logger.debug(f"[AdvancedFinancialMetrics] Portfolio contains {len(tickers)} unique tickers: {list(tickers)}")
            
            if not tickers:
                logger.warning(f"[AdvancedFinancialMetrics] No holdings found for beta calculation")
                return {"beta": 1.0, "interpretation": "market_like"}
            
            # For demonstration, use sector-based beta approximation
            # This would be replaced with actual correlation calculation in production
            estimated_betas = []
            
            for ticker in tickers:
                # Simplified beta estimation based on ticker characteristics
                ticker_beta = await self._estimate_ticker_beta_safe(ticker)
                estimated_betas.append(ticker_beta)
                logger.debug(f"[AdvancedFinancialMetrics] Estimated beta for {ticker}: {ticker_beta}")
            
            # Calculate weighted average (simplified - would use actual portfolio weights)
            portfolio_beta = sum(estimated_betas) / len(estimated_betas) if estimated_betas else 1.0
            
            # Determine interpretation
            if portfolio_beta > 1.2:
                interpretation = "high_volatility"
            elif portfolio_beta > 0.8:
                interpretation = "market_like"
            else:
                interpretation = "low_volatility"
            
            result = {
                "beta": portfolio_beta,
                "interpretation": interpretation,
                "tickers_analyzed": len(tickers)
            }
            
            logger.info(f"[AdvancedFinancialMetrics] ✅ Portfolio beta calculated: {portfolio_beta:.2f} ({interpretation})")
            return result
            
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error calculating portfolio beta: {e}", exc_info=True)
            return {"beta": 1.0, "interpretation": "market_like"}
    
    async def _estimate_ticker_beta_safe(self, ticker: str) -> float:
        """Estimate beta for individual ticker with fallbacks"""
        try:
            # Simplified beta estimation - in production you'd use historical correlations
            # For now, use sector-based estimates
            
            # Technology stocks tend to have higher beta
            if ticker.upper() in ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META']:
                return 1.3
            # Financial stocks
            elif ticker.upper() in ['JPM', 'BAC', 'WFC', 'GS']:
                return 1.5
            # Utilities tend to have lower beta
            elif ticker.upper() in ['DUK', 'NEE', 'SO']:
                return 0.6
            # Default to market beta
            else:
                return 1.0
                
        except Exception as e:
            logger.error(f"[AdvancedFinancialMetrics] Error estimating beta for {ticker}: {e}")
            return 1.0
    
    def _get_default_kpi_metrics(self) -> Dict[str, Any]:
        """Return default KPI metrics when calculations fail"""
        logger.info(f"[AdvancedFinancialMetrics] Returning default KPI metrics")
        
        default_metrics = {
            "marketValue": {
                "value": "0.00",
                "sub_label": "+AU$0.00 (+0.00%)",
                "is_positive": True
            },
            "irr": {
                "value": "0.00%",
                "sub_label": "vs SPY: +0.0%",
                "is_positive": False
            },
            "dividendYield": {
                "value": "AU$0.00",
                "sub_label": "0.00% yield (AU$0.00 annual)",
                "is_positive": False
            },
            "portfolioBeta": {
                "value": "1.00",
                "sub_label": "vs SPY",
                "is_positive": False
            }
        }
        
        logger.debug(f"[AdvancedFinancialMetrics] 📋 Default metrics structure:")
        logger.debug(f"[AdvancedFinancialMetrics]   ✓ marketValue: {default_metrics['marketValue']}")
        logger.debug(f"[AdvancedFinancialMetrics]   ✓ irr: {default_metrics['irr']}")
        logger.debug(f"[AdvancedFinancialMetrics]   ✓ dividendYield: {default_metrics['dividendYield']}")
        logger.debug(f"[AdvancedFinancialMetrics]   ✓ portfolioBeta: {default_metrics['portfolioBeta']}")
        
        return default_metrics


# Service instance
_service_instance = None

def get_advanced_financial_metrics_service() -> AdvancedFinancialMetricsService:
    """Get singleton instance of the advanced financial metrics service"""
    global _service_instance
    if _service_instance is None:
        _service_instance = AdvancedFinancialMetricsService()
        logger.info("[AdvancedFinancialMetrics] Service instance created")
    return _service_instance 