import { useId, type KeyboardEventHandler, type ReactNode } from 'react';
import { X } from 'lucide-react';
import useDialogFocus from './useDialogFocus';

export type BusinessDialogSize = 'sm' | 'md' | 'lg' | 'xl';
export type BusinessDialogTone = 'default' | 'warning' | 'danger';

interface BusinessDialogProps {
  open?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: BusinessDialogSize;
  tone?: BusinessDialogTone;
  dismissDisabled?: boolean;
  className?: string;
  bodyClassName?: string;
  onDialogKeyDown?: KeyboardEventHandler<HTMLElement>;
}

export default function BusinessDialog({
  open = true,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'md',
  tone = 'default',
  dismissDisabled = false,
  className = '',
  bodyClassName = '',
  onDialogKeyDown,
}: BusinessDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const { dialogRef, handleDialogKeyDown } = useDialogFocus<HTMLElement>({
    open,
    onClose,
    dismissDisabled,
  });

  if (!open) return null;

  return (
    <div
      className="ui-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !dismissDisabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`ui-dialog ui-business-dialog ui-business-dialog--${size} ui-business-dialog--${tone} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          onDialogKeyDown?.(event);
          if (!event.defaultPrevented) handleDialogKeyDown(event);
        }}
      >
        <header className="ui-dialog-header ui-business-dialog-header">
          <div className="ui-business-dialog-heading">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="ui-icon-button"
            aria-label="关闭对话框"
            onClick={onClose}
            disabled={dismissDisabled}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={`ui-dialog-body ui-business-dialog-body ${bodyClassName}`.trim()}>
          {children}
        </div>

        {footer ? <footer className="ui-dialog-footer ui-business-dialog-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
