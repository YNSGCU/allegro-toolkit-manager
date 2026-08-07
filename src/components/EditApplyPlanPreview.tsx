/**
 * ATM - 编辑 Apply Plan 预览组件
 * 显示修改前/修改后差异、目标文件、行号、操作类型
 */
import React from 'react';

interface EditPlanStep {
  opType: string;
  target: string;
  description: string;
  before: string;
  after: string;
  lineNumber?: number;
  backupPath?: string;
}

interface EditApplyPlan {
  id: string;
  createdAt: string;
  summary: string;
  steps: EditPlanStep[];
  requiresRestart: boolean;
}

interface EditApplyPlanPreviewProps {
  plan: EditApplyPlan;
  onConfirm: () => void;
  onCancel: () => void;
  isApplying?: boolean;
}

const OP_TYPE_LABELS: Record<string, string> = {
  modify_env: '修改 env 行',
  comment_env_line: '注释 env 行（安全删除）',
  modify_profile: '修改 Profile',
  add_to_profile: '添加到 Profile',
  override_source: '修正命令来源',
  add_env_line: '新增 env 行',
};

const EditApplyPlanPreview: React.FC<EditApplyPlanPreviewProps> = ({
  plan, onConfirm, onCancel, isApplying,
}) => {
  return (
    <div className="card" style={{ border: '1px solid var(--accent-blue)' }}>
      <div className="card-header">
        编辑 Apply Plan 预览
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : ''}
        </span>
      </div>

      <div style={{ padding: '8px 14px' }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{plan.summary}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {plan.steps.length} 个操作步骤
          {plan.requiresRestart && ' · 可能需要重启 Allegro 生效'}
        </p>

        {plan.steps.map((step, i) => (
          <div
            key={i}
            className="edit-plan-step"
            style={{
              marginBottom: 12,
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '6px 10px',
              background: 'var(--bg-hover)',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>步骤 {i + 1}: {OP_TYPE_LABELS[step.opType] || step.opType}</span>
              {step.lineNumber && (
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                  行 {step.lineNumber}
                </span>
              )}
            </div>

            <div style={{ padding: '8px 10px', fontSize: 12 }}>
              <div style={{ marginBottom: 6, color: 'var(--text-secondary)' }}>
                {step.target}
              </div>
              <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>
                {step.description}
              </div>

              {/* 差异对比 */}
              {(step.before || step.after) && (
                <div className="diff-view" style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {step.before && step.before !== step.after && (
                    <div className="diff-side diff-old" style={{
                      flex: 1,
                      background: 'rgba(234, 67, 53, 0.06)',
                      border: '1px solid rgba(234, 67, 53, 0.15)',
                      borderRadius: 4,
                      padding: '6px 8px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--accent-red)', marginBottom: 4, fontWeight: 600 }}>
                        修改前
                      </div>
                      <pre style={{
                        margin: 0, fontSize: 11, fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        color: 'var(--text-primary)',
                      }}>{step.before || '(空)'}</pre>
                    </div>
                  )}
                  {step.after && step.before !== step.after && (
                    <div className="diff-side diff-new" style={{
                      flex: 1,
                      background: 'rgba(52, 168, 83, 0.06)',
                      border: '1px solid rgba(52, 168, 83, 0.15)',
                      borderRadius: 4,
                      padding: '6px 8px',
                      minWidth: 0,
                    }}>
                      <div style={{ fontSize: 10, color: 'var(--accent-green)', marginBottom: 4, fontWeight: 600 }}>
                        修改后
                      </div>
                      <pre style={{
                        margin: 0, fontSize: 11, fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        color: 'var(--text-primary)',
                      }}>{step.after || '(空)'}</pre>
                    </div>
                  )}
                  {step.before === step.after && step.before && (
                    <div style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      （内容不变）
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--border-color)' }}>
        <button className="btn" onClick={onCancel} disabled={isApplying}>
          取消
        </button>
        <button className="btn btn-primary" onClick={onConfirm} disabled={isApplying}>
          {isApplying ? '执行中...' : '确认执行'}
        </button>
      </div>
    </div>
  );
};

export default EditApplyPlanPreview;
