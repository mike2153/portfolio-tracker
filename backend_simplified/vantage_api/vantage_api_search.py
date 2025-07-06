"""
Stock symbol search with relevance scoring algorithm
Implements the same scoring logic as the original system
"""
from typing import List, Dict, Any
import logging

from .vantage_api_client import get_vantage_client
from debug_logger import DebugLogger

logger = logging.getLogger(__name__)

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate the Levenshtein distance between two strings"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            # j+1 instead of j since previous_row and current_row are one character longer than s2
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

@DebugLogger.log_api_call(api_name="ALPHA_VANTAGE", sender="BACKEND", receiver="VANTAGE_API", operation="SYMBOL_SEARCH")
async def vantage_api_symbol_search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Search for stock symbols with intelligent scoring
    
    Scoring algorithm:
    - Exact ticker match: 100 points
    - Ticker prefix match: 75 points  
    - Ticker substring match: 50 points
    - Company name prefix match: 60 points
    - Company name substring match: 40 points
    - Short ticker penalty: -10 points
    - Fuzzy match bonus: up to 30 points based on Levenshtein distance
    """

    
    if not query or len(query) < 1:
        return []
    
    # Normalize query for matching
    query_upper = query.upper()
    query_lower = query.lower()
    
    # Get Alpha Vantage client
    client = get_vantage_client()
    
    # Check cache first
    cache_key = f"symbol_search:{query_upper}"
    cached_raw = await client._get_from_cache(cache_key)
    
    if cached_raw and isinstance(cached_raw, dict) and "results" in cached_raw:
        from typing import cast

        cached_list = cast(List[Dict[str, Any]], cached_raw["results"])
        return cached_list[:limit]
    
    # Make API request
    params = {
        'function': 'SYMBOL_SEARCH',
        'keywords': query
    }
    
    try:
        response = await client._make_request(params)
        
        if 'bestMatches' not in response:
            logger.warning(f"[vantage_api_search.py::vantage_api_symbol_search] No matches found for {query}")
            return []
        
        # Score and process results
        scored_results = []
        
        for match in response['bestMatches']:
            symbol = match.get('1. symbol', '')
            name = match.get('2. name', '')
            match_type = match.get('3. type', 'Equity')
            region = match.get('4. region', 'United States')
            currency = match.get('8. currency', 'USD')
            
            # 🔥 FIX: Don't skip short tickers - they might be valid matches
            # Calculate relevance score
            score = calculate_relevance_score(
                symbol=symbol,
                name=name,
                query_upper=query_upper,
                query_lower=query_lower
            )
            
            if score > 0:
                result = {
                    'symbol': symbol,
                    'name': name,
                    'type': match_type,
                    'region': region,
                    'currency': currency,
                    'score': score,
                    'source': 'alpha_vantage'
                }
                scored_results.append(result)
        
        # Sort by score descending
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Remove score from final results
        final_results = []
        for result in scored_results:
            result_copy = result.copy()
            del result_copy['score']
            final_results.append(result_copy)
        
        # Cache the results (wrap in a dict so the stored JSON shape is self-describing)
        await client._save_to_cache(cache_key, {"results": final_results})
        
    
        
        return final_results[:limit]
        
    except Exception as e:
        DebugLogger.log_error(
            file_name="vantage_api_search.py",
            function_name="vantage_api_symbol_search",
            error=e,
            query=query
        )
        return []

def calculate_relevance_score(symbol: str, name: str, query_upper: str, query_lower: str) -> int:
    """Calculate relevance score for a symbol based on the query"""
    score = 0
    
    ticker_upper = symbol.upper()
    name_lower = name.lower()
    
    # 🔥 DEBUG: Log scoring details
    logger.debug(f"[SCORING] Query: '{query_upper}', Symbol: '{ticker_upper}', Name: '{name_lower}'")
    
    # Exact match of ticker (highest priority)
    if ticker_upper == query_upper:
        score += 100
        logger.debug(f"[SCORING] Exact match: {symbol} (+100)")
    # Prefix match of ticker
    elif ticker_upper.startswith(query_upper):
        score += 75
        logger.debug(f"[SCORING] Prefix match: {symbol} (+75)")
    # Substring match of ticker
    elif query_upper in ticker_upper:
        score += 50
        logger.debug(f"[SCORING] Substring match: {symbol} (+50)")
    
    # 🔥 FIX: Add fuzzy matching for typos like APPL -> AAPL
    else:
        # Calculate Levenshtein distance for fuzzy matching
        distance = levenshtein_distance(ticker_upper, query_upper)
        max_length = max(len(ticker_upper), len(query_upper))
        
        # If distance is small relative to length, give bonus points
        if max_length > 0:
            similarity_ratio = 1.0 - (distance / max_length)
            if similarity_ratio > 0.75:  # 75% similar
                fuzzy_bonus = int(30 * similarity_ratio)
                score += fuzzy_bonus
                logger.debug(f"[SCORING] Fuzzy match: {symbol} distance={distance} similarity={similarity_ratio:.2f} (+{fuzzy_bonus})")
    
    # Prefix match of company name
    if name_lower.startswith(query_lower):
        score += 60
        logger.debug(f"[SCORING] Company name prefix match: {name} (+60)")
    # Substring match of company name
    elif query_lower in name_lower:
        score += 40
        logger.debug(f"[SCORING] Company name substring match: {name} (+40)")
    
    # 🔥 FIX: Don't penalize short tickers - many valid tickers are 1-3 chars (F, GM, GE, etc.)
    # Only penalize if it's a partial match
    if len(ticker_upper) < 3 and ticker_upper != query_upper:
        score -= 10
        logger.debug(f"[SCORING] Short ticker penalty: {symbol} (-10)")
    
    # 🔥 FIX: Bonus for common typos
    common_typos = {
        'APPL': 'AAPL',
        'AMZM': 'AMZN',
        'GOOG': 'GOOGL',
        'MSFT': 'MSFT',  # Keep exact matches
        'NVDA': 'NVDA',
        'TSLA': 'TSLA',
        'MELA': 'META',
        'NFLX': 'NFLX',
        'GOOLG': 'GOOGL',
        'AMAZN': 'AMZN',
    }
    
    if query_upper in common_typos and ticker_upper == common_typos[query_upper]:
        score += 50  # Significant bonus for common typos
        logger.debug(f"[SCORING] Common typo match: {query_upper} -> {ticker_upper} (+50)")
    
    logger.debug(f"[SCORING] Final score for {symbol}: {score}")
    return score

# Also search from cached symbols in database
@DebugLogger.log_api_call(api_name="SUPABASE", sender="BACKEND", receiver="SUPA_API", operation="SYMBOL_SEARCH")
async def supa_api_search_cached_symbols(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search cached symbols from Supabase with scoring"""
    from supa_api.supa_api_client import get_supa_client
    
    logger.info(f"[vantage_api_search.py::supa_api_search_cached_symbols] Searching cached symbols for: {query}")
    
    if not query or len(query) < 1:
        return []
    
    query_upper = query.upper()
    query_lower = query.lower()
    
    try:
        client = get_supa_client()
        
        # 🔥 FIX: Broader search to catch more potential matches
        # Search for symbols that contain the query OR are similar
        result = (
            client.table('stock_symbols')
            .select('*')
            .or_(f"symbol.ilike.%{query_lower}%,name.ilike.%{query_lower}%")  # type: ignore[attr-defined]
            .limit(100)  # Get more results to score
            .execute()
        )

        
        if not result.data:
            return []
        
        # Score the results
        scored_results = []
        for symbol_data in result.data:
            score = calculate_relevance_score(
                symbol=symbol_data['symbol'],
                name=symbol_data['name'],
                query_upper=query_upper,
                query_lower=query_lower
            )
            
            if score > 0:
                result_dict = {
                    'symbol': symbol_data['symbol'],
                    'name': symbol_data['name'],
                    'type': symbol_data.get('type', 'Equity'),
                    'region': 'United States',
                    'currency': symbol_data.get('currency', 'USD'),
                    'exchange': symbol_data.get('exchange', ''),
                    'score': score,
                    'source': 'cache'
                }
                scored_results.append(result_dict)
        
        # Sort by score
        scored_results.sort(key=lambda x: x['score'], reverse=True)
        
        # Remove scores
        final_results = []
        for result in scored_results:
            result_copy = result.copy()
            del result_copy['score']
            final_results.append(result_copy)
        
        logger.info(
            f"[vantage_api_search.py::supa_api_search_cached_symbols] Found {len(final_results)} results for {query}"
        )

        return final_results[:limit]
        
    except Exception as e:
        logger.warning(f"[vantage_api_search.py::supa_api_search_cached_symbols] Cache search failed: {e}")
        return []

# Combined search function
async def combined_symbol_search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search both cached and live symbols, merge and deduplicate"""
    logger.info(f"[vantage_api_search.py::combined_symbol_search] Combined search for: {query}")
    
    # 🔥 DEBUG: Log search request
    logger.info(f"[SEARCH_DEBUG] Query: '{query}'")
    logger.info(f"[SEARCH_DEBUG] Query length: {len(query)}")
    logger.info(f"[SEARCH_DEBUG] Query upper: '{query.upper()}'")
    
    # Search both sources
    cached_results = await supa_api_search_cached_symbols(query, limit)
    vantage_results = await vantage_api_symbol_search(query, limit)
    
    logger.info(f"[SEARCH_DEBUG] Cached results: {len(cached_results)}")
    logger.info(f"[SEARCH_DEBUG] Vantage results: {len(vantage_results)}")
    
    # Merge and deduplicate
    seen_symbols = set()
    combined_results = []
    
    # Add cached results first (they're faster)
    for result in cached_results:
        if result['symbol'] not in seen_symbols:
            seen_symbols.add(result['symbol'])
            combined_results.append(result)
    
    # Add vantage results
    for result in vantage_results:
        if result['symbol'] not in seen_symbols:
            seen_symbols.add(result['symbol'])
            combined_results.append(result)
    
    logger.info(f"[vantage_api_search.py::combined_symbol_search] Combined results: {len(combined_results)}")
    
    # 🔥 DEBUG: Log final results
    if combined_results:
        logger.info(f"[SEARCH_DEBUG] Top 5 results:")
        for i, result in enumerate(combined_results[:5]):
            logger.info(f"[SEARCH_DEBUG]   {i+1}. {result['symbol']} - {result['name']}")
    else:
        logger.warning(f"[SEARCH_DEBUG] No results found for query: '{query}'")
    
    return combined_results[:limit] 