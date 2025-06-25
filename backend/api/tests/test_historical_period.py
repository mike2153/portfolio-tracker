import pytest
from unittest.mock import patch

@pytest.mark.django_db
class HistoricalDataEndpointTest:
    @patch('api.views.alpha_vantage')
    def test_historical_period_all_returns_full_dataset(self, mock_alpha_vantage, ninja_client):
        mock_alpha_vantage.get_daily_adjusted.return_value = {
            'data': [
                {'date': '2024-01-02', 'adjusted_close': 170.0},
                {'date': '2023-01-02', 'adjusted_close': 150.0},
            ],
            'last_refreshed': '2024-01-02'
        }

        response = ninja_client.get('/stocks/AAPL/historical?period=MAX')
        assert response.status_code == 200
        data = response.json()
        assert len(data['data']) == 2

