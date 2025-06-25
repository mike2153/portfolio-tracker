from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.core.management import call_command
import pytest
from decimal import Decimal
from io import StringIO

from ..models import Portfolio, PriceAlert
from ..services.price_alert_service import PriceAlertService

class PriceAlertServiceTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "test_user_123"
        # Clear any existing portfolios for this user to avoid uniqueness issues
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Test Portfolio")
        self.alert_service = PriceAlertService()
        
        # Create test alerts
        self.alert_above = PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        self.alert_below = PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="TSLA",
            alert_type="below",
            target_price=Decimal("200.00"),
            is_active=True
        )

    def test_create_alert_valid(self):
        """Test creating a valid price alert"""
        alert = self.alert_service.create_alert(
            user_id=self.user_id,
            ticker="MSFT",
            alert_type="above",
            target_price=300.0
        )
        
        self.assertEqual(alert.ticker, "MSFT")
        self.assertEqual(alert.alert_type, "above")
        self.assertEqual(alert.target_price, Decimal("300.0"))
        self.assertTrue(alert.is_active)

    def test_create_alert_invalid_type(self):
        """Test creating an alert with invalid type"""
        with self.assertRaises(ValueError):
            self.alert_service.create_alert(
                user_id=self.user_id,
                ticker="MSFT",
                alert_type="invalid",
                target_price=300.0
            )

    def test_get_user_alerts(self):
        """Test getting user alerts"""
        alerts = self.alert_service.get_user_alerts(self.user_id)
        
        self.assertEqual(len(alerts), 2)
        tickers = [alert.ticker for alert in alerts]
        self.assertIn("AAPL", tickers)
        self.assertIn("TSLA", tickers)

    def test_get_user_alerts_active_only(self):
        """Test getting only active alerts"""
        # Deactivate one alert
        self.alert_above.is_active = False
        self.alert_above.save()
        
        active_alerts = self.alert_service.get_user_alerts(self.user_id, active_only=True)
        all_alerts = self.alert_service.get_user_alerts(self.user_id, active_only=False)
        
        self.assertEqual(len(active_alerts), 1)
        self.assertEqual(len(all_alerts), 2)
        self.assertEqual(active_alerts[0].ticker, "TSLA")

    def test_deactivate_alert(self):
        """Test deactivating an alert"""
        success = self.alert_service.deactivate_alert(self.alert_above.id, self.user_id)
        
        self.assertTrue(success)
        
        # Refresh from database
        self.alert_above.refresh_from_db()
        self.assertFalse(self.alert_above.is_active)

    def test_deactivate_nonexistent_alert(self):
        """Test deactivating a non-existent alert"""
        success = self.alert_service.deactivate_alert(99999, self.user_id)
        self.assertFalse(success)

    def test_should_trigger_alert_above(self):
        """Test alert triggering logic for 'above' alerts"""
        # Current price above target - should trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_above, 155.0)
        self.assertTrue(should_trigger)
        
        # Current price below target - should not trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_above, 145.0)
        self.assertFalse(should_trigger)
        
        # Current price equal to target - should trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_above, 150.0)
        self.assertTrue(should_trigger)

    def test_should_trigger_alert_below(self):
        """Test alert triggering logic for 'below' alerts"""
        # Current price below target - should trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_below, 195.0)
        self.assertTrue(should_trigger)
        
        # Current price above target - should not trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_below, 205.0)
        self.assertFalse(should_trigger)
        
        # Current price equal to target - should trigger
        should_trigger = self.alert_service._should_trigger_alert(self.alert_below, 200.0)
        self.assertTrue(should_trigger)

    def test_check_alerts_for_ticker_trigger(self):
        """Test checking alerts for a ticker that should trigger using real Alpha Vantage API"""
        # Use real API to check AAPL price
        triggered_alerts = self.alert_service._check_alerts_for_ticker('AAPL', [self.alert_above])
        
        # Since we're using real API, we check if the alert logic works correctly
        # The result depends on actual AAPL price vs our target of $150
        self.assertIsInstance(triggered_alerts, list)
        
        # If AAPL is above $150, alert should trigger and be deactivated
        if triggered_alerts:
            self.assertEqual(triggered_alerts[0]['ticker'], 'AAPL')
            self.assertGreaterEqual(triggered_alerts[0]['current_price'], 150.0)
            self.alert_above.refresh_from_db()
            self.assertFalse(self.alert_above.is_active)

    def test_check_alerts_for_ticker_no_trigger(self):
        """Test checking alerts with a very high target that shouldn't trigger"""
        # Create an alert with unrealistically high target price
        high_alert = PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("10000.00"),  # Unrealistically high
            is_active=True
        )
        
        triggered_alerts = self.alert_service._check_alerts_for_ticker('AAPL', [high_alert])
        
        # Should not trigger since AAPL won't be above $10,000
        self.assertEqual(len(triggered_alerts), 0)
        
        # Check that alert is still active
        high_alert.refresh_from_db()
        self.assertTrue(high_alert.is_active)

    def test_check_all_active_alerts(self):
        """Test checking all active alerts with real API"""
        # Set realistic targets that might trigger with real market data
        self.alert_above.target_price = Decimal("50.00")  # Low target for AAPL
        self.alert_above.save()
        
        self.alert_below.target_price = Decimal("1000.00")  # High target for TSLA
        self.alert_below.save()
        
        results = self.alert_service.check_all_active_alerts()
        
        self.assertIn('alerts_checked', results)
        self.assertIn('alerts_triggered', results)
        self.assertIn('errors', results)
        self.assertIn('triggered_alerts', results)
        
        # Should have checked our 2 alerts
        self.assertGreaterEqual(results['alerts_checked'], 2)

    def test_get_alert_statistics(self):
        """Test getting alert statistics"""
        stats = self.alert_service.get_alert_statistics()
        
        self.assertIn('total_alerts', stats)
        self.assertIn('active_alerts', stats)
        self.assertIn('triggered_alerts', stats)
        self.assertIn('recent_activity', stats)
        self.assertIn('top_tickers', stats)
        
        self.assertGreaterEqual(stats['total_alerts'], 2)
        self.assertGreaterEqual(stats['active_alerts'], 0)

@pytest.mark.django_db
class PriceAlertAPITest:
    def setup_method(self):
        """Set up test data"""
        self.user_id = "alt_user_456"
        # Clear any existing portfolios for this user to avoid uniqueness issues
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Test Portfolio")

    def test_create_price_alert_api(self, ninja_client):
        """Test creating a price alert via API"""
        response = ninja_client.post(f"/portfolios/{self.user_id}/alerts", json={
            "ticker": "AAPL",
            "alert_type": "above",
            "target_price": 150.0
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alert_id" in data
        assert data["ticker"] == "AAPL"
        assert data["alert_type"] == "above"
        assert data["target_price"] == 150.0

    def test_create_price_alert_invalid_type(self, ninja_client):
        """Test creating a price alert with invalid type via API"""
        response = ninja_client.post(f"/portfolios/{self.user_id}/alerts", json={
            "ticker": "AAPL",
            "alert_type": "invalid",
            "target_price": 150.0
        })
        
        assert response.status_code == 400

    def test_get_price_alerts_api(self, ninja_client):
        """Test getting price alerts via API"""
        # Create some test alerts
        PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        response = ninja_client.get(f"/portfolios/{self.user_id}/alerts")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "alerts" in data
        assert "total_count" in data
        assert "active_count" in data
        assert len(data["alerts"]) == 1
        assert data["alerts"][0]["ticker"] == "AAPL"

    def test_deactivate_price_alert_api(self, ninja_client):
        """Test deactivating a price alert via API"""
        alert = PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        response = ninja_client.delete(f"/portfolios/{self.user_id}/alerts/{alert.id}")
        
        assert response.status_code == 200
        
        # Check that alert was deactivated
        alert.refresh_from_db()
        assert not alert.is_active

    def test_deactivate_nonexistent_alert_api(self, ninja_client):
        """Test deactivating a non-existent alert via API"""
        response = ninja_client.delete(f"/portfolios/{self.user_id}/alerts/99999")
        
        assert response.status_code == 404

    def test_get_alert_statistics_api(self, ninja_client):
        """Test getting alert statistics via API"""
        response = ninja_client.get("/alerts/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "statistics" in data
        assert "status" in data
        assert data["status"] == "healthy"

    def test_check_alerts_manually_api(self, ninja_client):
        """Test manually checking alerts via API with real data"""
        # Create a test alert with realistic target
        PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("50.00"),  # Low target that should trigger
            is_active=True
        )
        
        response = ninja_client.post("/alerts/check")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "results" in data

class CheckPriceAlertsCommandTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "test_user_789"
        # Clear any existing portfolios for this user to avoid uniqueness issues
        Portfolio.objects.filter(user_id=self.user_id).delete()
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Test Portfolio")

    @patch('api.management.commands.check_price_alerts.get_price_alert_service')
    def test_check_price_alerts_command(self, mock_get_service):
        """Test the check_price_alerts management command"""
        # Mock the service
        mock_service = MagicMock()
        mock_service.check_all_active_alerts.return_value = {
            'alerts_checked': 5,
            'alerts_triggered': 2,
            'errors': 0,
            'triggered_alerts': [
                {'ticker': 'AAPL', 'alert_type': 'above', 'target_price': 150.0, 'current_price': 155.0},
                {'ticker': 'TSLA', 'alert_type': 'below', 'target_price': 200.0, 'current_price': 195.0}
            ]
        }
        mock_get_service.return_value = mock_service
        
        # Capture command output
        out = StringIO()
        
        # Run command
        call_command('check_price_alerts', stdout=out)
        
        # Check that service was called
        mock_service.check_all_active_alerts.assert_called_once()
        
        # Check command output
        output = out.getvalue()
        self.assertIn('Alerts checked: 5', output)
        self.assertIn('Alerts triggered: 2', output)
        self.assertIn('TRIGGERED: AAPL', output)
        self.assertIn('TRIGGERED: TSLA', output)

    @patch('api.management.commands.check_price_alerts.get_price_alert_service')
    def test_check_price_alerts_command_dry_run(self, mock_get_service):
        """Test the check_price_alerts management command in dry-run mode"""
        # Mock the service
        mock_service = MagicMock()
        mock_service.get_alert_statistics.return_value = {
            'active_alerts': 3,
            'total_alerts': 10
        }
        mock_get_service.return_value = mock_service
        
        # Capture command output
        out = StringIO()
        
        # Run command in dry-run mode
        call_command('check_price_alerts', dry_run=True, stdout=out)
        
        # Check that only statistics were called, not alert checking
        mock_service.get_alert_statistics.assert_called_once()
        mock_service.check_all_active_alerts.assert_not_called()
        
        # Check command output
        output = out.getvalue()
        self.assertIn('DRY-RUN', output)
        self.assertIn('Active alerts: 3', output)
        self.assertIn('Total alerts: 10', output) 