/**
 * ATM - 菜单 Apply Plan 确认弹窗（V5.5）
 *
 * 中文显示步骤列表、风险提示、确认/取消按钮
 */
import React from 'react';
import type { ApplyPlan } from '../types/applyPlan';
import { getStepTypeChinese } from '../types/applyPlan';
import { getStepLabel } from '../utils/stepLabels';

interface MenuApplyPlanDialogProps {
  open: boolean;
  plan: ApplyPlan | null;
  applying: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 风险样式 */
const RISK_STYLES: Record<string, { icon: string; bg: string; border: string; color: string }> = {
  error: { icon: '✕', bg: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.3)', color: '#f87171' },
  warning: { icon: '⚠', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)', color: '#fbbf24' },
  info: { icon: 'ℹ', bg: 'rgba(96, 165, 250, 0.1)', border: 'rgba(96, 165, 250, 0.3)', color: '#60a5fa' },
};

const MenuApplyPlanDialog: React.FC<MenuApplyPlanDialogProps> = ({
  open,
  plan,
  applying,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        width: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* 标题 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '15px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>确认应用菜单</span>
          {plan && (
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400 }}>
              ({plan.steps.length} 步)
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {/* 影响范围摘要 */}
          {plan && (
            <div className="impact-summary">
              <div className="impact-summary-title">📋 本次将影响：</div>
              <div className="impact-summary-grid">
                {(() => {
                  const targets = plan.targetFiles || [];
                  const hasEnv = targets.some(t => t.includes('env') && !t.includes('menu') && !t.includes('skill'));
                  const hasLoader = targets.some(t => t.includes('loader') || t.includes('skill'));
                  const hasMenu = targets.some(t => t.includes('menu'));
                  const hasIlInit = targets.some(t => t.includes('ilinit') || t.includes('bootstrap'));
                  const maxRisk = plan.risks?.reduce((p: string, r: any) => {
                    const w = { error: 3, warning: 2, info: 1 }[r.severity as string] || 0;
                    const pw = { error: 3, warning: 2, info: 1 }[p] || 0;
                    return w > pw ? r.severity : p;
                  }, 'info') || 'info';
                  const riskLabels: Record<string, string> = { error: '高风险', warning: '警告', info: '安全' };
                  const riskColors: Record<string, string> = { error: 'var(--accent-red)', warning: 'var(--accent-yellow)', info: 'var(--accent-green)' };
                  return [
                    { label: 'env', value: hasEnv ? '会修改' : '不修改', ok: !hasEnv },
                    { label: 'Skill Loader', value: hasLoader ? '会修改' : '不修改', ok: !hasLoader },
                    { label: 'Menu', value: hasMenu ? '会生成' : '不生成', ok: !hasMenu },
                    { label: 'allegro.ilinit', value: hasIlInit ? '会修改' : '不修改', ok: !hasIlInit },
                    { label: '可撤销', value: '是', ok: true },
                    { label: '风险等级', value: riskLabels[maxRisk] || '安全', ok: maxRisk === 'info' },
                  ].map((item, idx) => (
                    <div key={idx} className="impact-summary-item">
                      <span className={`status-pill-dot ${item.ok ? 'ok' : 'warning'}`} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}：</span>
                      <span style={{ color: item.ok ? 'var(--accent-green)' : 'var(--accent-yellow)', fontWeight: 500 }}>
                        {item.value}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* 说明 */}
          <div style={{
            padding: '10px 14px',
            marginBottom: '16px',
            borderRadius: '6px',
            background: 'rgba(96, 165, 250, 0.1)',
            border: '1px solid rgba(96, 165, 250, 0.25)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
          }}>
            以下是即将写入的配置<strong>预览</strong>。点击确认后才会修改 menu_profile.json、
            生成 generated_menu.il 并更新 bootstrap 配置。
            目前还没有写入任何文件，不会影响 Allegro。
          </div>
          {/* 步骤列表 */}
          {plan && plan.steps.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                将执行以下操作：
              </div>
              {plan.steps.map((step, idx) => {
                const stepInfo = getStepLabel(step.type);
                return (
                  <div
                    key={step.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      background: 'var(--bg-hover)',
                      fontSize: '13px',
                    }}
                  >
                    <span>{stepInfo.icon}</span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{step.title || stepInfo.label}</div>
                      {step.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {step.description}
                        </div>
                      )}
                      {step.targetFile && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                          {step.targetFile}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 风险提示 */}
          {plan && plan.risks && plan.risks.length > 0 && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                风险提示：
              </div>
              {plan.risks.map((risk, idx) => {
                const style = RISK_STYLES[risk.severity] || RISK_STYLES.info;
                return (
                  <div
                    key={risk.id || idx}
                    style={{
                      padding: '8px 10px',
                      marginBottom: '4px',
                      borderRadius: '4px',
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: style.color, fontWeight: 600 }}>
                      <span>{style.icon}</span>
                      <span>{risk.title}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '16px' }}>
                      {risk.description}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 重启提示 */}
          <div style={{
            marginTop: '16px',
            padding: '10px',
            borderRadius: '4px',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            fontSize: '12px',
            color: '#fbbf24',
          }}>
            ⚠ 菜单修改需要重启 Allegro 或在 Allegro 命令窗口执行 <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '2px' }}>atmLoadMenus</code> 后生效。
          </div>
        </div>

        {/* 按钮 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}>
          <button
            onClick={onCancel}
            disabled={applying}
            className="btn btn-sm"
            style={{
              padding: '8px 20px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: applying ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              opacity: applying ? 0.5 : 1,
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={applying}
            className="btn btn-sm btn-primary"
            style={{
              padding: '8px 20px',
              background: applying ? 'var(--bg-hover)' : 'var(--accent-blue)',
              color: applying ? 'var(--text-secondary)' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: applying ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {applying ? '正在写入...' : '确认写入并应用'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuApplyPlanDialog;
