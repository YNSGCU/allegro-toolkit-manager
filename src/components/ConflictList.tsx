/**
 * ATM - 冲突列表组件
 */
import React from 'react';
import type { Conflict } from '../types/hotkey';

interface ConflictListProps {
  conflicts: Conflict[];
}

const ConflictList: React.FC<ConflictListProps> = ({ conflicts }) => {
  if (conflicts.length === 0) {
    return (
      <div className="message message-info">
        ✓ 未检测到快捷键冲突
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      funckey_duplicate: 'Funckey 重复',
      alias_duplicate: 'Alias 重复',
      alias_prefix: 'Alias 前缀',
      cross_type_same_name: '跨类型同名',
      missing_command: '缺少命令',
      reserved_key: '保留键',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <span className="badge badge-error">
          {conflicts.filter((c) => c.severity === 'error').length} 个错误
        </span>
        <span className="badge badge-warning">
          {conflicts.filter((c) => c.severity === 'warning').length} 个警告
        </span>
      </div>
      {conflicts.map((conflict, index) => (
        <div
          key={index}
          className="card"
          style={{
            borderLeft: `3px solid ${
              conflict.severity === 'error'
                ? 'var(--accent-red)'
                : conflict.severity === 'warning'
                ? 'var(--accent-yellow)'
                : 'var(--accent-blue)'
            }`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <span style={{ marginRight: 8 }}>{getSeverityIcon(conflict.severity)}</span>
              <strong>{getTypeLabel(conflict.type)}</strong>
              <span
                className={`badge ${
                  conflict.severity === 'error' ? 'badge-error' : 'badge-warning'
                }`}
                style={{ marginLeft: 8 }}
              >
                {conflict.severity === 'error' ? '错误' : '警告'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {conflict.message}
          </p>
          {conflict.bindings.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              涉及 {conflict.bindings.length} 个绑定:
              {conflict.bindings.map((b) => (
                <code
                  key={b.id}
                  style={{
                    marginLeft: 4,
                    padding: '1px 6px',
                    background: 'var(--bg-primary)',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  {b.type} {b.key} → {b.command}
                </code>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ConflictList;
