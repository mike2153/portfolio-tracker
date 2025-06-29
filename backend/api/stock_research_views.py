from ninja import Router
from django.http import JsonResponse
from django.db import models
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from .auth import require_auth
from .models import StockNote, UserWatchlist, StockSymbol
from .alpha_vantage_service import AlphaVantageService
import json
import logging

logger = logging.getLogger(__name__)

stock_research_router = Router()
av_service = AlphaVantageService()

@stock_research_router.get("/search")
def search_stocks(request, query: str):
    """Search for stocks by ticker or company name with autocomplete"""
    try:
        # Search Alpha Vantage for symbols
        av_results = av_service.search_symbols(query)
        
        # Also search local symbol database
        local_results = StockSymbol.objects.filter(
            models.Q(ticker__icontains=query) | 
            models.Q(name__icontains=query)
        )[:10]
        
        # Combine and format results
        results = []
        
        # Add Alpha Vantage results
        if av_results and 'bestMatches' in av_results:
            for match in av_results['bestMatches'][:5]:
                results.append({
                    'ticker': match.get('1. symbol', ''),
                    'name': match.get('2. name', ''),
                    'type': match.get('3. type', ''),
                    'region': match.get('4. region', ''),
                    'currency': match.get('8. currency', 'USD'),
                    'source': 'alpha_vantage'
                })
        
        # Add local results
        for symbol in local_results:
            results.append({
                'ticker': symbol.ticker,
                'name': symbol.name,
                'type': 'Equity',
                'region': 'US',
                'currency': symbol.currency or 'USD',
                'source': 'local'
            })
        
        # Remove duplicates based on ticker
        seen_tickers = set()
        unique_results = []
        for result in results:
            if result['ticker'] not in seen_tickers:
                seen_tickers.add(result['ticker'])
                unique_results.append(result)
        
        return {"results": unique_results[:10]}
        
    except Exception as e:
        logger.error(f"Error searching stocks: {str(e)}")
        return {"results": [], "error": str(e)}


@stock_research_router.get("/overview/{ticker}")
def get_stock_overview(request, ticker: str):
    """Get comprehensive stock overview data"""
    try:
        data = {}
        
        # Get company overview
        overview = av_service.get_company_overview(ticker)
        if overview:
            data['overview'] = {
                'name': overview.get('Name', 'N/A'),
                'ticker': ticker.upper(),
                'exchange': overview.get('Exchange', 'N/A'),
                'sector': overview.get('Sector', 'N/A'),
                'industry': overview.get('Industry', 'N/A'),
                'country': overview.get('Country', 'N/A'),
                'description': overview.get('Description', 'N/A'),
                'market_cap': overview.get('MarketCapitalization', 'N/A'),
                'pe_ratio': overview.get('PERatio', 'N/A'),
                'eps': overview.get('EPS', 'N/A'),
                'beta': overview.get('Beta', 'N/A'),
                'dividend_yield': overview.get('DividendYield', 'N/A'),
                'book_value': overview.get('BookValue', 'N/A'),
                '52_week_high': overview.get('52WeekHigh', 'N/A'),
                '52_week_low': overview.get('52WeekLow', 'N/A'),
                'revenue_ttm': overview.get('RevenueTTM', 'N/A'),
                'gross_profit_ttm': overview.get('GrossProfitTTM', 'N/A'),
                'profit_margin': overview.get('ProfitMargin', 'N/A')
            }
        
        # Get current quote
        quote = av_service.get_stock_quote(ticker)
        if quote and 'Global Quote' in quote:
            quote_data = quote['Global Quote']
            data['quote'] = {
                'price': quote_data.get('05. price', 'N/A'),
                'change': quote_data.get('09. change', 'N/A'),
                'change_percent': quote_data.get('10. change percent', 'N/A'),
                'volume': quote_data.get('06. volume', 'N/A'),
                'open': quote_data.get('02. open', 'N/A'),
                'high': quote_data.get('03. high', 'N/A'),
                'low': quote_data.get('04. low', 'N/A'),
                'previous_close': quote_data.get('08. previous close', 'N/A'),
                'latest_trading_day': quote_data.get('07. latest trading day', 'N/A')
            }
        
        return data
        
    except Exception as e:
        logger.error(f"Error getting stock overview for {ticker}: {str(e)}")
        return {"error": str(e)}


@stock_research_router.get("/price-data/{ticker}")
def get_price_data(request, ticker: str, period: str = "1y"):
    """Get historical price data for charts"""
    try:
        # Map period to Alpha Vantage function
        if period in ['7d', '1m']:
            # Use intraday data for short periods
            data = av_service.get_intraday_data(ticker, interval='60min')
            time_series_key = 'Time Series (60min)'
        else:
            # Use daily data for longer periods
            data = av_service.get_daily_data(ticker, outputsize='full')
            time_series_key = 'Time Series (Daily)'
        
        if not data or time_series_key not in data:
            return {"error": "No price data available"}
        
        time_series = data[time_series_key]
        
        # Filter data based on period
        cutoff_date = datetime.now()
        if period == '7d':
            cutoff_date -= timedelta(days=7)
        elif period == '1m':
            cutoff_date -= timedelta(days=30)
        elif period == '3m':
            cutoff_date -= timedelta(days=90)
        elif period == '6m':
            cutoff_date -= timedelta(days=180)
        elif period == 'ytd':
            cutoff_date = datetime(cutoff_date.year, 1, 1)
        elif period == '1y':
            cutoff_date -= timedelta(days=365)
        elif period == '5y':
            cutoff_date -= timedelta(days=365*5)
        # 'max' doesn't filter
        
        # Format data for charts
        chart_data = []
        for date_str, values in time_series.items():
            date_obj = datetime.strptime(date_str, '%Y-%m-%d' if 'Daily' in time_series_key else '%Y-%m-%d %H:%M:%S')
            
            if period != 'max' and date_obj < cutoff_date:
                continue
                
            chart_data.append({
                'time': date_str,
                'open': float(values['1. open']),
                'high': float(values['2. high']),
                'low': float(values['3. low']),
                'close': float(values['4. close']),
                'volume': int(values['5. volume'])
            })
        
        # Sort by date (oldest first)
        chart_data.sort(key=lambda x: x['time'])
        
        return {"data": chart_data}
        
    except Exception as e:
        logger.error(f"Error getting price data for {ticker}: {str(e)}")
        return {"error": str(e)}


@stock_research_router.get("/financials/{ticker}")
def get_financials(request, ticker: str, statement_type: str = "income"):
    """Get financial statements data"""
    try:
        data = {}
        
        if statement_type == "income":
            annual = av_service.get_income_statement(ticker)
            data['annual'] = annual.get('annualReports', []) if annual else []
            data['quarterly'] = annual.get('quarterlyReports', []) if annual else []
            
        elif statement_type == "balance":
            annual = av_service.get_balance_sheet(ticker)
            data['annual'] = annual.get('annualReports', []) if annual else []
            data['quarterly'] = annual.get('quarterlyReports', []) if annual else []
            
        elif statement_type == "cashflow":
            annual = av_service.get_cash_flow(ticker)
            data['annual'] = annual.get('annualReports', []) if annual else []
            data['quarterly'] = annual.get('quarterlyReports', []) if annual else []
        
        return data
        
    except Exception as e:
        logger.error(f"Error getting financials for {ticker}: {str(e)}")
        return {"error": str(e)}


@stock_research_router.get("/dividends/{ticker}")
def get_dividends(request, ticker: str):
    """Get dividend history data"""
    try:
        # Get company overview for dividend info
        overview = av_service.get_company_overview(ticker)
        
        # Get time series data to extract dividend information
        daily_data = av_service.get_daily_data(ticker, outputsize='full')
        
        dividend_data = {
            'yield': overview.get('DividendYield', 'N/A') if overview else 'N/A',
            'payout_ratio': 'N/A',  # Calculate if we have EPS and dividend data
            'ex_dividend_date': overview.get('ExDividendDate', 'N/A') if overview else 'N/A',
            'dividend_date': overview.get('DividendDate', 'N/A') if overview else 'N/A',
            'history': []
        }
        
        # Extract dividend payments from time series (Alpha Vantage includes them)
        if daily_data and 'Time Series (Daily)' in daily_data:
            for date, values in daily_data['Time Series (Daily)'].items():
                # Look for dividend information in the data
                # Note: This is a simplified approach - you might need to use a dedicated dividend endpoint
                pass
        
        return dividend_data
        
    except Exception as e:
        logger.error(f"Error getting dividends for {ticker}: {str(e)}")
        return {"error": str(e)}


@stock_research_router.get("/news/{ticker}")
def get_news(request, ticker: str):
    """Get news and sentiment for a stock"""
    try:
        news_data = av_service.get_news_sentiment(ticker)
        
        if not news_data or 'feed' not in news_data:
            return {"articles": []}
        
        articles = []
        for article in news_data['feed'][:20]:  # Limit to 20 articles
            # Get sentiment for this ticker if available
            sentiment = 'Neutral'
            sentiment_score = 0.0
            
            if 'ticker_sentiment' in article:
                for ticker_data in article['ticker_sentiment']:
                    if ticker_data.get('ticker') == ticker.upper():
                        sentiment_label = ticker_data.get('ticker_sentiment_label', 'Neutral')
                        sentiment = sentiment_label.title()
                        sentiment_score = float(ticker_data.get('ticker_sentiment_score', 0.0))
                        break
            
            articles.append({
                'title': article.get('title', 'N/A'),
                'url': article.get('url', ''),
                'time_published': article.get('time_published', ''),
                'authors': article.get('authors', []),
                'summary': article.get('summary', 'N/A'),
                'source': article.get('source', 'N/A'),
                'source_domain': article.get('source_domain', 'N/A'),
                'sentiment': sentiment,
                'sentiment_score': sentiment_score,
                'topics': article.get('topics', [])
            })
        
        return {"articles": articles}
        
    except Exception as e:
        logger.error(f"Error getting news for {ticker}: {str(e)}")
        return {"articles": [], "error": str(e)}


@stock_research_router.get("/watchlist")
@require_auth
def get_watchlist(request):
    """Get user's watchlist"""
    try:
        watchlist = UserWatchlist.objects.filter(user_id=request.user.id)
        return {
            "watchlist": [
                {
                    "ticker": item.ticker,
                    "name": item.company_name,
                    "added_date": item.created_at.isoformat()
                }
                for item in watchlist
            ]
        }
    except Exception as e:
        logger.error(f"Error getting watchlist: {str(e)}")
        return {"watchlist": [], "error": str(e)}


@stock_research_router.post("/watchlist/{ticker}")
@require_auth
def add_to_watchlist(request, ticker: str):
    """Add stock to watchlist"""
    try:
        # Get company name
        overview = av_service.get_company_overview(ticker)
        company_name = overview.get('Name', ticker) if overview else ticker
        
        # Create or get watchlist item
        item, created = UserWatchlist.objects.get_or_create(
            user_id=request.user.id,
            ticker=ticker.upper(),
            defaults={'company_name': company_name}
        )
        
        return {
            "success": True,
            "created": created,
            "ticker": ticker.upper(),
            "name": company_name
        }
        
    except Exception as e:
        logger.error(f"Error adding to watchlist: {str(e)}")
        return {"success": False, "error": str(e)}


@stock_research_router.delete("/watchlist/{ticker}")
@require_auth
def remove_from_watchlist(request, ticker: str):
    """Remove stock from watchlist"""
    try:
        deleted_count, _ = UserWatchlist.objects.filter(
            user_id=request.user.id,
            ticker=ticker.upper()
        ).delete()
        
        return {
            "success": True,
            "deleted": deleted_count > 0,
            "ticker": ticker.upper()
        }
        
    except Exception as e:
        logger.error(f"Error removing from watchlist: {str(e)}")
        return {"success": False, "error": str(e)}


@stock_research_router.get("/notes/{ticker}")
@require_auth
def get_notes(request, ticker: str):
    """Get user notes for a stock"""
    try:
        notes = StockNote.objects.filter(
            user_id=request.user.id,
            ticker=ticker.upper()
        ).order_by('-created_at')
        
        return {
            "notes": [
                {
                    "id": note.id,  # type: ignore[attr-defined]
                    "content": note.content,
                    "created_at": note.created_at.isoformat(),
                    "updated_at": note.updated_at.isoformat()
                }
                for note in notes
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting notes: {str(e)}")
        return {"notes": [], "error": str(e)}


@stock_research_router.post("/notes/{ticker}")
@require_auth
def create_note(request, ticker: str):
    """Create a new note for a stock"""
    try:
        data = json.loads(request.body)
        content = data.get('content', '').strip()
        
        if not content:
            return {"success": False, "error": "Note content cannot be empty"}
        
        note = StockNote.objects.create(
            user_id=request.user.id,
            ticker=ticker.upper(),
            content=content
        )
        
        return {
            "success": True,
            "note": {
                "id": note.id, # type: ignore[attr-defined]
                "content": note.content,
                "created_at": note.created_at.isoformat(),
                "updated_at": note.updated_at.isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Error creating note: {str(e)}")
        return {"success": False, "error": str(e)}


@stock_research_router.put("/notes/{note_id}")
@require_auth
def update_note(request, note_id: int):
    """Update an existing note"""
    try:
        data = json.loads(request.body)
        content = data.get('content', '').strip()
        
        if not content:
            return {"success": False, "error": "Note content cannot be empty"}
        
        note = StockNote.objects.get(
            id=note_id,
            user_id=request.user.id
        )
        note.content = content
        note.save()
        
        return {
            "success": True,
            "note": {
                "id": note.id, # type: ignore[attr-defined]
                "content": note.content,
                "created_at": note.created_at.isoformat(),
                "updated_at": note.updated_at.isoformat()
            }
        }
        
    except StockNote.DoesNotExist:
        return {"success": False, "error": "Note not found"}
    except Exception as e:
        logger.error(f"Error updating note: {str(e)}")
        return {"success": False, "error": str(e)}


@stock_research_router.delete("/notes/{note_id}")
@require_auth
def delete_note(request, note_id: int):
    """Delete a note"""
    try:
        deleted_count, _ = StockNote.objects.filter(
            id=note_id,
            user_id=request.user.id
        ).delete()
        
        return {
            "success": True,
            "deleted": deleted_count > 0
        }
        
    except Exception as e:
        logger.error(f"Error deleting note: {str(e)}")
        return {"success": False, "error": str(e)}