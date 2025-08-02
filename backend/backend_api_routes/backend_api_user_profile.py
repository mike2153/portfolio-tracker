"""
User Profile API endpoints
Handles user profile management including currency preferences
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union
import logging

from supa_api.supa_api_auth import require_authenticated_user
from utils.auth_helpers import extract_user_credentials
from utils.response_factory import ResponseFactory
from models.response_models import APIResponse
from supa_api.supa_api_user_profile import (
    get_user_profile,
    create_user_profile,
    update_user_profile,
    get_user_base_currency
)
from supa_api.supa_api_client import get_supa_service_client

# Import centralized validation models
from models.validation_models import UserProfileCreate, UserProfileUpdate

logger = logging.getLogger(__name__)

user_profile_router = APIRouter()


# ============================================================================
# Response Models (keep local as they're not for validation)
# ============================================================================

class UserProfileResponse(BaseModel):
    """Response model for user profile"""
    id: str
    user_id: str
    first_name: str
    last_name: str
    country: str
    base_currency: str
    created_at: str
    updated_at: str


# ============================================================================
# API Endpoints
# ============================================================================

@user_profile_router.get("/profile")
async def get_profile(
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[UserProfileResponse, APIResponse[UserProfileResponse]]:
    """
    Get current user's profile
    
    Returns:
        User profile data including base currency preference
    """
    user_id, user_token = extract_user_credentials(user_data)
    
    try:
        supabase = get_supa_service_client()
        profile = await get_user_profile(supabase, user_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        profile_response = UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=profile_response,
                message="User profile retrieved successfully"
            )
        else:
            return profile_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")


@user_profile_router.post("/profile")
async def create_profile(
    profile_data: UserProfileCreate,
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[UserProfileResponse, APIResponse[UserProfileResponse]]:
    """
    Create user profile with currency preference
    
    Args:
        profile_data: Profile information including base currency
        
    Returns:
        Created profile data
    """
    user_id, user_token = extract_user_credentials(user_data)
    
    try:
        supabase = get_supa_service_client()
        
        # Check if profile already exists
        existing = await get_user_profile(supabase, user_id)
        if existing:
            raise HTTPException(status_code=400, detail="Profile already exists")
        
        # Create new profile
        profile = await create_user_profile(
            supabase,
            user_id=user_id,
            first_name=profile_data.first_name,
            last_name=profile_data.last_name,
            country=profile_data.country,
            base_currency=profile_data.base_currency
        )
        
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to create profile")
            
        profile_response = UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=profile_response,
                message="User profile created successfully"
            )
        else:
            return profile_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to create profile")


@user_profile_router.patch("/profile")
async def update_profile(
    updates: UserProfileUpdate,
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[UserProfileResponse, APIResponse[UserProfileResponse]]:
    """
    Update user profile including currency preference
    
    Args:
        updates: Fields to update
        
    Returns:
        Updated profile data
    """
    user_id, user_token = extract_user_credentials(user_data)
    
    # Build update dict excluding None values
    update_dict: Dict[str, Any] = {}
    if updates.first_name is not None:
        update_dict["first_name"] = updates.first_name
    if updates.last_name is not None:
        update_dict["last_name"] = updates.last_name
    if updates.country is not None:
        update_dict["country"] = updates.country
    if updates.base_currency is not None:
        update_dict["base_currency"] = updates.base_currency
        
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    try:
        supabase = get_supa_service_client()
        
        # Check if profile exists
        existing = await get_user_profile(supabase, user_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Update profile
        profile = await update_user_profile(supabase, user_id, update_dict)
        
        if not profile:
            raise HTTPException(status_code=500, detail="Failed to update profile")
            
        profile_response = UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=profile_response,
                message="User profile updated successfully"
            )
        else:
            return profile_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


@user_profile_router.get("/profile/currency")
async def get_base_currency(
    user_data: Dict[str, Any] = Depends(require_authenticated_user),
    api_version: Optional[str] = Header(None, alias="X-API-Version")
) -> Union[Dict[str, str], APIResponse[Dict[str, str]]]:
    """
    Get user's base currency preference
    
    Returns:
        Dictionary with base_currency field
    """
    user_id, user_token = extract_user_credentials(user_data)
    
    try:
        supabase = get_supa_service_client()
        base_currency = await get_user_base_currency(supabase, user_id)
        
        currency_data = {"base_currency": base_currency}
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=currency_data,
                message="Base currency retrieved successfully"
            )
        else:
            return currency_data
        
    except Exception as e:
        logger.error(f"Error fetching base currency: {e}")
        default_data = {"base_currency": "USD"}  # Default to USD on error
        
        if api_version == "v2":
            return ResponseFactory.success(
                data=default_data,
                message="Using default currency due to error",
                metadata={"error": str(e)}
            )
        else:
            return default_data