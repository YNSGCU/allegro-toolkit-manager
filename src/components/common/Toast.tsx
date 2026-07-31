/**
 * ATM - 统一提示 Toast 组件（V5.4）
 *
 * 用于显示短时操作反馈，如保存成功、扫描完成等。
 * 不再使用 console.log 替代用户反馈。
 */
import React, { useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

/** 单条 Toast */
const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = React.memo(({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const iconMap: Record<ToastType, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const colorMap: Record<ToastType, { bg: string; border: string }> = {
    success: { bg: 'var(--toast-success-bg, #1a3a2a)', border: 'var(--toast-success-border, #2ecc71)' },
    error: { bg: 'var(--toast-error-bg, #3a1a1a)', border: 'var(--toast-error-border, #e74c3c)' },
    warning: { bg: 'var(--toast-warning-bg, #3a3a1a)', border: 'var(--toast-warning-border, #f1c40f)' },
    info: { bg: 'var(--toast-info-bg, #1a2a3a)', border: 'var(--toast-info-border, #3498db)' },
  };

  const colors = colorMap[toast.type];

  return (
    <div
      style={{
        padding: '10px 16px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        color: '#eee',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
        maxWidth: 400,
        wordBreak: 'break-word',
      }}
    >
      <span>{iconMap[toast.type]}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: '#888',
          cursor: 'pointer',
          fontSize: 16,
          padding: '0 4px',
        }}
      >
        ×
      </button>
    </div>
  );
});

/** Toast 容器 — 固定在右上角 */
const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default ToastContainer;

/** 全局 Toast 管理 Hook */
let toastListeners: Array<(toast: ToastMessage) => void> = [];
let toastIdCounter = 0;

export function showToast(type: ToastType, message: string, duration?: number): void {
  const toast: ToastMessage = {
    id: `toast-${++toastIdCounter}`,
    type,
    message,
    duration,
  };
  toastListeners.forEach((listener) => listener(toast));
}

export function useToast(): {
  toasts: ToastMessage[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
} {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${++toastIdCounter}`;
    const toast: ToastMessage = { id, type, message, duration };
    setToasts((prev) => [...prev, toast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  return { toasts, addToast, removeToast };
}
