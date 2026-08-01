import { Component, type ErrorInfo, type ReactNode } from 'react';
import PageState from './PageState';
import WorkspacePage from '../workspace/WorkspacePage';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  onRetry: () => void;
  onGoHome: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('工作区页面加载失败:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <WorkspacePage>
          <PageState
            kind="error"
            title="工作区加载失败"
            description="页面资源没有正确加载，或页面运行时发生异常。你可以重新加载当前页面，或者先返回快捷键工作区。"
            action={(
              <div className="ui-page-state-actions">
                <button type="button" className="btn btn-primary" onClick={this.props.onRetry}>
                  重新加载页面
                </button>
                <button type="button" className="btn" onClick={this.props.onGoHome}>
                  返回快捷键
                </button>
              </div>
            )}
          />
        </WorkspacePage>
      );
    }

    return this.props.children;
  }
}
