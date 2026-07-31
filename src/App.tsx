/**
 * ATM - 根组件
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { getDefaultWorkspaceRoute } from './config/appShell';
import DashboardPage from './pages/DashboardPage';
import EnvironmentPage from './pages/EnvironmentPage';
import HotkeyWorkspacePage from './pages/HotkeyWorkspacePage';
import SkillPage from './pages/SkillPage';
import MenuPage from './pages/MenuPage';

const App: React.FC = () => {
  return (
    <Layout>
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
    </Layout>
  );
};

export default App;
