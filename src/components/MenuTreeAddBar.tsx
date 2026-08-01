import React from 'react';
import MoreActionsMenu from './MoreActionsMenu';

interface MenuTreeAddBarProps {
  selectedMenuLabel: string | null;
  onAddSubmenu: () => void;
  onAddCommand: () => void;
  onAddSeparator: () => void;
}

const MenuTreeAddBar: React.FC<MenuTreeAddBarProps> = ({
  selectedMenuLabel,
  onAddSubmenu,
  onAddCommand,
  onAddSeparator,
}) => {
  const disabled = !selectedMenuLabel;

  return (
    <div className="menu-tree-add-bar" aria-label="向菜单目录添加内容">
      <div className="menu-tree-add-copy">
        <span className="menu-tree-add-title">
          {selectedMenuLabel ? `添加到“${selectedMenuLabel}”` : '请先在左侧选择一个菜单目录'}
        </span>
        <span className="menu-tree-add-hint">
          {selectedMenuLabel ? '新内容会放在该目录的末尾' : '命令和分隔线不能直接放在顶层'}
        </span>
      </div>

      <div className="menu-tree-add-actions">
        <MoreActionsMenu
          label="添加"
          buttonClassName="btn btn-sm btn-primary"
          actions={[
            { label: '添加命令', onClick: onAddCommand, disabled },
            { label: '添加子菜单', onClick: onAddSubmenu, disabled },
            { label: '添加分隔线', onClick: onAddSeparator, disabled },
          ]}
        />
      </div>
    </div>
  );
};

export default MenuTreeAddBar;
