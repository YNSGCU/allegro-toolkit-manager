/**
 * ATM - Skill 删除/禁用影响分析弹窗（V5.1）
 * 删除或禁用 Skill 前，显示影响分析：
 *   - 哪些快捷键引用了此 Skill 的命令
 *   - 哪些菜单引用了此 Skill
 *   - 操作选项（取消/仅禁用/删除并注释等）
 */
import React, { useState } from 'react';
import type { SkillFileItem, ImpactAnalysis, ImpactOptionAction } from '../types/skill';
import { BusinessDialog } from '../shared/ui';

interface SkillDeleteImpactDialogProps {
  skill: SkillFileItem;
  impact: ImpactAnalysis;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (option: ImpactOptionAction) => void;
}

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
    <BusinessDialog
      title={isReadonly ? '只读 Skill 无法删除' : `删除/禁用影响分析 · ${impact.skillName}`}
      description={isReadonly ? '该项目来自公司只读目录。' : '先核对引用范围，再选择最合适的处理方式。'}
      size="lg"
      tone={isReadonly ? 'default' : showRefs ? 'warning' : 'danger'}
      onClose={onCancel}
      dismissDisabled={loading}
      footer={(
        <>
          <button type="button" className="btn" onClick={onCancel} disabled={loading} data-dialog-initial-focus>
            取消
          </button>
          {!isReadonly ? (
            <button
              type="button"
              className={`btn ${selectedOption === 'advanced_delete' ? 'ui-dialog-danger-button' : 'btn-primary'}`}
              onClick={() => onConfirm(selectedOption)}
              disabled={loading || selectedOption === 'cancel'}
            >
              {loading ? '正在生成计划…' : '确认处理方式'}
            </button>
          ) : null}
        </>
      )}
    >
      <div className="ui-dialog-form">
        {isReadonly ? (
          <div className="ui-dialog-alert ui-dialog-alert--info" role="note">
            此 Skill 无法删除或修改，只能移除 ATM 对它的引用。
          </div>
        ) : null}

        {showRefs && !isReadonly ? (
          <div className="ui-dialog-alert ui-dialog-alert--danger" role="alert">
            <strong>检测到 {impact.totalRefs} 个引用</strong>
            <span>快捷键 {impact.hotkeyRefs.length} 个 · 菜单 {impact.menuRefs.length} 个</span>
          </div>
        ) : null}

        {impact.hotkeyRefs.length > 0 ? (
          <section className="ui-dialog-stack" aria-labelledby="skill-impact-hotkeys">
            <h3 id="skill-impact-hotkeys" className="ui-dialog-section-title">快捷键引用</h3>
            {impact.hotkeyRefs.map((ref, idx) => (
              <div className="ui-dialog-reference-row ui-dialog-reference-row--code" key={`${ref.key}-${idx}`}>
                <code>{ref.key}</code>
                <code>{ref.command}</code>
                <small>{ref.source} · 行 {ref.lineNumber}</small>
              </div>
            ))}
          </section>
        ) : null}

        {impact.menuRefs.length > 0 ? (
          <section className="ui-dialog-stack" aria-labelledby="skill-impact-menu">
            <h3 id="skill-impact-menu" className="ui-dialog-section-title">菜单引用</h3>
            {impact.menuRefs.map((ref, idx) => (
              <div className="ui-dialog-reference-row" key={`${ref.path}-${idx}`}>
                <span>菜单</span>
                <span>{ref.path}</span>
                <code>{ref.command}</code>
              </div>
            ))}
          </section>
        ) : null}

        {showRefs && !isReadonly ? (
          <div className="ui-dialog-alert ui-dialog-alert--warning">
            <strong>删除后的影响</strong>
            <ul className="ui-dialog-impact-list">
              {impact.hotkeyRefs.length > 0 ? <li>{impact.hotkeyRefs.map(r => r.key).join(' / ')} 快捷键将失效</li> : null}
              {impact.menuRefs.length > 0 ? <li>关联菜单入口将失效</li> : null}
              <li>{skill.entryCommands.map(c => c.name).join(', ') || '相关'} 命令将从命令注册中心移除</li>
            </ul>
          </div>
        ) : null}

        {!isReadonly ? (
          <fieldset className="ui-dialog-field">
            <legend className="ui-dialog-section-title">选择处理方式</legend>
            <div className="impact-option-list">
              {impact.options.map((opt) => {
                if (opt.action === 'cancel' && showRefs) return null;
                const isSelected = selectedOption === opt.action;
                return (
                  <label
                    key={opt.action}
                    className={`impact-option-card ${isSelected ? 'selected' : ''} ${opt.riskLevel}`}
                  >
                    <input
                      type="radio"
                      name="skill-impact-option"
                      value={opt.action}
                      checked={isSelected}
                      onChange={() => setSelectedOption(opt.action)}
                      className="sr-only"
                    />
                    <span className="impact-option-label">
                      <span className={`impact-risk-label impact-risk-label--${opt.riskLevel}`}>
                        {optionRiskIcons[opt.riskLevel] || '安全'}
                      </span>
                      {opt.label}
                    </span>
                    <span className="impact-option-desc">{opt.description}</span>
                    {opt.steps.length > 0 ? (
                      <span className="impact-option-steps">
                        {opt.steps.map((step) => <span key={step}>• {step}</span>)}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>
    </BusinessDialog>
  );
};

export default SkillDeleteImpactDialog;
