/**
 * ATM - 快捷键删除确认弹窗（V5.3）
 * 应用内中文确认弹窗，不使用原生 Electron confirm
 * 确认后生成 Apply Plan（注释原行，不物理删除）
 */
import React from 'react';
import type { HotkeyBinding } from '../types/hotkey';

interface HotkeyDeleteConfirmDialogProps {
  binding: HotkeyBinding;
  onCancel: () => void;
  onConfirm: (binding: HotkeyBinding) => void;
}

const HotkeyDeleteConfirmDialog: React.FC<HotkeyDeleteConfirmDialogProps> = ({
  binding,
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480 }}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>⚠️ 确认删除快捷键</h3>
          <button className="btn btn-sm" onClick={onCancel}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>
              确认删除快捷键？
            </p>

            <table style={{ fontSize: 13, lineHeight: 2 }}>
              <tbody>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingRight: 16, whiteSpace: 'nowrap' }}>快捷键：</td>
                  <td><code style={{ fontWeight: 600 }}>{binding.key}</code></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingRight: 16 }}>命令：</td>
                  <td><code>{binding.command}</code></td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingRight: 16 }}>类型：</td>
                  <td>{binding.type === 'funckey' ? 'Funckey' : 'Alias'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', paddingRight: 16 }}>来源：</td>
                  <td>{binding.source || '未知'}</td>
                </tr>
                {binding.lineNumber && (
                  <tr>
                    <td style={{ color: 'var(--text-muted)', paddingRight: 16 }}>行号：</td>
                    <td>{binding.lineNumber}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: 10, borderRadius: 6,
            background: 'rgba(125, 207, 255, 0.08)',
            fontSize: 12, color: 'var(--text-secondary)',
            marginBottom: 16,
          }}>
            💡 该操作不会物理删除 env 行，而是将其注释，方便恢复。
            <br />
            修改前：<code style={{ fontSize: 11 }}>{binding.type} {binding.key} "{binding.command}"</code>
            <br />
            修改后：<code style={{ fontSize: 11 }}># ATM disabled: {binding.type} {binding.key} "{binding.command}"</code>
          </div>
        </div>

        <div className="modal-footer" style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 20px', borderTop: '1px solid var(--border-color)',
        }}>
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => onConfirm(binding)}>
            加入 Apply Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotkeyDeleteConfirmDialog;
