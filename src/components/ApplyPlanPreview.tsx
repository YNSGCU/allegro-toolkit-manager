/**
 * ATM - Apply Plan 预览组件
 */
import React from 'react';
import type { ApplyPlan } from '../types/hotkey';

interface ApplyPlanPreviewProps {
  plan: ApplyPlan;
  onConfirm?: () => void;
  onCancel?: () => void;
  isApplying?: boolean;
}

const ApplyPlanPreview: React.FC<ApplyPlanPreviewProps> = ({
  plan,
  onConfirm,
  onCancel,
  isApplying = false,
}) => {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'backup':
        return '💾';
      case 'modify_managed_block':
        return '✏️';
      case 'insert_bootstrap':
        return '🔧';
      case 'write_file':
        return '📄';
      case 'create_directory':
        return '📁';
      default:
        return '➡️';
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'backup':
        return 'var(--accent-green)';
      case 'modify_managed_block':
        return 'var(--accent-blue)';
      case 'insert_bootstrap':
        return 'var(--accent-purple)';
      case 'write_file':
        return 'var(--accent-cyan)';
      case 'create_directory':
        return 'var(--accent-yellow)';
      default:
        return 'var(--text-muted)';
    }
  };

  const getWarningLevel = (level: string) => {
    switch (level) {
      case 'danger':
        return { icon: '🔴', bg: 'rgba(247, 118, 142, 0.1)', border: 'rgba(247, 118, 142, 0.3)', color: 'var(--accent-red)' };
      case 'warning':
        return { icon: '🟡', bg: 'rgba(224, 175, 104, 0.1)', border: 'rgba(224, 175, 104, 0.3)', color: 'var(--accent-yellow)' };
      default:
        return { icon: '🔵', bg: 'rgba(122, 162, 247, 0.1)', border: 'rgba(122, 162, 247, 0.3)', color: 'var(--accent-blue)' };
    }
  };

  return (
    <div>
      {/* 摘要 */}
      <div className="card">
        <div className="card-header">计划摘要</div>
        <p style={{ fontSize: 14, marginBottom: 8 }}>{plan.summary}</p>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>ID: {plan.id}</span>
          <span>步骤: {plan.steps.length}</span>
          <span>创建: {new Date(plan.createdAt).toLocaleString('zh-CN')}</span>
          {plan.requiresRestart && (
            <span style={{ color: 'var(--accent-yellow)' }}>⚠ 需要重启 Allegro</span>
          )}
        </div>
      </div>

      {/* 警告 */}
      {plan.warnings.length > 0 && (
        <div className="card">
          <div className="card-header">警告</div>
          {plan.warnings.map((w, i) => {
            const level = getWarningLevel(w.level);
            return (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  marginBottom: 8,
                  borderRadius: 'var(--radius-sm)',
                  background: level.bg,
                  border: `1px solid ${level.border}`,
                  color: level.color,
                  fontSize: 13,
                }}
              >
                {level.icon} {w.message}
              </div>
            );
          })}
        </div>
      )}

      {/* 步骤列表 */}
      <div className="card">
        <div className="card-header">执行步骤</div>
        {plan.steps.map((step, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 0',
              borderBottom: index < plan.steps.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <span style={{ fontSize: 18 }}>{getStepIcon(step.type)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{step.description}</div>
              <div className="path-display" style={{ marginTop: 2 }}>{step.target}</div>
              {step.backupTo && (
                <div className="path-display" style={{ marginTop: 2, color: 'var(--accent-green)' }}>
                  → {step.backupTo}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: `${getStepColor(step.type)}20`,
                color: getStepColor(step.type),
                whiteSpace: 'nowrap',
              }}
            >
              {step.type === 'backup' ? '备份' :
               step.type === 'modify_managed_block' ? '修改' :
               step.type === 'insert_bootstrap' ? '插入' :
               step.type === 'write_file' ? '写入' :
               step.type === 'create_directory' ? '创建目录' : step.type}
            </span>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {(onConfirm || onCancel) && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          {onCancel && (
            <button className="btn" onClick={onCancel} disabled={isApplying}>
              取消
            </button>
          )}
          {onConfirm && (
            <button className="btn btn-primary" onClick={onConfirm} disabled={isApplying}>
              {isApplying ? '执行中...' : '确认执行'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplyPlanPreview;
