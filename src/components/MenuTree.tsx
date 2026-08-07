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
}) => {
  const [expanded, setExpanded] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const isSelected = selectedId === item.id;
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
        className={`menu-tree-row${isSelected ? ' is-selected' : ''}${item.enabled ? '' : ' is-disabled'}`}
        style={{ '--menu-depth': depth } as React.CSSProperties}
        onClick={() => onSelect(item)}
        draggable
        aria-label={`${item.label || '（未命名）'}，可拖动调整同级位置`}
        onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.setData('application/x-atm-menu-parent', item.parentId || ''); }}
        onDragOver={(event) => { const sourceId = event.dataTransfer.getData('text/plain') || draggedId; const sourceParentId = event.dataTransfer.getData('application/x-atm-menu-parent'); if (!sourceId || sourceId === item.id || sourceParentId !== (item.parentId || '')) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(item.id); }}
        onDragLeave={() => setDropTargetId(null)}
        onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggedId; if (sourceId && sourceId !== item.id) onReorder(sourceId, item.id); setDraggedId(null); setDropTargetId(null); }}
        onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
      >
        <GripVertical className={`menu-tree-drag-handle${dropTargetId === item.id ? ' is-drop-target' : ''}`} aria-hidden="true" />
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

const MenuTree: React.FC<MenuTreeProps> = (props) => {
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
        <MenuTreeItem key={item.id} {...props} item={item} depth={0} />
      ))}
    </div>
  );
};

export default MenuTree;
