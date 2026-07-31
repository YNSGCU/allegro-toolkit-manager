/**
 * ATM - 统一确认弹窗组件（V5.4）
 *
 * 替代 window.confirm 和 Electron 原生 confirm。
 * 所有需要用户确认的操作都应使用此组件。
 * 深色主题，与应用风格一致。
 */
import React from 'react';

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

const VARIANT_COLORS: Record<ConfirmVariant, { icon: string; accent: string }> = {
  danger: { icon: '⚠️', accent: 'var(--accent-red, #e74c3c)' },
  warning: { icon: '⚠️', accent: 'var(--accent-yellow, #f1c40f)' },
  info: { icon: 'ℹ️', accent: 'var(--accent-blue, #3498db)' },
};

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

  const colors = VARIANT_COLORS[variant];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: '#1e1e2e',
          border: `1px solid #333`,
          borderRadius: 12,
          padding: 24,
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 24 }}>{colors.icon}</span>
          <h3 style={{ margin: 0, color: '#eee', fontSize: 16 }}>{title}</h3>
        </div>
        <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.5, margin: '0 0 8px 0' }}>
          {message}
        </p>
        {detail && (
          <pre
            style={{
              background: '#151525',
              color: '#aaa',
              fontSize: 12,
              padding: 10,
              borderRadius: 6,
              margin: '8px 0 16px',
              maxHeight: 200,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {detail}
          </pre>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button
            className="btn"
            onClick={onCancel}
            style={{ background: '#333', color: '#ccc', border: '1px solid #555' }}
          >
            {cancelLabel}
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            style={{
              background: colors.accent,
              color: '#fff',
              border: 'none',
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
