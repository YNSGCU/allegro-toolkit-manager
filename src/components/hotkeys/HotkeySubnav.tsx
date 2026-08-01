import { NavLink } from 'react-router-dom';
import { Keyboard, ShieldAlert } from 'lucide-react';
import { HOTKEY_WORKSPACE_SECTIONS } from './hotkeyWorkspaceSections';

const sectionIcons = {
  keys: Keyboard,
  conflicts: ShieldAlert,
};

export default function HotkeySubnav() {
  return (
    <nav className="hotkey-subnav" aria-label="快捷键工作区">
      <div className="hotkey-subnav-track">
        {HOTKEY_WORKSPACE_SECTIONS.map((section) => {
          const Icon = sectionIcons[section.key];
          return (
            <NavLink
              key={section.key}
              to={section.path}
              aria-label={section.label}
              title={section.summary}
              className={({ isActive }) => `hotkey-subnav-link${isActive ? ' active' : ''}`}
            >
              <Icon aria-hidden="true" />
              <span className="hotkey-subnav-label">{section.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
