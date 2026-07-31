import React, { useCallback, useEffect, useState } from 'react';
import type { ChangeRecord } from '../types/hotkey';
import ConfirmDialog from './common/ConfirmDialog';

interface ChangeHistoryDialogProps {
  pcbenvPath: string;
  onClose: () => void;
  onRefresh: () => void;
}

const OPERATION_LABELS: Record<ChangeRecord['operation'], string> = {
  modify_env: '修改 env',
  add_env_line: '新增行',
  comment_env_line: '注释删除',
  plan_apply: '应用变更',
  undo: '撤销操作',
  restore: '恢复',
};

export const ChangeHistoryDialog: React.FC<ChangeHistoryDialogProps> = ({
  pcbenvPath,
  onClose,
  onRefresh,
}) => {
  const [records, setRecords] = useState<ChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoResult, setUndoResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.atm.loadChangeHistory(pcbenvPath);
      if (result.success) {
        setRecords(result.data?.records ?? []);
      } else {
        setError(result.error || '加载变更历史失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载变更历史失败');
    } finally {
      setLoading(false);
    }
  }, [pcbenvPath]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleUndo = async (record: ChangeRecord) => {
    if (!record.undoable) {
      return;
    }

    setUndoingId(record.id);
    setUndoResult(null);

    try {
      const result = await window.atm.undoLastChange(pcbenvPath);
      if (result.success) {
        setUndoResult({
          success: true,
          message: `已成功撤销：${record.summary}`,
        });
        onRefresh();
        await loadHistory();
      } else {
        setUndoResult({
          success: false,
          message: result.error || '撤销失败',
        });
      }
    } catch (err) {
      setUndoResult({
        success: false,
        message: err instanceof Error ? err.message : '撤销异常',
      });
    } finally {
      setUndoingId(null);
    }
  };

  const executeClear = async () => {
    try {
      const result = await window.atm.clearChangeHistory(pcbenvPath);
      if (!result.success) {
        setError(result.error || '清空历史失败');
        return;
      }
      setRecords([]);
      setExpandedId(null);
      setUndoResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '清空历史失败');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="变更历史弹窗"
        className="modal-dialog change-history-dialog change-history-dialog--compact"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3>变更历史</h3>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="关闭变更历史弹窗"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-body change-history-body">
          <div className="change-history-toolbar">
            <div className="change-history-toolbar-actions">
              <button
                type="button"
                className="btn"
                onClick={() => void loadHistory()}
                disabled={loading}
                aria-label="刷新历史"
              >
                刷新
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowClearConfirm(true)}
                disabled={records.length === 0}
                aria-label="清空历史"
              >
                清空历史
              </button>
            </div>
            <span className="change-history-count">共 {records.length} 条记录</span>
          </div>

          {undoResult ? (
            <div className={`undo-result ${undoResult.success ? 'undo-success' : 'undo-error'}`}>
              {undoResult.message}
            </div>
          ) : null}

          {loading ? (
            <div className="loading-spinner">加载中...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : records.length === 0 ? (
            <div className="empty-state change-history-empty">
              <div>暂无变更历史</div>
              <div className="empty-hint">修改快捷键后会自动记录历史</div>
            </div>
          ) : (
            <div className="change-history-list">
              {records.map((record) => {
                const expanded = expandedId === record.id;
                const undoing = undoingId === record.id;

                return (
                  <div key={record.id} className={`change-record ${record.operation}`}>
                  <div
                      className="change-record-header"
                      onClick={() => setExpandedId(expanded ? null : record.id)}
                    >
                      <span className="change-record-time">{record.timestamp}</span>
                      <span className="change-record-op">
                        {OPERATION_LABELS[record.operation]}
                      </span>
                      <span className="change-record-summary">{record.summary}</span>
                      <span className="change-record-steps">{record.stepsCount} 步</span>
                      {record.undoable ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleUndo(record);
                          }}
                          disabled={undoing}
                        >
                          {undoing ? '撤销中...' : '撤销'}
                        </button>
                      ) : null}
                      <span className="expand-icon" aria-hidden="true">
                        {expanded ? '▲' : '▼'}
                      </span>
                    </div>

                    {expanded ? (
                      <div className="change-record-detail">
                        <div className="detail-row">
                          <span className="detail-label">目标文件</span>
                          <code className="detail-value">{record.targetFile}</code>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">备份文件</span>
                          <code className="detail-value">{record.backupFile}</code>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">备份 ID</span>
                          <span className="detail-value">{record.backupId}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Plan ID</span>
                          <span className="detail-value">{record.planId}</span>
                        </div>
                        {record.restorePoint ? (
                          <div className="detail-row restore-point-badge">恢复点</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        title="清空变更历史"
        message="确定清空所有变更历史？此操作不可撤销。"
        variant="danger"
        confirmLabel="清空"
        onConfirm={() => {
          setShowClearConfirm(false);
          void executeClear();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
};

export default ChangeHistoryDialog;
