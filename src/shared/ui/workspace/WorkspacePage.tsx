import type { ReactNode } from 'react';

interface WorkspacePageProps {
  children: ReactNode;
  className?: string;
  density?: 'default' | 'compact';
  scroll?: 'page' | 'contained';
}

export default function WorkspacePage({
  children,
  className = '',
  density = 'default',
  scroll = 'page',
}: WorkspacePageProps) {
  const classes = [
    'ui-workspace-page',
    density === 'compact' ? 'ui-workspace-page--compact' : '',
    scroll === 'contained' ? 'ui-workspace-page--contained' : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
