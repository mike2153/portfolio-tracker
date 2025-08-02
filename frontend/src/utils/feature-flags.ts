/**
 * 🛡️ BULLETPROOF FEATURE FLAG SYSTEM
 * 
 * Provides safe rollouts, dark shipping, canary releases, and instant rollback
 * for bulletproof deployment safety in the Portfolio Tracker system.
 * 
 * Usage:
 *   const isEnabled = useFeatureFlag('newPortfolioView');
 *   if (isEnabled) { // render new feature }
 */

import { useState, useEffect, useCallback } from 'react';

// Feature flags available in the Portfolio Tracker
export interface FeatureFlags {
  // Phase 1 Security Features
  decimalMigration: boolean;
  errorBoundaries: boolean;
  typeStrictMode: boolean;
  
  // Phase 2 Architecture Features  
  newPortfolioView: boolean;
  enhancedCharts: boolean;
  componentLibrary: boolean;
  reactQueryStandard: boolean;
  
  // Phase 3 Polish Features
  mobileOptimizations: boolean;
  performanceMode: boolean;
  loadingStates: boolean;
  realTimeUpdates: boolean;
  
  // Development & Testing
  debugMode: boolean;
  mockDataMode: boolean;
}

// Rollout configuration for gradual feature deployment
export interface RolloutConfig {
  canaryUsers: string[];          // Users who get immediate access
  rolloutPercentage: number;      // Percentage of users who see the feature
  killSwitch: boolean;           // Emergency disable (overrides everything)
  startDate?: string;            // When rollout begins
  endDate?: string;              // When rollout should complete
  description?: string;          // What this feature does
}

// A/B test configuration
export interface ABTestConfig {
  enabled: boolean;
  variantA: string;              // Description of variant A
  variantB: string;              // Description of variant B
  trafficSplit: number;          // Percentage going to variant B (0-100)
}

// Complete feature configuration
export interface FeatureConfig {
  rollout: RolloutConfig;
  abTest?: ABTestConfig;
  dependencies?: (keyof FeatureFlags)[];  // Features this depends on
  incompatible?: (keyof FeatureFlags)[];  // Features incompatible with this
}

class FeatureFlagManager {
  private flags: FeatureFlags;
  private config: Record<keyof FeatureFlags, FeatureConfig>;
  private userId: string;
  private userHash: number;
  
  // Storage keys
  private readonly STORAGE_KEY_FLAGS = 'portfolioTracker_featureFlags';
  private readonly STORAGE_KEY_CONFIG = 'portfolioTracker_flagConfig';
  private readonly STORAGE_KEY_USER = 'portfolioTracker_userId';
  
  constructor(userId?: string) {
    this.userId = userId || this.getOrCreateUserId();
    this.userHash = this.hashUserId(this.userId);
    this.flags = this.loadFlags();
    this.config = this.loadConfig();
    
    // Initialize default configurations on first run
    this.initializeDefaultConfigs();
  }
  
  /**
   * Check if a feature flag is enabled for the current user
   */
  isEnabled(flag: keyof FeatureFlags): boolean {
    const flagConfig = this.config[flag];
    
    // Emergency kill switch - overrides everything
    if (flagConfig.rollout.killSwitch) {
      this.logFlagUsage(flag, false, 'kill_switch_active');
      return false;
    }
    
    // Check dependencies - all must be enabled
    if (flagConfig.dependencies) {
      const dependenciesMet = flagConfig.dependencies.every(dep => this.isEnabled(dep));
      if (!dependenciesMet) {
        this.logFlagUsage(flag, false, 'dependencies_not_met');
        return false;
      }
    }
    
    // Check incompatible features - none should be enabled
    if (flagConfig.incompatible) {
      const hasIncompatible = flagConfig.incompatible.some(incomp => this.isEnabled(incomp));
      if (hasIncompatible) {
        this.logFlagUsage(flag, false, 'incompatible_feature_active');
        return false;
      }
    }
    
    // Check date-based rollout
    if (flagConfig.rollout.startDate) {
      const startDate = new Date(flagConfig.rollout.startDate);
      if (new Date() < startDate) {
        this.logFlagUsage(flag, false, 'before_start_date');
        return false;
      }
    }
    
    if (flagConfig.rollout.endDate) {
      const endDate = new Date(flagConfig.rollout.endDate);
      if (new Date() > endDate) {
        this.logFlagUsage(flag, false, 'after_end_date');
        return false;
      }
    }
    
    // Canary users get immediate access
    if (flagConfig.rollout.canaryUsers.includes(this.userId)) {
      this.logFlagUsage(flag, true, 'canary_user');
      return true;
    }
    
    // Percentage-based rollout
    const rolloutEnabled = (this.userHash % 100) < flagConfig.rollout.rolloutPercentage;
    
    if (rolloutEnabled) {
      this.logFlagUsage(flag, true, 'percentage_rollout');
      return true;
    }
    
    this.logFlagUsage(flag, false, 'percentage_rollout_excluded');
    return false;
  }
  
  /**
   * Get A/B test variant for a feature (A or B)
   */
  getABVariant(flag: keyof FeatureFlags): 'A' | 'B' {
    if (!this.isEnabled(flag)) {
      return 'A'; // Default to variant A if feature not enabled
    }
    
    const flagConfig = this.config[flag];
    if (!flagConfig.abTest?.enabled) {
      return 'A'; // No A/B test configured
    }
    
    // Use separate hash for A/B testing to avoid correlation with rollout
    const abHash = this.hashString(`${this.userId}_${flag}_ab`);
    const isVariantB = (abHash % 100) < flagConfig.abTest.trafficSplit;
    
    const variant = isVariantB ? 'B' : 'A';
    this.logABTest(flag, variant);
    
    return variant;
  }
  
  /**
   * Dark ship a feature (deploy but keep disabled)
   */
  darkShip(flag: keyof FeatureFlags, enabled: boolean = false): void {
    const config = this.config[flag];
    config.rollout.rolloutPercentage = enabled ? 100 : 0;
    config.rollout.killSwitch = !enabled;
    
    this.saveConfig();
    this.logAdminAction('dark_ship', flag, { enabled });
  }
  
  /**
   * Start canary rollout to specific users
   */
  canaryRollout(flag: keyof FeatureFlags, userIds: string[]): void {
    const config = this.config[flag];
    config.rollout.canaryUsers = [...new Set([...config.rollout.canaryUsers, ...userIds])];
    config.rollout.killSwitch = false;
    
    this.saveConfig();
    this.logAdminAction('canary_rollout', flag, { userIds });
  }
  
  /**
   * Gradually increase rollout percentage
   */
  gradualRollout(flag: keyof FeatureFlags, percentage: number): void {
    const config = this.config[flag];
    config.rollout.rolloutPercentage = Math.min(100, Math.max(0, percentage));
    config.rollout.killSwitch = false;
    
    this.saveConfig();
    this.logAdminAction('gradual_rollout', flag, { percentage });
  }
  
  /**
   * Emergency disable - instant rollback
   */
  emergencyDisable(flag: keyof FeatureFlags, reason?: string): void {
    const config = this.config[flag];
    config.rollout.killSwitch = true;
    config.rollout.rolloutPercentage = 0;
    
    this.saveConfig();
    this.logAdminAction('emergency_disable', flag, { reason });
    
    // Also disable all dependent features
    Object.entries(this.config).forEach(([otherFlag, otherConfig]) => {
      if (otherConfig.dependencies?.includes(flag)) {
        this.emergencyDisable(otherFlag as keyof FeatureFlags, `Dependency ${flag} disabled`);
      }
    });
  }
  
  /**
   * Enable A/B testing for a feature
   */
  enableABTest(flag: keyof FeatureFlags, config: ABTestConfig): void {
    this.config[flag].abTest = config;
    this.saveConfig();
    this.logAdminAction('enable_ab_test', flag, config);
  }
  
  /**
   * Get all feature flag statuses for current user
   */
  getAllFlags(): Record<keyof FeatureFlags, boolean> {
    const result = {} as Record<keyof FeatureFlags, boolean>;
    
    Object.keys(this.flags).forEach(flag => {
      result[flag as keyof FeatureFlags] = this.isEnabled(flag as keyof FeatureFlags);
    });
    
    return result;
  }
  
  /**
   * Get configuration for admin dashboard
   */
  getAdminConfig(): Record<keyof FeatureFlags, FeatureConfig> {
    return { ...this.config };
  }
  
  /**
   * Update feature configuration (admin only)
   */
  updateConfig(flag: keyof FeatureFlags, newConfig: Partial<FeatureConfig>): void {
    this.config[flag] = { ...this.config[flag], ...newConfig };
    this.saveConfig();
    this.logAdminAction('update_config', flag, newConfig);
  }
  
  // Private helper methods
  
  private getOrCreateUserId(): string {
    let userId = localStorage.getItem(this.STORAGE_KEY_USER);
    
    if (!userId) {
      // Try to get from auth context or generate
      userId = this.generateUserId();
      localStorage.setItem(this.STORAGE_KEY_USER, userId);
    }
    
    return userId;
  }
  
  private generateUserId(): string {
    // In a real app, this would come from authentication
    // For now, generate a persistent anonymous ID
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  private hashUserId(userId: string): number {
    return this.hashString(userId);
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private loadFlags(): FeatureFlags {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_FLAGS);
      if (stored) {
        return { ...this.getDefaultFlags(), ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load feature flags from storage:', e);
    }
    
    return this.getDefaultFlags();
  }
  
  private loadConfig(): Record<keyof FeatureFlags, FeatureConfig> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (stored) {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load feature flag config from storage:', e);
    }
    
    return this.getDefaultConfig();
  }
  
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save feature flag config:', e);
    }
  }
  
  private getDefaultFlags(): FeatureFlags {
    return {
      // Phase 1 Security Features (start disabled)
      decimalMigration: false,
      errorBoundaries: false,
      typeStrictMode: false,
      
      // Phase 2 Architecture Features (start disabled)
      newPortfolioView: false,
      enhancedCharts: false,
      componentLibrary: false,
      reactQueryStandard: false,
      
      // Phase 3 Polish Features (start disabled)
      mobileOptimizations: false,
      performanceMode: false,
      loadingStates: false,
      realTimeUpdates: false,
      
      // Development & Testing (configurable)
      debugMode: process.env.NODE_ENV === 'development',
      mockDataMode: false,
    };
  }
  
  private getDefaultConfig(): Record<keyof FeatureFlags, FeatureConfig> {
    const defaultRollout: RolloutConfig = {
      canaryUsers: [],
      rolloutPercentage: 0,
      killSwitch: false,
    };
    
    return {
      // Phase 1 Security Features
      decimalMigration: {
        rollout: { ...defaultRollout, description: 'Financial calculations using Decimal type' },
      },
      errorBoundaries: {
        rollout: { ...defaultRollout, description: 'Error boundaries for crash prevention' },
        dependencies: ['decimalMigration'],
      },
      typeStrictMode: {
        rollout: { 
          ...defaultRollout, 
          description: 'Strict TypeScript mode enforcement with zero tolerance for type errors',
          canaryUsers: ['dev_team_lead', 'qa_lead'], // Initial canary users for Phase 1
          rolloutPercentage: 0, // 0% general rollout - canary only
          killSwitch: false, // Enabled for canary testing
          startDate: new Date().toISOString(), // Start immediately
        },
      },
      
      // Phase 2 Architecture Features
      newPortfolioView: {
        rollout: { ...defaultRollout, description: 'Redesigned portfolio dashboard' },
        dependencies: ['errorBoundaries', 'componentLibrary'],
        abTest: {
          enabled: false,
          variantA: 'Current portfolio view',
          variantB: 'New consolidated view',
          trafficSplit: 50,
        },
      },
      enhancedCharts: {
        rollout: { ...defaultRollout, description: 'Interactive portfolio charts' },
        dependencies: ['componentLibrary'],
      },
      componentLibrary: {
        rollout: { ...defaultRollout, description: 'Consolidated component library' },
      },
      reactQueryStandard: {
        rollout: { ...defaultRollout, description: 'Standardized API calls via React Query' },
      },
      
      // Phase 3 Polish Features
      mobileOptimizations: {
        rollout: { ...defaultRollout, description: 'Mobile-responsive optimizations' },
        dependencies: ['componentLibrary'],
      },
      performanceMode: {
        rollout: { ...defaultRollout, description: 'Performance-optimized rendering' },
      },
      loadingStates: {
        rollout: { ...defaultRollout, description: 'Consistent loading indicators' },
        dependencies: ['componentLibrary'],
      },
      realTimeUpdates: {
        rollout: { ...defaultRollout, description: 'Real-time portfolio updates' },
        dependencies: ['reactQueryStandard'],
      },
      
      // Development & Testing
      debugMode: {
        rollout: {
          canaryUsers: [],
          rolloutPercentage: process.env.NODE_ENV === 'development' ? 100 : 0,
          killSwitch: false,
          description: 'Debug logging and development tools',
        },
      },
      mockDataMode: {
        rollout: { ...defaultRollout, description: 'Use mock data instead of API calls' },
        incompatible: ['realTimeUpdates'],
      },
    };
  }
  
  private initializeDefaultConfigs(): void {
    // Only initialize if storage is empty
    const hasStoredConfig = localStorage.getItem(this.STORAGE_KEY_CONFIG);
    if (!hasStoredConfig) {
      this.saveConfig();
    }
  }
  
  private logFlagUsage(flag: keyof FeatureFlags, enabled: boolean, reason: string): void {
    if (this.isEnabled('debugMode')) {
      console.log(`🚩 Feature Flag: ${flag} = ${enabled} (${reason})`);
    }
    
    // In production, this would send to analytics
    // analytics.track('feature_flag_usage', { flag, enabled, reason, userId: this.userId });
  }
  
  private logABTest(flag: keyof FeatureFlags, variant: 'A' | 'B'): void {
    if (this.isEnabled('debugMode')) {
      console.log(`🧪 A/B Test: ${flag} = Variant ${variant}`);
    }
    
    // In production, this would send to analytics
    // analytics.track('ab_test_variant', { flag, variant, userId: this.userId });
  }
  
  private logAdminAction(action: string, flag: keyof FeatureFlags, data: unknown): void {
    console.log(`👑 Admin Action: ${action} on ${flag}`, data);
    
    // In production, this would send to audit log
    // auditLog.record('feature_flag_admin', { action, flag, data, userId: this.userId, timestamp: new Date().toISOString() });
  }
}

// Global instance
let globalFlagManager: FeatureFlagManager | null = null;

/**
 * Initialize feature flag system with user ID
 */
export function initializeFeatureFlags(userId?: string): void {
  globalFlagManager = new FeatureFlagManager(userId);
}

/**
 * Get feature flag manager instance
 */
export function getFeatureFlagManager(): FeatureFlagManager {
  if (!globalFlagManager) {
    globalFlagManager = new FeatureFlagManager();
  }
  return globalFlagManager;
}

/**
 * React hook for using feature flags
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const [isEnabled, setIsEnabled] = useState(() => {
    return getFeatureFlagManager().isEnabled(flag);
  });
  
  // Re-evaluate when dependencies might have changed
  useEffect(() => {
    const manager = getFeatureFlagManager();
    const newValue = manager.isEnabled(flag);
    
    if (newValue !== isEnabled) {
      setIsEnabled(newValue);
    }
  }, [flag, isEnabled]);
  
  return isEnabled;
}

/**
 * React hook for A/B testing
 */
export function useABTest(flag: keyof FeatureFlags): 'A' | 'B' {
  const [variant, setVariant] = useState(() => {
    return getFeatureFlagManager().getABVariant(flag);
  });
  
  const isEnabled = useFeatureFlag(flag);
  
  useEffect(() => {
    const manager = getFeatureFlagManager();
    const newVariant = manager.getABVariant(flag);
    
    if (newVariant !== variant) {
      setVariant(newVariant);
    }
  }, [flag, isEnabled, variant]);
  
  return variant;
}

/**
 * React hook for getting all feature flags
 */
export function useAllFeatureFlags(): Record<keyof FeatureFlags, boolean> {
  const [flags, setFlags] = useState(() => {
    return getFeatureFlagManager().getAllFlags();
  });
  
  const updateFlags = useCallback(() => {
    const newFlags = getFeatureFlagManager().getAllFlags();
    setFlags(newFlags);
  }, []);
  
  // Update flags periodically (in case of config changes)
  useEffect(() => {
    const interval = setInterval(updateFlags, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [updateFlags]);
  
  return flags;
}

/**
 * Admin functions (would normally be protected by auth)
 */
export const FeatureFlagAdmin = {
  /**
   * Dark ship a feature
   */
  darkShip: (flag: keyof FeatureFlags, enabled: boolean = false) => {
    getFeatureFlagManager().darkShip(flag, enabled);
  },
  
  /**
   * Add users to canary rollout
   */
  canaryRollout: (flag: keyof FeatureFlags, userIds: string[]) => {
    getFeatureFlagManager().canaryRollout(flag, userIds);
  },
  
  /**
   * Set rollout percentage
   */
  gradualRollout: (flag: keyof FeatureFlags, percentage: number) => {
    getFeatureFlagManager().gradualRollout(flag, percentage);
  },
  
  /**
   * Emergency disable
   */
  emergencyDisable: (flag: keyof FeatureFlags, reason?: string) => {
    getFeatureFlagManager().emergencyDisable(flag, reason);
  },
  
  /**
   * Enable A/B testing
   */
  enableABTest: (flag: keyof FeatureFlags, config: ABTestConfig) => {
    getFeatureFlagManager().enableABTest(flag, config);
  },
  
  /**
   * Get admin configuration
   */
  getConfig: () => {
    return getFeatureFlagManager().getAdminConfig();
  },
  
  /**
   * Update feature configuration
   */
  updateConfig: (flag: keyof FeatureFlags, config: Partial<FeatureConfig>) => {
    getFeatureFlagManager().updateConfig(flag, config);
  },
};