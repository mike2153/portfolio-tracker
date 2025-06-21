# backend/api/services/price_alert_service.py
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from django.utils import timezone
from django.db import transaction
from ..models import PriceAlert, Portfolio
from ..alpha_vantage_service import get_alpha_vantage_service

logger = logging.getLogger(__name__)

class PriceAlertService:
    """Service for managing and checking price alerts"""
    
    def __init__(self):
        self.av_service = get_alpha_vantage_service()
    
    def check_all_active_alerts(self) -> Dict[str, Any]:
        """
        Check all active price alerts against current market prices.
        
        Returns:
            Dictionary with summary of alerts checked and triggered
        """
        logger.info("Starting price alert check for all active alerts")
        
        # Get all active alerts
        active_alerts = PriceAlert.objects.filter(
            is_active=True,
            triggered_at__isnull=True
        ).select_related('portfolio')
        
        if not active_alerts.exists():
            logger.info("No active alerts to check")
            return {
                'total_alerts': 0,
                'alerts_checked': 0,
                'alerts_triggered': 0,
                'errors': 0
            }
        
        # Group alerts by ticker to minimize API calls
        alerts_by_ticker = {}
        for alert in active_alerts:
            if alert.ticker not in alerts_by_ticker:
                alerts_by_ticker[alert.ticker] = []
            alerts_by_ticker[alert.ticker].append(alert)
        
        stats = {
            'total_alerts': active_alerts.count(),
            'alerts_checked': 0,
            'alerts_triggered': 0,
            'errors': 0,
            'triggered_alerts': []
        }
        
        # Check each ticker
        for ticker, ticker_alerts in alerts_by_ticker.items():
            try:
                triggered_alerts = self._check_alerts_for_ticker(ticker, ticker_alerts)
                stats['alerts_checked'] += len(ticker_alerts)
                stats['alerts_triggered'] += len(triggered_alerts)
                stats['triggered_alerts'].extend(triggered_alerts)
                
            except Exception as e:
                logger.error(f"Error checking alerts for ticker {ticker}: {e}", exc_info=True)
                stats['errors'] += 1
        
        logger.info(f"Price alert check completed: {stats['alerts_triggered']} triggered out of {stats['alerts_checked']} checked")
        return stats
    
    def _check_alerts_for_ticker(self, ticker: str, alerts: List[PriceAlert]) -> List[Dict[str, Any]]:
        """Check alerts for a specific ticker"""
        logger.debug(f"Checking {len(alerts)} alerts for ticker {ticker}")
        
        # Get current price
        quote = self.av_service.get_global_quote(ticker)
        if not quote or 'price' not in quote:
            logger.warning(f"Could not get current price for {ticker}")
            return []
        
        current_price = float(quote['price'])
        logger.debug(f"Current price for {ticker}: ${current_price}")
        
        triggered_alerts = []
        
        for alert in alerts:
            try:
                should_trigger = self._should_trigger_alert(alert, current_price)
                
                if should_trigger:
                    triggered_alert = self._trigger_alert(alert, current_price, quote)
                    triggered_alerts.append(triggered_alert)
                    logger.info(f"Alert triggered for {ticker}: {alert.alert_type} ${alert.target_price} (current: ${current_price})")
                
            except Exception as e:
                logger.error(f"Error processing alert {alert.id} for {ticker}: {e}", exc_info=True)
        
        return triggered_alerts
    
    def _should_trigger_alert(self, alert: PriceAlert, current_price: float) -> bool:
        """Determine if an alert should be triggered based on current price"""
        target_price = float(alert.target_price)
        
        if alert.alert_type == 'above':
            return current_price >= target_price
        elif alert.alert_type == 'below':
            return current_price <= target_price
        else:
            logger.warning(f"Unknown alert type: {alert.alert_type}")
            return False
    
    def _trigger_alert(self, alert: PriceAlert, current_price: float, quote_data: Dict[str, Any]) -> Dict[str, Any]:
        """Trigger an alert and mark it as triggered"""
        with transaction.atomic():
            # Update the alert
            alert.triggered_at = timezone.now()
            alert.is_active = False  # Deactivate after triggering
            alert.save()
        
        # Prepare alert data for notification
        triggered_alert = {
            'alert_id': alert.id,
            'ticker': alert.ticker,
            'alert_type': alert.alert_type,
            'target_price': float(alert.target_price),
            'current_price': current_price,
            'triggered_at': alert.triggered_at,
            'portfolio_user_id': alert.portfolio.user_id,
            'quote_data': quote_data
        }
        
        # Here you would typically send notifications (email, SMS, push notification, etc.)
        # For now, we'll just log it
        self._send_alert_notification(triggered_alert)
        
        return triggered_alert
    
    def _send_alert_notification(self, alert_data: Dict[str, Any]) -> None:
        """Send notification for triggered alert (placeholder implementation)"""
        # This is where you would integrate with notification services
        # Examples: email service, SMS service, push notifications, webhooks, etc.
        
        ticker = alert_data['ticker']
        alert_type = alert_data['alert_type']
        target_price = alert_data['target_price']
        current_price = alert_data['current_price']
        user_id = alert_data['portfolio_user_id']
        
        message = f"Price Alert Triggered: {ticker} is now {alert_type} ${target_price} (current: ${current_price})"
        
        # Log the notification (in production, replace with actual notification service)
        logger.info(f"NOTIFICATION for user {user_id}: {message}")
        
        # Example integrations you might add:
        # - self._send_email_notification(user_id, message, alert_data)
        # - self._send_sms_notification(user_id, message)
        # - self._send_push_notification(user_id, message, alert_data)
        # - self._send_webhook_notification(alert_data)
    
    def create_alert(
        self, 
        user_id: str, 
        ticker: str, 
        alert_type: str, 
        target_price: float
    ) -> PriceAlert:
        """Create a new price alert"""
        logger.info(f"Creating price alert for user {user_id}: {ticker} {alert_type} ${target_price}")
        
        # Validate alert type
        if alert_type not in ['above', 'below']:
            raise ValueError(f"Invalid alert type: {alert_type}. Must be 'above' or 'below'.")
        
        # Get or create portfolio
        portfolio, _ = Portfolio.objects.get_or_create(user_id=user_id)
        
        # Create the alert
        alert = PriceAlert.objects.create(
            portfolio=portfolio,
            ticker=ticker.upper(),
            alert_type=alert_type,
            target_price=target_price,
            is_active=True
        )
        
        logger.info(f"Created price alert {alert.id} for user {user_id}")
        return alert
    
    def get_user_alerts(
        self, 
        user_id: str, 
        active_only: bool = False,
        ticker: Optional[str] = None
    ) -> List[PriceAlert]:
        """Get alerts for a specific user"""
        try:
            portfolio = Portfolio.objects.get(user_id=user_id)
        except Portfolio.DoesNotExist:
            return []
        
        queryset = PriceAlert.objects.filter(portfolio=portfolio)
        
        if active_only:
            queryset = queryset.filter(is_active=True, triggered_at__isnull=True)
        
        if ticker:
            queryset = queryset.filter(ticker__iexact=ticker)
        
        return list(queryset.order_by('-created_at'))
    
    def deactivate_alert(self, alert_id: int, user_id: str) -> bool:
        """Deactivate a specific alert"""
        try:
            portfolio = Portfolio.objects.get(user_id=user_id)
            alert = PriceAlert.objects.get(id=alert_id, portfolio=portfolio)
            
            alert.is_active = False
            alert.save()
            
            logger.info(f"Deactivated alert {alert_id} for user {user_id}")
            return True
            
        except (Portfolio.DoesNotExist, PriceAlert.DoesNotExist):
            logger.warning(f"Could not find alert {alert_id} for user {user_id}")
            return False
    
    def get_alert_statistics(self) -> Dict[str, Any]:
        """Get statistics about price alerts"""
        total_alerts = PriceAlert.objects.count()
        active_alerts = PriceAlert.objects.filter(is_active=True, triggered_at__isnull=True).count()
        triggered_alerts = PriceAlert.objects.filter(triggered_at__isnull=False).count()
        
        # Get recent activity (last 24 hours)
        yesterday = timezone.now() - timedelta(hours=24)
        recent_triggered = PriceAlert.objects.filter(triggered_at__gte=yesterday).count()
        recent_created = PriceAlert.objects.filter(created_at__gte=yesterday).count()
        
        # Top tickers with alerts
        from django.db.models import Count
        top_tickers = list(
            PriceAlert.objects.filter(is_active=True)
            .values('ticker')
            .annotate(alert_count=Count('id'))
            .order_by('-alert_count')[:10]
        )
        
        return {
            'total_alerts': total_alerts,
            'active_alerts': active_alerts,
            'triggered_alerts': triggered_alerts,
            'recent_activity': {
                'triggered_last_24h': recent_triggered,
                'created_last_24h': recent_created
            },
            'top_tickers': top_tickers
        }

# Singleton instance
_price_alert_service_instance = None

def get_price_alert_service() -> PriceAlertService:
    """Get singleton instance of PriceAlertService"""
    global _price_alert_service_instance
    if _price_alert_service_instance is None:
        _price_alert_service_instance = PriceAlertService()
    return _price_alert_service_instance 