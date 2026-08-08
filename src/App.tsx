/**
 * ATM - 根组件与页面级加载边界
 */
import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { getDefaultWorkspaceRoute } from './config/appShell';
import { getRouteBoundaryKey, routePageLoaders } from './config/routePageLoaders';
import PageState from './shared/ui/feedback/PageState';
import RouteErrorBoundary from './shared/ui/feedback/RouteErrorBoundary';
import WorkspacePage from './shared/ui/workspace/WorkspacePage';

const DashboardPage = lazy(routePageLoaders.overview);
const EnvironmentPage = lazy(routePageLoaders.environment);
const HotkeyWorkspacePage = lazy(routePageLoaders.hotkeys);
const SkillPage = lazy(routePageLoaders.skills);
const MenuPage = lazy(routePageLoaders.menu);
const ColorPage = lazy(routePageLoaders.colors);
const BackupPage = lazy(routePageLoaders.backup);
const UnifiedWorkspacePage = lazy(routePageLoaders.workspace);

function RouteLoadingFallback() {
  return (
    <WorkspacePage>
      <PageState
        kind="loading"
        title="正在加载工作区"
        description="正在准备页面资源，请稍候。"
      />
    </WorkspacePage>
  );
}

function RoutedWorkspace() {
  const location = useLocation();

  return (
    <RouteErrorBoundary
      key={getRouteBoundaryKey(location.pathname)}
      onRetry={() => window.location.reload()}
      onGoHome={() => {
        window.location.hash = `#${getDefaultWorkspaceRoute()}`;
      }}
    >
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route
            path="/"
            element={<Navigate to={getDefaultWorkspaceRoute()} replace />}
          />
          <Route path="/overview" element={<DashboardPage />} />
          <Route path="/environment" element={<EnvironmentPage />} />
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
          <Route path="/skills" element={<SkillPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/colors" element={<ColorPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/workspace" element={<UnifiedWorkspacePage />} />
          <Route
            path="*"
            element={<Navigate to={getDefaultWorkspaceRoute()} replace />}
          />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

const App: React.FC = () => {
  return (
    <Layout>
      <RoutedWorkspace />
    </Layout>
  );
};

export default App;
