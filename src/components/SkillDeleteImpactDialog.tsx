/**
 * ATM - Skill 删除/禁用影响分析弹窗（V5.1）
 * 删除或禁用 Skill 前，显示影响分析：
 *   - 哪些快捷键引用了此 Skill 的命令
 *   - 哪些菜单引用了此 Skill
 *   - 操作选项（取消/仅禁用/删除并注释等）
 */
import React, { useState } from 'react';
import type { SkillFileItem, ImpactAnalysis, ImpactOptionAction } from '../types/skill';

interface SkillDeleteImpactDialogProps {
  skill: SkillFileItem;
  impact: ImpactAnalysis;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (option: ImpactOptionAction) => void;
}

const optionColors: Record<string, { border: string; bg: string; text: string }> = {
  cancel: { border: 'var(--border-color)', bg: 'transparent', text: 'var(--text-muted)' },
  just_disable_loader: { border: 'var(--accent-yellow)', bg: 'rgba(224, 175, 104, 0.08)', text: 'var(--accent-yellow)' },
  delete_and_comment_hotkeys: { border: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.08)', text: 'var(--accent-orange)' },
  delete_but_mark_invalid: { border: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.08)', text: 'var(--accent-orange)' },
  advanced_delete: { border: 'var(--accent-red)', bg: 'rgba(247, 118, 142, 0.08)', text: 'var(--accent-red)' },
};

const optionRiskIcons: Record<string, string> = {
  safe: '安全',
  warning: '警告',
  danger: '高风险',
};

const SkillDeleteImpactDialog: React.FC<SkillDeleteImpactDialogProps> = ({
  skill,
  impact,
  loading,
  onCancel,
  onConfirm,
}) => {
  const [selectedOption, setSelectedOption] = useState<ImpactOptionAction>(
    impact.totalRefs > 0 ? 'just_disable_loader' : 'cancel'
  );

  const isReadonly = impact.isReadonly;
  const showRefs = impact.hotkeyRefs.length > 0 || impact.menuRefs.length > 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-dialog skill-delete-impact-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {isReadonly ? '只读' : showRefs ? '警告' : '删除'}
            {isReadonly ? ' 只读 Skill 无法删除' : ` 删除/禁用影响分析 — ${impact.skillName}`}
          </h3>
          <button className="btn btn-sm" onClick={onCancel} title="关闭">
            ×
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* 只读提示 */}
          {isReadonly && (
            <div style={{
              padding: 12, borderRadius: 8,
              background: 'rgba(187, 154, 247, 0.1)',
              border: '1px solid var(--accent-purple)',
              marginBottom: 16, fontSize: 13,
            }}>
              此 Skill 来自公司只读目录，无法删除或修改。只能移除 ATM 对其的引用。
            </div>
          )}

          {/* 影响摘要 */}
          {showRefs && !isReadonly && (
            <div style={{
              padding: 12, borderRadius: 8,
              background: 'rgba(247, 118, 142, 0.08)',
              border: '1px solid rgba(247, 118, 142, 0.3)',
              marginBottom: 16,
            }}>
              <strong style={{ color: 'var(--accent-red)', fontSize: 14 }}>
                检测到 {impact.totalRefs} 个引用
              </strong>
              {impact.hotkeyRefs.length > 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
                  （快捷键 {impact.hotkeyRefs.length} 个
                  {impact.menuRefs.length > 0 ? ` / 菜单 ${impact.menuRefs.length} 个` : ''}）
                </span>
              )}
            </div>
          )}

          {/* 快捷键引用列表 */}
          {impact.hotkeyRefs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                快捷键引用
              </div>
              {impact.hotkeyRefs.map((ref, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', marginBottom: 4,
                    background: 'rgba(125, 207, 255, 0.06)',
                    borderRadius: 6, fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  <code style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{ref.key}</code>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <code>{ref.command}</code>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {ref.source} 行 {ref.lineNumber}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 菜单引用列表 */}
          {impact.menuRefs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                菜单引用
              </div>
              {impact.menuRefs.map((ref, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', marginBottom: 4,
                    background: 'rgba(122, 162, 247, 0.06)',
                    borderRadius: 6, fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>引用</span>
                  <span>{ref.path}</span>
                  <code style={{ marginLeft: 'auto', fontSize: 11 }}>{ref.command}</code>
                </div>
              ))}
            </div>
          )}

          {/* 影响提示 */}
          {showRefs && !isReadonly && (
            <div style={{
              padding: 10, borderRadius: 6,
              background: 'rgba(247, 118, 142, 0.05)',
              marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)',
            }}>
              删除后影响：
              <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                {impact.hotkeyRefs.length > 0 && (
                  <li>{impact.hotkeyRefs.map(r => r.key).join(' / ')} 快捷键将失效</li>
                )}
                {impact.menuRefs.length > 0 && <li>菜单入口将失效</li>}
                <li>{skill.entryCommands.map(c => c.name).join(', ')} 命令将从命令注册中心移除</li>
              </ul>
            </div>
          )}

          {/* 操作选项 */}
          {!isReadonly && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                选择处理方式
              </div>
              <div className="impact-option-list">
                {impact.options.map((opt) => {
                  if (opt.action === 'cancel' && showRefs) return null; // 隐藏 cancel 仅在有关时
                  const colors = optionColors[opt.action] || optionColors.cancel;
                  const isSelected = selectedOption === opt.action;
                  return (
                    <div
                      key={opt.action}
                      className={`impact-option-card ${isSelected ? 'selected' : ''} ${opt.riskLevel}`}
                      onClick={() => setSelectedOption(opt.action)}
                      style={{
                        border: `1px solid ${isSelected ? colors.border : 'var(--border-color)'}`,
                        background: isSelected ? colors.bg : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="impact-option-label">
                        {optionRiskIcons[opt.riskLevel] || '安全'} {opt.label}
                      </div>
                      <div className="impact-option-desc">{opt.description}</div>
                      {opt.steps.length > 0 && (
                        <div className="impact-option-steps">
                          {opt.steps.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>·</span> {s}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
          <button className="btn" onClick={onCancel} disabled={loading}>
            取消
          </button>
          {!isReadonly && (
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(selectedOption)}
              disabled={loading || selectedOption === 'cancel'}
              style={
                selectedOption === 'advanced_delete'
                  ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }
                  : undefined
              }
            >
              {loading ? '处理中...' : '确认执行'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillDeleteImpactDialog;
