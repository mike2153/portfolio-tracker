"""
🛡️ BULLETPROOF FEATURE FLAG MODELS

Pydantic models for backend feature flag system with strict typing
and comprehensive validation for safe rollout management.
"""

from decimal import Decimal
from datetime import datetime
from typing import List, Dict, Optional, Union, Literal
from pydantic import BaseModel, Field, ConfigDict, validator
from enum import Enum


class FeatureFlagStatus(str, Enum):
    """Feature flag status enumeration"""
    ENABLED = "enabled"
    DISABLED = "disabled" 
    CANARY = "canary"
    PERCENTAGE = "percentage"
    KILL_SWITCH = "kill_switch"


class RolloutStrategy(str, Enum):
    """Rollout strategy types"""
    ALL_USERS = "all_users"
    CANARY_USERS = "canary_users"
    PERCENTAGE_BASED = "percentage_based"
    USER_BASED = "user_based"
    ENVIRONMENT_BASED = "environment_based"


class FeatureFlagConfig(BaseModel):
    """Individual feature flag configuration"""
    
    model_config = ConfigDict(
        extra="forbid",
        validate_assignment=True,
        json_encoders={
            Decimal: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }
    )
    
    flag_name: str = Field(..., description="Unique feature flag identifier")
    display_name: str = Field(..., description="Human-readable flag name")
    description: str = Field(..., description="Flag purpose and functionality")
    
    # Status and Strategy
    status: FeatureFlagStatus = Field(default=FeatureFlagStatus.DISABLED)
    rollout_strategy: RolloutStrategy = Field(default=RolloutStrategy.ALL_USERS)
    
    # Rollout Configuration
    enabled_percentage: int = Field(default=0, ge=0, le=100, description="Percentage of users")
    canary_users: List[str] = Field(default_factory=list, description="Specific user IDs")
    environment_filter: Optional[List[str]] = Field(default=None, description="Environment restrictions")
    
    # Safety Controls
    kill_switch: bool = Field(default=False, description="Emergency disable override")
    max_rollout_percentage: int = Field(default=100, ge=0, le=100, description="Maximum allowed rollout")
    
    # Metadata
    created_by: str = Field(..., description="User who created the flag")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_modified_by: Optional[str] = Field(default=None)
    last_modified_at: Optional[datetime] = Field(default=None)
    
    # Dependencies and Incompatibilities
    depends_on: List[str] = Field(default_factory=list, description="Required flags")
    incompatible_with: List[str] = Field(default_factory=list, description="Conflicting flags")

    @validator('flag_name')
    def validate_flag_name(cls, v: str) -> str:
        """Ensure flag name follows naming conventions"""
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError("Flag name must contain only alphanumeric characters, hyphens, and underscores")
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Flag name must be between 3 and 50 characters")
        return v.lower()

    @validator('canary_users')
    def validate_canary_users(cls, v: List[str]) -> List[str]:
        """Ensure canary user IDs are valid"""
        if len(v) > 100:
            raise ValueError("Cannot have more than 100 canary users")
        return [user_id.strip() for user_id in v if user_id.strip()]


class FeatureFlagEvaluation(BaseModel):
    """Result of feature flag evaluation for a specific context"""
    
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    
    flag_name: str = Field(..., description="Feature flag name")
    is_enabled: bool = Field(..., description="Whether flag is enabled for this context")
    reason: str = Field(..., description="Reason for enable/disable decision")
    rollout_strategy: RolloutStrategy = Field(..., description="Strategy used")
    evaluation_context: Dict[str, Union[str, int, bool]] = Field(
        default_factory=dict, 
        description="Context used for evaluation"
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FeatureFlagRequest(BaseModel):
    """Request for feature flag evaluation"""
    
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    
    user_id: Optional[str] = Field(default=None, description="User requesting flag evaluation")
    flags: List[str] = Field(..., description="List of flags to evaluate")
    environment: Optional[str] = Field(default=None, description="Environment context")
    additional_context: Dict[str, Union[str, int, bool]] = Field(
        default_factory=dict, 
        description="Additional evaluation context"
    )


class FeatureFlagResponse(BaseModel):
    """Response containing feature flag evaluations"""
    
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    
    evaluations: List[FeatureFlagEvaluation] = Field(..., description="Flag evaluations")
    user_id: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    cache_ttl_seconds: int = Field(default=300, description="Cache time-to-live")


class FeatureFlagUpdateRequest(BaseModel):
    """Request to update feature flag configuration"""
    
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    
    flag_name: str = Field(..., description="Flag to update")
    updates: Dict[str, Union[str, int, bool, List[str]]] = Field(
        ..., 
        description="Fields to update"
    )
    updated_by: str = Field(..., description="User making the update")
    reason: Optional[str] = Field(default=None, description="Reason for update")


class EmergencyDisableRequest(BaseModel):
    """Request to emergency disable a feature flag"""
    
    model_config = ConfigDict(extra="forbid", validate_assignment=True)
    
    flag_name: str = Field(..., description="Flag to disable")
    reason: str = Field(..., description="Reason for emergency disable")
    disabled_by: str = Field(..., description="User initiating disable")
    notify_team: bool = Field(default=True, description="Send notifications")


class FeatureFlagAuditLog(BaseModel):
    """Audit log entry for feature flag operations"""
    
    model_config = ConfigDict(
        extra="forbid", 
        validate_assignment=True,
        json_encoders={datetime: lambda v: v.isoformat()}
    )
    
    log_id: Optional[str] = Field(default=None, description="Unique log entry ID")
    flag_name: str = Field(..., description="Feature flag name")
    action: Literal["created", "updated", "enabled", "disabled", "evaluated", "emergency_disable"] = Field(
        ..., 
        description="Action performed"
    )
    user_id: Optional[str] = Field(default=None, description="User who performed action")
    performed_by: str = Field(..., description="System or user identifier")
    
    # Change Details
    old_value: Optional[Dict[str, Union[str, int, bool, List[str]]]] = Field(
        default=None, 
        description="Previous values"
    )
    new_value: Optional[Dict[str, Union[str, int, bool, List[str]]]] = Field(
        default=None, 
        description="New values"
    )
    
    # Context
    ip_address: Optional[str] = Field(default=None, description="Request IP address")
    user_agent: Optional[str] = Field(default=None, description="User agent string")
    environment: Optional[str] = Field(default=None, description="Environment context")
    
    # Metadata
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    reason: Optional[str] = Field(default=None, description="Reason for action")
    success: bool = Field(default=True, description="Whether action succeeded")
    error_message: Optional[str] = Field(default=None, description="Error if action failed")


# Predefined Feature Flags for Portfolio Tracker
PORTFOLIO_TRACKER_FEATURE_FLAGS = {
    "decimalMigration": FeatureFlagConfig(
        flag_name="decimal_migration",
        display_name="Financial Decimal Migration",
        description="Migrate all financial calculations from float to Decimal type for precision",
        status=FeatureFlagStatus.CANARY,
        rollout_strategy=RolloutStrategy.CANARY_USERS,
        canary_users=["dev_team_lead", "qa_lead"],
        created_by="system",
        depends_on=[],
        incompatible_with=[]
    ),
    "sqlInjectionPrevention": FeatureFlagConfig(
        flag_name="sql_injection_prevention", 
        display_name="SQL Injection Prevention",
        description="Replace raw SQL with parameterized queries",
        status=FeatureFlagStatus.DISABLED,
        rollout_strategy=RolloutStrategy.CANARY_USERS,
        created_by="system"
    ),
    "rlsPolicies": FeatureFlagConfig(
        flag_name="rls_policies",
        display_name="Row Level Security Policies", 
        description="Enable comprehensive RLS policies for data isolation",
        status=FeatureFlagStatus.DISABLED,
        rollout_strategy=RolloutStrategy.ALL_USERS,
        created_by="system"
    ),
    "typeStrictMode": FeatureFlagConfig(
        flag_name="type_strict_mode",
        display_name="Strict Type Enforcement",
        description="Enforce strict typing across backend services",
        status=FeatureFlagStatus.ENABLED,
        rollout_strategy=RolloutStrategy.ALL_USERS,
        created_by="system"
    )
}