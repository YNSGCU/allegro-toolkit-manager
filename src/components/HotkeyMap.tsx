/**
 * ATM - 快捷键地图（V1.6 三视图）
 *
 * 视图模式：
 *   my       — 只显示用户真实快捷键（env/Profile）
 *   reserved — 只显示软件默认/系统保留键（只读）
 *   overlay  — 同时显示，冲突部分用警告标识
 */
import React, { useMemo, useState } from 'react';
import type { HotkeyBinding, Conflict } from '../types/hotkey';
import CommandView from './CommandView';
import SourceView from './SourceView';
import ConflictList from './ConflictList';
import { BINDING_SRC_CONFIG, CMD_SRC_CONFIG } from '../utils/hotkeyItem';

// ─── 视图模式 ──────────────────────────────────────────────────

export type MapViewMode = 'my' | 'reserved' | 'overlay';
export type MapContentViewMode = 'key' | 'command' | 'source' | 'conflict';

// ─── 分类定义 ──────────────────────────────────────────────────

type BindingCategory =
  | 'letter_funckey'
  | 'function_funckey'
  | 'number_funckey'
  | 'alias'
  | 'atm_managed'
  | 'conflict_warning'
  | 'allegro_default_group'
  | 'system_reserved_group'
  | 'overlay_conflict_group';

const CATEGORY_LABEL: Record<string, string> = {
  letter_funckey: '字母单键 funckey',
  function_funckey: '功能键 funckey',
  number_funckey: '数字/符号 funckey',
  alias: 'alias 别名',
  atm_managed: 'ATM 托管快捷键',
  conflict_warning: '冲突/警告项',
  allegro_default_group: '🔒 Allegro 软件默认键',
  system_reserved_group: '🔒 系统保留键',
  overlay_conflict_group: '⚠️ 覆盖风险（用户已绑定默认占用键）',
};

const CATEGORY_ICON: Record<string, string> = {
  letter_funckey: '🔤',
  function_funckey: '⌨️',
  number_funckey: '🔢',
  alias: '🔗',
  atm_managed: '🤖',
  conflict_warning: '⚠️',
  allegro_default_group: '🔒',
  system_reserved_group: '🔒',
  overlay_conflict_group: '⚠️',
};

// ─── 来源标签配置（从 hotkeyItem.ts 共享）────────────────────────

const BINDING_SOURCE_CONFIG = BINDING_SRC_CONFIG;
const CMD_SOURCE_CONFIG = CMD_SRC_CONFIG;

// ─── 辅助函数 ──────────────────────────────────────────────────

function classifyBinding(b: HotkeyBinding): BindingCategory {
  if (b.bindingSource === 'allegro_default') return 'allegro_default_group';
  if (b.bindingSource === 'system_reserved') return 'system_reserved_group';
  if (b.status === 'duplicate' || b.status === 'prefix_conflict') return 'conflict_warning';
  if (b.source === 'atm_managed' || b.bindingSource === 'atm_managed_block') return 'atm_managed';
  if (b.type === 'alias') return 'alias';
  const key = b.key.replace(/^[~CS]*(?:\+)?/i, '');
  if (/^F\d{1,2}$/i.test(key)) return 'function_funckey';
  if (/^[0-9`~\-=!@#$%^&*()_+[\]\\;',./<>?:"|{}]$/.test(key)) return 'number_funckey';
  return 'letter_funckey';
}

function buildTooltip(b: HotkeyBinding): string {
  const lines: string[] = [];
  lines.push(`${b.type.toUpperCase()} ${b.key} → ${b.command}`);
  if (b.chineseName && b.chineseName !== b.command) lines.push(`中文: ${b.chineseName}`);
  const bSrc = BINDING_SOURCE_CONFIG[b.bindingSource]?.label || '未知';
  const cSrc = CMD_SOURCE_CONFIG[b.commandSource || 'unknown']?.label || '未知';
  lines.push(`快捷键来源: ${bSrc}`);
  lines.push(`命令来源: ${cSrc}`);
  if (b.skillName) lines.push(`Skill: ${b.skillName}`);
  if (b.skillFilePath) lines.push(`文件: ${b.skillFilePath}`);
  if (b.profileName) lines.push(`方案: ${b.profileName}`);
  if (b.lineNumber) lines.push(`行号: ${b.lineNumber}`);
  if (b.defaultOccupier) {
    lines.push(`---`);
    lines.push(`⚠️ 默认占用: ${b.defaultOccupier.command}`);
    lines.push(`   ${b.defaultOccupier.description}`);
  }
  if (b.confidence) {
    const m: Record<string, string> = { high: '高', medium: '中', low: '低' };
    lines.push(`可信度: ${m[b.confidence] || b.confidence}`);
  }
  return lines.join('\n');
}

// ─── 组件 ──────────────────────────────────────────────────────

export type MapFilter = 'all' | 'funckey' | 'alias' | 'conflict' | 'warning' | 'atm_managed' | 'user_original';

interface HotkeyMapProps {
  bindings: HotkeyBinding[];
  reservedBindings?: HotkeyBinding[];
  conflicts: Conflict[];
  selectedBindingId: string | null;
  onSelectBinding: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: MapFilter;
  onFilterChange: (f: MapFilter) => void;
  onEdit?: (binding: HotkeyBinding) => void;
  viewMode: MapViewMode;
  // V3.0 多视图模式
  selectedCommand?: string | null;
  onSelectCommand?: (command: string | null) => void;
  onDelete?: (binding: HotkeyBinding) => void;
  onAdopt?: (binding: HotkeyBinding) => void;
  onOverrideSource?: (binding: HotkeyBinding) => void;
}

const HotkeyMap: React.FC<HotkeyMapProps> = ({
  bindings,
  reservedBindings = [],
  conflicts,
  selectedBindingId,
  onSelectBinding,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  onEdit,
  viewMode,
  selectedCommand,
  onSelectCommand,
  onDelete,
  onAdopt,
  onOverrideSource,
}) => {
  const [expandHints, setExpandHints] = useState<Set<string>>(new Set());
  const [contentViewMode, setContentViewMode] = useState<MapContentViewMode>('key');

  // 根据视图模式筛选绑定
  const displayBindings = useMemo(() => {
    switch (viewMode) {
      case 'my':
        // 只显示用户真实快捷键（非保留键）
        return bindings.filter((b) =>
          b.bindingSource !== 'allegro_default' &&
          b.bindingSource !== 'system_reserved' &&
          b.visibleInUserMap !== false
        );
      case 'reserved':
        // 只显示保留键
        return reservedBindings.filter((b) => b.visibleInReservedMap !== false);
      case 'overlay': {
        // 合并用户绑定和保留键
        const reservedMap = new Map(reservedBindings.map((b) => [b.key.toLowerCase(), b]));
        const seen = new Set<string>();
        const result: HotkeyBinding[] = [];

        // 先添加用户绑定，注入冲突信息
        for (const b of bindings) {
          const bKey = b.key.toLowerCase();
          const reserved = reservedMap.get(bKey);
          if (reserved) {
            // 用户绑定了默认占用键 → 标记为冲突/覆盖风险
            result.push({
              ...b,
              status: b.status === 'normal' ? 'duplicate' : b.status,
              warnWhenOverride: true,
              defaultOccupier: reserved.defaultOccupier,
              notes: [...(b.notes || []), `⚠️ 覆盖风险：Allegro 默认占用 ${reserved.key} → ${reserved.command}`],
            });
            // 将被覆盖的保留键也加入
            result.push({
              ...reserved,
              id: reserved.id + '_overridden',
              status: 'duplicate',
              notes: [`被用户绑定 ${b.key} → ${b.command} 覆盖中`],
            });
          } else {
            // 正常用户绑定
            result.push({
              ...b,
              warnWhenOverride: false,
            });
          }
          seen.add(b.id);
        }

        // 添加未被覆盖的保留键
        for (const b of reservedBindings) {
          if (!seen.has(b.id)) {
            result.push(b);
          }
        }

        return result;
      }
      default:
        return bindings;
    }
  }, [bindings, reservedBindings, viewMode]);

  // 筛选 + 搜索（提取为独立 memo，供所有视图共享）
  const filteredBindings = useMemo(() => {
    const bindingConflictMap = new Map<string, Conflict>();
    for (const c of conflicts) {
      for (const cb of c.bindings) {
        bindingConflictMap.set(cb.id, c);
      }
    }

    return displayBindings.filter((b) => {
      // 筛选
      if (filter !== 'all') {
        switch (filter) {
          case 'funckey': if (b.type !== 'funckey') return false; break;
          case 'alias': if (b.type !== 'alias') return false; break;
          case 'conflict': if (!bindingConflictMap.has(b.id) && b.status !== 'duplicate') return false; break;
          case 'warning':
            if (bindingConflictMap.get(b.id)?.severity !== 'warning') return false; break;
          case 'atm_managed': if (b.bindingSource !== 'atm_managed_block') return false; break;
          case 'user_original': if (b.bindingSource !== 'user_env_original') return false; break;
        }
      }

      // 搜索（扩展支持来源标签和分类名）
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesKey = b.key.toLowerCase().includes(q);
        const matchesCmd = b.command.toLowerCase().includes(q);
        const matchesChinese = (b.chineseName || '').toLowerCase().includes(q);
        const bSrcLabel = (BINDING_SRC_CONFIG[b.bindingSource]?.label || '').toLowerCase();
        const cSrcLabel = (CMD_SRC_CONFIG[b.commandSource || 'unknown']?.label || '').toLowerCase();
        const matchesSource = bSrcLabel.includes(q) || cSrcLabel.includes(q);
        const matchesCategory = (b.category || '').toLowerCase().includes(q);
        if (!matchesKey && !matchesCmd && !matchesChinese && !matchesSource && !matchesCategory) return false;
      }

      return true;
    });
  }, [displayBindings, conflicts, filter, searchQuery]);

  // 分类 + 分组（仅按键视图使用）
  const grouped = useMemo(() => {
    const categories: Record<string, HotkeyBinding[]> = {};

    for (const b of filteredBindings) {
      const cat = classifyBinding(b);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(b);
    }

    return Object.entries(categories).map(([cat, bs]) => ({ cat: cat as BindingCategory, bindings: bs }));
  }, [filteredBindings]);

  const FILTER_OPTIONS: { key: MapFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'funckey', label: 'Funckey' },
    { key: 'alias', label: 'Alias' },
    { key: 'conflict', label: '冲突' },
    { key: 'warning', label: '警告' },
    { key: 'atm_managed', label: 'ATM 托管' },
    { key: 'user_original', label: '用户原始' },
  ];

  const getBindingSourceTag = (source?: string) => {
    const config = BINDING_SOURCE_CONFIG[source || 'user_env_original'] || BINDING_SOURCE_CONFIG.user_env_original;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  const getCmdSourceTag = (source?: string) => {
    const config = CMD_SOURCE_CONFIG[source || 'unknown'] || CMD_SOURCE_CONFIG.unknown;
    return <span className={`source-tag ${config.className}`}>{config.label}</span>;
  };

  return (
    <div className="card hotkey-map">
      <div className="card-header">🗺️ 快捷键地图</div>

      {/* 视图说明 */}
      {viewMode === 'reserved' && (
        <p className="card-subtitle" style={{ marginBottom: 8 }}>
          🔒 这些是 Allegro 软件默认占用或系统保留的快捷键，仅用于参考，不可直接编辑。
          {reservedBindings.length > 0 && ' 若要覆盖，在"我的快捷键"中绑定相同按键即可。'}
        </p>
      )}
      {viewMode === 'overlay' && (
        <p className="card-subtitle" style={{ marginBottom: 8 }}>
          📌 同时展示用户快捷键和系统默认键。黄色 ⚠️ 标记表示用户绑定了默认占用键，存在覆盖风险。
        </p>
      )}

      {/* 工具栏 */}
      {viewMode !== 'reserved' && (
        <div className="hotkey-map-toolbar">
          <div className="hotkey-map-filters">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                className={`btn btn-sm ${filter === opt.key ? 'btn-primary' : ''}`}
                onClick={() => onFilterChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            className="search-input hotkey-map-search"
            type="text"
            placeholder="搜索命令、按键或中文名..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}

      {/* V3.0 视图切换标签栏 */}
      <div className="hotkey-map-view-switcher">
        {[
          { key: 'key' as MapContentViewMode, label: '🔑 按键视图' },
          { key: 'command' as MapContentViewMode, label: '📋 命令视图' },
          { key: 'source' as MapContentViewMode, label: '📦 来源视图' },
          { key: 'conflict' as MapContentViewMode, label: '⚔️ 冲突视图' },
        ].map((opt) => (
          <button
            key={opt.key}
            className={`kv-view-tab ${contentViewMode === opt.key ? 'kv-view-tab--active' : ''}`}
            onClick={() => setContentViewMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 视图内容 */}
      {contentViewMode === 'key' && (
        <>
          {filteredBindings.length === 0 && (
            <div className="hotkey-map-empty">
              {searchQuery ? '没有匹配的快捷键' : viewMode === 'my' ? '暂无快捷键绑定' : '暂无保留键数据'}
            </div>
          )}

          {grouped.map(({ cat, bindings: catBindings }) => (
            <div key={cat} className="hotkey-map-group">
              <div className="hotkey-map-group-header">
                {CATEGORY_ICON[cat] || '📌'} {CATEGORY_LABEL[cat] || cat}
                <span className="hotkey-map-count">{catBindings.length}</span>
              </div>
              <div className="hotkey-map-cards">
                {catBindings.map((b) => {
                  const isSelected = b.id === selectedBindingId;
                  const isReadOnly = b.editable === false;
                  const isOverlayConflict = b.defaultOccupier && viewMode === 'overlay';

                  let cardClass = isSelected ? 'hotkey-card-selected' : '';
                  if (isOverlayConflict && b.warnWhenOverride) cardClass += ' hotkey-card-warning';
                  if (b.status === 'duplicate' && !isOverlayConflict) cardClass += ' hotkey-card-error';
                  if (isReadOnly) cardClass += ' hotkey-card-readonly';

                  return (
                    <div
                      key={b.id}
                      className={`hotkey-card ${cardClass}`}
                      onClick={() => onSelectBinding(isSelected ? null : b.id)}
                      title={buildTooltip(b)}
                    >
                      <div className="hotkey-card-body">
                        <div className="hotkey-card-key">
                        <span className="hotkey-card-keyname">{b.key}</span>
                        <span className={`badge ${b.type === 'funckey' ? 'badge-info' : 'badge-success'}`}>
                          {b.type === 'funckey' ? 'F' : 'A'}
                        </span>
                        {isReadOnly && <span className="hotkey-card-lock" title="只读（系统/软件默认占用）">🔒</span>}
                      </div>

                      <div className="hotkey-card-chinese" title={b.description || b.command}>
                        {isReadOnly && <span className="hotkey-card-default-label">[默认] </span>}
                        {b.chineseName && b.chineseName !== b.command
                          ? b.chineseName
                          : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{b.command || '(无命令)'}</span>}
                      </div>

                      <code className="hotkey-card-cmd">{b.command || '—'}</code>

                      <div className="hotkey-card-source-row">
                        <div className="hotkey-card-source-item">
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>快捷键:</span>
                          {getBindingSourceTag(b.bindingSource)}
                        </div>
                        <div className="hotkey-card-source-item">
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>命令:</span>
                          {getCmdSourceTag(b.commandSource)}
                          {b.skillName && (
                            <span className="hotkey-card-skillname" title={b.skillFilePath || ''}>
                              {b.skillName}
                            </span>
                          )}
                        </div>
                      </div>

                      {isOverlayConflict && b.defaultOccupier && (
                        <div className="hotkey-card-override-warning">
                          <div>⚠️ 覆盖风险</div>
                          <div className="hotkey-card-override-detail">
                            默认占用: {b.defaultOccupier.command} — {b.defaultOccupier.description}
                          </div>
                        </div>
                      )}

                      {b.loadStatus === 'maybe_unloaded' && (
                        <div className="hotkey-card-warning-banner">
                          ⚠️ 该命令可能来自 Skill，但未发现启动加载配置
                        </div>
                      )}

                      </div>
                      <div className="hotkey-card-footer">
                      <div className="hotkey-card-meta">
                        <span className={`status-dot ${b.status === 'normal' ? 'ok' : 'error'}`} />
                        <span className="hotkey-card-source">
                          {b.profileName || (b.bindingSource === 'allegro_default' ? 'Allegro' : b.bindingSource === 'system_reserved' ? '系统' : b.source === 'atm_managed' ? 'ATM' : '用户')}
                        </span>
                        {b.lineNumber && <span className="hotkey-card-line">行{b.lineNumber}</span>}
                        {!isReadOnly && onEdit && (
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border-color)' }}
                            onClick={(e) => { e.stopPropagation(); onEdit(b); }}
                            title="编辑此快捷键"
                          >✏️</button>
                        )}
                        {isReadOnly && (
                          <span className="hotkey-card-readonly-badge" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                            🔒 只读
                          </span>
                        )}
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {contentViewMode === 'command' && (
        <CommandView
          bindings={filteredBindings}
          selectedCommand={selectedCommand ?? null}
          onSelectCommand={onSelectCommand || (() => {})}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdopt={onAdopt}
          onOverrideSource={onOverrideSource}
        />
      )}

      {contentViewMode === 'source' && (
        <SourceView
          bindings={filteredBindings}
          selectedCommand={selectedCommand ?? null}
          onSelectCommand={onSelectCommand || (() => {})}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdopt={onAdopt}
          onOverrideSource={onOverrideSource}
        />
      )}

      {contentViewMode === 'conflict' && (
        conflicts.length > 0
          ? <ConflictList conflicts={conflicts} />
          : <div className="hotkey-map-empty">✅ 未检测到冲突</div>
      )}
    </div>
  );
};

export default HotkeyMap;
