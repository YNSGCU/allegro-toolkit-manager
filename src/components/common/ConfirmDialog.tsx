/**
 * ATM - 统一确认弹窗组件（V5.4）
 *
 * 替代 window.confirm 和 Electron 原生 confirm。
 * 所有需要用户确认的操作都应使用此组件。
 * 深色主题，与应用风格一致。
 */
import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  detail,
  variant = 'info',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const Icon = variant === 'info' ? Info : AlertTriangle;

  return (
    <div
      className="confirm-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className={`confirm-dialog confirm-dialog--${variant}`} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="confirm-dialog-header">
          <span className="confirm-dialog-icon"><Icon aria-hidden="true" /></span>
          <h3 id="confirm-dialog-title">{title}</h3>
        </div>
        <p className="confirm-dialog-message">
          {message}
        </p>
        {detail && (
          <pre className="confirm-dialog-detail">
            {detail}
          </pre>
        )}
        <div className="confirm-dialog-actions">
          <button className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
