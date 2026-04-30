import { Component, type ErrorInfo, type ReactNode } from "react";

type ShapeErrorBoundaryProps = {
  shapeId: string;
  fallback?: ReactNode;
  children: ReactNode;
};

type ShapeErrorBoundaryState = {
  hasError: boolean;
};

export class ShapeErrorBoundary extends Component<
  ShapeErrorBoundaryProps,
  ShapeErrorBoundaryState
> {
  public override state: ShapeErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ShapeErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ShapeErrorBoundary] Failed to render shape", {
      shapeId: this.props.shapeId,
      error,
      errorInfo,
    });
  }

  public override componentDidUpdate(prevProps: ShapeErrorBoundaryProps): void {
    if (prevProps.shapeId !== this.props.shapeId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
