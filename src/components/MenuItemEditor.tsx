/**
 * ATM - 菜单项编辑器组件（V5.5）
 *
 * 右侧详情编辑面板，显示选中菜单项的全部字段。
 * - separator 类型：只显示类型、父菜单、启用/可见、操作按钮
 * - command 类型：显示绑定命令、命令来源
 * - menu 类型：显示完整编辑面板
 */
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Save, Trash2, XCircle } from 'lucide-react';
import type { MenuItemConfig, MenuItemType, MenuSource, MenuCommandSource, MenuIssue } from '../types/menu';
import {
  getMenuSourceLabel,
  getMenuSourceBadge,
  isMenuSourceReadOnly,
  ISSUE_SEVERITY_STYLES,
  isPrintableAsciiMenuLabel,
  requiresAsciiMenuLabelCompatibility,
} from '../types/menu';

interface MenuItemEditorProps {
  item: MenuItemConfig | null;
  onSave: (itemId: string, updates: Partial<MenuItemConfig>) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onSelectCommand: (itemId: string) => void;
  onNavigateSkill?: (skillId: string) => void;
  onNavigateHotkey?: (command: string) => void;
  allegroVersion?: string | null;
}

const itemTypes: { value: MenuItemType; label: string }[] = [
  { value: 'menu', label: '菜单（含子项）' },
  { value: 'command', label: '命令菜单项' },
  { value: 'separator', label: '分隔线' },
];

const menuSources: { value: MenuSource; label: string }[] = [
  { value: 'atm_managed', label: 'ATM 托管菜单' },
  { value: 'manual', label: '手动添加' },
  { value: 'skill_package', label: 'Skill 包菜单' },
  { value: 'imported', label: '导入菜单' },
  { value: 'company_menu', label: '公司菜单（只读）' },
  { value: 'allegro_default', label: 'Allegro 默认（只读）' },
];

const MenuItemEditor: React.FC<MenuItemEditorProps> = ({
  item,
  onSave,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onSelectCommand,
  onNavigateSkill,
  onNavigateHotkey,
  allegroVersion,
}) => {
  // 本地编辑状态
  const [label, setLabel] = useState('');
  const [compatibilityLabel, setCompatibilityLabel] = useState('');
  const [type, setType] = useState<MenuItemType>('command');
  const [command, setCommand] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [visible, setVisible] = useState(true);
  const [menuSource, setMenuSource] = useState<MenuSource>('atm_managed');
  const [hasChanges, setHasChanges] = useState(false);

  // 从外部 item 同步
  useEffect(() => {
    if (item) {
      setLabel(item.label || '');
      setCompatibilityLabel(item.compatibilityLabel || '');
      setType(item.type || 'command');
      setCommand(item.command || '');
      setEnabled(item.enabled !== false);
      setVisible(item.visible !== false);
      setMenuSource(item.menuSource || 'atm_managed');
      setHasChanges(false);
    }
  }, [item]);

  // 检测变更
  useEffect(() => {
    if (!item) return;
    const changed =
      label !== (item.label || '') ||
      compatibilityLabel !== (item.compatibilityLabel || '') ||
      type !== (item.type || 'command') ||
      command !== (item.command || '') ||
      enabled !== (item.enabled !== false) ||
      visible !== (item.visible !== false) ||
      menuSource !== (item.menuSource || 'atm_managed');
    setHasChanges(changed);
  }, [item, label, compatibilityLabel, type, command, enabled, visible, menuSource]);

  const requiresCompatibilityLabel = type !== 'separator'
    && requiresAsciiMenuLabelCompatibility(allegroVersion)
    && !isPrintableAsciiMenuLabel(label);
  const compatibilityLabelError = requiresCompatibilityLabel
    && !isPrintableAsciiMenuLabel(compatibilityLabel)
    ? `Allegro ${allegroVersion || '17.2'} 需要仅含英文、数字和 ASCII 符号的显示名`
    : '';

  const handleSave = () => {
    if (!item) return;
    onSave(item.id, {
      label,
      compatibilityLabel: compatibilityLabel.trim(),
      type,
      command: type === 'command' ? command : undefined,
      enabled,
      visible,
      menuSource,
    });
    setHasChanges(false);
  };

  const isReadOnly = item ? isMenuSourceReadOnly(item.menuSource) : false;
  const sourceLabel = item ? getMenuSourceLabel(item.menuSource) : '';
  const sourceBadge = item ? getMenuSourceBadge(item.menuSource) : '';

  /** 是否为非法顶级结点 */
  const isIllegalTopLevel = item?.status === 'error' && !item.parentId;

  if (!item) {
    return (
      <div className="menu-item-empty">
        <FileText aria-hidden="true" />
        <strong>选择一个菜单项进行编辑</strong>
        <span>点击左侧菜单树中的项目查看详情。</span>
      </div>
    );
  }

  const isSeparator = item.type === 'separator';

  return (
    <div className="menu-item-editor">
      {/* 标题区域 */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
            {isSeparator ? '──────────' : (item.label || '(未命名)')}
          </h3>
          <span style={{
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: isReadOnly ? 'rgba(251, 191, 36, 0.15)' : 'rgba(52, 211, 153, 0.15)',
            color: isReadOnly ? '#fbbf24' : '#34d399',
          }}>
            {sourceBadge}
          </span>
        </div>
        {/* 路径 */}
        {item.path && item.path.length > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {item.path.join(' > ')}
          </div>
        )}
      </div>

      {/* 非法顶级结点错误提示 */}
      {isIllegalTopLevel && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '16px',
          borderRadius: '6px',
          background: 'rgba(248, 113, 113, 0.1)',
          border: '1px solid rgba(248, 113, 113, 0.3)',
          fontSize: '13px',
          color: '#f87171',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {item.type === 'separator' ? '分隔线不能作为顶级节点' : '命令不能作为顶级节点'}
          </div>
          <div style={{ fontSize: '12px' }}>
            {item.type === 'separator'
              ? '分隔线只能作为某个菜单下的子项。请移动到某个菜单下，或删除。'
              : '命令菜单项只能作为某个菜单下的子项。请移动到某个菜单下。'}
          </div>
        </div>
      )}

      {/* 基本信息 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* 菜单名称（separator 不显示） */}
        {!isSeparator && (
          <>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                菜单名称（中文原名）
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isReadOnly}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid var(--border-color)`,
                  background: isReadOnly ? 'var(--bg-surface)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label htmlFor="menu-compatibility-label" style={{ fontSize: '12px', color: requiresCompatibilityLabel ? '#f59e0b' : 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                17.2 英文兼容显示名{requiresCompatibilityLabel ? '（必填）' : '（可选）'}
              </label>
              <input
                id="menu-compatibility-label"
                type="text"
                value={compatibilityLabel}
                onChange={(e) => setCompatibilityLabel(e.target.value)}
                disabled={isReadOnly}
                placeholder="例如 Component Align"
                aria-invalid={Boolean(compatibilityLabelError)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${compatibilityLabelError ? '#f59e0b' : 'var(--border-color)'}`,
                  background: isReadOnly ? 'var(--bg-surface)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ marginTop: '4px', fontSize: '11px', lineHeight: 1.5, color: compatibilityLabelError ? '#f59e0b' : 'var(--text-secondary)' }}>
                {compatibilityLabelError
                  || '仅 Allegro 17.2 及更早版本使用；17.4 及以后仍显示上方中文名称。'}
              </div>
            </div>
          </>
        )}

        {/* 菜单类型 */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            类型
          </label>
          {isSeparator ? (
            <div style={{
              padding: '6px 10px',
              borderRadius: '4px',
              background: 'var(--bg-hover)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}>
              分隔线
            </div>
          ) : (
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MenuItemType)}
              disabled={isReadOnly}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            >
              {itemTypes.filter(t => t.value !== 'separator').map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* 所在父菜单（separator 显示这个而非名称） */}
        {isSeparator && item.parentId && (
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              所在父菜单
            </label>
            <div style={{
              padding: '6px 10px',
              borderRadius: '4px',
              background: 'var(--bg-hover)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}>
              {item.path && item.path.length > 1 ? item.path.slice(0, -1).join(' > ') : item.parentId}
            </div>
          </div>
        )}

        {/* 绑定命令 — separator 不显示 */}
        {!isSeparator && type === 'command' && (
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              绑定命令
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={isReadOnly}
                placeholder="输入命令名或从下方选择"
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${command.trim() ? 'var(--border-color)' : '#f87171'}`,
                  background: isReadOnly ? 'var(--bg-surface)' : 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => onSelectCommand(item.id)}
                disabled={isReadOnly}
                className="btn btn-sm"
                style={{
                  padding: '6px 12px',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isReadOnly ? 'not-allowed' : 'pointer',
                  opacity: isReadOnly ? 0.5 : 1,
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                }}
              >
                选择命令
              </button>
            </div>
            {!command.trim() && (
              <div style={{ marginTop: '5px', color: '#f87171', fontSize: '12px' }}>
                必须绑定一个 Allegro 或 Skill 命令，否则该菜单项不会出现在实际菜单中。
              </div>
            )}
          </div>
        )}

        {/* 命令状态 — separator 不显示 */}
        {!isSeparator && item.command && (() => {
          // 计算命令状态
          const cmd = item.command || '';
          const hasIssue = item.issues && item.issues.length > 0;
          const cmdMissingIssue = hasIssue && item.issues!.some(i => i.type === 'command_missing');
          const skillDisabledIssue = hasIssue && item.issues!.some(i => i.type === 'disabled_skill');
          const skillNotLoadedIssue = hasIssue && item.issues!.some(i => i.type === 'skill_not_loaded');

          let StatusIcon = CheckCircle2;
          let statusText = '可用';
          let statusColor = '#34d399';

          if (cmdMissingIssue) {
            StatusIcon = XCircle;
            statusText = 'CommandIndex 中未找到该命令';
            statusColor = '#f87171';
          } else if (skillDisabledIssue) {
            StatusIcon = AlertTriangle;
            statusText = 'Skill 已禁用，菜单可能无法使用';
            statusColor = '#fbbf24';
          } else if (skillNotLoadedIssue) {
            StatusIcon = AlertTriangle;
            statusText = 'Skill 未配置加载，菜单可能无法使用';
            statusColor = '#fbbf24';
          }

          return (
            <div style={{
              fontSize: '12px',
              padding: '10px 12px',
              background: `${statusColor}0d`,
              border: `1px solid ${statusColor}22`,
              borderRadius: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '13px' }}>{cmd}</span>
                <span style={{
                  fontSize: '11px',
                  color: statusColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                }}>
                  <StatusIcon aria-hidden="true" /> {statusText}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {item.commandSource && <span>来源：{item.commandSource}</span>}
                {item.sourceSkillName && <span>Skill：{item.sourceSkillName}</span>}
                {item.hotkeys && item.hotkeys.length > 0 && (
                  <span>快捷键：{item.hotkeys.join(' / ')}</span>
                )}
                {item.sourceSkillFile && <span>文件：{item.sourceSkillFile}</span>}
              </div>
            </div>
          );
        })()}

        {/* 来源设置 */}
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            菜单来源
          </label>
          <select
            value={menuSource}
            onChange={(e) => setMenuSource(e.target.value as MenuSource)}
            disabled={isReadOnly}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          >
            {menuSources.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* 开关 */}
        <div style={{ display: 'flex', gap: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={isReadOnly}
            />
            启用
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
              disabled={isReadOnly}
            />
            可见
          </label>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isReadOnly || Boolean(compatibilityLabelError)}
          className="btn btn-sm btn-primary"
          style={{
            padding: '6px 16px',
            background: hasChanges && !isReadOnly && !compatibilityLabelError ? 'var(--accent-blue)' : 'var(--bg-hover)',
            color: hasChanges && !isReadOnly && !compatibilityLabelError ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: '4px',
            cursor: hasChanges && !isReadOnly && !compatibilityLabelError ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          {hasChanges ? <><Save aria-hidden="true" />保存修改</> : '已保存'}
        </button>

        <button
          onClick={() => onDuplicate(item.id)}
          className="btn btn-sm"
          style={{
            padding: '6px 12px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          复制
        </button>

        <button
          onClick={() => onMoveUp(item.id)}
          className="btn btn-sm"
          style={{
            padding: '6px 12px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ↑ 上移
        </button>

        <button
          onClick={() => onMoveDown(item.id)}
          className="btn btn-sm"
          style={{
            padding: '6px 12px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          ↓ 下移
        </button>

        <button
          onClick={() => onDelete(item.id)}
          className="btn btn-sm"
          style={{
            padding: '6px 12px',
            background: 'rgba(248, 113, 113, 0.1)',
            color: '#f87171',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <Trash2 aria-hidden="true" />删除
        </button>
      </div>

      {/* 联动按钮（separator 不显示） */}
      {!isSeparator && (item.sourceSkillId || item.command) && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '100%', marginBottom: '4px' }}>
            关联操作
          </div>
          {item.sourceSkillId && onNavigateSkill && (
            <button
              onClick={() => onNavigateSkill(item.sourceSkillId!)}
              className="btn btn-sm"
              style={{
                padding: '4px 10px',
                background: 'rgba(96, 165, 250, 0.1)',
                color: '#60a5fa',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              <ExternalLink aria-hidden="true" />查看 Skill
            </button>
          )}
          {item.command && onNavigateHotkey && (
            <button
              onClick={() => onNavigateHotkey(item.command!)}
              className="btn btn-sm"
              style={{
                padding: '4px 10px',
                background: 'rgba(52, 211, 153, 0.1)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              <ExternalLink aria-hidden="true" />查看快捷键
            </button>
          )}
        </div>
      )}

      {/* 问题列表 */}
      {item.issues && item.issues.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
            问题列表 ({item.issues.length})
          </div>
          {item.issues.map((issue) => {
            const style = ISSUE_SEVERITY_STYLES[issue.severity] || ISSUE_SEVERITY_STYLES.info;
            const IssueIcon = issue.severity === 'error' ? XCircle : issue.severity === 'warning' ? AlertTriangle : CheckCircle2;
            return (
              <div
                key={issue.id}
                style={{
                  padding: '8px 10px',
                  marginBottom: '6px',
                  borderRadius: '4px',
                  background: style.bg,
                  border: `1px solid ${style.color}33`,
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: style.color, fontWeight: 600 }}>
                  <IssueIcon aria-hidden="true" />
                  <span>{issue.title}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{issue.description}</div>
                {issue.suggestedAction && (
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                    建议：{issue.suggestedAction}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MenuItemEditor;
