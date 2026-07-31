import React from 'react';
import { NavLink } from 'react-router-dom';
import { APP_NAV_ITEMS } from '../config/appShell';

interface LayoutProps {
  children: React.ReactNode;
}

const NavGlyph: React.FC<{ label: string }> = ({ label }) => (
  <span className="nav-icon-badge" aria-hidden="true">
    {label}
  </span>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const primaryItems = APP_NAV_ITEMS.filter((item) => item.group === 'primary');
  const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');

  const renderNavGroup = (
    title: string,
    items: typeof APP_NAV_ITEMS,
  ) => (
    <div className="sidebar-section">
      <div className="sidebar-section-label">{title}</div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/overview'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <NavGlyph label={item.shortLabel} />
            <span className="nav-copy">
              <span className="nav-label">{item.label}</span>
              <span className="nav-summary">{item.summary}</span>
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand-kicker">Allegro Workspace</div>
          <h1>ATM</h1>
          <p>把快捷键、Skill 与菜单收进同一个工作台。</p>
        </div>

        <div className="sidebar-body">
          {renderNavGroup('核心工作区', primaryItems)}
          {renderNavGroup('辅助页面', utilityItems)}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-note">
            <div className="sidebar-note-title">当前原则</div>
            <div className="sidebar-note-text">
              所有写入都经由 Apply Plan，先预览，再落盘。
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
};

export default Layout;
