/**
 * ATM - 菜单树组件（V5.5）
 *
 * 递归显示菜单层级，支持选中、展开/折叠、操作按钮。
 * 每项显示：label, type 图标, enabled 状态, source 徽章, issues 指示器
 */
import React, { useState, useCallback } from 'react';
import type { MenuItemConfig } from '../types/menu';
import { getMenuSourceBadge, isMenuSourceReadOnly, MENU_SOURCE_LABELS } from '../types/menu';

interface MenuTreeProps {
  items: MenuItemConfig[];
  selectedId: string | null;
  onSelect: (item: MenuItemConfig) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  /** 搜索过滤文本 */
  filterText?: string;
}

const typeIcons: Record<string, string> = {
  menu: '📁',
  command: '⚡',
  separator: '➖',
};

const issueCountColors: Record<string, string> = {
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
};

/** 单个菜单树节点 */
const MenuTreeItem: React.FC<{
  item: MenuItemConfig;
  depth: number;
  selectedId: string | null;
  onSelect: (item: MenuItemConfig) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  filterText?: string;
}> = React.memo(({
  item,
  depth,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  filterText,
}) => {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === item.id;
  const hasChildren = item.children && item.children.length > 0;
  const isReadOnly = isMenuSourceReadOnly(item.menuSource);
  const sourceBadge = getMenuSourceBadge(item.menuSource);

  // 计算问题数量
  const errorCount = item.issues?.filter(i => i.severity === 'error').length || 0;
  const warningCount = item.issues?.filter(i => i.severity === 'warning').length || 0;
  const totalIssues = errorCount + warningCount;

  // 是否匹配搜索
  const matchesFilter = !filterText || item.label.toLowerCase().includes(filterText.toLowerCase());
  const childrenMatchFilter = hasChildren && item.children!.some(c => {
    if (!filterText) return false;
    return c.label.toLowerCase().includes(filterText.toLowerCase());
  });

  if (filterText && !matchesFilter && !childrenMatchFilter) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div style={{ userSelect: 'none' }}>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          paddingLeft: `${12 + depth * 20}px`,
          cursor: 'pointer',
          borderRadius: '4px',
          background: isSelected ? 'var(--accent-blue)' : 'transparent',
          color: isSelected ? '#fff' : 'var(--text-primary)',
          opacity: item.enabled ? 1 : 0.5,
          fontSize: '13px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* 展开/折叠 */}
        <span
          onClick={hasChildren ? handleToggle : undefined}
          style={{
            width: '16px',
            textAlign: 'center',
            cursor: hasChildren ? 'pointer' : 'default',
            fontSize: '10px',
            color: isSelected ? '#fff' : 'var(--text-secondary)',
            visibility: hasChildren ? 'visible' : 'hidden',
          }}
        >
          {expanded ? '▼' : '▶'}
        </span>

        {/* 类型图标 */}
        <span style={{ fontSize: '14px' }}>{typeIcons[item.type] || '📄'}</span>

        {/* 标签 */}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isSelected ? 600 : 400,
        }}>
          {item.label || '(未命名)'}
        </span>

        {/* 来源徽章 */}
        <span style={{
          fontSize: '10px',
          padding: '1px 4px',
          borderRadius: '3px',
          background: 'var(--bg-surface)',
          color: isSelected ? '#fff' : 'var(--text-secondary)',
          border: `1px solid ${isSelected ? 'rgba(255,255,255,0.3)' : 'var(--border-color)'}`,
          whiteSpace: 'nowrap',
        }}>
          {sourceBadge}
        </span>

        {/* 问题指示器 */}
        {totalIssues > 0 && (
          <span style={{
            fontSize: '10px',
            color: errorCount > 0 ? '#f87171' : '#fbbf24',
            fontWeight: 600,
          }}>
            {errorCount > 0 ? `✕${errorCount}` : `⚠${warningCount}`}
          </span>
        )}
      </div>

      {/* 子菜单 */}
      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <MenuTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              filterText={filterText}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** 主菜单树组件 */
const MenuTree: React.FC<MenuTreeProps> = ({
  items,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  filterText,
}) => {
  if (items.length === 0) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
        <div>暂无菜单项</div>
        <div style={{ fontSize: '12px', marginTop: '8px' }}>
          点击上方工具栏 "新建菜单" 开始创建
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {items.map((item) => (
        <MenuTreeItem
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          filterText={filterText}
        />
      ))}
    </div>
  );
};

export default MenuTree;
