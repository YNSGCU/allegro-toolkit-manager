/**
 * ATM - 物理键绑定管理面板（V2.2）
 *
 * 键盘点击物理键后展示所有绑定的详情面板，支持：
 * - 全部绑定 / 仅当前层 切换
 * - 编辑 / 删除 / 接管 / 修正来源 / 查看原始行
 * - 新增绑定
 */
import React, { useState, useMemo } from 'react';
import type { HotkeyBinding, Conflict } from '../types/hotkey';
import {
  BINDING_SRC_CONFIG,
  CMD_SRC_CONFIG,
  filterHotkeysByKeyboardLayer,
  getLayerLabel,
  getLayerDisplayName,
  isReadonlyBinding,
  type ActiveLayer,
} from '../utils/hotkeyItem';

interface PhysicalKeyBindingPanelProps {
  /** 物理键名（键盘 label，如 "S"、"F1"） */
  selectedKey: string;
  /** 该物理键的所有绑定（已按 physicalKey 预筛选） */
  bindings: HotkeyBinding[];
  /** 关联的冲突 */
  conflicts: Conflict[];
  /** 当前图层（V2.2） */
  activeLayer: ActiveLayer;
  onClose: () => void;
  onEdit: (binding: HotkeyBinding) => void;
  onDelete: (binding: HotkeyBinding) => void;
  onAdopt: (binding: HotkeyBinding) => void;
  onOverrideSource: (binding: HotkeyBinding) => void;
  onAddBinding: (physicalKey: string) => void;
}

const PhysicalKeyBindingPanel: React.FC<PhysicalKeyBindingPanelProps> = ({
  selectedKey,
  bindings,
  conflicts,
  activeLayer,
  onClose,
  onEdit,
  onDelete,
  onAdopt,
  onOverrideSource,
  onAddBinding,
}) => {
  // 筛选模式：true = 全部绑定, false = 仅当前层
  const [showFilterAll, setShowFilterAll] = useState(true);
  // 展开原始行的绑定 ID
  const [expandedRawId, setExpandedRawId] = useState<string | null>(null);
  // 删除确认
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 根据图层 + 筛选模式过滤绑定
  const filteredBindings = useMemo(() => {
    if (showFilterAll) return bindings;
    return filterHotkeysByKeyboardLayer(bindings, activeLayer);
  }, [bindings, showFilterAll, activeLayer]);

  // 冲突查找表
  const conflictMap = useMemo(() => {
    const map = new Map<string, Conflict>();
    for (const c of conflicts) {
      for (const cb of c.bindings) {
        map.set(cb.id, c);
      }
    }
    return map;
  }, [conflicts]);

  const bindingCount = bindings.length;
  const displayKey = selectedKey;

  const handleDelete = (binding: HotkeyBinding) => {
    if (confirmDeleteId === binding.id) {
      onDelete(binding);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(binding.id);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const toggleRawLine = (bindingId: string) => {
    setExpandedRawId((prev) => (prev === bindingId ? null : bindingId));
  };

  // 修饰键层组合
  const LAYER_OPTIONS = [
    { label: '普通层', mods: [] as string[] },
    { label: 'Ctrl', mods: ['Ctrl'] },
    { label: 'Shift', mods: ['Shift'] },
    { label: 'Alt', mods: ['Alt'] },
    { label: 'Ctrl+Shift', mods: ['Ctrl', 'Shift'] },
    { label: 'Ctrl+Alt', mods: ['Ctrl', 'Alt'] },
    { label: 'Shift+Alt', mods: ['Shift', 'Alt'] },
  ];

  return (
    <div className="phy-key-panel">
      {/* ─── Header ─── */}
      <div className="phy-key-panel-header">
        <span>
          物理键 <strong>{displayKey}</strong> 的绑定（{bindingCount} 个）
        </span>
        <div className="phy-key-header-actions">
          <button className="btn btn-sm btn-primary" onClick={() => onAddBinding(selectedKey)}>
            ＋ 为 {selectedKey} 新增绑定
          </button>
          <button className="btn btn-sm" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {/* ─── 筛选切换 ─── */}
      <div className="phy-key-panel-filter">
        <button
          className={showFilterAll ? 'active' : ''}
          onClick={() => setShowFilterAll(true)}
        >
          全部绑定
        </button>
        <button
          className={!showFilterAll ? 'active' : ''}
          onClick={() => setShowFilterAll(false)}
        >
          仅当前层
        </button>
        {!showFilterAll && activeLayer !== 'normal' && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, alignSelf: 'center' }}>
            当前层: {getLayerDisplayName(activeLayer)}
          </span>
        )}
      </div>

      {/* ─── 绑定列表 ─── */}
      <div className="phy-key-binding-list">
        {filteredBindings.length === 0 && (
          <div className="phy-key-panel-empty">
            {showFilterAll
              ? `物理键 ${displayKey} 暂无绑定`
              : `当前层未找到绑定`}
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => onAddBinding(selectedKey)}>
                ＋ 新增绑定
              </button>
            </div>
          </div>
        )}

        {filteredBindings.map((b) => {
          const conflict = conflictMap.get(b.id);
          const readonly = isReadonlyBinding(b);
          const showAdopt = b.bindingSource === 'user_env_original' && !b.isAdopted;
          const bSrc = BINDING_SRC_CONFIG[b.bindingSource] || BINDING_SRC_CONFIG.unknown;
          const cSrc = CMD_SRC_CONFIG[b.commandSource || 'unknown'] || CMD_SRC_CONFIG.unknown;
          const dk = b.displayKey || b.key;
          const layerLabel = getLayerLabel(b.modifiers || [], b.caseVariant);
          const isExpanded = expandedRawId === b.id;
          const isConfirming = confirmDeleteId === b.id;

          // 构造原始行显示
          const reconstructedRawLine = b.lineNumber
            ? `${b.type} ${b.key} ${b.command.includes(' ') ? `"${b.command}"` : b.command}`
            : '';

          return (
            <div
              key={b.id}
              className={`phy-key-binding-card ${readonly ? 'phy-key-binding-card--readonly' : ''}`}
            >
              {/* 信息区 */}
              <div className="phy-key-binding-card__info">
                <span className={`badge ${b.type === 'funckey' ? 'badge-info' : 'badge-success'}`}>
                  {b.type === 'funckey' ? 'FUNCKEY' : 'ALIAS'}
                </span>
                <span className="phy-key-display-key">{dk}</span>
                <span className="phy-key-layer-label">{layerLabel}</span>
                {b.chineseName && b.chineseName !== b.command && (
                  <span className="phy-key-chinese-name">{b.chineseName}</span>
                )}
                <code className="phy-key-command">{b.command}</code>

                {/* 来源标签 */}
                <div className="phy-key-source-tags">
                  <span className={`source-tag ${bSrc.className}`}>{bSrc.label}</span>
                  <span className={`source-tag ${cSrc.className}`}>{cSrc.label}</span>
                </div>

                {/* 状态 + 行号 */}
                {b.status === 'normal' && (
                  <span className="status-dot ok" style={{ marginLeft: 4 }} />
                )}
                {b.status === 'duplicate' && (
                  <span className="status-dot error" style={{ marginLeft: 4 }} />
                )}
                {b.lineNumber && (
                  <span className="phy-key-line-number">行 {b.lineNumber}</span>
                )}

                {/* 覆盖风险提示 */}
                {b.warnWhenOverride && b.defaultOccupier && (
                  <span style={{ fontSize: 10, color: 'var(--accent-yellow)', marginLeft: 4 }}>
                    覆盖风险
                  </span>
                )}

                {/* 冲突消息 */}
                {conflict && (
                  <span style={{ fontSize: 10, color: 'var(--accent-red)', marginLeft: 4 }}>
                    {conflict.message}
                  </span>
                )}

                {/* 原始行（展开） */}
                {isExpanded && reconstructedRawLine && (
                  <div className="phy-key-raw-line">{reconstructedRawLine}</div>
                )}
              </div>

              {/* 操作按钮区 */}
              <div className="phy-key-binding-card__actions">
                {/* 编辑 */}
                {!readonly && (
                  <button className="btn btn-sm" onClick={() => onEdit(b)} title="编辑此快捷键">
                    编辑
                  </button>
                )}

                {/* 删除 */}
                {!readonly && (
                  <button
                    className={`btn btn-sm ${isConfirming ? 'btn-danger' : ''}`}
                    onClick={() => handleDelete(b)}
                    title={isConfirming ? '再次点击确认删除' : '删除此快捷键'}
                  >
                    {isConfirming ? '确认？' : '删除'}
                  </button>
                )}
                {isConfirming && (
                  <button className="btn btn-sm" onClick={handleCancelDelete} title="取消删除">
                    取消
                  </button>
                )}

                {/* 接管到方案 */}
                {showAdopt && (
                  <button
                    className="btn btn-sm"
                    onClick={() => onAdopt(b)}
                    title="接管到当前方案"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    接管
                  </button>
                )}

                {/* 修正来源 */}
                {!b.isSourceOverridden && !readonly && (
                  <button
                    className="btn btn-sm"
                    onClick={() => onOverrideSource(b)}
                    title="修正命令来源"
                    style={{ color: 'var(--accent-yellow)' }}
                  >
                    修正
                  </button>
                )}

                {/* 查看原始行 */}
                {b.lineNumber && (
                  <button
                    className="btn btn-sm"
                    onClick={() => toggleRawLine(b.id)}
                    title="查看原始行"
                  >
                    {isExpanded ? '收起' : '详情'}
                  </button>
                )}

                {/* 只读标记 */}
                {readonly && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>只读</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhysicalKeyBindingPanel;
