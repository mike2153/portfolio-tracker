"""
Authentication helper utilities for consistent user data extraction and validation
"""
from typing import Dict, Any, Tuple
from fastapi import HTTPException

def extract_user_credentials(user_data: Dict[str, Any]) -> Tuple[str, str]:
    """
    Extract and validate user_id and user_token from authenticated user data.
    
    Args:
        user_data: Dictionary from require_authenticated_user dependency
        
    Returns:
        Tuple of (user_id, user_token)
        
    Raises:
        HTTPException: If user_id or user_token is missing
    """
    user_id = user_data.get("id")
    user_token = user_data.get("access_token")
    
    if not user_id:
        raise HTTPException(
            status_code=401, 
            detail="User ID not found in authentication data. Please log in again."
        )
    
    if not user_token:
        raise HTTPException(
            status_code=401,
            detail="Access token not found in authentication data. Please log in again."
        )
    
    # Ensure they are strings (type assertion for type checker)
    if not isinstance(user_id, str) or not isinstance(user_token, str):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication data format"
        )
    
    return user_id, user_token


def validate_user_id(user_id: Any) -> str:
    """
    Validate that user_id is a non-empty string with proper format.
    
    Args:
        user_id: The user ID to validate
        
    Returns:
        The validated user_id as a string
        
    Raises:
        HTTPException: If user_id is None, empty, not a string, or invalid format
    """
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID is required but was not provided"
        )
    
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=400,
            detail=f"User ID must be a string, got {type(user_id).__name__}"
        )
    
    # Validate UUID format (Supabase uses UUIDs)
    import re
    uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    if not re.match(uuid_pattern, user_id, re.IGNORECASE):
        raise HTTPException(
            status_code=400,
            detail="User ID must be a valid UUID format"
        )
    
    return user_id