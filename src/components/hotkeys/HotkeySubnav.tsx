import { NavLink } from 'react-router-dom';
import { HOTKEY_WORKSPACE_SECTIONS } from './hotkeyWorkspaceSections';

export default function HotkeySubnav() {
  return (
    <nav className="hotkey-subnav hotkey-subnav--balanced" aria-label="快捷键工作区">
      {HOTKEY_WORKSPACE_SECTIONS.map((section) => (
        <NavLink
          key={section.key}
          to={section.path}
          aria-label={section.label}
          className={({ isActive }) => `hotkey-subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="hotkey-subnav-label">{section.label}</span>
          <span className="hotkey-subnav-summary">{section.summary}</span>
        </NavLink>
      ))}
    </nav>
  );
}
