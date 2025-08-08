"""
Supabase API functions for user profile management
Handles user profile data including base currency preferences
"""

from typing import Optional, Dict, Any
from supabase import Client
import logging

logger = logging.getLogger(__name__)


async def get_user_profile(supabase: Client, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch user profile data from Supabase
    
    Args:
        supabase: Authenticated Supabase client
        user_id: User's UUID
        
    Returns:
        User profile data or None if not found
    """
    if not user_id:
        logger.error("get_user_profile called with empty user_id")
        return None
        
    try:
        query = supabase.table('user_profiles')\
            .select('*')\
            .eq('user_id', user_id)
        # Support both async and sync clients
        result = query.execute()
            
        if result.data and len(result.data) > 0:
            return result.data[0]
        else:
            logger.info(f"No profile found for user {user_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        return None


async def get_user_base_currency(supabase: Client, user_id: str) -> str:
    """
    Get user's base currency preference
    
    Args:
        supabase: Authenticated Supabase client
        user_id: User's UUID
        
    Returns:
        Base currency code (defaults to 'USD' if not found)
    """
    if not user_id:
        logger.error("get_user_base_currency called with empty user_id")
        return 'USD'
        
    try:
        query = supabase.table('user_profiles')\
            .select('base_currency')\
            .eq('user_id', user_id)
        result = query.execute()
            
        if result.data and len(result.data) > 0:
            currency: str = result.data[0].get('base_currency', 'USD')
            return currency
        else:
            logger.info(f"No profile found for user {user_id}, defaulting to USD")
            return 'USD'
            
    except Exception as e:
        logger.error(f"Error fetching user base currency: {e}")
        return 'USD'


async def create_user_profile(
    supabase: Client, 
    user_id: str,
    first_name: str,
    last_name: str,
    country: str,
    base_currency: str = 'USD'
) -> Optional[Dict[str, Any]]:
    """
    Create a new user profile
    
    Args:
        supabase: Authenticated Supabase client
        user_id: User's UUID
        first_name: User's first name
        last_name: User's last name
        country: Two-letter country code
        base_currency: Three-letter currency code
        
    Returns:
        Created profile data or None if failed
    """
    if not all([user_id, first_name, last_name, country]):
        logger.error("create_user_profile called with missing required fields")
        return None
        
    try:
        profile_data = {
            'user_id': user_id,
            'first_name': first_name,
            'last_name': last_name,
            'country': country.upper()[:2],  # Ensure 2-letter code
            'base_currency': base_currency.upper()[:3]  # Ensure 3-letter code
        }
        
        result = supabase.table('user_profiles')\
            .insert(profile_data)\
            .execute()
            
        if result.data and len(result.data) > 0:
            logger.info(f"Created profile for user {user_id}")
            return result.data[0]
        else:
            logger.error("Failed to create user profile - no data returned")
            return None
            
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        return None


async def update_user_profile(
    supabase: Client,
    user_id: str,
    updates: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Update user profile data
    
    Args:
        supabase: Authenticated Supabase client
        user_id: User's UUID
        updates: Dictionary of fields to update
        
    Returns:
        Updated profile data or None if failed
    """
    if not user_id:
        logger.error("update_user_profile called with empty user_id")
        return None
        
    if not updates:
        logger.warning("update_user_profile called with no updates")
        return None
        
    try:
        # Validate currency code if provided
        if 'base_currency' in updates:
            updates['base_currency'] = updates['base_currency'].upper()[:3]
            
        # Validate country code if provided
        if 'country' in updates:
            updates['country'] = updates['country'].upper()[:2]
            
        result = supabase.table('user_profiles')\
            .update(updates)\
            .eq('user_id', user_id)\
            .execute()
            
        if result.data and len(result.data) > 0:
            logger.info(f"Updated profile for user {user_id}")
            return result.data[0]
        else:
            logger.error("Failed to update user profile - no data returned")
            return None
            
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        return None