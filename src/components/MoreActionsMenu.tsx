import React, { useEffect, useRef, useState } from 'react';

export interface ActionItem {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface MoreActionsMenuProps {
  actions: ActionItem[];
  label?: string;
}

const MoreActionsMenu: React.FC<MoreActionsMenuProps> = ({
  actions,
  label = '更多操作',
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasEnabled = actions.some((action) => !action.disabled);

  return (
    <div className="more-actions-wrapper" ref={wrapperRef}>
      <button
        className="more-actions-btn"
        onClick={() => setOpen((current) => !current)}
        disabled={!hasEnabled}
        title={label}
      >
        <span>{label}</span>
        <span className={`more-actions-caret${open ? ' open' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="more-actions-dropdown">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              className={`more-actions-item${action.danger ? ' danger' : ''}`}
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                action.onClick();
                setOpen(false);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoreActionsMenu;
