import type { ComponentType } from 'react';

type RoutePageModule = { default: ComponentType };
type RoutePageLoader = () => Promise<RoutePageModule>;

export const routePageLoaders = {
  overview: () => import('../pages/DashboardPage'),
  environment: () => import('../pages/EnvironmentPage'),
  hotkeys: () => import('../pages/HotkeyWorkspacePage'),
  skills: () => import('../pages/SkillPage'),
  menu: () => import('../pages/MenuPage'),
  colors: () => import('../pages/ColorPage'),
} satisfies Record<string, RoutePageLoader>;

const routeLoaderEntries: Array<[string, RoutePageLoader]> = [
  ['/overview', routePageLoaders.overview],
  ['/environment', routePageLoaders.environment],
  ['/hotkeys', routePageLoaders.hotkeys],
  ['/skills', routePageLoaders.skills],
  ['/menu', routePageLoaders.menu],
  ['/colors', routePageLoaders.colors],
];

const preloadRequests = new Map<RoutePageLoader, Promise<void>>();

function findRouteLoaderEntry(pathname: string): [string, RoutePageLoader] | undefined {
  return routeLoaderEntries.find(([route]) => (
    pathname === route || pathname.startsWith(`${route}/`)
  ));
}

export function getRoutePageLoader(pathname: string): RoutePageLoader | undefined {
  return findRouteLoaderEntry(pathname)?.[1];
}

export function getRouteBoundaryKey(pathname: string): string {
  return findRouteLoaderEntry(pathname)?.[0] || pathname;
}

export function preloadWorkspaceRoute(pathname: string): Promise<void> {
  const loader = getRoutePageLoader(pathname);
  if (!loader) return Promise.resolve();

  const existingRequest = preloadRequests.get(loader);
  if (existingRequest) return existingRequest;

  const request = loader()
    .then(() => undefined)
    .catch((error) => {
      preloadRequests.delete(loader);
      throw error;
    });
  preloadRequests.set(loader, request);
  return request;
}
