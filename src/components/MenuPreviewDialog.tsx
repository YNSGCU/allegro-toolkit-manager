import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ClipboardCopy,
  Eye,
  FileJson,
  FileText,
  Folder,
  Minus,
  TerminalSquare,
  X,
} from 'lucide-react';
import type { MenuItemConfig } from '../types/menu';
import useDialogFocus from '../shared/ui/overlays/useDialogFocus';

interface MenuPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  ilContent: string;
  profileJson?: string;
  itemCount?: { total: number; commands: number; menus: number; separators: number };
  onApplyPlan?: () => void;
  items?: MenuItemConfig[];
}

type PreviewTab = 'visual' | 'il' | 'json';

const TYPE_ICONS = {
  menu: Folder,
  command: TerminalSquare,
  separator: Minus,
} as const;

const MenuPreviewDialog: React.FC<MenuPreviewDialogProps> = ({
  open,
  onClose,
  ilContent,
  profileJson,
  itemCount,
  onApplyPlan,
  items,
}) => {
  const [tab, setTab] = useState<PreviewTab>('visual');
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const { dialogRef, handleDialogKeyDown } = useDialogFocus<HTMLElement>({
    open,
    onClose,
  });

  const handleCopy = async () => {
    const content = tab === 'il' ? ilContent : (profileJson || '');
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const renderVisualItem = (item: MenuItemConfig, depth: number): React.ReactNode => {
    const isDisabled = !item.enabled;
    const hasIssue = item.status === 'error' || item.status === 'warning';

    if (item.type === 'separator') {
      return (
        <div
          key={item.id}
          className={`menu-preview-separator${isDisabled ? ' is-disabled' : ''}`}
          style={{ '--menu-depth': depth } as React.CSSProperties}
        >
          <span />
        </div>
      );
    }

    const TypeIcon = TYPE_ICONS[item.type] || FileText;
    return (
      <div key={item.id}>
        <div
          className={`menu-preview-row${isDisabled ? ' is-disabled' : ''}`}
          style={{ '--menu-depth': depth } as React.CSSProperties}
        >
          <TypeIcon aria-hidden="true" />
          <span className={item.type === 'menu' ? 'is-menu' : ''}>{item.label || '（未命名）'}</span>
          {item.command ? <code>({item.command})</code> : null}
          {isDisabled ? <small>已禁用</small> : null}
          {hasIssue ? <AlertTriangle className="menu-preview-issue" aria-label="存在问题" /> : null}
          {item.type === 'menu' && item.children?.length ? <ChevronDown className="menu-preview-chevron" aria-hidden="true" /> : null}
        </div>
        {item.children?.map((child) => renderVisualItem(child, depth + 1))}
      </div>
    );
  };

  if (!open) return null;

  const tabs = [
    { key: 'visual' as const, label: '可视化预览', icon: Eye },
    { key: 'il' as const, label: 'generated_menu.il', icon: FileText },
    { key: 'json' as const, label: 'menu_profile.json', icon: FileJson },
  ];

  return (
    <div className="ui-dialog-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className="ui-dialog menu-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="ui-dialog-header">
          <div>
            <h2 id={titleId}>菜单预览</h2>
            {itemCount ? (
              <p>{itemCount.total} 个菜单项 · {itemCount.commands} 个命令 · {itemCount.menus} 个菜单 · {itemCount.separators} 个分隔线</p>
            ) : null}
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label="关闭菜单预览" data-dialog-initial-focus><X aria-hidden="true" /></button>
        </header>

        <div className="menu-preview-tabs" role="tablist" aria-label="菜单预览格式">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'is-active' : ''}
              onClick={() => setTab(key)}
            >
              <Icon aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="ui-dialog-body menu-preview-body">
          {tab === 'visual' ? (
            items?.length ? <div className="menu-preview-tree">{items.map((item) => renderVisualItem(item, 0))}</div> : <div className="menu-preview-empty">暂无菜单项</div>
          ) : (
            <pre className="menu-preview-code">{tab === 'il' ? ilContent : (profileJson || '暂无 JSON 预览')}</pre>
          )}
        </div>

        <footer className="ui-dialog-footer menu-preview-footer">
          <span className="menu-preview-restart"><AlertTriangle aria-hidden="true" />应用后需要重启 Allegro 或重新加载菜单。</span>
          <div>
            {tab !== 'visual' ? (
              <button className="btn btn-sm" onClick={handleCopy}>
                {copied ? <Check aria-hidden="true" /> : <ClipboardCopy aria-hidden="true" />}
                {copied ? '已复制' : '复制'}
              </button>
            ) : null}
            {onApplyPlan ? <button className="btn btn-sm btn-primary" onClick={onApplyPlan}>生成 Apply Plan</button> : null}
          </div>
        </footer>
      </section>
    </div>
  );
};

export default MenuPreviewDialog;
