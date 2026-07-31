import React from 'react';

export interface StatusItem {
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error' | 'muted';
  tooltip?: string;
}

interface GlobalStatusBarProps {
  items: StatusItem[];
  envPath?: string;
  needsRestart?: boolean;
}

const GlobalStatusBar: React.FC<GlobalStatusBarProps> = ({
  items,
  envPath,
  needsRestart,
}) => {
  return (
    <section className="global-status-bar">
      <div className="global-status-bar-pills">
        {items.map((item) => (
          <span
            key={`${item.label}-${item.value}`}
            className={`status-pill status-pill-${item.status}`}
            title={item.tooltip || `${item.label}: ${item.value}`}
          >
            <span className={`status-pill-dot ${item.status}`} />
            {item.label}: {item.value}
          </span>
        ))}
      </div>

      <div className="global-status-bar-meta">
        {envPath && (
          <span className="global-status-bar-path" title={envPath}>
            {envPath}
          </span>
        )}

        {needsRestart !== undefined && (
          <span
            className={`status-pill ${needsRestart ? 'status-pill-warning' : 'status-pill-muted'}`}
          >
            <span className={`status-pill-dot ${needsRestart ? 'warning' : 'muted'}`} />
            {needsRestart ? '需要重启 Allegro' : '无需重启'}
          </span>
        )}
      </div>
    </section>
  );
};

export default GlobalStatusBar;
