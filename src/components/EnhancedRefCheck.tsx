/**
 * ATM - 增强引用检查组件（V4.5）
 * 5 类问题检查：快捷键命令不存在 / Skill 未加载 / 菜单命令不存在 / 同名冲突 / 未引用 Skill
 */
import React, { useState } from 'react';
import type { SkillReferenceIssue, SkillCommandItem } from '../types/skill';

interface EnhancedRefCheckProps {
  issues: SkillReferenceIssue[];
  stats: { total: number; errors: number; warnings: number; infos: number };
  loading?: boolean;
  onAddToLoader?: (skillId: string) => void;
  onBindHotkey?: (commandName: string) => void;
  onAddMenu?: (commandName: string) => void;
  onViewSkill?: (skillId: string) => void;
  onIgnoreIssue?: (issueId: string) => void;
}

type FilterSeverity = 'all' | 'error' | 'warning' | 'info';
type FilterType = 'all' | 'hotkey_command_missing' | 'skill_not_loaded' | 'menu_command_missing' | 'duplicate_command' | 'skill_unreferenced' | 'parse_error' | 'skill_delete_has_refs' | 'duplicate_skill_command' | 'stale_hotkey_ref';

const EnhancedRefCheck: React.FC<EnhancedRefCheckProps> = ({
  issues,
  stats,
  loading = false,
  onAddToLoader,
  onBindHotkey,
  onAddMenu,
  onViewSkill,
  onIgnoreIssue,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (loading) {
    return <div className="loading">正在检查引用...</div>;
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div className="ref-check-success-mark" aria-hidden="true" />
        <p style={{ color: 'var(--accent-green)', fontWeight: 600 }}>所有引用检查通过</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>未发现问题</p>
      </div>
    );
  }

  // 筛选
  let filtered = [...issues];

  if (filterSeverity !== 'all') {
    filtered = filtered.filter((i) => i.severity === filterSeverity);
  }
  if (filterType !== 'all') {
    filtered = filtered.filter((i) => i.type === filterType);
  }
  if (!showIgnored) {
    filtered = filtered.filter((i) => !i.ignored);
  }

  // 按严重级别排序
  const severityOrder = { error: 0, warning: 1, info: 2 };
  filtered.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '错误';
      case 'warning': return '警告';
      case 'info': return '信息';
      default: return '未知';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'hotkey_command_missing': return '快捷键命令不存在';
      case 'skill_not_loaded': return 'Skill 未加载';
      case 'menu_command_missing': return '菜单命令不存在';
      case 'duplicate_command': return '同名命令冲突';
      case 'skill_unreferenced': return 'Skill 未被引用';
      case 'parse_error': return '解析错误';
      case 'skill_delete_has_refs': return '删除引用冲突';
      case 'duplicate_skill_command': return 'Skill 同名冲突';
      case 'stale_hotkey_ref': return '失效引用';
      default: return type;
    }
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'var(--accent-red)';
      case 'warning': return 'var(--accent-yellow)';
      case 'info': return 'var(--accent-blue)';
      default: return 'var(--border-color)';
    }
  };

  return (
    <div>
      {/* 统计 */}
      <div className="card" style={{ padding: '12px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span className="stat-label">总问题</span>
            <div className="stat-value" style={{ fontSize: 20, color: stats.total > 0 ? 'var(--accent-orange)' : 'var(--accent-green)' }}>
              {stats.total}
            </div>
          </div>
          <div>
            <span className="stat-label">错误</span>
            <div className="stat-value" style={{ fontSize: 20, color: stats.errors > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
              {stats.errors}
            </div>
          </div>
          <div>
            <span className="stat-label">警告</span>
            <div className="stat-value" style={{ fontSize: 20, color: stats.warnings > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
              {stats.warnings}
            </div>
          </div>
          <div>
            <span className="stat-label">提示</span>
            <div className="stat-value" style={{ fontSize: 20, color: stats.infos > 0 ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
              {stats.infos}
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>级别:</span>
          {(['all', 'error', 'warning', 'info'] as FilterSeverity[]).map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${filterSeverity === s ? 'btn-primary' : ''}`}
              onClick={() => setFilterSeverity(s)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {s === 'all' ? '全部' : s === 'error' ? '错误' : s === 'warning' ? '警告' : '提示'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>类型:</span>
          {(['all', 'hotkey_command_missing', 'skill_not_loaded', 'duplicate_command', 'skill_unreferenced', 'parse_error', 'skill_delete_has_refs', 'duplicate_skill_command', 'stale_hotkey_ref'] as FilterType[]).map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${filterType === t ? 'btn-primary' : ''}`}
              onClick={() => setFilterType(t)}
              style={{ fontSize: 10, padding: '3px 6px' }}
            >
              {getTypeLabel(t)}
            </button>
          ))}
        </div>
        <label style={{ marginLeft: 'auto', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={showIgnored} onChange={(e) => setShowIgnored(e.target.checked)} />
          显示已忽略
        </label>
      </div>

      {/* 问题列表 */}
      <div className="ref-issues-list">
        {filtered.map((issue) => (
          <div
            key={issue.id}
            className={`ref-issue-card ${issue.ignored ? 'ref-issue-ignored' : ''}`}
            style={{
              borderLeft: `3px solid ${getSeverityBorderColor(issue.severity)}`,
            }}
          >
            <div className="ref-issue-header" onClick={() => toggleExpand(issue.id)}>
              <div className="ref-issue-severity">{getSeverityIcon(issue.severity)}</div>
              <div className="ref-issue-type-badge" style={{
                background: issue.severity === 'error' ? 'rgba(247, 118, 142, 0.15)' :
                  issue.severity === 'warning' ? 'rgba(224, 175, 104, 0.15)' :
                  'rgba(122, 162, 247, 0.15)',
                color: issue.severity === 'error' ? 'var(--accent-red)' :
                  issue.severity === 'warning' ? 'var(--accent-yellow)' :
                  'var(--accent-blue)',
              }}>
                {getTypeLabel(issue.type)}
              </div>
              <div className="ref-issue-title">{issue.title}</div>
              <div className="ref-issue-expand">{expandedIds.has(issue.id) ? '▼' : '▶'}</div>
            </div>

            {expandedIds.has(issue.id) && (
              <div className="ref-issue-detail">
                <p className="ref-issue-description">{issue.description}</p>

                {issue.hotkeyKey && (
                  <div className="ref-issue-meta">
                    <span className="ref-issue-meta-label">快捷键:</span>
                    <code className="ref-issue-meta-value">{issue.hotkeyKey}</code>
                  </div>
                )}
                {issue.commandName && (
                  <div className="ref-issue-meta">
                    <span className="ref-issue-meta-label">命令:</span>
                    <code className="ref-issue-meta-value">{issue.commandName}</code>
                  </div>
                )}
                {issue.details?.matchedSkills && issue.details.matchedSkills.length > 0 && (
                  <div className="ref-issue-meta">
                    <span className="ref-issue-meta-label">涉及 Skill:</span>
                    <span className="ref-issue-meta-value">{issue.details.matchedSkills.join(', ')}</span>
                  </div>
                )}

                {/* 建议修复 */}
                {issue.suggestedActions.length > 0 && (
                  <div className="ref-issue-suggestions">
                    <div className="ref-issue-meta-label">建议修复:</div>
                    <ul>
                      {issue.suggestedActions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="ref-issue-actions">
                  {issue.type === 'skill_not_loaded' && onAddToLoader && issue.skillId && (
                    <button className="btn btn-sm" onClick={() => onAddToLoader(issue.skillId!)}>
                      加入 Loader
                    </button>
                  )}
                  {issue.type === 'skill_unreferenced' && onBindHotkey && issue.commandName && (
                    <button className="btn btn-sm" onClick={() => onBindHotkey(issue.commandName!)}>
                      绑定快捷键
                    </button>
                  )}
                  {issue.type === 'skill_unreferenced' && onAddMenu && issue.commandName && (
                    <button className="btn btn-sm" onClick={() => onAddMenu(issue.commandName!)}>
                      添加菜单
                    </button>
                  )}
                  {onViewSkill && issue.skillId && (
                    <button className="btn btn-sm" onClick={() => onViewSkill(issue.skillId!)}>
                      查看详情
                    </button>
                  )}
                  {onIgnoreIssue && !issue.ignored && (
                    <button className="btn btn-sm" onClick={() => onIgnoreIssue(issue.id)}>
                      忽略
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ padding: 24 }}>
            <p>无匹配的问题</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedRefCheck;
