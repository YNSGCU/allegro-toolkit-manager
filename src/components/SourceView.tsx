/**
 * ATM - 来源视图（V3.0 多视图模式）
 *
 * 按 commandSource 分组显示快捷键绑定。
 * Allegro 内置 / 用户 Skill / ATM 托管 / 公司 Skill / 未识别
 */
import React, { useMemo } from 'react';
import type { HotkeyBinding, CommandSourceType } from '../types/hotkey';
import { CMD_SRC_CONFIG, BINDING_SRC_CONFIG, isReadonlyBinding } from '../utils/hotkeyItem';

interface SourceViewProps {
  bindings: HotkeyBinding[];
  selectedCommand: string | null;
  onSelectCommand: (command: string | null) => void;
  onEdit?: (binding: HotkeyBinding) => void;
  onDelete?: (binding: HotkeyBinding) => void;
  onAdopt?: (binding: HotkeyBinding) => void;
  onOverrideSource?: (binding: HotkeyBinding) => void;
}

/** 来源分组顺序 */
const SOURCE_ORDER: CommandSourceType[] = [
  'allegro_builtin',
  'user_skill',
  'atm_managed_skill',
  'company_skill',
  'ambiguous',
  'unknown',
];

const SOURCE_ICON: Record<string, string> = {
  allegro_builtin: '⚡',
  user_skill: '📦',
  atm_managed_skill: '🤖',
  company_skill: '🏢',
  ambiguous: '⚠️',
  unknown: '❓',
};

interface SourceGroup {
  source: CommandSourceType;
  label: string;
  icon: string;
  className: string;
  bindings: HotkeyBinding[];
}

const SourceView: React.FC<SourceViewProps> = ({
  bindings,
  selectedCommand,
  onSelectCommand,
  onEdit,
  onDelete,
  onAdopt,
  onOverrideSource,
}) => {
  const groupedBySource = useMemo(() => {
    const map = new Map<CommandSourceType, HotkeyBinding[]>();

    for (const b of bindings) {
      const src = b.commandSource || 'unknown';
      if (!map.has(src)) {
        map.set(src, []);
      }
      map.get(src)!.push(b);
    }

    // 按 SOURCE_ORDER 排序，未知来源排末位
    return SOURCE_ORDER
      .filter((src) => map.has(src))
      .map((src) => {
        const config = CMD_SRC_CONFIG[src] || CMD_SRC_CONFIG.unknown;
        return {
          source: src,
          label: config.label,
          icon: SOURCE_ICON[src] || '❓',
          className: config.className,
          bindings: map.get(src)!,
        } as SourceGroup;
      });
  }, [bindings]);

  const getCmdSourceTag = (source?: string) => {
    const config = CMD_SRC_CONFIG[source || 'unknown'] || CMD_SRC_CONFIG.unknown;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  const getBindingSourceTag = (source?: string) => {
    const config = BINDING_SRC_CONFIG[source || 'user_env_original'] || BINDING_SRC_CONFIG.user_env_original;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  if (bindings.length === 0) {
    return <div className="hotkey-map-empty">没有匹配的快捷键</div>;
  }

  return (
    <div className="source-view">
      {groupedBySource.map((group) => (
        <div key={group.source} className="source-view-section">
          <div className="source-view-header" style={{ borderLeft: `3px solid` }}>
            {getCmdSourceTag(group.source)}
            <span className="source-view-count">{group.bindings.length}</span>
          </div>

          <div className="source-view-table">
            {group.bindings.map((b) => {
              const isSelected = b.command === selectedCommand;
              const readonly = isReadonlyBinding(b);

              return (
                <div
                  key={b.id}
                  className={`source-view-row ${isSelected ? 'source-view-row--selected' : ''}`}
                  onClick={() => onSelectCommand(isSelected ? null : b.command)}
                >
                  {/* 快捷键 */}
                  <span className="source-view-key">{b.displayKey || b.key}</span>

                  {/* 命令 + 中文名 */}
                  <div className="source-view-cmd-block">
                    <code className="source-view-cmd">{b.command}</code>
                    {b.chineseName && b.chineseName !== b.command && (
                      <span className="source-view-chinese">{b.chineseName}</span>
                    )}
                  </div>

                  {/* 分类标签 */}
                  {b.category && (
                    <span className="source-view-category">{b.category}</span>
                  )}

                  {/* 快捷键来源 */}
                  <div className="source-view-binding-source">
                    {getBindingSourceTag(b.bindingSource)}
                  </div>

                  {/* 操作按钮 */}
                  {!readonly && (
                    <div className="source-view-actions">
                      {onEdit && (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                          onClick={(e) => { e.stopPropagation(); onEdit(b); }}
                          title="编辑"
                        >✏️</button>
                      )}
                      {onDelete && (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                          onClick={(e) => { e.stopPropagation(); onDelete(b); }}
                          title="删除"
                        >🗑️</button>
                      )}
                      {onAdopt && (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                          onClick={(e) => { e.stopPropagation(); onAdopt(b); }}
                          title="接管"
                        >📋</button>
                      )}
                      {onOverrideSource && b.commandSource !== 'allegro_builtin' && (
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                          onClick={(e) => { e.stopPropagation(); onOverrideSource(b); }}
                          title="修正来源"
                        >🔧</button>
                      )}
                    </div>
                  )}
                  {readonly && (
                    <span className="source-view-readonly" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>🔒 只读</span>
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

export default SourceView;
