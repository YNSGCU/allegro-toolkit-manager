/**
 * ATM - 统一 Apply Plan 撤销条
 * 显示最近一次已应用变更，并提供「撤销本次应用」（复用统一历史回滚）。
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface LastChange {
  title: string;
  module: string;
  canUndo: boolean;
}

interface ApplyPlanUndoBarProps {
  /** 变化时重新加载（例如应用成功后递增） */
  refreshToken?: string | number;
  onUndone?: () => void;
  onError?: (message: string) => void;
}

const BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '8px 12px',
  border: '1px solid var(--border-color, #e8e1d8)',
  borderRadius: '10px',
  background: 'var(--bg-surface, #ffffff)',
};

export default function ApplyPlanUndoBar({ refreshToken, onUndone, onError }: ApplyPlanUndoBarProps) {
  const [last, setLast] = useState<LastChange | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (typeof window.atm === 'undefined') return;
      const res = await window.atm.historyApplyPlanList();
      if (res.success && Array.isArray(res.data)) {
        const undoable = res.data.find((item) => item && item.canUndo);
        setLast(undoable ? { title: undoable.title, module: undoable.module, canUndo: true } : null);
      }
    } catch {
      setLast(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const undo = async () => {
    setUndoing(true);
    try {
      const res = await window.atm.historyApplyPlanUndo();
      if (res.success) {
        setLast(null);
        onUndone?.();
      } else {
        onError?.(res.error || '撤销失败');
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      setUndoing(false);
      void load();
    }
  };

  if (!last) return null;

  return (
    <div style={BAR_STYLE} role="status">
      <span style={{ fontSize: '12px', color: 'var(--text-secondary, #5f5a52)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        上次应用：{last.title}
      </span>
      <button type="button" className="btn btn-sm" onClick={() => void undo()} disabled={undoing}>
        {undoing ? '撤销中…' : '撤销本次应用'}
      </button>
    </div>
  );
}
