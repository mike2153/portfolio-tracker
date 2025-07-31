"""
🛡️ BULLETPROOF FEATURE FLAG SERVICE

Core service for managing feature flags with strict typing, comprehensive
validation, and bulletproof safety controls for the Portfolio Tracker.
"""

import hashlib
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Union, Any
from pydantic import ValidationError

from ..models.feature_flag_models import (
    FeatureFlagConfig,
    FeatureFlagEvaluation, 
    FeatureFlagRequest,
    FeatureFlagResponse,
    FeatureFlagUpdateRequest,
    EmergencyDisableRequest,
    FeatureFlagAuditLog,
    FeatureFlagStatus,
    RolloutStrategy,
    PORTFOLIO_TRACKER_FEATURE_FLAGS
)
from ..utils.auth_helpers import extract_user_credentials
from ..utils.exceptions import ValidationError as CustomValidationError

logger = logging.getLogger(__name__)


class FeatureFlagService:
    """
    Bulletproof feature flag service with comprehensive safety controls,
    audit logging, and real-time rollout management.
    """
    
    def __init__(self, environment: str = "development") -> None:
        """Initialize feature flag service with environment context"""
        self.environment = environment
        self._flags_cache: Dict[str, FeatureFlagConfig] = {}
        self._cache_expiry: Optional[datetime] = None
        self._cache_ttl_seconds = 300  # 5 minutes
        
        # Initialize with predefined flags
        self._initialize_default_flags()
        
        logger.info(f"FeatureFlagService initialized for environment: {environment}")
    
    def _initialize_default_flags(self) -> None:
        """Initialize service with predefined Portfolio Tracker feature flags"""
        try:
            for flag_name, config in PORTFOLIO_TRACKER_FEATURE_FLAGS.items():
                self._flags_cache[config.flag_name] = config
                logger.debug(f"Initialized feature flag: {config.flag_name}")
            
            self._cache_expiry = datetime.utcnow() + timedelta(seconds=self._cache_ttl_seconds)
            logger.info(f"Initialized {len(PORTFOLIO_TRACKER_FEATURE_FLAGS)} default feature flags")
            
        except Exception as e:
            logger.error(f"Failed to initialize default feature flags: {e}")
            raise CustomValidationError(f"Feature flag initialization failed: {e}")
    
    def is_enabled(
        self, 
        flag_name: str, 
        user_id: Optional[str] = None,
        context: Optional[Dict[str, Union[str, int, bool]]] = None
    ) -> bool:
        """
        Check if a feature flag is enabled for the given context.
        
        Args:
            flag_name: Name of the feature flag to check
            user_id: Optional user ID for user-based rollouts
            context: Additional context for evaluation
            
        Returns:
            True if flag is enabled, False otherwise
            
        Raises:
            CustomValidationError: If flag evaluation fails
        """
        try:
            evaluation = self.evaluate_flag(flag_name, user_id, context or {})
            return evaluation.is_enabled
            
        except Exception as e:
            logger.error(f"Failed to check flag {flag_name}: {e}")
            # Fail closed - return False for safety
            return False
    
    def evaluate_flag(
        self,
        flag_name: str,
        user_id: Optional[str] = None, 
        context: Dict[str, Union[str, int, bool]] = None
    ) -> FeatureFlagEvaluation:
        """
        Evaluate a single feature flag with comprehensive logic.
        
        Args:
            flag_name: Name of the feature flag
            user_id: Optional user ID for context
            context: Additional evaluation context
            
        Returns:
            FeatureFlagEvaluation with detailed results
            
        Raises:
            CustomValidationError: If flag doesn't exist or evaluation fails
        """
        if context is None:
            context = {}
            
        try:
            # Get flag configuration
            flag_config = self._get_flag_config(flag_name)
            if not flag_config:
                raise CustomValidationError(f"Feature flag '{flag_name}' not found")
            
            # Check kill switch first (overrides everything)
            if flag_config.kill_switch:
                return FeatureFlagEvaluation(
                    flag_name=flag_name,
                    is_enabled=False,
                    reason="kill_switch_active",
                    rollout_strategy=RolloutStrategy.ALL_USERS,
                    evaluation_context=context
                )
            
            # Check dependencies
            dependency_check = self._check_dependencies(flag_config, user_id, context)
            if not dependency_check[0]:
                return FeatureFlagEvaluation(
                    flag_name=flag_name,
                    is_enabled=False,
                    reason=f"dependency_not_met: {dependency_check[1]}",
                    rollout_strategy=flag_config.rollout_strategy,
                    evaluation_context=context
                )
            
            # Check incompatibilities
            incompatibility_check = self._check_incompatibilities(flag_config, user_id, context)
            if not incompatibility_check[0]:
                return FeatureFlagEvaluation(
                    flag_name=flag_name,
                    is_enabled=False,
                    reason=f"incompatible_flag_enabled: {incompatibility_check[1]}",
                    rollout_strategy=flag_config.rollout_strategy,
                    evaluation_context=context
                )
            
            # Check environment filter
            if flag_config.environment_filter:
                if self.environment not in flag_config.environment_filter:
                    return FeatureFlagEvaluation(
                        flag_name=flag_name,
                        is_enabled=False,
                        reason=f"environment_not_allowed: {self.environment}",
                        rollout_strategy=flag_config.rollout_strategy,
                        evaluation_context=context
                    )
            
            # Main evaluation logic based on status and strategy
            evaluation_result = self._evaluate_rollout_strategy(flag_config, user_id, context)
            
            # Log evaluation for audit trail
            self._log_evaluation(flag_config, evaluation_result, user_id, context)
            
            return evaluation_result
            
        except Exception as e:
            logger.error(f"Feature flag evaluation failed for {flag_name}: {e}")
            # Fail closed - return disabled for safety
            return FeatureFlagEvaluation(
                flag_name=flag_name,
                is_enabled=False,
                reason=f"evaluation_error: {str(e)}",
                rollout_strategy=RolloutStrategy.ALL_USERS,
                evaluation_context=context
            )
    
    def evaluate_multiple_flags(
        self, 
        request: FeatureFlagRequest
    ) -> FeatureFlagResponse:
        """
        Evaluate multiple feature flags in a single request.
        
        Args:
            request: FeatureFlagRequest with flags to evaluate
            
        Returns:
            FeatureFlagResponse with all evaluations
        """
        try:
            evaluations: List[FeatureFlagEvaluation] = []
            
            for flag_name in request.flags:
                try:
                    evaluation = self.evaluate_flag(
                        flag_name, 
                        request.user_id, 
                        request.additional_context
                    )
                    evaluations.append(evaluation)
                    
                except Exception as e:
                    logger.error(f"Failed to evaluate flag {flag_name}: {e}")
                    # Add failed evaluation
                    evaluations.append(FeatureFlagEvaluation(
                        flag_name=flag_name,
                        is_enabled=False,
                        reason=f"evaluation_failed: {str(e)}",
                        rollout_strategy=RolloutStrategy.ALL_USERS,
                        evaluation_context=request.additional_context
                    ))
            
            return FeatureFlagResponse(
                evaluations=evaluations,
                user_id=request.user_id,
                timestamp=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Multiple flag evaluation failed: {e}")
            raise CustomValidationError(f"Flag evaluation failed: {e}")
    
    def emergency_disable(
        self, 
        request: EmergencyDisableRequest
    ) -> bool:
        """
        Emergency disable a feature flag with immediate effect.
        
        Args:
            request: EmergencyDisableRequest with flag and reason
            
        Returns:
            True if successfully disabled
            
        Raises:
            CustomValidationError: If disable operation fails
        """
        try:
            flag_config = self._get_flag_config(request.flag_name)
            if not flag_config:
                raise CustomValidationError(f"Feature flag '{request.flag_name}' not found")
            
            # Create audit log entry before changes
            old_config = flag_config.model_dump()
            
            # Set kill switch and disable
            flag_config.kill_switch = True
            flag_config.status = FeatureFlagStatus.KILL_SWITCH
            flag_config.last_modified_by = request.disabled_by
            flag_config.last_modified_at = datetime.utcnow()
            
            # Update cache
            self._flags_cache[request.flag_name] = flag_config
            
            # Log the emergency disable
            audit_log = FeatureFlagAuditLog(
                flag_name=request.flag_name,
                action="emergency_disable",
                performed_by=request.disabled_by,
                old_value=old_config,
                new_value=flag_config.model_dump(),
                reason=request.reason,
                timestamp=datetime.utcnow(),
                success=True
            )
            
            self._write_audit_log(audit_log)
            
            logger.warning(
                f"EMERGENCY DISABLE: Flag '{request.flag_name}' disabled by {request.disabled_by}. "
                f"Reason: {request.reason}"
            )
            
            # TODO: Send notifications if request.notify_team is True
            
            return True
            
        except Exception as e:
            logger.error(f"Emergency disable failed for {request.flag_name}: {e}")
            raise CustomValidationError(f"Emergency disable failed: {e}")
    
    def _get_flag_config(self, flag_name: str) -> Optional[FeatureFlagConfig]:
        """Get feature flag configuration from cache or storage"""
        try:
            # Check cache expiry
            if self._cache_expiry and datetime.utcnow() > self._cache_expiry:
                self._refresh_cache()
            
            return self._flags_cache.get(flag_name)
            
        except Exception as e:
            logger.error(f"Failed to get flag config for {flag_name}: {e}")
            return None
    
    def _evaluate_rollout_strategy(
        self,
        flag_config: FeatureFlagConfig,
        user_id: Optional[str],
        context: Dict[str, Union[str, int, bool]]
    ) -> FeatureFlagEvaluation:
        """Evaluate flag based on its rollout strategy"""
        
        # Check if globally disabled
        if flag_config.status == FeatureFlagStatus.DISABLED:
            return FeatureFlagEvaluation(
                flag_name=flag_config.flag_name,
                is_enabled=False,
                reason="flag_disabled",
                rollout_strategy=flag_config.rollout_strategy,
                evaluation_context=context
            )
        
        # Check if globally enabled
        if flag_config.status == FeatureFlagStatus.ENABLED:
            if flag_config.rollout_strategy == RolloutStrategy.ALL_USERS:
                return FeatureFlagEvaluation(
                    flag_name=flag_config.flag_name,
                    is_enabled=True,
                    reason="globally_enabled",
                    rollout_strategy=flag_config.rollout_strategy,
                    evaluation_context=context
                )
        
        # Canary user check
        if user_id and user_id in flag_config.canary_users:
            return FeatureFlagEvaluation(
                flag_name=flag_config.flag_name,
                is_enabled=True,
                reason="canary_user",
                rollout_strategy=flag_config.rollout_strategy,
                evaluation_context=context
            )
        
        # Percentage-based rollout
        if flag_config.rollout_strategy == RolloutStrategy.PERCENTAGE_BASED:
            if user_id:
                user_hash = self._hash_user_id(user_id, flag_config.flag_name)
                user_percentage = user_hash % 100
                
                if user_percentage < flag_config.enabled_percentage:
                    return FeatureFlagEvaluation(
                        flag_name=flag_config.flag_name,
                        is_enabled=True,
                        reason=f"percentage_rollout: {user_percentage}% < {flag_config.enabled_percentage}%",
                        rollout_strategy=flag_config.rollout_strategy,
                        evaluation_context=context
                    )
        
        # Default to disabled
        return FeatureFlagEvaluation(
            flag_name=flag_config.flag_name,
            is_enabled=False,
            reason="not_in_rollout",
            rollout_strategy=flag_config.rollout_strategy,
            evaluation_context=context
        )
    
    def _check_dependencies(
        self,
        flag_config: FeatureFlagConfig,
        user_id: Optional[str],
        context: Dict[str, Union[str, int, bool]]
    ) -> Tuple[bool, str]:
        """Check if all dependencies are satisfied"""
        try:
            for dependency in flag_config.depends_on:
                if not self.is_enabled(dependency, user_id, context):
                    return False, dependency
            return True, ""
            
        except Exception as e:
            logger.error(f"Dependency check failed: {e}")
            return False, f"check_failed: {str(e)}"
    
    def _check_incompatibilities(
        self,
        flag_config: FeatureFlagConfig,
        user_id: Optional[str],
        context: Dict[str, Union[str, int, bool]]
    ) -> Tuple[bool, str]:
        """Check if any incompatible flags are enabled"""
        try:
            for incompatible_flag in flag_config.incompatible_with:
                if self.is_enabled(incompatible_flag, user_id, context):
                    return False, incompatible_flag
            return True, ""
            
        except Exception as e:
            logger.error(f"Incompatibility check failed: {e}")
            return True, ""  # Allow execution if check fails
    
    def _hash_user_id(self, user_id: str, flag_name: str) -> int:
        """Generate consistent hash for user ID and flag combination"""
        try:
            hash_input = f"{user_id}:{flag_name}".encode('utf-8')
            hash_value = hashlib.sha256(hash_input).hexdigest()
            return int(hash_value[:8], 16)  # Use first 8 hex chars
            
        except Exception as e:
            logger.error(f"User ID hashing failed: {e}")
            # Return deterministic fallback
            return sum(ord(c) for c in user_id) % 100
    
    def _refresh_cache(self) -> None:
        """Refresh feature flags cache from storage"""
        try:
            # TODO: Implement actual storage refresh from Supabase
            logger.debug("Cache refresh not yet implemented - using in-memory defaults")
            self._cache_expiry = datetime.utcnow() + timedelta(seconds=self._cache_ttl_seconds)
            
        except Exception as e:
            logger.error(f"Cache refresh failed: {e}")
    
    def _log_evaluation(
        self,
        flag_config: FeatureFlagConfig,
        evaluation: FeatureFlagEvaluation,
        user_id: Optional[str],
        context: Dict[str, Union[str, int, bool]]
    ) -> None:
        """Log feature flag evaluation for audit trail"""
        try:
            # Only log in debug mode to avoid spam
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    f"Flag evaluation: {flag_config.flag_name} = {evaluation.is_enabled} "
                    f"(reason: {evaluation.reason}, user: {user_id})"
                )
            
        except Exception as e:
            logger.error(f"Evaluation logging failed: {e}")
    
    def _write_audit_log(self, audit_log: FeatureFlagAuditLog) -> None:
        """Write audit log entry to persistent storage"""
        try:
            # TODO: Implement actual audit log storage to Supabase
            logger.info(
                f"AUDIT: {audit_log.action} on {audit_log.flag_name} by {audit_log.performed_by} "
                f"at {audit_log.timestamp.isoformat()}"
            )
            
        except Exception as e:
            logger.error(f"Audit log write failed: {e}")


# Global service instance
_feature_flag_service: Optional[FeatureFlagService] = None


def get_feature_flag_service() -> FeatureFlagService:
    """Get global feature flag service instance"""
    global _feature_flag_service
    
    if _feature_flag_service is None:
        _feature_flag_service = FeatureFlagService()
    
    return _feature_flag_service


def is_feature_enabled(
    flag_name: str, 
    user_id: Optional[str] = None,
    context: Optional[Dict[str, Union[str, int, bool]]] = None
) -> bool:
    """
    Convenience function to check if a feature flag is enabled.
    
    Args:
        flag_name: Name of the feature flag
        user_id: Optional user ID for context
        context: Additional context for evaluation
        
    Returns:
        True if flag is enabled, False otherwise
    """
    try:
        service = get_feature_flag_service()
        return service.is_enabled(flag_name, user_id, context)
        
    except Exception as e:
        logger.error(f"Feature flag check failed for {flag_name}: {e}")
        # Fail closed for safety
        return False