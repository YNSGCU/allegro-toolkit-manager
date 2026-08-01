/**
 * ATM - 命令选择器组件（V5.5）
 *
 * 从 CommandIndex 选择命令的弹窗。
 * 搜索栏（搜索命令名、中文名、Skill 名、快捷键）
 * 结果列表：命令名、中文名、来源 Skill、快捷键、状态
 * 选中后自动填充 command, commandSource, sourceSkillId 等字段
 */
import React, { useState, useMemo, useEffect } from 'react';
import { BusinessDialog } from '../shared/ui';

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
const SOURCE_TAGS: Record<string, string> = {
  user_skill: '用户',
  atm_managed_skill: '托管',
  company_skill: '公司',
  allegro_builtin: '内置',
  unknown: '未知',
};

/** 入口类型标签 */
const ENTRY_TAGS: Record<string, string> = {
  axlCmdRegister: '注册命令',
  procedure: 'Procedure',
  defun: 'Defun',
  manual: '手动',
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
    <BusinessDialog
      open={open}
      title="选择菜单命令"
      description="搜索命令并核对来源；双击或按 Enter 将命令填入当前菜单项。"
      size="lg"
      onClose={onClose}
      bodyClassName="command-selector-body"
      onDialogKeyDown={handleKeyDown}
      footer={(
        <div className="command-selector-footer">
          <span>共 {filtered.length} 个命令</span>
          <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
        </div>
      )}
    >
      <div className="command-selector-toolbar">
        <label className="sr-only" htmlFor="command-selector-search">搜索命令</label>
        <input
          id="command-selector-search"
          type="search"
          placeholder="搜索命令名、中文名、Skill 名或快捷键…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
          data-dialog-initial-focus
        />

        <div className="command-selector-filters" aria-label="按命令来源筛选">
          <button
            type="button"
            className={`command-selector-filter ${filterType === 'all' ? 'is-active' : ''}`}
            aria-pressed={filterType === 'all'}
            onClick={() => { setFilterType('all'); setSelectedIndex(0); }}
          >
            全部 <span>{commands.length}</span>
          </button>
          {sourceTypes.map(type => {
            const label = SOURCE_TAGS[type] || type;
            const count = commands.filter(c => c.sourceType === type).length;
            return (
              <button
                type="button"
                key={type}
                className={`command-selector-filter command-selector-filter--${type} ${filterType === type ? 'is-active' : ''}`}
                aria-pressed={filterType === type}
                onClick={() => { setFilterType(type); setSelectedIndex(0); }}
              >
                {label} <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="command-selector-results" role="listbox" aria-label="命令搜索结果">
        {filtered.length === 0 ? (
          <div className="command-selector-empty">{search ? '未找到匹配命令' : '暂无可用命令'}</div>
        ) : (
          filtered.map((cmd, idx) => {
            const sourceType = cmd.sourceType || 'unknown';
            const sourceLabel = SOURCE_TAGS[sourceType] || '未知';
            const entryLabel = ENTRY_TAGS[cmd.entryType || ''];
            const isSelected = idx === selectedIndex;
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                key={`${cmd.commandName}_${cmd.sourceSkillId || ''}`}
                className={`command-selector-result ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="command-selector-result-main">
                  <code>{cmd.commandName}</code>
                  {cmd.chineseName ? <span>{cmd.chineseName}</span> : null}
                  <small className={`command-selector-tag command-selector-tag--${sourceType}`}>{sourceLabel}</small>
                  {entryLabel ? <small className="command-selector-tag command-selector-tag--entry">{entryLabel}</small> : null}
                </span>
                <span className="command-selector-result-meta">
                  {cmd.sourceSkillName ? <span>Skill：{cmd.sourceSkillName}</span> : null}
                  {cmd.hotkeys?.length ? <span>快捷键：{cmd.hotkeys.join(' / ')}</span> : null}
                  {cmd.menuPaths?.length ? <span>已有菜单：{cmd.menuPaths.length}</span> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </BusinessDialog>
  );
};

export default CommandSelector;
