import React, { useMemo, useState } from 'react';
import type { Conflict, EnhancedConflict, EnhancedConflictType } from '../types/hotkey';

interface EnhancedConflictListProps {
  conflicts: Conflict[];
  enhancedConflicts: EnhancedConflict[];
  ignoredConflictIds: string[];
  onIgnoreConflict: (id: string) => void;
  onEditBinding: (bindingId: string) => void;
  onViewRawLine: (filePath: string, lineNumber: number) => void;
  onOverrideSource: (command: string) => void;
}

const SEVERITY_LABELS: Record<'error' | 'warning' | 'info', string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
};

const CONFLICT_TYPE_LABELS: Record<EnhancedConflictType, string> = {
  same_env_duplicate: '同文件重复定义',
  reserved_key_override: '覆盖默认/保留键',
  unrecognized_command: '命令未识别',
  skill_not_loaded: 'Skill 可能未加载',
  cross_env_override: '跨 env 覆盖',
  profile_override_env: '方案覆盖用户 env',
  funckey_duplicate: 'Funckey 重复',
  alias_duplicate: 'Alias 重复',
  alias_prefix: 'Alias 前缀关系',
  cross_type_same_name: '跨类型同名',
};

interface ConflictGroup {
  subType: EnhancedConflictType;
  label: string;
  conflicts: EnhancedConflict[];
  maxSeverity: 'error' | 'warning' | 'info';
}

export const EnhancedConflictList: React.FC<EnhancedConflictListProps> = ({
  conflicts,
  enhancedConflicts,
  ignoredConflictIds,
  onIgnoreConflict,
  onEditBinding,
  onViewRawLine,
  onOverrideSource,
}) => {
  const [expandedGroup, setExpandedGroup] = useState<EnhancedConflictType | null>(null);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [showIgnored, setShowIgnored] = useState(false);

  const allEnhanced = useMemo<EnhancedConflict[]>(() => {
    const converted = (conflicts || []).map((conflict, index) => ({
      ...conflict,
      id: `basic_${index}`,
      subType: conflict.type as EnhancedConflictType,
      suggestions: getBasicSuggestions(conflict),
      ignoreable: conflict.severity !== 'error',
      involvedKeys: conflict.bindings
        .map((binding) => binding.key || binding.primaryKey || '')
        .filter(Boolean),
      involvedFiles: conflict.bindings
        .map((binding) => binding.envSourceId || binding.bindingSource || '')
        .filter(Boolean),
    }));

    const seen = new Set<string>();
    return [...converted, ...(enhancedConflicts || [])].filter((conflict) => {
      const signature = `${conflict.subType}_${conflict.involvedKeys.join('_')}_${conflict.message}`;
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }, [conflicts, enhancedConflicts]);

  const groups = useMemo<ConflictGroup[]>(() => {
    const grouped = new Map<EnhancedConflictType, EnhancedConflict[]>();
    const severityOrder: Record<'error' | 'warning' | 'info', number> = {
      error: 0,
      warning: 1,
      info: 2,
    };

    const filtered = allEnhanced.filter((conflict) => {
      if (filterSeverity !== 'all' && conflict.severity !== filterSeverity) {
        return false;
      }
      if (!showIgnored && ignoredConflictIds.includes(conflict.id)) {
        return false;
      }
      return true;
    });

    for (const conflict of filtered) {
      const list = grouped.get(conflict.subType) || [];
      list.push(conflict);
      grouped.set(conflict.subType, list);
    }

    const result: ConflictGroup[] = [];
    for (const [subType, list] of grouped.entries()) {
      const maxSeverity = list.reduce<'error' | 'warning' | 'info'>((current, conflict) => (
        severityOrder[conflict.severity] < severityOrder[current] ? conflict.severity : current
      ), 'info');

      result.push({
        subType,
        label: CONFLICT_TYPE_LABELS[subType] || subType,
        conflicts: list,
        maxSeverity,
      });
    }

    result.sort((left, right) => severityOrder[left.maxSeverity] - severityOrder[right.maxSeverity]);
    return result;
  }, [allEnhanced, filterSeverity, ignoredConflictIds, showIgnored]);

  const totals = useMemo(() => ({
    errors: allEnhanced.filter((conflict) => conflict.severity === 'error').length,
    warnings: allEnhanced.filter((conflict) => conflict.severity === 'warning').length,
    infos: allEnhanced.filter((conflict) => conflict.severity === 'info').length,
  }), [allEnhanced]);

  return (
    <div className="enhanced-conflict-list">
      <div className="conflict-stat-bar">
        <span className="conflict-stat total">共 {allEnhanced.length} 项</span>
        {totals.errors > 0 ? <span className="conflict-stat errors">{totals.errors} 个错误</span> : null}
        {totals.warnings > 0 ? <span className="conflict-stat warnings">{totals.warnings} 个警告</span> : null}
        {totals.infos > 0 ? <span className="conflict-stat infos">{totals.infos} 个提示</span> : null}
      </div>

      <div className="conflict-toolbar">
        <div className="conflict-filter-buttons" role="group" aria-label="冲突筛选">
          {(['all', 'error', 'warning', 'info'] as const).map((severity) => (
            <button
              key={severity}
              type="button"
              className={`btn btn-sm ${filterSeverity === severity ? 'btn-primary' : ''}`}
              onClick={() => setFilterSeverity(severity)}
            >
              {severity === 'all' ? '全部' : SEVERITY_LABELS[severity]}
            </button>
          ))}
        </div>

        <label className="conflict-show-ignored">
          <input
            type="checkbox"
            checked={showIgnored}
            onChange={() => setShowIgnored((value) => !value)}
          />
          <span>显示已忽略 ({ignoredConflictIds.length})</span>
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="conflict-empty">无冲突</div>
      ) : (
        <div className="conflict-groups">
          {groups.map((group) => (
            <div key={group.subType} className={`conflict-group severity-${group.maxSeverity}`}>
              <div
                className="conflict-group-header"
                onClick={() => setExpandedGroup(expandedGroup === group.subType ? null : group.subType)}
              >
                <span className={`conflict-group-badge badge-${group.maxSeverity}`}>
                  {group.label}
                </span>
                <span className="conflict-group-count">{group.conflicts.length} 项</span>
                <span className="expand-icon" aria-hidden="true">
                  {expandedGroup === group.subType ? '▲' : '▼'}
                </span>
              </div>

              {expandedGroup === group.subType ? (
                <div className="conflict-items">
                  {group.conflicts.map((conflict) => (
                    <div
                      key={conflict.id}
                      className={`conflict-item ${ignoredConflictIds.includes(conflict.id) ? 'conflict-ignored' : ''}`}
                    >
                      <div
                        className="conflict-item-header"
                        onClick={() => setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)}
                      >
                        <span className={`conflict-severity-badge severity-${conflict.severity}`}>
                          {SEVERITY_LABELS[conflict.severity]}
                        </span>
                        <span className="conflict-message">{conflict.message}</span>
                      </div>

                      <div className="conflict-item-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            const bindingId = conflict.bindings?.[0]?.id;
                            if (bindingId) {
                              onEditBinding(bindingId);
                            }
                          }}
                        >
                          编辑快捷键
                        </button>

                        {conflict.bindings?.map((binding) => (
                          binding.lineNumber ? (
                            <button
                              key={binding.id}
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                const filePath = binding.envSourceId || '';
                                const lineNumber = binding.lineNumber || 0;
                                if (lineNumber > 0) {
                                  onViewRawLine(filePath, lineNumber);
                                }
                              }}
                            >
                              查看原始行
                            </button>
                          ) : null
                        ))}

                        {conflict.ignoreable && !ignoredConflictIds.includes(conflict.id) ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => onIgnoreConflict(conflict.id)}
                          >
                            忽略此警告
                          </button>
                        ) : null}

                        {conflict.subType === 'unrecognized_command' ? (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => {
                              const command = conflict.bindings?.[0]?.command;
                              if (command) {
                                onOverrideSource(command);
                              }
                            }}
                          >
                            修正来源
                          </button>
                        ) : null}
                      </div>

                      {expandedConflict === conflict.id ? (
                        <div className="conflict-detail">
                          {conflict.suggestions?.length ? (
                            <div className="conflict-suggestions">
                              <span className="detail-label">建议</span>
                              <ul>
                                {conflict.suggestions.map((suggestion, index) => (
                                  <li key={index}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          <div className="conflict-bindings">
                            {conflict.bindings?.map((binding) => (
                              <div key={binding.id} className="conflict-binding-row">
                                <span className="conflict-binding-key">{binding.displayKey || binding.key}</span>
                                <span className="conflict-binding-arrow">→</span>
                                <span className="conflict-binding-cmd">{binding.command}</span>
                                <span className="conflict-binding-src">({binding.bindingSource})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getBasicSuggestions(conflict: Conflict): string[] {
  switch (conflict.type) {
    case 'funckey_duplicate':
    case 'alias_duplicate':
      return ['删除或修改其中一条快捷键', '确保同一个按键只映射一个命令'];
    case 'alias_prefix':
      return ['检查是否有意使用前缀关系', '如果不是有意设计，可以忽略或改名'];
    case 'cross_type_same_name':
      return ['避免 funckey 和 alias 同名，以免造成混淆'];
    case 'missing_command':
      return ['给空白快捷键补充命令', '或者直接删除这一行'];
    case 'reserved_key':
    case 'reserved_key_warning':
      return ['系统保留键不建议直接覆盖', '优先更换为其他可用按键'];
    default:
      return ['检查冲突来源，再决定保留、覆盖还是删除'];
  }
}

export default EnhancedConflictList;
