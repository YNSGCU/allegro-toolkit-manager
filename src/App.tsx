/**
 * ATM - 根组件与页面级加载边界
 */
import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { getDefaultWorkspaceRoute } from './config/appShell';
import PageState from './shared/ui/feedback/PageState';
import WorkspacePage from './shared/ui/workspace/WorkspacePage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EnvironmentPage = lazy(() => import('./pages/EnvironmentPage'));
const HotkeyWorkspacePage = lazy(() => import('./pages/HotkeyWorkspacePage'));
const SkillPage = lazy(() => import('./pages/SkillPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));

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

const App: React.FC = () => {
  return (
    <Layout>
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
          <Route
            path="*"
            element={<Navigate to={getDefaultWorkspaceRoute()} replace />}
          />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default App;
