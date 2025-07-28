"""
User Profile API endpoints
Handles user profile management including currency preferences
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import logging

from backend_api_routes.backend_api_auth import get_current_user
from supa_api.supa_api_user_profile import (
    get_user_profile,
    create_user_profile,
    update_user_profile,
    get_user_base_currency
)
from supa_api.supa_api_client import get_supa_service_client

logger = logging.getLogger(__name__)

user_profile_router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================

class UserProfileCreate(BaseModel):
    """Request model for creating user profile"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    country: str = Field(..., pattern="^[A-Z]{2}$", description="Two-letter country code")
    base_currency: str = Field(default="USD", pattern="^[A-Z]{3}$", description="Three-letter currency code")


class UserProfileUpdate(BaseModel):
    """Request model for updating user profile"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    country: Optional[str] = Field(None, pattern="^[A-Z]{2}$", description="Two-letter country code")
    base_currency: Optional[str] = Field(None, pattern="^[A-Z]{3}$", description="Three-letter currency code")


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

@user_profile_router.get("/profile", response_model=UserProfileResponse)
async def get_profile(user_data: Dict[str, Any] = Depends(get_current_user)) -> UserProfileResponse:
    """
    Get current user's profile
    
    Returns:
        User profile data including base currency preference
    """
    user_id: str = user_data["user_id"]
    
    try:
        supabase = get_supa_service_client()
        profile = await get_user_profile(supabase, user_id)
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        return UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")


@user_profile_router.post("/profile", response_model=UserProfileResponse)
async def create_profile(
    profile_data: UserProfileCreate,
    user_data: Dict[str, Any] = Depends(get_current_user)
) -> UserProfileResponse:
    """
    Create user profile with currency preference
    
    Args:
        profile_data: Profile information including base currency
        
    Returns:
        Created profile data
    """
    user_id: str = user_data["user_id"]
    
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
            
        return UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to create profile")


@user_profile_router.patch("/profile", response_model=UserProfileResponse)
async def update_profile(
    updates: UserProfileUpdate,
    user_data: Dict[str, Any] = Depends(get_current_user)
) -> UserProfileResponse:
    """
    Update user profile including currency preference
    
    Args:
        updates: Fields to update
        
    Returns:
        Updated profile data
    """
    user_id: str = user_data["user_id"]
    
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
            
        return UserProfileResponse(
            id=profile["id"],
            user_id=profile["user_id"],
            first_name=profile["first_name"],
            last_name=profile["last_name"],
            country=profile["country"],
            base_currency=profile["base_currency"],
            created_at=profile["created_at"],
            updated_at=profile["updated_at"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")


@user_profile_router.get("/profile/currency")
async def get_base_currency(user_data: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    """
    Get user's base currency preference
    
    Returns:
        Dictionary with base_currency field
    """
    user_id: str = user_data["user_id"]
    
    try:
        supabase = get_supa_service_client()
        base_currency = await get_user_base_currency(supabase, user_id)
        
        return {"base_currency": base_currency}
        
    except Exception as e:
        logger.error(f"Error fetching base currency: {e}")
        return {"base_currency": "USD"}  # Default to USD on error