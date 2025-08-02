/**
 * 🛡️ TYPE SAFETY WRAPPER
 * 
 * Wraps components with bulletproof type safety features,
 * providing gradual rollout and emergency fallback capabilities.
 */

import React, { ReactNode, Component, ErrorInfo } from 'react';
import { FeatureGate } from './FeatureFlagProvider';
import { DashboardErrorState, DashboardErrorActions as _DashboardErrorActions } from '@/types/dashboard';

interface TypeSafetyWrapperProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<Record<string, unknown>>;
  featureFlag: 'typeStrictMode' | 'errorBoundaries';
  componentName: string;
}

/**
 * Error boundary specifically for type safety migration
 */
class TypeSafetyErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    onError: (error: Error, errorInfo: ErrorInfo) => void;
  },
  DashboardErrorState
> {
  constructor(props: {
    children: ReactNode;
    fallback: ReactNode;
    onError: (error: Error, errorInfo: ErrorInfo) => void;
  }) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): DashboardErrorState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      hasError: true,
      error,
      errorInfo: {
        componentStack: errorInfo.componentStack ?? '',
      },
    });

    this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Fallback component for type safety errors
 */
const TypeSafetyFallback: React.FC<{
  componentName: string;
  error?: Error;
  onRetry: () => void;
}> = ({ componentName, error, onRetry }) => (
  <div className="rounded-xl bg-yellow-900/20 border border-yellow-800 p-6 shadow-lg">
    <h3 className="text-lg font-semibold text-yellow-400">
      Component Temporarily Unavailable
    </h3>
    <p className="text-sm text-yellow-300 mt-2">
      The {componentName} component is being upgraded with enhanced type safety.
    </p>
    {error && (
      <details className="mt-4">
        <summary className="text-xs text-yellow-400 cursor-pointer hover:text-yellow-300">
          Technical Details
        </summary>
        <pre className="text-xs text-yellow-500 mt-2 overflow-auto">
          {error.message}
        </pre>
      </details>
    )}
    <button
      onClick={onRetry}
      className="mt-4 px-4 py-2 bg-yellow-600 text-yellow-100 rounded hover:bg-yellow-500 text-sm"
    >
      Try Again
    </button>
  </div>
);

/**
 * Main type safety wrapper component
 */
export const TypeSafetyWrapper: React.FC<TypeSafetyWrapperProps> = ({
  children,
  fallbackComponent: FallbackComponent,
  featureFlag,
  componentName,
}) => {
  // Feature flag is handled by FeatureGate component
  const [retryKey, setRetryKey] = React.useState(0);

  const handleError = React.useCallback((error: Error, errorInfo: ErrorInfo) => {
    console.error(`Type safety error in ${componentName}:`, error, errorInfo);
    
    // Report to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // analytics.reportError('type_safety_error', {
      //   component: componentName,
      //   error: error.message,
      //   stack: error.stack,
      //   componentStack: errorInfo.componentStack,
      // });
    }
  }, [componentName]);

  const handleRetry = React.useCallback(() => {
    setRetryKey(prev => prev + 1);
  }, []);

  // Feature flag gating
  return (
    <FeatureGate
      flag={featureFlag}
      fallback={
        FallbackComponent ? (
          <FallbackComponent />
        ) : (
          <TypeSafetyFallback 
            componentName={componentName}
            onRetry={handleRetry}
          />
        )
      }
    >
      <TypeSafetyErrorBoundary
        key={retryKey}
        fallback={
          <TypeSafetyFallback 
            componentName={componentName}
            onRetry={handleRetry}
          />
        }
        onError={handleError}
      >
        {children}
      </TypeSafetyErrorBoundary>
    </FeatureGate>
  );
};

/**
 * Higher-order component for easy wrapping
 */
export function withTypeSafety<P extends object>(
  Component: React.ComponentType<P>,
  config: {
    featureFlag: 'typeStrictMode' | 'errorBoundaries';
    componentName: string;
    fallbackComponent?: React.ComponentType<P>;
  }
) {
  return function TypeSafeComponent(props: P) {
    return (
      <TypeSafetyWrapper
        featureFlag={config.featureFlag}
        componentName={config.componentName}
        {...(config.fallbackComponent && { fallbackComponent: config.fallbackComponent as React.ComponentType<Record<string, unknown>> })}
      >
        <Component {...props} />
      </TypeSafetyWrapper>
    );
  };
}

/**
 * Hook for components to report type safety metrics
 */
export function useTypeSafetyMetrics(componentName: string) {
  const [renderCount, setRenderCount] = React.useState(0);
  const [errorCount, setErrorCount] = React.useState(0);

  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);

  const reportTypeError = React.useCallback((error: Error, context?: string) => {
    setErrorCount(prev => prev + 1);
    
    console.warn(`Type safety issue in ${componentName}:`, {
      error: error.message,
      context,
      renderCount,
    });

    // In production, send to analytics
    if (process.env.NODE_ENV === 'production') {
      // analytics.track('type_safety_issue', {
      //   component: componentName,
      //   error: error.message,
      //   context,
      //   renderCount,
      // });
    }
  }, [componentName, renderCount]);

  return {
    renderCount,
    errorCount,
    reportTypeError,
  };
}

/**
 * Development-only type checker component
 */
export const TypeSafetyDebugger: React.FC<{
  data: unknown;
  expectedType: string;
  componentName: string;
}> = ({ data, expectedType, componentName }) => {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const actualType = typeof data;
    const isArray = Array.isArray(data);
    const isNull = data === null;
    const isUndefined = data === undefined;

    const typeDescription = isNull
      ? 'null'
      : isUndefined
      ? 'undefined'
      : isArray
      ? 'array'
      : actualType;

    if (typeDescription !== expectedType) {
      console.warn(`🔍 Type Safety Check - ${componentName}:`, {
        expected: expectedType,
        actual: typeDescription,
        value: data,
        suggestion: `Consider adding type guards or updating the expected type`,
      });
    }
  }, [data, expectedType, componentName]);

  return null; // This component doesn't render anything
};