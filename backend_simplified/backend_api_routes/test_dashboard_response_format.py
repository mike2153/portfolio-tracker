"""
Test script to demonstrate the new response format for dashboard endpoints.
This shows how the v1 (legacy) and v2 (new standardized) formats differ.
"""

# Example of legacy v1 response format
v1_dashboard_response = {
    "success": True,
    "portfolio": {
        "total_value": 50000.00,
        "total_cost": 45000.00,
        "total_gain_loss": 5000.00,
        "total_gain_loss_percent": 11.11,
        "daily_change": 250.00,
        "daily_change_percent": 0.5,
        "holdings_count": 10
    },
    "top_holdings": [
        {
            "symbol": "AAPL",
            "quantity": 100,
            "avg_cost": 150.00,
            "total_cost": 15000.00,
            "current_price": 175.00,
            "current_value": 17500.00,
            "allocation": 35.0,
            "total_gain_loss": 2500.00,
            "total_gain_loss_percent": 16.67,
            "gain_loss": 2500.00,
            "gain_loss_percent": 16.67
        }
    ],
    "transaction_summary": {
        "total_invested": 50000,
        "total_sold": 5000,
        "net_invested": 45000,
        "total_transactions": 25
    },
    "cache_status": "fresh",
    "computation_time_ms": 150
}

# Example of new v2 response format (standardized)
v2_dashboard_response = {
    "success": True,
    "data": {
        "portfolio": {
            "total_value": 50000.00,
            "total_cost": 45000.00,
            "total_gain_loss": 5000.00,
            "total_gain_loss_percent": 11.11,
            "daily_change": 250.00,
            "daily_change_percent": 0.5,
            "holdings_count": 10
        },
        "top_holdings": [
            {
                "symbol": "AAPL",
                "quantity": 100,
                "avg_cost": 150.00,
                "total_cost": 15000.00,
                "current_price": 175.00,
                "current_value": 17500.00,
                "allocation": 35.0,
                "total_gain_loss": 2500.00,
                "total_gain_loss_percent": 16.67,
                "gain_loss": 2500.00,
                "gain_loss_percent": 16.67
            }
        ],
        "transaction_summary": {
            "total_invested": 50000,
            "total_sold": 5000,
            "net_invested": 45000,
            "total_transactions": 25
        }
    },
    "error": None,
    "message": "Dashboard data retrieved successfully",
    "metadata": {
        "timestamp": "2025-01-29T12:00:00",
        "version": "1.0",
        "cache_status": "fresh",
        "computation_time_ms": 150,
        "holdings_count": 10,
        "force_refresh": False
    }
}

# Example of v2 error response
v2_error_response = {
    "success": False,
    "error": "DashboardError",
    "message": "Failed to retrieve dashboard data: Database connection timeout",
    "details": None,
    "request_id": None,
    "timestamp": "2025-01-29T12:00:00"
}

# Example of v2 validation error response
v2_validation_error = {
    "success": False,
    "error": "ValidationError",
    "message": "Invalid benchmark symbol",
    "details": [
        {
            "code": "VALIDATION_ERROR",
            "message": "Unsupported benchmark: INVALID",
            "field": "benchmark",
            "details": None
        }
    ],
    "request_id": None,
    "timestamp": "2025-01-29T12:00:00"
}

print("Dashboard Response Format Examples")
print("=" * 50)
print("\n1. Legacy v1 format (default when X-Api-Version header is 'v1' or missing):")
print("   - Data is directly in the response body")
print("   - cache_status and computation_time_ms are top-level fields")
print("   - Simple success: true/false structure")

print("\n2. New v2 format (when X-Api-Version header is 'v2'):")
print("   - All response data wrapped in 'data' field")
print("   - Standardized metadata object with timestamp and version")
print("   - Consistent error structure with error type categorization")
print("   - Better separation of data, metadata, and error information")

print("\n3. Key differences:")
print("   - v2 wraps all payload in 'data' field")
print("   - v2 adds automatic timestamp and API version to metadata")
print("   - v2 provides structured error responses with error categorization")
print("   - v2 maintains backward compatibility - clients can continue using v1")

print("\n4. Migration strategy:")
print("   - Existing clients continue to work with v1 (default)")
print("   - New clients can opt into v2 by sending 'X-Api-Version: v2' header")
print("   - Both formats will be supported during transition period")