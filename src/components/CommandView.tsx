/**
 * ATM - 命令视图（V3.0 多视图模式）
 *
 * 按 category 分组显示快捷键命令，相同命令合并显示。
 * 紧凑行布局：中文命令 / 原始命令 / 快捷键 / 来源 / 分类
 */
import React, { useMemo, useState } from 'react';
import type { HotkeyBinding, CommandSourceType } from '../types/hotkey';
import { CMD_SRC_CONFIG, BINDING_SRC_CONFIG } from '../utils/hotkeyItem';
import { isReadonlyBinding } from '../utils/hotkeyItem';

interface CommandViewProps {
  bindings: HotkeyBinding[];
  selectedCommand: string | null;
  onSelectCommand: (command: string | null) => void;
  onEdit?: (binding: HotkeyBinding) => void;
  onDelete?: (binding: HotkeyBinding) => void;
  onAdopt?: (binding: HotkeyBinding) => void;
  onOverrideSource?: (binding: HotkeyBinding) => void;
}

/** 合并后的命令条目 */
interface MergedEntry {
  command: string;
  chineseName: string;
  bindings: HotkeyBinding[];
  mergedKeys: string[];
  mergedCommandSources: CommandSourceType[];
}

/** 分类组的显示顺序和标签 */
const CATEGORY_ORDER = ['编辑', '布线', '显示', '视图', '选择', '布局', '约束', '工具', '文件', '分析', '制造'];

const CATEGORY_LABEL: Record<string, string> = {
  '编辑': '编辑类',
  '布线': '布线类',
  '显示': '显示/查看类',
  '视图': '显示/查看类',
  '选择': '选择类',
  '布局': '布局类',
  '约束': '约束类',
  '工具': '工具类',
  '文件': '文件类',
  '分析': '分析类',
  '制造': '制造类',
};

const CATEGORY_ICON: Record<string, string> = {
  '编辑': '',
  '布线': '',
  '显示': '',
  '视图': '',
  '选择': '',
  '布局': '',
  '约束': '',
  '工具': '',
  '文件': '',
  '分析': '',
  '制造': '',
};

interface CategoryGroup {
  label: string;
  icon: string;
  entries: MergedEntry[];
}

const CommandView: React.FC<CommandViewProps> = ({
  bindings,
  selectedCommand,
  onSelectCommand,
  onEdit,
  onDelete,
  onAdopt,
  onOverrideSource,
}) => {
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());

  /** 按 category 分组和按 command 合并 */
  const groupedByCategory = useMemo(() => {
    // 第一阶段：按 command 合并
    const commandMap = new Map<string, MergedEntry>();

    for (const b of bindings) {
      const cmd = b.command;
      if (!commandMap.has(cmd)) {
        commandMap.set(cmd, {
          command: cmd,
          chineseName: b.chineseName || cmd,
          bindings: [],
          mergedKeys: [],
          mergedCommandSources: [],
        });
      }
      const entry = commandMap.get(cmd)!;
      entry.bindings.push(b);
      if (b.key && !entry.mergedKeys.includes(b.key)) {
        entry.mergedKeys.push(b.key);
      }
      if (b.commandSource && !entry.mergedCommandSources.includes(b.commandSource)) {
        entry.mergedCommandSources.push(b.commandSource);
      }
    }

    // 第二阶段：按 category 分组
    const categoryGroups = new Map<string, MergedEntry[]>();

    for (const [, entry] of commandMap) {
      // 决定所属分类
      let category = deriveCategory(entry);
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(entry);
    }

    // 第三阶段：排序
    const result: CategoryGroup[] = [];

    // 1) 字典分类
    for (const key of CATEGORY_ORDER) {
      const label = CATEGORY_LABEL[key];
      if (categoryGroups.has(key)) {
        result.push({
          label: label,
          icon: CATEGORY_ICON[key] || '',
          entries: categoryGroups.get(key)!,
        });
        categoryGroups.delete(key);
      }
    }

    // 2) 剩余的字典分类
    const remainingDict = Array.from(categoryGroups.entries())
      .filter(([k]) => !['skill_custom', 'unrecognized', 'uncategorized'].includes(k))
      .sort(([a], [b]) => a.localeCompare(b, 'zh'));
    for (const [key, entries] of remainingDict) {
      result.push({ label: key, icon: '', entries });
      categoryGroups.delete(key);
    }

    // 3) Skill/自定义类
    if (categoryGroups.has('skill_custom')) {
      result.push({ label: 'Skill/自定义类', icon: '', entries: categoryGroups.get('skill_custom')! });
      categoryGroups.delete('skill_custom');
    }

    // 4) 未识别命令
    if (categoryGroups.has('unrecognized')) {
      result.push({ label: '未识别命令', icon: '', entries: categoryGroups.get('unrecognized')! });
      categoryGroups.delete('unrecognized');
    }

    // 5) 未分类
    if (categoryGroups.has('uncategorized')) {
      result.push({ label: '未分类', icon: '', entries: categoryGroups.get('uncategorized')! });
      categoryGroups.delete('uncategorized');
    }

    return result;
  }, [bindings]);

  const getCmdSourceTag = (source?: string) => {
    const config = CMD_SRC_CONFIG[source || 'unknown'] || CMD_SRC_CONFIG.unknown;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  const getBindingSourceTag = (source?: string) => {
    const config = BINDING_SRC_CONFIG[source || 'user_env_original'] || BINDING_SRC_CONFIG.user_env_original;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  const toggleExpand = (cmd: string) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(cmd)) next.delete(cmd);
      else next.add(cmd);
      return next;
    });
  };

  if (bindings.length === 0) {
    return <div className="hotkey-map-empty">没有匹配的快捷键</div>;
  }

  return (
    <div className="command-view">
      {groupedByCategory.map((group) => (
        <div key={group.label} className="command-view-section">
          <div className="command-view-header">
            {group.icon} {group.label}
            <span className="command-view-count">{group.entries.length}</span>
          </div>

          <div className="command-view-table">
            {group.entries.map((entry) => {
              const isSelected = entry.command === selectedCommand;
              const hasMultiple = entry.bindings.length > 1;
              const isExpanded = expandedCommands.has(entry.command);

              return (
                <div key={entry.command}>
                  {/* 主行 */}
                  <div
                    className={`command-view-row ${isSelected ? 'command-view-row--selected' : ''}`}
                    onClick={() => {
                      onSelectCommand(isSelected ? null : entry.command);
                      if (hasMultiple) toggleExpand(entry.command);
                    }}
                  >
                    {/* 展开按钮 */}
                    {hasMultiple ? (
                      <span
                        className={`command-view-expand ${isExpanded ? 'command-view-expand--open' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleExpand(entry.command); }}
                      >▶</span>
                    ) : (
                      <span className="command-view-expand-placeholder" />
                    )}

                    {/* 中文命令 */}
                    <span className="command-view-chinese" title={entry.chineseName}>
                      {entry.chineseName !== entry.command
                        ? entry.chineseName
                        : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{entry.command}</span>}
                    </span>

                    {/* 原始命令 */}
                    <code className="command-view-cmd">{entry.command}</code>

                    {/* 快捷键 */}
                    <div className="command-view-keys">
                      {entry.mergedKeys.map((k) => (
                        <span key={k} className="command-view-key-pill">{k}</span>
                      ))}
                    </div>

                    {/* 命令来源 */}
                    <div className="command-view-sources" style={{ display: 'flex', gap: 2 }}>
                      {entry.mergedCommandSources.map((src) => (
                        <span key={src}>{getCmdSourceTag(src)}</span>
                      ))}
                    </div>

                    {/* 操作按钮（单绑定时直接显示） */}
                    {!hasMultiple && entry.bindings[0] && !isReadonlyBinding(entry.bindings[0]) && (
                      <div className="command-view-actions">
                        {onEdit && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                            onClick={(e) => { e.stopPropagation(); onEdit(entry.bindings[0]); }}
                            title="编辑"
                          >编辑</button>
                        )}
                        {onDelete && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                            onClick={(e) => { e.stopPropagation(); onDelete(entry.bindings[0]); }}
                            title="删除"
                          >删除</button>
                        )}
                        {onAdopt && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                            onClick={(e) => { e.stopPropagation(); onAdopt(entry.bindings[0]); }}
                            title="接管"
                          >接管</button>
                        )}
                        {onOverrideSource && entry.bindings[0].commandSource !== 'allegro_builtin' && (
                          <button
                            className="btn btn-sm"
                            style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                            onClick={(e) => { e.stopPropagation(); onOverrideSource(entry.bindings[0]); }}
                            title="修正来源"
                          >修正</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 展开的绑定详情（多绑定时） */}
                  {isExpanded && hasMultiple && (
                    <div className="command-view-details">
                      {entry.bindings.map((b) => (
                        <div key={b.id} className="command-view-binding-row">
                          <span className="command-view-key-pill">{b.key}</span>
                          <span className="command-view-binding-source">
                            {getBindingSourceTag(b.bindingSource)}
                          </span>
                          <span className="command-view-binding-source">
                            {getCmdSourceTag(b.commandSource)}
                          </span>
                          {b.lineNumber && (
                            <span className="hotkey-card-line">行{b.lineNumber}</span>
                          )}
                          <span className={`status-dot ${b.status === 'normal' ? 'ok' : 'error'}`} />
                          {!isReadonlyBinding(b) && (
                            <div className="command-view-actions" style={{ marginLeft: 'auto' }}>
                              {onEdit && (
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }} onClick={(e) => { e.stopPropagation(); onEdit(b); }} title="编辑">编辑</button>
                              )}
                              {onDelete && (
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }} onClick={(e) => { e.stopPropagation(); onDelete(b); }} title="删除">删除</button>
                              )}
                              {onAdopt && (
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }} onClick={(e) => { e.stopPropagation(); onAdopt(b); }} title="接管">接管</button>
                              )}
                              {onOverrideSource && b.commandSource !== 'allegro_builtin' && (
                                <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }} onClick={(e) => { e.stopPropagation(); onOverrideSource(b); }} title="修正来源">修正</button>
                              )}
                            </div>
                          )}
                          {isReadonlyBinding(b) && (
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>只读</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 根据命令绑定的分类策略决定所属分组。
 * 优先使用 dictionary 中的 category，否则根据 commandSource 判断。
 */
function deriveCategory(entry: MergedEntry): string {
  // 取第一个非空的 category
  for (const b of entry.bindings) {
    if (b.category && b.category.trim()) {
      return b.category;
    }
  }

  // 如果没有 category，根据 commandSource 判断
  for (const b of entry.bindings) {
    if (b.commandSource === 'user_skill' || b.commandSource === 'atm_managed_skill' || b.commandSource === 'company_skill') {
      return 'skill_custom';
    }
    if (b.commandSource === 'unknown' || b.confidence === 'low') {
      return 'unrecognized';
    }
  }

  return 'uncategorized';
}

export default CommandView;
