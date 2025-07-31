/**
 * 🛡️ BULLETPROOF FEATURE FLAG PROVIDER
 * 
 * React context provider for feature flags with automatic initialization
 * and user management for the Portfolio Tracker system.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  initializeFeatureFlags, 
  getFeatureFlagManager, 
  FeatureFlags, 
  FeatureConfig 
} from '../utils/feature-flags';

interface FeatureFlagContextType {
  isInitialized: boolean;
  userId: string | null;
  flags: Record<keyof FeatureFlags, boolean>;
  refreshFlags: () => void;
  getConfig: () => Record<keyof FeatureFlags, FeatureConfig>;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

interface FeatureFlagProviderProps {
  children: ReactNode;
  userId?: string;
  mockFlags?: Partial<Record<keyof FeatureFlags, boolean>>;
}

/**
 * Feature Flag Provider Component
 * 
 * Provides feature flag context to all child components with automatic
 * initialization and user management.
 */
export function FeatureFlagProvider({ 
  children, 
  userId, 
  mockFlags 
}: FeatureFlagProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [flags, setFlags] = useState<Record<keyof FeatureFlags, boolean>>(() => {
    // Initialize with safe defaults until real flags are loaded
    const manager = getFeatureFlagManager();
    return manager ? manager.getAllFlags() : {} as Record<keyof FeatureFlags, boolean>;
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Initialize feature flags
  useEffect(() => {
    const initFlags = async () => {
      try {
        // Initialize with provided user ID or let system generate one
        initializeFeatureFlags(userId);
        
        const manager = getFeatureFlagManager();
        const initialFlags = manager.getAllFlags();
        
        // Apply mock flags if provided (for testing)
        const finalFlags = mockFlags ? { ...initialFlags, ...mockFlags } : initialFlags;
        
        setFlags(finalFlags);
        setCurrentUserId(userId || 'anonymous');
        setIsInitialized(true);
        
        console.log('🚩 Feature flags initialized:', finalFlags);
        
      } catch (error) {
        console.error('Failed to initialize feature flags:', error);
        // Fallback to safe defaults
        setFlags({
          decimalMigration: false,
          errorBoundaries: false,
          typeStrictMode: false,
          newPortfolioView: false,
          enhancedCharts: false,
          componentLibrary: false,
          reactQueryStandard: false,
          mobileOptimizations: false,
          performanceMode: false,
          loadingStates: false,
          realTimeUpdates: false,
          debugMode: process.env.NODE_ENV === 'development',
          mockDataMode: false,
        } as Record<keyof FeatureFlags, boolean>);
        setIsInitialized(true);
      }
    };

    initFlags();
  }, [userId, mockFlags]);

  // Refresh flags function
  const refreshFlags = () => {
    if (isInitialized) {
      const manager = getFeatureFlagManager();
      const newFlags = manager.getAllFlags();
      const finalFlags = mockFlags ? { ...newFlags, ...mockFlags } : newFlags;
      setFlags(finalFlags);
    }
  };

  // Get configuration function
  const getConfig = () => {
    if (isInitialized) {
      return getFeatureFlagManager().getAdminConfig();
    }
    return {} as Record<keyof FeatureFlags, FeatureConfig>;
  };

  // Periodically refresh flags to pick up config changes
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(refreshFlags, 60000); // Every minute
    return () => clearInterval(interval);
  }, [isInitialized, mockFlags]);

  const contextValue: FeatureFlagContextType = {
    isInitialized,
    userId: currentUserId,
    flags,
    refreshFlags,
    getConfig,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flag context
 */
export function useFeatureFlagContext(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  
  if (context === undefined) {
    throw new Error('useFeatureFlagContext must be used within a FeatureFlagProvider');
  }
  
  return context;
}

/**
 * Component that conditionally renders children based on feature flag
 */
interface FeatureGateProps {
  flag: keyof FeatureFlags;
  children: ReactNode;
  fallback?: ReactNode;
  variant?: 'A' | 'B';
}

export function FeatureGate({ flag, children, fallback = null, variant }: FeatureGateProps) {
  const { flags, isInitialized } = useFeatureFlagContext();
  
  // Don't render anything until flags are initialized
  if (!isInitialized) {
    return null;
  }
  
  const isEnabled = flags[flag];
  
  // Handle A/B testing variant
  if (variant && isEnabled) {
    const manager = getFeatureFlagManager();
    const currentVariant = manager.getABVariant(flag);
    
    if (currentVariant !== variant) {
      return <>{fallback}</>;
    }
  }
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Higher-order component for feature flag gating
 */
export function withFeatureFlag<P extends object>(
  flag: keyof FeatureFlags,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    return (
      <FeatureGate 
        flag={flag} 
        fallback={FallbackComponent ? <FallbackComponent {...props} /> : null}
      >
        <Component {...props} />
      </FeatureGate>
    );
  };
}

/**
 * Development-only component for feature flag debugging
 */
export function FeatureFlagDebugger() {
  const { flags, isInitialized, userId, getConfig } = useFeatureFlagContext();
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !flags.debugMode) {
    return null;
  }
  
  if (!isInitialized) {
    return (
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: '#333',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        zIndex: 9999,
      }}>
        🚩 Initializing feature flags...
      </div>
    );
  }
  
  const [isExpanded, setIsExpanded] = useState(false);
  
  const enabledFlags = Object.entries(flags).filter(([_, enabled]) => enabled);
  const config = getConfig();
  
  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: '#333',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: isExpanded ? '400px' : '200px',
      cursor: 'pointer',
    }} onClick={() => setIsExpanded(!isExpanded)}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
        🚩 Feature Flags ({enabledFlags.length} active)
      </div>
      
      <div>User: {userId}</div>
      
      {isExpanded && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Active Flags:</div>
          {enabledFlags.length === 0 ? (
            <div style={{ fontStyle: 'italic', color: '#888' }}>None active</div>
          ) : (
            enabledFlags.map(([flag, enabled]) => (
              <div key={flag} style={{ marginBottom: '2px' }}>
                ✅ {flag}
                {config[flag as keyof FeatureFlags]?.rollout.description && (
                  <div style={{ fontSize: '10px', color: '#ccc', marginLeft: '15px' }}>
                    {config[flag as keyof FeatureFlags].rollout.description}
                  </div>
                )}
              </div>
            ))
          )}
          
          <div style={{ marginTop: '10px', fontSize: '10px', color: '#888' }}>
            Click to collapse
          </div>
        </div>
      )}
      
      {!isExpanded && (
        <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
          Click to expand
        </div>
      )}
    </div>
  );
}