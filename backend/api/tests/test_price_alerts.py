from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.core.management import call_command
from ninja.testing import TestClient
from decimal import Decimal
from io import StringIO

from ..api import api
from ..models import Portfolio, PriceAlert
from ..services.price_alert_service import PriceAlertService

class PriceAlertServiceTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "test_user_123"
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

    @patch('api.services.price_alert_service.get_alpha_vantage_service')
    def test_check_alerts_for_ticker_trigger(self, mock_get_av):
        """Test checking alerts for a ticker that should trigger"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {
            'price': '155.00',
            'symbol': 'AAPL',
            'change': '5.00',
            'change_percent': '3.33%'
        }
        mock_get_av.return_value = mock_av_service
        
        # Create new service instance to use the mock
        alert_service = PriceAlertService()
        
        # Check alerts for AAPL (should trigger the 'above 150' alert)
        triggered_alerts = alert_service._check_alerts_for_ticker('AAPL', [self.alert_above])
        
        self.assertEqual(len(triggered_alerts), 1)
        self.assertEqual(triggered_alerts[0]['ticker'], 'AAPL')
        self.assertEqual(triggered_alerts[0]['current_price'], 155.0)
        
        # Check that alert was deactivated
        self.alert_above.refresh_from_db()
        self.assertFalse(self.alert_above.is_active)
        self.assertIsNotNone(self.alert_above.triggered_at)

    @patch('api.services.price_alert_service.get_alpha_vantage_service')
    def test_check_alerts_for_ticker_no_trigger(self, mock_get_av):
        """Test checking alerts for a ticker that should not trigger"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {
            'price': '145.00',  # Below the 150 target for 'above' alert
            'symbol': 'AAPL'
        }
        mock_get_av.return_value = mock_av_service
        
        # Create new service instance to use the mock
        alert_service = PriceAlertService()
        
        # Check alerts for AAPL (should not trigger)
        triggered_alerts = alert_service._check_alerts_for_ticker('AAPL', [self.alert_above])
        
        self.assertEqual(len(triggered_alerts), 0)
        
        # Check that alert is still active
        self.alert_above.refresh_from_db()
        self.assertTrue(self.alert_above.is_active)
        self.assertIsNone(self.alert_above.triggered_at)

    @patch('api.services.price_alert_service.get_alpha_vantage_service')
    def test_check_all_active_alerts(self, mock_get_av):
        """Test checking all active alerts"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.side_effect = [
            {'price': '155.00', 'symbol': 'AAPL'},  # Should trigger AAPL alert
            {'price': '195.00', 'symbol': 'TSLA'}   # Should trigger TSLA alert
        ]
        mock_get_av.return_value = mock_av_service
        
        # Create new service instance to use the mock
        alert_service = PriceAlertService()
        
        # Check all alerts
        results = alert_service.check_all_active_alerts()
        
        self.assertEqual(results['alerts_checked'], 2)
        self.assertEqual(results['alerts_triggered'], 2)
        self.assertEqual(results['errors'], 0)
        self.assertEqual(len(results['triggered_alerts']), 2)

    def test_get_alert_statistics(self):
        """Test getting alert statistics"""
        stats = self.alert_service.get_alert_statistics()
        
        self.assertIn('total_alerts', stats)
        self.assertIn('active_alerts', stats)
        self.assertIn('triggered_alerts', stats)
        self.assertIn('recent_activity', stats)
        self.assertIn('top_tickers', stats)
        
        self.assertEqual(stats['total_alerts'], 2)
        self.assertEqual(stats['active_alerts'], 2)
        self.assertEqual(stats['triggered_alerts'], 0)

class PriceAlertAPITest(TestCase):
    def setUp(self):
        """Set up test client and data"""
        self.client = TestClient(api)
        self.user_id = "test_user_456"
        self.portfolio = Portfolio.objects.create(user_id=self.user_id, name="Test Portfolio")

    def test_create_price_alert_api(self):
        """Test creating a price alert via API"""
        response = self.client.post(f"/portfolios/{self.user_id}/alerts", json={
            "ticker": "AAPL",
            "alert_type": "above",
            "target_price": 150.0
        })
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("alert_id", data)
        self.assertEqual(data["ticker"], "AAPL")
        self.assertEqual(data["alert_type"], "above")
        self.assertEqual(data["target_price"], 150.0)

    def test_create_price_alert_invalid_type(self):
        """Test creating a price alert with invalid type via API"""
        response = self.client.post(f"/portfolios/{self.user_id}/alerts", json={
            "ticker": "AAPL",
            "alert_type": "invalid",
            "target_price": 150.0
        })
        
        self.assertEqual(response.status_code, 400)

    def test_get_price_alerts_api(self):
        """Test getting price alerts via API"""
        # Create some test alerts
        PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        response = self.client.get(f"/portfolios/{self.user_id}/alerts")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("alerts", data)
        self.assertIn("total_count", data)
        self.assertIn("active_count", data)
        self.assertEqual(len(data["alerts"]), 1)
        self.assertEqual(data["alerts"][0]["ticker"], "AAPL")

    def test_deactivate_price_alert_api(self):
        """Test deactivating a price alert via API"""
        alert = PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        response = self.client.delete(f"/portfolios/{self.user_id}/alerts/{alert.id}")
        
        self.assertEqual(response.status_code, 200)
        
        # Check that alert was deactivated
        alert.refresh_from_db()
        self.assertFalse(alert.is_active)

    def test_deactivate_nonexistent_alert_api(self):
        """Test deactivating a non-existent alert via API"""
        response = self.client.delete(f"/portfolios/{self.user_id}/alerts/99999")
        
        self.assertEqual(response.status_code, 404)

    def test_get_alert_statistics_api(self):
        """Test getting alert statistics via API"""
        response = self.client.get("/alerts/stats")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("statistics", data)
        self.assertIn("status", data)
        self.assertEqual(data["status"], "healthy")

    @patch('api.services.price_alert_service.get_alpha_vantage_service')
    def test_check_alerts_manually_api(self, mock_get_av):
        """Test manually checking alerts via API"""
        # Mock Alpha Vantage service
        mock_av_service = MagicMock()
        mock_av_service.get_global_quote.return_value = {
            'price': '155.00',
            'symbol': 'AAPL'
        }
        mock_get_av.return_value = mock_av_service
        
        # Create a test alert
        PriceAlert.objects.create(
            portfolio=self.portfolio,
            ticker="AAPL",
            alert_type="above",
            target_price=Decimal("150.00"),
            is_active=True
        )
        
        response = self.client.post("/alerts/check")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertIn("message", data)
        self.assertIn("results", data)

class CheckPriceAlertsCommandTest(TestCase):
    def setUp(self):
        """Set up test data"""
        self.user_id = "test_user_789"
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