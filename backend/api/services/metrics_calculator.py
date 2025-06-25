# backend/api/services/metrics_calculator.py
import logging
from typing import Any, Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

# Helper to safely get nested values from API data
def _safe_get(data: Dict[str, Any], key: str, default: Optional[Any] = None) -> Optional[Any]:
    """Safely get a value from a dictionary, returning a default if the key is not found or value is 'None' or '-'."""
    val = data.get(key, default)
    if val in [None, 'None', '-']:
        return default
    return val

def _safe_get_float(data: Dict[str, Any], key: str) -> Optional[float]:
    """Safely get a value and convert it to a float."""
    val = _safe_get(data, key)
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        logger.warning(f"Could not convert value '{val}' for key '{key}' to float.")
        return None

def _get_report_value(reports: List[Dict[str, Any]], key: str, index: int = 0) -> Optional[float]:
    """Get a specific value from a list of financial reports (e.g., income statements)."""
    if not reports or len(reports) <= index:
        return None
    return _safe_get_float(reports[index], key)

# TTM Calculation Helpers
def _calculate_ttm(quarterly_reports: List[Dict[str, Any]], key: str) -> Optional[float]:
    """Calculate Trailing Twelve Months (TTM) value from the last 4 quarterly reports."""
    if not quarterly_reports or len(quarterly_reports) < 4:
        return None
    
    values = [_safe_get_float(report, key) for report in quarterly_reports[:4]]
    
    # Ensure no None values before summing
    valid_values = [v for v in values if v is not None]
    if len(valid_values) < 4:
        logger.debug(f"Cannot calculate TTM for '{key}' due to missing quarterly data.")
        return None
    
    return sum(valid_values)

def _calculate_cagr(reports: List[Dict[str, Any]], key: str, years: int) -> Optional[float]:
    """Calculate Compound Annual Growth Rate (CAGR) for a given metric."""
    if not reports or len(reports) < years:
        return None

    end_value = _get_report_value(reports, key, 0)
    start_value = _get_report_value(reports, key, years - 1)

    if start_value is None or end_value is None or start_value <= 0 or years <= 0:
        return None
        
    try:
        cagr = (end_value / start_value) ** (1 / years) - 1
        return cagr
    except (ZeroDivisionError, ValueError):
        return None


class AdvancedMetricsCalculator:
    """Advanced financial metrics calculator for portfolio analysis."""
    
    def __init__(self):
        """Initialize the calculator."""
        pass
    
    def calculate_sharpe_ratio(self, returns: List[float], risk_free_rate: float = 0.02) -> Optional[float]:
        """Calculate Sharpe ratio."""
        if not returns or len(returns) < 2:
            return None
        
        try:
            returns_array = np.array(returns)
            excess_returns = returns_array - risk_free_rate / 252  # Daily risk-free rate
            
            if np.std(excess_returns) == 0:
                return None
            
            sharpe = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252)
            return float(sharpe)
        except Exception as e:
            logger.error(f"Error calculating Sharpe ratio: {e}")
            return None
    
    def calculate_beta(self, stock_returns: List[float], market_returns: List[float]) -> Optional[float]:
        """Calculate beta coefficient."""
        if not stock_returns or not market_returns or len(stock_returns) != len(market_returns):
            return None
        
        try:
            stock_array = np.array(stock_returns)
            market_array = np.array(market_returns)
            
            covariance = np.cov(stock_array, market_array)[0][1]
            market_variance = np.var(market_array)
            
            if market_variance == 0:
                return None
            
            beta = covariance / market_variance
            return float(beta)
        except Exception as e:
            logger.error(f"Error calculating beta: {e}")
            return None
    
    def calculate_volatility(self, returns: List[float]) -> Optional[float]:
        """Calculate annualized volatility."""
        if not returns or len(returns) < 2:
            return None
        
        try:
            returns_array = np.array(returns)
            volatility = np.std(returns_array) * np.sqrt(252)
            return float(volatility)
        except Exception as e:
            logger.error(f"Error calculating volatility: {e}")
            return None
    
    def calculate_max_drawdown(self, price_data: List[Dict[str, Any]]) -> Optional[float]:
        """Calculate maximum drawdown."""
        if not price_data:
            return None
        
        try:
            prices = [float(item['close']) for item in price_data]
            if not prices:
                return None
            
            peak = prices[0]
            max_drawdown = 0.0
            
            for price in prices:
                if price > peak:
                    peak = price
                drawdown = (peak - price) / peak
                if drawdown > max_drawdown:
                    max_drawdown = drawdown
            
            return float(max_drawdown)
        except Exception as e:
            logger.error(f"Error calculating max drawdown: {e}")
            return None
    
    def calculate_var_95(self, returns: List[float]) -> Optional[float]:
        """Calculate 95% Value at Risk."""
        if not returns or len(returns) < 20:
            return None
        
        try:
            returns_array = np.array(returns)
            var_95 = np.percentile(returns_array, 5)
            return float(var_95)
        except Exception as e:
            logger.error(f"Error calculating VaR 95%: {e}")
            return None
    
    def calculate_all_metrics(self, price_data: List[Dict[str, Any]], benchmark_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate all advanced metrics."""
        if not price_data or len(price_data) < 2:
            return {}
        
        try:
            # Calculate returns
            prices = [float(item['close']) for item in price_data]
            returns = []
            for i in range(1, len(prices)):
                ret = (prices[i] - prices[i-1]) / prices[i-1]
                returns.append(ret)
            
            # Calculate benchmark returns if available
            benchmark_returns = []
            if benchmark_data and len(benchmark_data) >= len(price_data):
                benchmark_prices = [float(item['close']) for item in benchmark_data[:len(price_data)]]
                for i in range(1, len(benchmark_prices)):
                    ret = (benchmark_prices[i] - benchmark_prices[i-1]) / benchmark_prices[i-1]
                    benchmark_returns.append(ret)
            
            # Calculate metrics
            metrics = {
                'sharpe_ratio': self.calculate_sharpe_ratio(returns),
                'volatility': self.calculate_volatility(returns),
                'max_drawdown': self.calculate_max_drawdown(price_data),
                'var_95': self.calculate_var_95(returns),
                'beta': None,
                'alpha': None
            }
            
            # Calculate beta and alpha if benchmark data is available
            if benchmark_returns and len(benchmark_returns) == len(returns):
                metrics['beta'] = self.calculate_beta(returns, benchmark_returns)
                
                if metrics['beta'] is not None:
                    # Simple alpha calculation
                    avg_return = np.mean(returns) if returns else 0
                    avg_benchmark_return = np.mean(benchmark_returns) if benchmark_returns else 0
                    risk_free_rate = 0.02 / 252  # Daily risk-free rate
                    
                    alpha = (avg_return - risk_free_rate) - metrics['beta'] * (avg_benchmark_return - risk_free_rate)
                    metrics['alpha'] = float(alpha) * 252  # Annualized
            
            return metrics
        except Exception as e:
            logger.error(f"Error calculating all metrics: {e}")
            return {}


# Main Calculation Function
def calculate_advanced_metrics(
    overview: Dict[str, Any],
    income_annual: List[Dict[str, Any]],
    income_quarterly: List[Dict[str, Any]],
    balance_annual: List[Dict[str, Any]],
    balance_quarterly: List[Dict[str, Any]],
    cash_flow_annual: List[Dict[str, Any]],
    cash_flow_quarterly: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Calculates a comprehensive set of advanced financial metrics from raw Alpha Vantage data.

    Args:
        overview: Company overview data.
        income_annual/quarterly: List of annual/quarterly income statement reports.
        balance_annual/quarterly: List of annual/quarterly balance sheet reports.
        cash_flow_annual/quarterly: List of annual/quarterly cash flow reports.

    Returns:
        A dictionary containing calculated metrics, structured by category.
    """
    # --- Raw Data Extraction ---
    market_cap = _safe_get_float(overview, 'MarketCapitalization')
    shares_outstanding = _safe_get_float(overview, 'SharesOutstanding')
    eps_ttm_overview = _safe_get_float(overview, 'EPS')
    pe_ratio_overview = _safe_get_float(overview, 'PERatio')
    pb_ratio_overview = _safe_get_float(overview, 'PriceToBookRatio')
    peg_ratio_overview = _safe_get_float(overview, 'PEGRatio')
    dividend_yield_overview = _safe_get_float(overview, 'DividendYield')
    beta = _safe_get_float(overview, 'Beta')
    latest_price = _safe_get_float(overview, 'AnalystTargetPrice')

    # Income Statement (TTM & Annual)
    net_income_ttm = _calculate_ttm(income_quarterly, 'netIncome')
    ebitda_ttm = _calculate_ttm(income_quarterly, 'ebitda')
    ebit_ttm = _calculate_ttm(income_quarterly, 'ebit')
    
    gross_profit_annual = _get_report_value(income_annual, 'grossProfit', 0)
    revenue_annual = _get_report_value(income_annual, 'totalRevenue', 0)
    operating_income_annual = _get_report_value(income_annual, 'operatingIncome', 0)
    net_income_annual = _get_report_value(income_annual, 'netIncome', 0)
    interest_expense_annual = _get_report_value(income_annual, 'interestExpense', 0)
    
    # Balance Sheet (Latest Annual)
    total_debt = _get_report_value(balance_annual, 'totalLiabilities', 0)
    total_shareholder_equity = _get_report_value(balance_annual, 'totalShareholderEquity', 0)
    cash_and_equivalents = _get_report_value(balance_annual, 'cashAndCashEquivalentsAtCarryingValue', 0)
    current_assets = _get_report_value(balance_annual, 'totalCurrentAssets', 0)
    current_liabilities = _get_report_value(balance_annual, 'totalCurrentLiabilities', 0)

    # Cash Flow (TTM & Annual)
    operating_cash_flow_ttm = _calculate_ttm(cash_flow_quarterly, 'operatingCashflow')
    capex_ttm = _calculate_ttm(cash_flow_quarterly, 'capitalExpenditures')
    
    total_dividend_paid_annual = _get_report_value(cash_flow_annual, 'dividendPayout', 0)
    
    # --- Metric Calculations ---

    # Valuation
    pe_ratio = None
    if eps_ttm_overview and eps_ttm_overview > 0:
        if latest_price:
             pe_ratio = latest_price / eps_ttm_overview
        elif market_cap and shares_outstanding and shares_outstanding > 0:
             pe_ratio = market_cap / (eps_ttm_overview * shares_outstanding)
    if not pe_ratio:
        pe_ratio = pe_ratio_overview

    book_value = _get_report_value(balance_annual, 'totalShareholderEquity', 0)
    pb_ratio = market_cap / book_value if market_cap and book_value and book_value > 0 else pb_ratio_overview

    eps_growth_5y = _calculate_cagr(income_annual, 'eps', 5)
    peg_ratio = (pe_ratio / (eps_growth_5y * 100)) if pe_ratio and eps_growth_5y and eps_growth_5y > 0 else peg_ratio_overview
    
    ev = None
    if market_cap is not None and total_debt is not None and cash_and_equivalents is not None:
        ev = market_cap + total_debt - cash_and_equivalents

    ev_ebitda = ev / ebitda_ttm if ev and ebitda_ttm and ebitda_ttm > 0 else None

    # Financial Health
    current_ratio = current_assets / current_liabilities if current_assets and current_liabilities and current_liabilities > 0 else None
    debt_to_equity = total_debt / total_shareholder_equity if total_debt and total_shareholder_equity and total_shareholder_equity > 0 else None
    interest_coverage = ebit_ttm / abs(interest_expense_annual) if ebit_ttm and interest_expense_annual is not None and interest_expense_annual != 0 else None
    fcf_ttm = (operating_cash_flow_ttm - abs(capex_ttm)) if operating_cash_flow_ttm is not None and capex_ttm is not None else None

    # Performance
    rev_now = _get_report_value(income_annual, 'totalRevenue', 0)
    rev_prev = _get_report_value(income_annual, 'totalRevenue', 1)
    revenue_growth_yoy = ((rev_now - rev_prev) / rev_prev) if rev_now and rev_prev and rev_prev > 0 else None
    
    revenue_growth_5y_cagr = _calculate_cagr(income_annual, 'totalRevenue', 5)
    
    eps_now = _get_report_value(income_annual, 'eps', 0)
    eps_prev = _get_report_value(income_annual, 'eps', 1)
    eps_growth_yoy = ((eps_now - eps_prev) / abs(eps_prev)) if eps_now and eps_prev and eps_prev != 0 else None

    equity_now = _get_report_value(balance_annual, 'totalShareholderEquity', 0)
    equity_prev = _get_report_value(balance_annual, 'totalShareholderEquity', 1)
    avg_equity = ((equity_now or 0) + (equity_prev or 0)) / 2 if equity_now is not None or equity_prev is not None else None
    roe_ttm = net_income_ttm / avg_equity if net_income_ttm and avg_equity and avg_equity > 0 else None

    assets_now = _get_report_value(balance_annual, 'totalAssets', 0)
    assets_prev = _get_report_value(balance_annual, 'totalAssets', 1)
    avg_assets = ((assets_now or 0) + (assets_prev or 0)) / 2 if assets_now is not None or assets_prev is not None else None
    roa_ttm = net_income_ttm / avg_assets if net_income_ttm and avg_assets and avg_assets > 0 else None

    # Profitability
    gross_margin = (gross_profit_annual / revenue_annual) * 100 if gross_profit_annual and revenue_annual and revenue_annual > 0 else None
    operating_margin = (operating_income_annual / revenue_annual) * 100 if operating_income_annual and revenue_annual and revenue_annual > 0 else None
    net_profit_margin = (net_income_annual / revenue_annual) * 100 if net_income_annual and revenue_annual and revenue_annual > 0 else None

    # Dividends
    dividend_payout_ratio = (abs(total_dividend_paid_annual) / net_income_annual) * 100 if total_dividend_paid_annual is not None and net_income_annual and net_income_annual > 0 else None
    dividend_growth_3y_cagr = None

    return {
        "valuation": {"market_capitalization": market_cap, "pe_ratio": pe_ratio, "pb_ratio": pb_ratio, "peg_ratio": peg_ratio, "ev_to_ebitda": ev_ebitda, "dividend_yield": dividend_yield_overview},
        "financial_health": {"current_ratio": current_ratio, "debt_to_equity_ratio": debt_to_equity, "interest_coverage_ratio": interest_coverage, "free_cash_flow_ttm": fcf_ttm},
        "performance": {"revenue_growth_yoy": revenue_growth_yoy, "revenue_growth_5y_cagr": revenue_growth_5y_cagr, "eps_growth_yoy": eps_growth_yoy, "eps_growth_5y_cagr": eps_growth_5y, "return_on_equity_ttm": roe_ttm, "return_on_assets_ttm": roa_ttm},
        "profitability": {"gross_margin": gross_margin, "operating_margin": operating_margin, "net_profit_margin": net_profit_margin},
        "dividends": {"dividend_payout_ratio": dividend_payout_ratio, "dividend_growth_rate_3y_cagr": dividend_growth_3y_cagr},
        "raw_data_summary": {"beta": beta, "eps_ttm": eps_ttm_overview, "shares_outstanding": shares_outstanding}
    } 