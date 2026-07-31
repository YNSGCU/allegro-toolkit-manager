/**
 * ATM - Skill 卡片组件（V5.2 增强版）
 * 显示使用状态、健康度评分、入口命令/内部函数区分、加载状态、快捷键引用状态、中文备注等
 */
import React from 'react';
import type { SkillFileItem, SkillUsageStatus, SkillUsageInfo, SkillMeta } from '../types/skill';
import { getLoadStatusDisplay, USAGE_STATUS_DISPLAY } from '../types/skill';

interface SkillCardProps {
  skill: SkillFileItem;
  onToggle: (skillPath: string, enabled: boolean) => void;
  onShowDetail: (skill: SkillFileItem) => void;
  selected?: boolean;
  /** 中文备注/元数据 */
  meta?: SkillMeta | null;
  /** 编辑备注 */
  onEditNote?: (skill: SkillFileItem) => void;
  /** 重新分析 */
  onReAnalyze?: (skill: SkillFileItem) => void;
  /** V5.1 删除 Skill */
  onDelete?: (skill: SkillFileItem) => void;
  /** V5.2 使用状态信息 */
  usageInfo?: SkillUsageInfo;
  /** 待应用操作（用于显示待禁用/待启用状态） */
  pendingAction?: 'pending_disable' | 'pending_enable';
  /** V5.3 显示模式 */
  displayMode?: 'original' | 'chinese' | 'bilingual';
}

const tierIcons: Record<string, string> = {
  company: '公司',
  user: '用户',
  atm: 'ATM',
};

const tierColors: Record<string, string> = {
  company: 'var(--accent-purple)',
  user: 'var(--accent-cyan)',
  atm: 'var(--accent-green)',
};

function getHealthColor(score: number): string {
  if (score >= 90) return 'var(--accent-green)';
  if (score >= 70) return 'var(--accent-cyan)';
  if (score >= 50) return 'var(--accent-yellow)';
  if (score >= 30) return 'var(--accent-orange)';
  return 'var(--accent-red)';
}

const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onToggle,
  onShowDetail,
  selected = false,
  meta,
  onEditNote,
  onReAnalyze,
  onDelete,
  usageInfo,
  pendingAction,
  displayMode = 'bilingual',
}) => {
  const isCompany = skill.tier === 'company';
  const isEnabled = skill.enabled;
  // 待应用状态覆盖实际启用状态显示
  const effectiveEnabled = pendingAction === 'pending_enable' ? true
    : pendingAction === 'pending_disable' ? false
    : isEnabled;

  // 加载状态显示
  const loadDisplay = getLoadStatusDisplay(skill.loadStatus);

  // ═══════════════════════════════════════════════
  // V5.3 显示模式逻辑
  // ═══════════════════════════════════════════════
  // 原始文件名（来自 filePath，永远保真）
  const originalName = meta?.originalName || skill.name;
  // 中文名称（用户设置 > 自动生成）
  const chineseName = meta?.userName || meta?.displayName || meta?.autoName || '';
  // 中文简介（用户备注 > 自动简介）
  const chineseSummary = meta?.userNote || meta?.autoSummary || '';

  // 根据 displayMode 决定标题和副标题
  let displayTitle: string;
  let displaySubtitle: string;
  let showOriginalHint: boolean;
  let showChineseHint: boolean;

  switch (displayMode) {
    case 'original':
      displayTitle = originalName;
      displaySubtitle = chineseName || '';
      showOriginalHint = false;
      showChineseHint = !!chineseName;
      break;
    case 'chinese':
      displayTitle = chineseName || originalName;
      displaySubtitle = '';
      showOriginalHint = !!chineseName;
      showChineseHint = false;
      break;
    case 'bilingual':
    default:
      displayTitle = originalName;
      displaySubtitle = chineseName;
      showOriginalHint = false;
      showChineseHint = !!chineseName;
      break;
  }
  // 副标题也可以是 autoSummary（当没有中文名时）
  if (!displaySubtitle && chineseSummary) {
    displaySubtitle = chineseSummary;
  }
  const displaySummary = chineseSummary;

  // 使用状态
  const statusInfo = usageInfo;
  const usageStatus: SkillUsageStatus = statusInfo?.status || (isCompany ? 'readonly_reference' : 'available');
  const healthScore = statusInfo?.healthScore ?? 100;
  const statusDisplay = USAGE_STATUS_DISPLAY[usageStatus] || USAGE_STATUS_DISPLAY.available;

  // 状态标签列表
  const statusTags: Array<{ label: string; color: string; bg: string; title?: string }> = [];

  if (pendingAction === 'pending_disable') {
    statusTags.push({ label: '待禁用', color: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.2)' });
  } else if (pendingAction === 'pending_enable') {
    statusTags.push({ label: '待启用', color: 'var(--accent-blue)', bg: 'rgba(122, 162, 247, 0.2)' });
  } else if (skill.enabled) {
    statusTags.push({ label: '已启用', color: 'var(--accent-green)', bg: 'rgba(158, 206, 106, 0.15)', title: 'ATM 当前方案中允许加载该 Skill' });
  } else {
    statusTags.push({ label: '已禁用', color: 'var(--accent-red)', bg: 'rgba(247, 118, 142, 0.15)', title: 'ATM 当前方案中不加载该 Skill' });
  }

  if (skill.loadStatus === 'loaded_configured') {
    statusTags.push({ label: '已配置加载', color: 'var(--accent-green)', bg: 'rgba(158, 206, 106, 0.15)', title: '检测到 loader/allegro.ilinit 中存在加载配置' });
  } else if (skill.loadStatus === 'enabled_but_not_loaded') {
    statusTags.push({ label: '可能未加载', color: 'var(--accent-yellow)', bg: 'rgba(224, 175, 104, 0.15)', title: '已启用但未在 loader 或 ilinit 中发现加载配置' });
  } else if (skill.readonly) {
    statusTags.push({ label: '只读', color: 'var(--accent-purple)', bg: 'rgba(187, 154, 247, 0.15)', title: '公司/只读 Skill，不可修改' });
  }

  // 组合状态警告提示
  if (skill.enabled && skill.loadStatus !== 'loaded_configured' && !skill.readonly) {
    statusTags.push({ label: '启用未加载', color: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.15)', title: 'Skill 已启用但未在 loader 中发现加载配置，快捷键可能无效' });
  } else if (!skill.enabled && skill.loadStatus === 'loaded_configured') {
    statusTags.push({ label: '禁用仍在加载', color: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.15)', title: 'Skill 已禁用但 loader 中仍有加载配置' });
  }

  if (skill.hotkeyRefs.length > 0) {
    const hotkeyKeys = skill.hotkeyRefs.map((r) => r.key).join(', ');
    statusTags.push({ label: `快捷键引用：${hotkeyKeys}`, color: 'var(--accent-cyan)', bg: 'rgba(125, 207, 255, 0.15)' });
  } else if (!isCompany) {
    statusTags.push({ label: '无引用', color: 'var(--text-muted)', bg: 'rgba(108, 108, 138, 0.08)' });
  }

  if (skill.menuRefs.length > 0) {
    statusTags.push({ label: '有菜单', color: 'var(--accent-blue)', bg: 'rgba(122, 162, 247, 0.15)' });
  }

  if (skill.parseStatus === 'error') {
    statusTags.push({ label: '解析失败', color: 'var(--accent-red)', bg: 'rgba(247, 118, 142, 0.15)' });
  }

  if (skill.hasPackageJson) {
    statusTags.push({ label: 'Skill 包', color: 'var(--accent-orange)', bg: 'rgba(255, 158, 100, 0.15)' });
  }

  // 入口命令名标签（最多展示 5 个）
  const entryNames = skill.entryCommands.map((c) => c.name);
  const displayEntryNames = entryNames.slice(0, 5);
  const remaining = entryNames.length - 5;

  // pending 状态下的边框颜色
  const pendingBorderColor = pendingAction === 'pending_disable' ? 'var(--accent-orange)'
    : pendingAction === 'pending_enable' ? 'var(--accent-blue)'
    : tierColors[skill.tier] || 'var(--accent-blue)';

  return (
    <div
      className={`skill-card ${selected ? 'skill-card-selected' : ''} ${pendingAction ? 'skill-card-pending' : ''}`}
      style={{
        opacity: effectiveEnabled ? 1 : 0.6,
        borderLeft: `3px solid ${pendingBorderColor}`,
        outline: pendingAction ? `1px dashed ${pendingBorderColor}` : 'none',
        outlineOffset: -1,
      }}
    >
      {/* 头部：名称 + 切换开关 + 健康度 */}
      <div className="skill-card-header">
        <div className="skill-card-title-row">
          <span className="skill-card-icon">{tierIcons[skill.tier]}</span>
          <span className="skill-card-name" title={`${originalName}${chineseName ? ' — ' + chineseName : ''}`}>
            {displayTitle}
          </span>
          <span className={`badge ${
            skill.tier === 'company' ? 'badge-info' :
            skill.tier === 'user' ? 'badge-success' :
            'badge-warning'
          }`}>
            {skill.tier === 'company' ? '公司' : skill.tier === 'user' ? '用户' : 'ATM'}
          </span>
          {skill.packageType === 'atm_package' && (
            <span className="badge badge-warning" style={{ fontSize: 10 }}>包</span>
          )}
        </div>
        {/* V5.3 副标题：中文名（双显模式）/ 英文名（中文模式） */}
        {displaySubtitle && (
          <div className="skill-card-subtitle" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, marginBottom: 4 }}>
            {showOriginalHint && <span style={{ opacity: 0.7 }}>原名：</span>}
            {displaySubtitle}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 健康度 — 悬停显示扣分原因 */}
          <span
            className="skill-health-badge"
            style={{ color: getHealthColor(healthScore), cursor: 'help', position: 'relative' }}
            title={
              (statusInfo?.healthDeductions && statusInfo.healthDeductions.length > 0
                ? '扣分明细:\n' + statusInfo.healthDeductions.map(d => '  -' + d.points + ': ' + d.reason).join('\n')
                : '健康度: ' + healthScore + '/100')
            }
          >
            {healthScore >= 90 ? '优' : healthScore >= 70 ? '良' : healthScore >= 50 ? '中' : '差'}
            {healthScore}
          </span>
          <div className="skill-card-toggle">
            {isCompany ? (
              <span className="badge badge-info" style={{ fontSize: 11 }}>只读</span>
            ) : pendingAction ? (
              <span className="badge badge-warning" style={{
                fontSize: 11,
                background: pendingAction === 'pending_disable' ? 'rgba(255, 158, 100, 0.2)' : 'rgba(122, 162, 247, 0.2)',
                color: pendingAction === 'pending_disable' ? 'var(--accent-orange)' : 'var(--accent-blue)',
              }}>
                {pendingAction === 'pending_disable' ? '待禁用' : '待启用'}
              </span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="toggle-switch" title={isEnabled ? '禁用' : '启用'}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => onToggle(skill.path, e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                {onDelete && (
                  <button
                    className="btn btn-sm"
                    onClick={(e) => { e.stopPropagation(); onDelete(skill); }}
                    title="删除"
                    style={{ color: 'var(--accent-red)', fontSize: 10, padding: '2px 6px', opacity: 0.7 }}
                  >
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 综合使用状态 */}
      <div className="skill-card-usage-status" style={{ color: statusDisplay.color }}>
        <span className="skill-usage-icon">{statusDisplay.icon}</span>
        <span className="skill-usage-label">状态：{statusDisplay.label}</span>
        {statusInfo?.reasons && statusInfo.reasons.length > 0 && (
          <span className="skill-usage-reason" title={statusInfo.reasons.join('；')}>
            — {statusInfo.reasons[0]}
          </span>
        )}
      </div>

      {/* V5.3 中文简介/备注 */}
      {displaySummary && (
        <div className="skill-card-summary" title={displaySummary}>
          {displaySummary}
        </div>
      )}

      {/* 原始文件名提示（仅中文模式且原标题不是原始名时） */}
      {displayMode === 'chinese' && originalName !== displayTitle && (
        <div className="skill-card-filename-hint" title={originalName}>
          原始: {originalName}
        </div>
      )}

      {/* 函数计数 */}
      <div className="skill-card-counts">
        <span className="skill-count-entry">
          <strong>入口命令：{skill.entryCommands.length}</strong> 个
        </span>
        <span className="skill-count-internal">
          内部函数：{skill.internalFunctions.length} 个
        </span>
        <span className="skill-count-total">
          总计：{skill.totalFunctionCount} 个
        </span>
      </div>

      {/* 路径 */}
      <div className="skill-card-path" title={skill.path}>
        {skill.path}
      </div>

      {/* 标签和可信度 */}
      <div className="skill-card-tags-row">
        {meta?.tags && meta.tags.length > 0 && (
          <div className="skill-card-tags">
            {meta.tags.slice(0, 4).map((tag, i) => (
              <span key={i} className="skill-meta-tag">{tag}</span>
            ))}
            {meta.tags.length > 4 && (
              <span className="skill-meta-tag skill-meta-tag-more">+{meta.tags.length - 4}</span>
            )}
          </div>
        )}
        {meta?.confidence && (
          <span
            className="skill-confidence-badge"
            style={{
              color: meta.confidence === 'high' ? 'var(--accent-green)' :
                     meta.confidence === 'medium' ? 'var(--accent-yellow)' : 'var(--accent-red)',
            }}
            title={`分析可信度: ${meta.confidence === 'high' ? '高' : meta.confidence === 'medium' ? '中' : '低'}`}
          >
            {meta.confidence === 'high' ? '高' : meta.confidence === 'medium' ? '中' : '低'}
          </span>
        )}
      </div>

      {/* 状态标签 */}
      <div className="skill-card-status-tags">
        {statusTags.map((tag, i) => (
          <span
            key={i}
            className="skill-status-tag"
            title={tag.title}
            style={{
              background: tag.bg,
              color: tag.color,
            }}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* 入口命令标签 + 操作按钮 */}
      <div className="skill-card-actions">
        <button className="btn btn-sm btn-primary" onClick={() => onShowDetail(skill)}>
          查看详情
        </button>
        {onEditNote && (
          <button className="btn btn-sm" onClick={() => onEditNote(skill)} title="编辑中文备注">
            备注
          </button>
        )}
        {onReAnalyze && (
          <button className="btn btn-sm" onClick={() => onReAnalyze(skill)} title="重新自动分析">
            分析
          </button>
        )}
        {entryNames.length > 0 && (
          <span className="skill-card-functions">
            {displayEntryNames.map((name) => (
              <code key={name} className="skill-func-tag" title="入口命令">{name}</code>
            ))}
            {remaining > 0 && (
              <code className="skill-func-tag" style={{ opacity: 0.6 }}>+{remaining}</code>
            )}
          </span>
        )}
        <span className="skill-load-badge" style={{ color: loadDisplay.color, fontSize: 11 }}>
          {loadDisplay.icon} {loadDisplay.label}
        </span>
      </div>
    </div>
  );
};

export default SkillCard;
