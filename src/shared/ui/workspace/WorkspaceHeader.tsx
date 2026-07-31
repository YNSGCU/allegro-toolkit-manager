import type { ReactNode } from 'react';

interface WorkspaceHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export default function WorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: WorkspaceHeaderProps) {
  return (
    <header className={`ui-workspace-header ${className}`.trim()}>
      <div className="ui-workspace-header-copy">
        {eyebrow ? <p className="ui-workspace-eyebrow">{eyebrow}</p> : null}
        <h1 className="ui-workspace-title">{title}</h1>
        {description ? <p className="ui-workspace-description">{description}</p> : null}
      </div>
      {actions ? <div className="ui-workspace-header-actions">{actions}</div> : null}
    </header>
  );
}
