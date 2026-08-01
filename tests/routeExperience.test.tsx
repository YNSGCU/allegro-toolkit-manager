import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRouteBoundaryKey,
  getRoutePageLoader,
  preloadWorkspaceRoute,
  routePageLoaders,
} from '../src/config/routePageLoaders';
import RouteErrorBoundary from '../src/shared/ui/feedback/RouteErrorBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('route experience', () => {
  it('maps nested routes to the same page loader and deduplicates preload requests', async () => {
    expect(getRoutePageLoader('/hotkeys/keys')).toBe(routePageLoaders.hotkeys);
    expect(getRoutePageLoader('/skills')).toBe(routePageLoaders.skills);
    expect(getRoutePageLoader('/unknown')).toBeUndefined();
    expect(getRouteBoundaryKey('/hotkeys/keys')).toBe('/hotkeys');
    expect(getRouteBoundaryKey('/hotkeys/conflicts')).toBe('/hotkeys');

    const firstRequest = preloadWorkspaceRoute('/overview');
    const secondRequest = preloadWorkspaceRoute('/overview');
    expect(secondRequest).toBe(firstRequest);
    await firstRequest;
  });

  it('turns route failures into recoverable actions', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onRetry = vi.fn();
    const onGoHome = vi.fn();

    function BrokenPage(): never {
      throw new Error('chunk failed');
    }

    render(
      <RouteErrorBoundary onRetry={onRetry} onGoHome={onGoHome}>
        <BrokenPage />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('工作区加载失败');
    fireEvent.click(screen.getByRole('button', { name: '重新加载页面' }));
    fireEvent.click(screen.getByRole('button', { name: '返回快捷键' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
