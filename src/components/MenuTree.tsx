import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileText, Folder, GripVertical, Minus, TerminalSquare } from 'lucide-react';
import type { MenuItemConfig } from '../types/menu';
import { getMenuSourceBadge, isMenuSourceReadOnly } from '../types/menu';

interface MenuTreeProps {
  items: MenuItemConfig[];
  selectedId: string | null;
  onSelect: (item: MenuItemConfig) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  onMoveUp: (itemId: string) => void;
  onMoveDown: (itemId: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  filterText?: string;
}

const TYPE_ICONS = {
  menu: Folder,
  command: TerminalSquare,
  separator: Minus,
} as const;

interface MenuTreeItemProps extends Omit<MenuTreeProps, 'items'> {
  item: MenuItemConfig;
  depth: number;
  draggedItem: { id: string; parentId: string } | null;
  dropTargetId: string | null;
  onDraggedItemChange: (item: { id: string; parentId: string } | null) => void;
  onDropTargetChange: (itemId: string | null) => void;
}

const MenuTreeItem: React.FC<MenuTreeItemProps> = React.memo(({
  item,
  depth,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onReorder,
  filterText,
  draggedItem,
  dropTargetId,
  onDraggedItemChange,
  onDropTargetChange,
}) => {
  const [expanded, setExpanded] = useState(true);
  const isSelected = selectedId === item.id;
  const isDragging = draggedItem?.id === item.id;
  const isDropTarget = dropTargetId === item.id;
  const hasChildren = Boolean(item.children?.length);
  const errorCount = item.issues?.filter((issue) => issue.severity === 'error').length || 0;
  const warningCount = item.issues?.filter((issue) => issue.severity === 'warning').length || 0;
  const totalIssues = errorCount + warningCount;
  const query = filterText?.trim().toLowerCase();
  const matches = !query || item.label.toLowerCase().includes(query);
  const childMatches = Boolean(query && item.children?.some((child) => child.label.toLowerCase().includes(query)));
  const TypeIcon = TYPE_ICONS[item.type] || FileText;

  if (!matches && !childMatches) return null;

  return (
    <div className="menu-tree-branch">
      <button
        type="button"
        className={`menu-tree-row${isSelected ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}${isDragging ? ' is-dragging' : ''}${isDropTarget ? ' is-drop-target' : ''}`}
        style={{ '--menu-depth': depth } as React.CSSProperties}
        onClick={() => onSelect(item)}
        draggable
        aria-grabbed={isDragging}
        aria-label={`${item.label || '（未命名）'}，可拖动调整同级位置`}
        onDragStart={(event) => {
          onDraggedItemChange({ id: item.id, parentId: item.parentId || '' });
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', item.id);
        }}
        onDragOver={(event) => {
          if (!draggedItem || draggedItem.id === item.id || draggedItem.parentId !== (item.parentId || '')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          onDropTargetChange(item.id);
        }}
        onDragLeave={() => {
          if (isDropTarget) onDropTargetChange(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedItem && draggedItem.id !== item.id && draggedItem.parentId === (item.parentId || '')) {
            onReorder(draggedItem.id, item.id);
          }
          onDraggedItemChange(null);
          onDropTargetChange(null);
        }}
        onDragEnd={() => {
          onDraggedItemChange(null);
          onDropTargetChange(null);
        }}
      >
        <GripVertical className="menu-tree-drag-handle" aria-hidden="true" />
        <span
          className={`menu-tree-toggle${hasChildren ? '' : ' is-hidden'}`}
          role="button"
          tabIndex={hasChildren ? 0 : -1}
          aria-label={expanded ? '折叠子菜单' : '展开子菜单'}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) setExpanded((value) => !value);
          }}
          onKeyDown={(event) => {
            if (hasChildren && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              event.stopPropagation();
              setExpanded((value) => !value);
            }
          }}
        >
          {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </span>
        <TypeIcon className="menu-tree-type-icon" aria-hidden="true" />
        <span className="menu-tree-label">{item.label || '（未命名）'}</span>
        <span className={`menu-tree-source${isMenuSourceReadOnly(item.menuSource) ? ' is-readonly' : ''}`}>
          {getMenuSourceBadge(item.menuSource)}
        </span>
        {totalIssues > 0 ? (
          <span className={`menu-tree-issue${errorCount > 0 ? ' is-error' : ''}`} title={`${totalIssues} 个问题`}>
            <AlertTriangle aria-hidden="true" />
            {errorCount > 0 ? errorCount : warningCount}
          </span>
        ) : null}
      </button>

      {hasChildren && expanded ? (
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
              onReorder={onReorder}
              filterText={filterText}
              draggedItem={draggedItem}
              dropTargetId={dropTargetId}
              onDraggedItemChange={onDraggedItemChange}
              onDropTargetChange={onDropTargetChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

const MenuTree: React.FC<MenuTreeProps> = (props) => {
  const [draggedItem, setDraggedItem] = useState<{ id: string; parentId: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  if (props.items.length === 0) {
    return (
      <div className="menu-tree-empty">
        <FileText aria-hidden="true" />
        <strong>暂无菜单项</strong>
        <span>使用上方工具栏创建菜单或命令项。</span>
      </div>
    );
  }

  return (
    <div className="menu-tree-list">
      {props.items.map((item) => (
        <MenuTreeItem
          key={item.id}
          {...props}
          item={item}
          depth={0}
          draggedItem={draggedItem}
          dropTargetId={dropTargetId}
          onDraggedItemChange={setDraggedItem}
          onDropTargetChange={setDropTargetId}
        />
      ))}
    </div>
  );
};

export default MenuTree;
