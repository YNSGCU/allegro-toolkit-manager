import type { ComponentType, ReactNode } from 'react';
import {
  Archive,
  Blocks,
  CircuitBoard,
  Gauge,
  LayoutGrid,
  Keyboard,
  Menu,
  Palette,
  ShieldCheck,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { APP_NAV_ITEMS, type AppNavItem } from '../config/appShell';
import { preloadWorkspaceRoute } from '../config/routePageLoaders';
import AllegroEnvironmentSwitcher from './AllegroEnvironmentSwitcher';

interface LayoutProps {
  children: ReactNode;
}

const navIcons: Record<AppNavItem['key'], ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  hotkeys: Keyboard,
  skills: Blocks,
  menu: Menu,
  colors: Palette,
  overview: Gauge,
  backup: Archive,
  workspace: LayoutGrid,
};

export default function Layout({ children }: LayoutProps) {
  const primaryItems = APP_NAV_ITEMS.filter((item) => item.group === 'primary');
  const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');

  const renderNavGroup = (
    title: string,
    items: AppNavItem[],
    variant: 'primary' | 'utility',
  ) => (
    <section
      className={`atm-nav-group atm-nav-group--${variant}`}
      aria-label={title}
    >
      <div className="atm-nav-group-label">{title}</div>
      <nav className="atm-nav">
        {items.map((item) => {
          const Icon = navIcons[item.key];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/overview'}
              title={item.summary}
              className={({ isActive }) => `atm-nav-item${isActive ? ' active' : ''}`}
              onMouseEnter={() => {
                void preloadWorkspaceRoute(item.path).catch(() => undefined);
              }}
              onFocus={() => {
                void preloadWorkspaceRoute(item.path).catch(() => undefined);
              }}
            >
              <Icon className="atm-nav-item-icon" aria-hidden />
              <span className="atm-nav-item-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </section>
  );

  return (
    <div className="atm-shell">
      <a className="atm-skip-link" href="#main-content">跳到主要内容</a>
      <aside className="atm-sidebar">
        <div className="atm-brand">
          <div className="atm-brand-mark" aria-hidden="true">
            <CircuitBoard size={19} />
          </div>
          <div className="atm-brand-copy">
            <div className="atm-brand-name">ATM</div>
            <div className="atm-brand-subtitle">Allegro DevOps Tool</div>
          </div>
        </div>

        <div className="atm-sidebar-sections">
          {renderNavGroup('核心工作区', primaryItems, 'primary')}
          {renderNavGroup('系统', utilityItems, 'utility')}
        </div>

        <div className="atm-sidebar-footer">
          <AllegroEnvironmentSwitcher />
          <ShieldCheck aria-hidden="true" />
          <span>安全配置工作台</span>
        </div>
      </aside>

      <main id="main-content" className="atm-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
