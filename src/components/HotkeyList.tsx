/**
 * ATM - 快捷键列表组件（V1.5）
 * 列：类型 / 按键 / 中文命令 / 原始命令 / 快捷键来源 / 命令来源 / 所属Skill / 所属方案 / 状态 / 行号 / 操作
 */
import React from 'react';
import type { HotkeyBinding, BindingSourceType, CommandSourceType } from '../types/hotkey';

interface HotkeyListProps {
  bindings: HotkeyBinding[];
  onBindingClick?: (binding: HotkeyBinding) => void;
  highlightId?: string;
  onEdit?: (binding: HotkeyBinding) => void;
  onAdopt?: (binding: HotkeyBinding) => void;
  onOverrideSource?: (binding: HotkeyBinding) => void;
}

/** 快捷键来源标签 */
const BINDING_SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  user_env_original: { label: '用户原始 env', className: 'source-tag source-tag--unknown' },
  atm_managed_block: { label: 'ATM 托管块', className: 'source-tag source-tag--atm' },
  active_profile: { label: '当前方案', className: 'source-tag source-tag--user' },
  imported_profile: { label: '导入方案', className: 'source-tag source-tag--company' },
  generated: { label: '自动生成', className: 'source-tag source-tag--builtin' },
  allegro_default: { label: 'Allegro 默认', className: 'source-tag source-tag--builtin' },
  system_reserved: { label: '系统保留', className: 'source-tag source-tag--warning' },
};

/** 命令来源标签 */
const CMD_SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  allegro_builtin: { label: 'Allegro 内置', className: 'source-tag source-tag--builtin' },
  user_skill: { label: '本地 Skill', className: 'source-tag source-tag--user' },
  company_skill: { label: '公司 Skill', className: 'source-tag source-tag--company' },
  atm_managed_skill: { label: 'ATM 托管', className: 'source-tag source-tag--atm' },
  ambiguous: { label: '歧义', className: 'source-tag source-tag--warning' },
  unknown: { label: '未识别', className: 'source-tag source-tag--unknown' },
};

const LOAD_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  loaded_configured: { label: '已配置加载', className: 'badge badge-success' },
  maybe_unloaded: { label: '可能未加载', className: 'badge badge-warning' },
  unknown: { label: '未知', className: 'badge badge-info' },
};

const HotkeyList: React.FC<HotkeyListProps> = ({
  bindings, onBindingClick, highlightId, onEdit, onAdopt, onOverrideSource,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'normal': return <span className="badge badge-success">正常</span>;
      case 'duplicate': return <span className="badge badge-error">冲突</span>;
      case 'prefix_conflict': return <span className="badge badge-warning">前缀</span>;
      case 'missing_command': return <span className="badge badge-error">无命令</span>;
      case 'reserved': return <span className="badge badge-warning">保留键</span>;
      case 'disabled': return <span className="badge badge-info">禁用</span>;
      case 'adopted': return <span className="badge badge-info">已接管</span>;
      default: return null;
    }
  };

  if (bindings.length === 0) {
    return <div className="empty-state"><p>未检测到快捷键绑定</p></div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>类型</th>
          <th>按键/别名</th>
          <th>中文命令</th>
          <th>原始命令</th>
          <th>快捷键来源</th>
          <th>命令来源</th>
          <th>所属 Skill/文件</th>
          <th>所属方案</th>
          <th>状态</th>
          <th>行号</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {bindings.map((binding) => {
          const isSelected = binding.id === highlightId;
          const bSrc = BINDING_SOURCE_CONFIG[binding.bindingSource] || BINDING_SOURCE_CONFIG.user_env_original;
          const cSrc = CMD_SOURCE_CONFIG[binding.commandSource || 'unknown'] || CMD_SOURCE_CONFIG.unknown;
          const loadCfg = LOAD_STATUS_CONFIG[binding.loadStatus || 'unknown'];
          const showAdopt = binding.bindingSource === 'user_env_original' && !binding.isAdopted;

          return (
            <React.Fragment key={binding.id}>
            <tr
              onClick={() => onBindingClick?.(binding)}
              className={isSelected ? 'table-row-highlight' : ''}
              style={{ cursor: onBindingClick ? 'pointer' : undefined }}
              title={
                `按键: ${binding.key}\n` +
                `命令: ${binding.command}\n` +
                `中文: ${binding.chineseName || '—'}\n` +
                `快捷键来源: ${bSrc.label}\n` +
                `命令来源: ${cSrc.label}\n` +
                `Skill: ${binding.skillName || '—'}\n` +
                `文件: ${binding.skillFilePath || '—'}\n` +
                `方案: ${binding.profileName || '—'}\n` +
                `可信度: ${binding.confidence === 'high' ? '高' : binding.confidence === 'medium' ? '中' : '低'}\n` +
                `加载: ${loadCfg?.label || '未知'}\n` +
                (binding.lineNumber ? `行号: ${binding.lineNumber}\n` : '\n') +
                (binding.warnWhenOverride && binding.defaultOccupier
                  ? `⚠️ 覆盖风险：默认占用 ${binding.key} → ${binding.defaultOccupier.command}`
                  : '')
              }
            >
              <td>
                <span className={`badge ${binding.type === 'funckey' ? 'badge-info' : 'badge-warning'}`}>
                  {binding.type}
                </span>
              </td>
              <td style={{ fontWeight: 600 }}>{binding.key}</td>
              <td>
                <span className="chinese-cmd-name">
                  {binding.chineseName || binding.command}
                </span>
                {binding.commandSource === 'unknown' && !binding.chineseName && (
                  <span className="unrecognized-hint" style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>
                    未识别命令
                  </span>
                )}
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{binding.command}</td>
              <td>
                <span className={`source-tag ${bSrc.className}`}>{bSrc.label}</span>
              </td>
              <td>
                <span className={`source-tag ${cSrc.className}`} title={binding.description || ''}>
                  {cSrc.label}
                  {binding.isSourceOverridden && <span style={{ marginLeft: 2 }}>*</span>}
                </span>
              </td>
              <td>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {binding.skillName || '—'}
                </span>
                {binding.loadStatus === 'maybe_unloaded' && (
                  <span className="badge badge-warning" style={{ fontSize: 10, marginLeft: 4 }}>可能未加载</span>
                )}
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {binding.profileName || '—'}
              </td>
              <td>
                {getStatusBadge(binding.status)}
                {binding.warnWhenOverride && binding.defaultOccupier && (
                  <div className="overlay-warning" style={{ fontSize: 10, color: 'var(--accent-yellow)', marginTop: 2, whiteSpace: 'nowrap' }}>
                    ⚠️ 覆盖风险
                  </div>
                )}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{binding.lineNumber || '—'}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                  <button
                    className="btn btn-sm"
                    onClick={(e) => { e.stopPropagation(); onEdit?.(binding); }}
                    title="编辑"
                  >✏️</button>
                  {showAdopt && (
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); onAdopt?.(binding); }}
                      title="接管到当前方案"
                      style={{ color: 'var(--accent-blue)' }}
                    >📋</button>
                  )}
                  {!binding.isSourceOverridden && (
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); onOverrideSource?.(binding); }}
                      title="修正命令来源"
                      style={{ color: 'var(--accent-yellow)' }}
                    >🔧</button>
                  )}
                </div>
              </td>
            </tr>
            {binding.warnWhenOverride && binding.defaultOccupier && (
              <tr className="table-row-overlay-detail">
                <td colSpan={11} style={{ padding: '2px 8px 6px', fontSize: 11, color: 'var(--accent-yellow)', borderTop: 'none' }}>
                  <span style={{ fontWeight: 600 }}>我的绑定：</span>{binding.command}
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <span style={{ fontWeight: 600 }}>默认占用：</span>{binding.defaultOccupier.command}
                  &nbsp;&nbsp;|&nbsp;&nbsp;⚠️ 可能覆盖软件默认功能
                </td>
              </tr>
            )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export default HotkeyList;
