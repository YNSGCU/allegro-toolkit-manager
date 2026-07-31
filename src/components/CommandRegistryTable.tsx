/**
 * ATM - 命令注册中心表格组件（V4.5 增强版）
 * 展示所有已注册命令，含快捷键绑定、加载状态、冲突状态等
 */
import React, { useState } from 'react';
import type { SkillCommandItem, ConflictStatus, SkillLoadStatus, ConfidenceLevel } from '../types/skill';
import { getLoadStatusDisplay } from '../types/skill';

interface CommandRegistryTableProps {
  commands: SkillCommandItem[];
  loading?: boolean;
  onBindHotkey?: (commandName: string) => void;
  onAddMenu?: (commandName: string) => void;
  onViewSkill?: (skillId: string) => void;
  onMarkEntry?: (commandName: string) => void;
}

type SortField = 'name' | 'skillName' | 'tier' | 'type' | 'loadStatus' | 'conflictStatus' | 'hotkeyCount';
type FilterTier = 'all' | 'company' | 'user' | 'atm';
type FilterLoad = 'all' | 'loaded' | 'unloaded' | 'disabled';
type FilterConflict = 'all' | 'normal' | 'conflict';

const CommandRegistryTable: React.FC<CommandRegistryTableProps> = ({
  commands,
  loading = false,
  onBindHotkey,
  onAddMenu,
  onViewSkill,
  onMarkEntry,
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [filterLoad, setFilterLoad] = useState<FilterLoad>('all');
  const [filterConflict, setFilterConflict] = useState<FilterConflict>('all');
  const [searchText, setSearchText] = useState('');

  if (loading) {
    return <div className="loading">加载命令注册中心...</div>;
  }

  if (!commands || commands.length === 0) {
    return (
      <div className="empty-state">
        <p>暂无注册命令</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          请先扫描 Skill 目录
        </p>
      </div>
    );
  }

  // 筛选
  let filtered = [...commands];

  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    filtered = filtered.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.sourceSkillName.toLowerCase().includes(q) ||
        cmd.sourceFile.toLowerCase().includes(q) ||
        (cmd.zhName && cmd.zhName.toLowerCase().includes(q))
    );
  }

  if (filterTier !== 'all') {
    filtered = filtered.filter((cmd) => cmd.tier === filterTier);
  }

  if (filterLoad === 'loaded') {
    filtered = filtered.filter((cmd) => cmd.loadStatus === 'loaded_configured');
  } else if (filterLoad === 'unloaded') {
    filtered = filtered.filter((cmd) => cmd.loadStatus === 'enabled_but_not_loaded' || cmd.loadStatus === 'unknown');
  } else if (filterLoad === 'disabled') {
    filtered = filtered.filter((cmd) => cmd.loadStatus === 'disabled');
  }

  if (filterConflict === 'normal') {
    filtered = filtered.filter((cmd) => cmd.conflictStatus === 'normal');
  } else if (filterConflict === 'conflict') {
    filtered = filtered.filter((cmd) => cmd.conflictStatus === 'duplicate_command' || cmd.conflictStatus === 'missing_load');
  }

  // 排序
  filtered.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'skillName': cmp = a.sourceSkillName.localeCompare(b.sourceSkillName); break;
      case 'tier': cmp = (a.tier || '').localeCompare(b.tier || ''); break;
      case 'type': cmp = (a.commandKind || '').localeCompare(b.commandKind || ''); break;
      case 'loadStatus': cmp = (a.loadStatus || '').localeCompare(b.loadStatus || ''); break;
      case 'conflictStatus': cmp = (a.conflictStatus || '').localeCompare(b.conflictStatus || ''); break;
      case 'hotkeyCount': cmp = (a.hotkeys?.length || 0) - (b.hotkeys?.length || 0); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortAsc ? ' ▲' : ' ▼';
  };

  // 统计
  const stats = {
    total: commands.length,
    company: commands.filter((c) => c.tier === 'company').length,
    user: commands.filter((c) => c.tier === 'user').length,
    atm: commands.filter((c) => c.tier === 'atm').length,
    entry: commands.filter((c) => c.isEntry).length,
    withHotkeys: commands.filter((c) => c.hotkeys.length > 0).length,
    conflicts: commands.filter((c) => c.conflictStatus === 'duplicate_command').length,
  };

  const getConflictDisplay = (status: ConflictStatus) => {
    switch (status) {
      case 'normal': return <span className="badge badge-success" style={{ fontSize: 10 }}>正常</span>;
      case 'duplicate_command': return <span className="badge badge-error" style={{ fontSize: 10 }}>重名冲突</span>;
      case 'missing_load': return <span className="badge badge-warning" style={{ fontSize: 10 }}>可能未加载</span>;
      case 'unknown': return <span className="badge badge-info" style={{ fontSize: 10 }}>未知</span>;
    }
  };

  const getCommandKindLabel = (kind: string) => {
    switch (kind) {
      case 'axl_registered': return <span className="badge badge-success" style={{ fontSize: 10 }}>axl注册</span>;
      case 'procedure': return <span className="badge badge-info" style={{ fontSize: 10 }}>procedure</span>;
      case 'defun': return <span className="badge badge-info" style={{ fontSize: 10 }}>defun</span>;
      case 'manual': return <span className="badge badge-warning" style={{ fontSize: 10 }}>手动</span>;
      default: return <span className="badge" style={{ fontSize: 10 }}>{kind}</span>;
    }
  };

  return (
    <div>
      {/* 统计栏 */}
      <div className="card" style={{ padding: '12px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div><span className="stat-label">总命令数</span><div className="stat-value" style={{ fontSize: 20 }}>{stats.total}</div></div>
          <div><span className="stat-label">公司</span><div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-purple)' }}>{stats.company}</div></div>
          <div><span className="stat-label">用户</span><div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-cyan)' }}>{stats.user}</div></div>
          <div><span className="stat-label">ATM</span><div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-green)' }}>{stats.atm}</div></div>
          <div><span className="stat-label">入口命令</span><div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-green)' }}>{stats.entry}</div></div>
          <div><span className="stat-label">有快捷键</span><div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-cyan)' }}>{stats.withHotkeys}</div></div>
          <div><span className="stat-label">有冲突</span><div className="stat-value" style={{ fontSize: 20, color: stats.conflicts > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{stats.conflicts}</div></div>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="search-input"
          placeholder="搜索命令名、中文名、Skill 名称或路径..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: 13,
            flex: '1 1 200px',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>层级:</span>
          {(['all', 'company', 'user', 'atm'] as FilterTier[]).map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${filterTier === t ? 'btn-primary' : ''}`}
              onClick={() => setFilterTier(t)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {t === 'all' ? '全部' : t === 'company' ? '公司' : t === 'user' ? '用户' : 'ATM'}
            </button>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>加载:</span>
          {(['all', 'loaded', 'unloaded', 'disabled'] as FilterLoad[]).map((t) => (
            <button
              key={t}
              className={`btn btn-sm ${filterLoad === t ? 'btn-primary' : ''}`}
              onClick={() => setFilterLoad(t)}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {t === 'all' ? '全部' : t === 'loaded' ? '已加载' : t === 'unloaded' ? '未加载' : '已禁用'}
            </button>
          ))}
        </div>
      </div>

      {/* 表格 */}
      <div className="cmd-registry-table-wrapper">
        <table className="data-table cmd-registry-table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer', minWidth: 120 }} onClick={() => handleSort('name')}>
                命令名{getSortIndicator('name')}
              </th>
              <th style={{ minWidth: 80 }}>类型</th>
              <th style={{ cursor: 'pointer', minWidth: 100 }} onClick={() => handleSort('skillName')}>
                来源 Skill{getSortIndicator('skillName')}
              </th>
              <th style={{ cursor: 'pointer', minWidth: 60 }} onClick={() => handleSort('tier')}>
                层级{getSortIndicator('tier')}
              </th>
              <th style={{ minWidth: 50 }}>入口</th>
              <th style={{ minWidth: 80 }}>快捷键</th>
              <th style={{ minWidth: 60 }}>菜单</th>
              <th style={{ cursor: 'pointer', minWidth: 80 }} onClick={() => handleSort('loadStatus')}>
                加载状态{getSortIndicator('loadStatus')}
              </th>
              <th style={{ cursor: 'pointer', minWidth: 70 }} onClick={() => handleSort('conflictStatus')}>
                冲突{getSortIndicator('conflictStatus')}
              </th>
              <th style={{ minWidth: 100 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cmd, idx) => {
              const loadDisp = getLoadStatusDisplay(cmd.loadStatus);
              return (
                <tr key={`${cmd.name}-${cmd.sourceSkillId}-${idx}`}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <code style={{ color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600 }}>{cmd.name}</code>
                      {cmd.zhName && (
                        <span style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>{cmd.zhName}</span>
                      )}
                    </div>
                  </td>
                  <td>{getCommandKindLabel(cmd.commandKind)}</td>
                  <td>
                    <span
                      style={{ fontSize: 12, cursor: onViewSkill ? 'pointer' : 'default', color: 'var(--text-primary)' }}
                      onClick={() => onViewSkill?.(cmd.sourceSkillId)}
                      title={cmd.sourceFile}
                    >
                      {cmd.sourceSkillName}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      cmd.tier === 'company' ? 'badge-info' :
                      cmd.tier === 'user' ? 'badge-success' :
                      'badge-warning'
                    }`} style={{ fontSize: 10 }}>
                      {cmd.tier === 'company' ? '公司' : cmd.tier === 'user' ? '用户' : 'ATM'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {cmd.isEntry ? (
                      <span className="status-dot ok" title="入口命令"></span>
                    ) : (
                      <span className="status-dot muted" title="内部函数"></span>
                    )}
                  </td>
                  <td>
                    {cmd.hotkeys.length > 0 ? (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {cmd.hotkeys.slice(0, 3).map((hk, i) => (
                          <code key={i} className="cmd-registry-hotkey-badge">{hk}</code>
                        ))}
                        {cmd.hotkeys.length > 3 && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{cmd.hotkeys.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {cmd.menuPaths.length > 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{cmd.menuPaths.length} 个</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: loadDisp.color, fontSize: 11 }}>
                      {loadDisp.icon} {loadDisp.label}
                    </span>
                  </td>
                  <td>{getConflictDisplay(cmd.conflictStatus)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {onBindHotkey && (
                        <button className="atm-btn-small btn" style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => onBindHotkey(cmd.name)} title="绑定快捷键">
                          绑定
                        </button>
                      )}
                      {onAddMenu && (
                        <button className="atm-btn-small btn" style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => onAddMenu(cmd.name)} title="添加菜单">
                          菜单
                        </button>
                      )}
                      {onViewSkill && (
                        <button className="atm-btn-small btn" style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => onViewSkill(cmd.sourceSkillId)} title="查看来源">
                          查看
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  无匹配结果
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommandRegistryTable;
