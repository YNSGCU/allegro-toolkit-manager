import React from 'react';
import { NavLink } from 'react-router-dom';
import { APP_NAV_ITEMS } from '../config/appShell';
import { SHELL_SCALE_CONFIG } from '../layout/responsiveScale';
import { useResponsiveScale } from '../layout/useResponsiveScale';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { elementRef, scale } = useResponsiveScale<HTMLDivElement>(SHELL_SCALE_CONFIG);
  const primaryItems = APP_NAV_ITEMS.filter((item) => item.group === 'primary');
  const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');

  const renderNavGroup = (
    title: string,
    items: typeof APP_NAV_ITEMS,
  ) => (
    <section className="marvis-nav-group" aria-label={title}>
      <div className="marvis-nav-group-label">{title}</div>
      <nav className="marvis-nav">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/overview'}
            className={({ isActive }) =>
              `marvis-nav-item${isActive ? ' active' : ''}`
            }
          >
            <span className="marvis-nav-item-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </section>
  );

  return (
    <div
      ref={elementRef}
      className="marvis-shell"
      style={{ '--shell-scale': String(scale) } as React.CSSProperties}
    >
      <aside className="marvis-sidebar">
        <div className="marvis-brand-block">
          <div className="marvis-brand">ATM</div>
          <div className="marvis-brand-subtitle">Allegro DevOps Tool</div>
        </div>

        {renderNavGroup('核心模块', primaryItems)}
        {renderNavGroup('辅助模块', utilityItems)}
      </aside>

      <main className="marvis-main">{children}</main>
    </div>
  );
};

export default Layout;
