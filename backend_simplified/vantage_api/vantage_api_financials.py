"""
Alpha Vantage Financial Statements API
Handles income statement, balance sheet, and cash flow data
"""
import logging
import aiohttp
from typing import Dict, Any, List
from datetime import datetime

from config import VANTAGE_API_KEY
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

# Alpha Vantage API endpoint
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

async def vantage_api_get_income_statement(symbol: str) -> Dict[str, Any]:
    """
    Get income statement data from Alpha Vantage
    
    Args:
        symbol: Stock ticker symbol
        
    Returns:
        Dictionary containing annual and quarterly income statement data
    """
    logger.info(f"[vantage_api_financials.py::vantage_api_get_income_statement] Fetching income statement for {symbol}")
    
    params = {
        "function": "INCOME_STATEMENT",
        "symbol": symbol,
        "apikey": VANTAGE_API_KEY
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(ALPHA_VANTAGE_BASE_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check for API errors
                    if "Error Message" in data:
                        raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
                    if "Note" in data:
                        raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")
                    
                    # Process and return the data
                    return {
                        "symbol": data.get("symbol", symbol),
                        "annual_reports": data.get("annualReports", []),
                        "quarterly_reports": data.get("quarterlyReports", []),
                        "last_updated": datetime.utcnow().isoformat()
                    }
                else:
                    raise ValueError(f"Alpha Vantage API request failed with status {response.status}")
                    
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_financials.py",
            function_name="vantage_api_get_income_statement",
            error=e,
            symbol=symbol
        )
        raise

async def vantage_api_get_balance_sheet(symbol: str) -> Dict[str, Any]:
    """
    Get balance sheet data from Alpha Vantage
    
    Args:
        symbol: Stock ticker symbol
        
    Returns:
        Dictionary containing annual and quarterly balance sheet data
    """
    logger.info(f"[vantage_api_financials.py::vantage_api_get_balance_sheet] Fetching balance sheet for {symbol}")
    
    params = {
        "function": "BALANCE_SHEET",
        "symbol": symbol,
        "apikey": VANTAGE_API_KEY
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(ALPHA_VANTAGE_BASE_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check for API errors
                    if "Error Message" in data:
                        raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
                    if "Note" in data:
                        raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")
                    
                    # Process and return the data
                    return {
                        "symbol": data.get("symbol", symbol),
                        "annual_reports": data.get("annualReports", []),
                        "quarterly_reports": data.get("quarterlyReports", []),
                        "last_updated": datetime.utcnow().isoformat()
                    }
                else:
                    raise ValueError(f"Alpha Vantage API request failed with status {response.status}")
                    
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_financials.py",
            function_name="vantage_api_get_balance_sheet",
            error=e,
            symbol=symbol
        )
        raise

async def vantage_api_get_cash_flow(symbol: str) -> Dict[str, Any]:
    """
    Get cash flow statement data from Alpha Vantage
    
    Args:
        symbol: Stock ticker symbol
        
    Returns:
        Dictionary containing annual and quarterly cash flow data
    """
    logger.info(f"[vantage_api_financials.py::vantage_api_get_cash_flow] Fetching cash flow for {symbol}")
    
    params = {
        "function": "CASH_FLOW",
        "symbol": symbol,
        "apikey": VANTAGE_API_KEY
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(ALPHA_VANTAGE_BASE_URL, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    # Check for API errors
                    if "Error Message" in data:
                        raise ValueError(f"Alpha Vantage API error: {data['Error Message']}")
                    if "Note" in data:
                        raise ValueError(f"Alpha Vantage rate limit: {data['Note']}")
                    
                    # Process and return the data
                    return {
                        "symbol": data.get("symbol", symbol),
                        "annual_reports": data.get("annualReports", []),
                        "quarterly_reports": data.get("quarterlyReports", []),
                        "last_updated": datetime.utcnow().isoformat()
                    }
                else:
                    raise ValueError(f"Alpha Vantage API request failed with status {response.status}")
                    
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_financials.py",
            function_name="vantage_api_get_cash_flow",
            error=e,
            symbol=symbol
        )
        raise

def format_financial_statement(raw_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Format raw financial statement data from Alpha Vantage
    
    Args:
        raw_data: Raw financial data from Alpha Vantage
        
    Returns:
        Formatted financial data suitable for frontend consumption
    """
    formatted_data = []
    
    for report in raw_data[:8]:  # Limit to last 8 periods
        formatted_report = {}
        
        # Add fiscal date
        formatted_report["fiscalDateEnding"] = report.get("fiscalDateEnding", "")
        formatted_report["reportedCurrency"] = report.get("reportedCurrency", "USD")
        
        # Convert all string numbers to proper format for charts
        for key, value in report.items():
            if key not in ["fiscalDateEnding", "reportedCurrency"]:
                try:
                    # Try to convert to float for numeric data
                    numeric_value = float(value.replace(",", "") if isinstance(value, str) else value)
                    formatted_report[key] = numeric_value
                except (ValueError, AttributeError, TypeError):
                    # Keep as string if conversion fails
                    formatted_report[key] = value if value != "None" else 0
        
        formatted_data.append(formatted_report)
    
    return formatted_data