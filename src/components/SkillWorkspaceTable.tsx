import React from 'react';
import type { SkillFileItem, SkillMeta, SkillUsageInfo } from '../types/skill';
import { getLoadStatusDisplay, getSourceTypeLabel } from '../types/skill';

interface SkillWorkspaceTableProps {
  skills: SkillFileItem[];
  selectedSkillId?: string;
  metaMap: Record<string, SkillMeta>;
  usageStatuses: Record<string, SkillUsageInfo>;
  issueCountMap: Map<string, number>;
  pendingSkills: Record<string, 'pending_disable' | 'pending_enable'>;
  displayMode: 'original' | 'chinese' | 'bilingual';
  onSelect: (skill: SkillFileItem) => void;
  onToggle: (skillPath: string, enabled: boolean) => void;
}

function getDisplayName(
  skill: SkillFileItem,
  meta: SkillMeta | undefined,
  displayMode: SkillWorkspaceTableProps['displayMode'],
) {
  const chineseName = meta?.userName || meta?.displayName || meta?.autoName;
  if (displayMode === 'chinese' && chineseName) return chineseName;
  return skill.name;
}

function getSecondaryName(
  skill: SkillFileItem,
  meta: SkillMeta | undefined,
  displayMode: SkillWorkspaceTableProps['displayMode'],
) {
  const chineseName = meta?.userName || meta?.displayName || meta?.autoName;
  if (displayMode === 'original') return meta?.userNote || meta?.autoSummary;
  if (displayMode === 'chinese') return chineseName ? skill.name : meta?.userNote || meta?.autoSummary;
  return chineseName || meta?.userNote || meta?.autoSummary;
}

const SkillWorkspaceTable: React.FC<SkillWorkspaceTableProps> = ({
  skills,
  selectedSkillId,
  metaMap,
  usageStatuses,
  issueCountMap,
  pendingSkills,
  displayMode,
  onSelect,
  onToggle,
}) => {
  if (skills.length === 0) {
    return (
      <div className="skill-workspace-empty">
        <strong>没有符合当前条件的 Skill</strong>
        <span>调整筛选条件或重新扫描后再试。</span>
      </div>
    );
  }

  return (
    <div className="skill-workspace-table-wrap">
      <table className="skill-workspace-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>来源</th>
            <th>加载状态</th>
            <th className="skill-cell-number">命令</th>
            <th className="skill-cell-number">引用</th>
            <th className="skill-cell-number">健康度</th>
            <th className="skill-cell-number">问题</th>
            <th className="skill-cell-action">操作</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => {
            const meta = metaMap[skill.id];
            const usage = usageStatuses[skill.id];
            const issueCount = issueCountMap.get(skill.id) || 0;
            const referenceCount = skill.hotkeyRefs.length + skill.menuRefs.length;
            const pendingAction = pendingSkills[skill.id];
            const loadDisplay = getLoadStatusDisplay(skill.loadStatus);
            const selected = selectedSkillId === skill.id;
            const secondaryName = getSecondaryName(skill, meta, displayMode);

            return (
              <tr
                key={skill.id}
                className={selected ? 'is-selected' : ''}
                onClick={() => onSelect(skill)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(skill);
                  }
                }}
                aria-label={`查看 ${skill.name} 详情`}
              >
                <td>
                  <div className="skill-workspace-name">
                    <span className={`skill-source-mark skill-source-${skill.tier}`} aria-hidden="true" />
                    <div>
                      <strong>{getDisplayName(skill, meta, displayMode)}</strong>
                      {secondaryName && <span>{secondaryName}</span>}
                      <code title={skill.path}>{skill.path}</code>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`skill-source-badge skill-source-badge-${skill.tier}`}>
                    {getSourceTypeLabel(skill.sourceType)}
                  </span>
                </td>
                <td>
                  <span className="skill-load-state" style={{ color: loadDisplay.color }}>
                    <span className="skill-state-dot" aria-hidden="true" />
                    {pendingAction === 'pending_enable'
                      ? '待启用'
                      : pendingAction === 'pending_disable'
                        ? '待禁用'
                        : loadDisplay.label}
                  </span>
                </td>
                <td className="skill-cell-number">{skill.entryCommands.length}</td>
                <td className="skill-cell-number">{referenceCount}</td>
                <td className="skill-cell-number">
                  {usage ? (
                    <span className={`skill-health-value ${usage.healthScore < 50 ? 'is-danger' : usage.healthScore < 70 ? 'is-warning' : ''}`}>
                      {usage.healthScore}
                    </span>
                  ) : (
                    <span className="skill-cell-muted">—</span>
                  )}
                </td>
                <td className="skill-cell-number">
                  <span className={issueCount > 0 ? 'skill-issue-count has-issues' : 'skill-issue-count'}>
                    {issueCount}
                  </span>
                </td>
                <td className="skill-cell-action">
                  {skill.tier === 'company' ? (
                    <span className="skill-readonly-label">只读</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm skill-row-toggle"
                      disabled={Boolean(pendingAction)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(skill.path, !skill.enabled);
                      }}
                    >
                      {pendingAction ? '待应用' : skill.enabled ? '禁用' : '启用'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SkillWorkspaceTable;
