/**
 * ATM - 统一提示 Toast 组件（V5.4）
 *
 * 用于显示短时操作反馈，如保存成功、扫描完成等。
 * 不再使用 console.log 替代用户反馈。
 */
import React, { useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';

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

  const iconMap: Record<ToastType, LucideIcon> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };
  const Icon = iconMap[toast.type];

  return (
    <div className={`toast-item toast-item--${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon className="toast-item-icon" aria-hidden="true" />
      <span className="toast-item-message">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="toast-item-close"
        aria-label="关闭提示"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
});

/** Toast 容器 — 固定在右上角 */
const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container" aria-live="polite">
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
