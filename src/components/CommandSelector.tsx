/**
 * ATM - 命令选择器组件（V5.5）
 *
 * 从 CommandIndex 选择命令的弹窗。
 * 搜索栏（搜索命令名、中文名、Skill 名、快捷键）
 * 结果列表：命令名、中文名、来源 Skill、快捷键、状态
 * 选中后自动填充 command, commandSource, sourceSkillId 等字段
 */
import React, { useState, useMemo, useEffect } from 'react';

interface CommandItem {
  commandName: string;
  normalizedCommandName?: string;
  sourceType?: string;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  entryType?: string;
  handlerFunction?: string;
  // 可选额外字段
  hotkeys?: string[];
  menuPaths?: string[];
  chineseName?: string;
  skillLoaded?: boolean;
}

interface CommandSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (command: {
    command: string;
    commandSource: string;
    sourceSkillId?: string;
    sourceSkillName?: string;
    sourceSkillFile?: string;
    hotkeys?: string[];
  }) => void;
  commands?: CommandItem[];
}

/** 命令来源标签映射 */
const SOURCE_TAGS: Record<string, { label: string; color: string }> = {
  user_skill: { label: '用户', color: '#60a5fa' },
  atm_managed_skill: { label: '托管', color: '#34d399' },
  company_skill: { label: '公司', color: '#f472b6' },
  allegro_builtin: { label: '内置', color: '#a78bfa' },
  unknown: { label: '未知', color: '#9ca3af' },
};

/** 入口类型标签 */
const ENTRY_TAGS: Record<string, { label: string; color: string }> = {
  axlCmdRegister: { label: '注册命令', color: '#34d399' },
  procedure: { label: 'Procedure', color: '#60a5fa' },
  defun: { label: 'Defun', color: '#fbbf24' },
  manual: { label: '手动', color: '#9ca3af' },
};

const CommandSelector: React.FC<CommandSelectorProps> = ({
  open,
  onClose,
  onSelect,
  commands = [],
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');

  // 重置搜索关闭时
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
      setFilterType('all');
    }
  }, [open]);

  // 筛选结果
  const filtered = useMemo(() => {
    let result = commands;
    const q = search.toLowerCase().trim();

    if (q) {
      result = result.filter(c =>
        c.commandName.toLowerCase().includes(q) ||
        (c.chineseName || '').toLowerCase().includes(q) ||
        (c.sourceSkillName || '').toLowerCase().includes(q) ||
        (c.hotkeys || []).some(h => h.toLowerCase().includes(q)),
      );
    }

    // 按来源筛选
    if (filterType !== 'all') {
      result = result.filter(c => c.sourceType === filterType);
    }

    // 去重（按 commandName）
    const seen = new Set<string>();
    result = result.filter(c => {
      const key = c.commandName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 排序：有快捷键的优先，有中文名的优先
    result.sort((a, b) => {
      const aHot = (a.hotkeys?.length || 0);
      const bHot = (b.hotkeys?.length || 0);
      if (aHot !== bHot) return bHot - aHot;
      return a.commandName.localeCompare(b.commandName);
    });

    return result;
  }, [commands, search, filterType]);

  // 来源类型去重（用于筛选）
  const sourceTypes = useMemo(() => {
    const types = new Set(commands.map(c => c.sourceType || 'unknown'));
    return Array.from(types);
  }, [commands]);

  // 处理键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (cmd: CommandItem) => {
    onSelect({
      command: cmd.commandName,
      commandSource: (cmd.sourceType === 'allegro_builtin' ? 'allegro_builtin'
        : cmd.sourceType === 'company_skill' ? 'company_skill'
        : cmd.sourceType === 'atm_managed_skill' ? 'atm_managed_skill'
        : cmd.sourceType === 'user_skill' ? 'user_skill'
        : 'unknown') as any,
      sourceSkillId: cmd.sourceSkillId,
      sourceSkillName: cmd.sourceSkillName,
      sourceSkillFile: cmd.sourceSkillFile,
      hotkeys: cmd.hotkeys,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '8px',
          width: '640px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        autoFocus
      >
        {/* 标题 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          fontSize: '15px',
          fontWeight: 600,
        }}>
          选择命令
        </div>

        {/* 搜索栏 */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <input
            type="text"
            placeholder="搜索命令名、中文名、Skill 名、快捷键..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            autoFocus
          />

          {/* 来源筛选 */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setFilterType('all'); setSelectedIndex(0); }}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: filterType === 'all' ? 'var(--accent-blue)' : 'transparent',
                color: filterType === 'all' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              全部 ({commands.length})
            </button>
            {sourceTypes.map(type => {
              const tag = SOURCE_TAGS[type] || { label: type, color: '#9ca3af' };
              const count = commands.filter(c => c.sourceType === type).length;
              return (
                <button
                  key={type}
                  onClick={() => { setFilterType(type); setSelectedIndex(0); }}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${tag.color}`,
                    background: filterType === type ? tag.color : 'transparent',
                    color: filterType === type ? '#fff' : tag.color,
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                >
                  {tag.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 结果列表 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 0',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {search ? '未找到匹配命令' : '暂无可用命令'}
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const sourceTag = SOURCE_TAGS[cmd.sourceType || 'unknown'] || { label: '未知', color: '#9ca3af' };
              const entryTag = ENTRY_TAGS[cmd.entryType || ''] || null;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${cmd.commandName}_${cmd.sourceSkillId || ''}`}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '8px 20px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--accent-blue)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* 命令名 */}
                    <span style={{ fontWeight: 600, fontSize: '13px', fontFamily: 'monospace' }}>
                      {cmd.commandName}
                    </span>
                    {/* 中文名 */}
                    {cmd.chineseName && (
                      <span style={{ fontSize: '12px', opacity: 0.8 }}>{cmd.chineseName}</span>
                    )}
                    {/* 来源标签 */}
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: sourceTag.color + '22',
                      color: isSelected ? '#fff' : sourceTag.color,
                      border: `1px solid ${sourceTag.color}44`,
                    }}>
                      {sourceTag.label}
                    </span>
                    {/* 入口类型 */}
                    {entryTag && (
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        background: entryTag.color + '22',
                        color: isSelected ? '#fff' : entryTag.color,
                      }}>
                        {entryTag.label}
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '11px',
                    marginTop: '2px',
                    opacity: isSelected ? 0.9 : 0.6,
                  }}>
                    {cmd.sourceSkillName && <span>Skill: {cmd.sourceSkillName}</span>}
                    {cmd.hotkeys && cmd.hotkeys.length > 0 && (
                      <span>快捷键: {cmd.hotkeys.join(' / ')}</span>
                    )}
                    {cmd.menuPaths && cmd.menuPaths.length > 0 && (
                      <span>已有菜单: {cmd.menuPaths.length}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 底部信息 */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>共 {filtered.length} 个命令</span>
          <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
        </div>
      </div>
    </div>
  );
};

export default CommandSelector;
