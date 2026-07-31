/**
 * ATM - 来源标签组件（V5.3）
 * 统一显示快捷键/Skill/菜单的来源类型徽章
 */
import React from 'react';
import { getSourceLabel, getSourceBadge, isSourceReadOnly } from '../types/applyPlan';

interface SourceBadgeProps {
  source: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  原始: { bg: 'rgba(125, 207, 255, 0.15)', color: 'var(--accent-cyan)' },
  托管: { bg: 'rgba(158, 206, 106, 0.15)', color: 'var(--accent-green)' },
  方案: { bg: 'rgba(122, 162, 247, 0.15)', color: 'var(--accent-blue)' },
  导入: { bg: 'rgba(224, 175, 104, 0.15)', color: 'var(--accent-yellow)' },
  默认: { bg: 'rgba(108, 108, 138, 0.15)', color: 'var(--text-muted)' },
  站点: { bg: 'rgba(187, 154, 247, 0.15)', color: 'var(--accent-purple)' },
  公司: { bg: 'rgba(247, 118, 142, 0.15)', color: 'var(--accent-red)' },
  系统: { bg: 'rgba(247, 118, 142, 0.1)', color: 'var(--accent-orange)' },
  用户: { bg: 'rgba(125, 207, 255, 0.15)', color: 'var(--accent-cyan)' },
  只读: { bg: 'rgba(108, 108, 138, 0.15)', color: 'var(--text-muted)' },
  包: { bg: 'rgba(255, 158, 100, 0.15)', color: 'var(--accent-orange)' },
  手动: { bg: 'rgba(122, 162, 247, 0.15)', color: 'var(--accent-blue)' },
};

const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  size = 'sm',
  showLabel = false,
}) => {
  const badge = getSourceBadge(source);
  const label = getSourceLabel(source);
  const colors = BADGE_COLORS[badge] || { bg: 'rgba(108, 108, 138, 0.1)', color: 'var(--text-muted)' };
  const readOnly = isSourceReadOnly(source);

  return (
    <span
      className="source-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: size === 'sm' ? '1px 6px' : '3px 10px',
        borderRadius: 'var(--radius-sm)',
        background: colors.bg,
        color: colors.color,
        fontSize: size === 'sm' ? 10 : 12,
        fontWeight: 500,
        cursor: 'default',
        whiteSpace: 'nowrap',
      }}
      title={label + (readOnly ? '（只读）' : '')}
    >
      {readOnly && <span style={{ opacity: 0.6 }}>只读</span>}
      {badge}
      {showLabel && <span style={{ marginLeft: 2 }}>{label}</span>}
    </span>
  );
};

export default SourceBadge;
