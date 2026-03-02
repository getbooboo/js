import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException, getClient } from "./index";

export function boobooQueryIntegration() {
  return {
    queryCache: {
      onError: (error: unknown, query: { queryHash?: string; queryKey?: unknown }) => {
        const err = error instanceof Error ? error : new Error(String(error));
        captureException(err, {
          tanstackQuery: {
            queryHash: query?.queryHash,
            queryKey: query?.queryKey,
          },
        });
      },
    },
    mutationCache: {
      onError: (
        error: unknown,
        _variables: unknown,
        _context: unknown,
        mutation: { mutationId?: number; options?: { mutationKey?: unknown } },
      ) => {
        const err = error instanceof Error ? error : new Error(String(error));
        captureException(err, {
          tanstackQuery: {
            mutationId: mutation?.mutationId,
            mutationKey: mutation?.options?.mutationKey,
          },
        });
      },
    },
  };
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const client = getClient();
    if (client) {
      const extra: Record<string, unknown> = {};
      if (errorInfo.componentStack) {
        extra.componentStack = errorInfo.componentStack;
      }
      captureException(error, extra);
    }
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(this.state.error, this.reset);
      }
      return fallback ?? null;
    }
    return this.props.children;
  }
}
