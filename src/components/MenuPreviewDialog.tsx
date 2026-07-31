/**
 * ATM - 菜单预览弹窗组件（V5.5）
 *
 * 三个 Tab：
 * 1. 可视化预览 — 树形显示菜单结构
 * 2. generated_menu.il — SKILL 脚本
 * 3. menu_profile.json — JSON 配置
 */
import React, { useState } from 'react';
import type { MenuItemConfig } from '../types/menu';

interface MenuPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  ilContent: string;
  profileJson?: string;
  itemCount?: { total: number; commands: number; menus: number; separators: number };
  onApplyPlan?: () => void;
  /** 用于可视化预览的菜单项 */
  items?: MenuItemConfig[];
}

type PreviewTab = 'visual' | 'il' | 'json';

const TYPE_ICONS: Record<string, string> = {
  menu: '📁',
  command: '⚡',
  separator: '➖',
};

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

  const handleCopy = async () => {
    try {
      const content = tab === 'il' ? ilContent : (profileJson || '');
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = tab === 'il' ? ilContent : (profileJson || '');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /** 递归渲染菜单项预览 */
  const renderVisualItem = (item: MenuItemConfig, depth: number): React.ReactNode => {
    const indent = depth * 20;
    const isDisabled = !item.enabled;
    const hasIssue = item.status === 'error' || item.status === 'warning';
    const issueColor = item.status === 'error' ? '#f87171' : '#fbbf24';

    if (item.type === 'separator') {
      return (
        <div key={item.id} style={{
          padding: '2px 0 2px 12px',
          paddingLeft: `${12 + indent}px`,
          opacity: isDisabled ? 0.4 : 1,
        }}>
          <div style={{
            height: '1px',
            background: 'var(--border-color)',
            margin: '4px 0',
            width: '100%',
          }} />
        </div>
      );
    }

    return (
      <div key={item.id}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 0 3px 12px',
          paddingLeft: `${12 + indent}px`,
          opacity: isDisabled ? 0.4 : 1,
          fontSize: '13px',
        }}>
          <span style={{ fontSize: '13px' }}>{TYPE_ICONS[item.type] || '📄'}</span>
          <span style={{ fontWeight: item.type === 'menu' ? 600 : 400 }}>
            {item.label || '(未命名)'}
          </span>
          {item.command && (
            <span style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              marginLeft: '4px',
            }}>
              ({item.command})
            </span>
          )}
          {isDisabled && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>（禁用）</span>
          )}
          {hasIssue && (
            <span style={{ fontSize: '11px', color: issueColor }}>⚠</span>
          )}
          {item.type === 'menu' && item.children && item.children.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>▼</span>
          )}
        </div>
        {item.children && item.children.map(child => renderVisualItem(child, depth + 1))}
      </div>
    );
  };

  /** 递归用展开/折叠状态渲染预览 */
  const [expandedVisual, setExpandedVisual] = useState(true);

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
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '8px',
        width: '800px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* 标题 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>菜单预览</span>
            {itemCount && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                {itemCount.total} 个菜单项 · {itemCount.commands} 个命令 · {itemCount.menus} 个菜单 · {itemCount.separators} 个分隔线
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 20px',
        }}>
          <TabButton
            label="👁 可视化预览"
            active={tab === 'visual'}
            onClick={() => setTab('visual')}
          />
          <TabButton
            label="📜 generated_menu.il"
            active={tab === 'il'}
            onClick={() => setTab('il')}
          />
          <TabButton
            label="📋 menu_profile.json"
            active={tab === 'json'}
            onClick={() => setTab('json')}
          />
        </div>

        {/* 预览内容 */}
        {tab === 'visual' ? (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
            maxHeight: '50vh',
            background: 'var(--bg-surface)',
          }}>
            {items && items.length > 0 ? (
              items.map(item => renderVisualItem(item, 0))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                暂无菜单项
              </div>
            )}
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 20px',
            background: 'var(--bg-code, #1a1a2e)',
            fontFamily: 'monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            color: '#e0e0e0',
            maxHeight: '50vh',
          }}>
            {tab === 'il' ? ilContent : (profileJson || '暂无 JSON 预览')}
          </div>
        )}

        {/* 底部 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>⚠ 需要重启 Allegro 或重新加载菜单后生效</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {tab !== 'visual' && (
              <button
                onClick={handleCopy}
                className="btn btn-sm"
                style={{
                  padding: '6px 16px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {copied ? '✅ 已复制' : '📋 复制'}
              </button>
            )}
            {onApplyPlan && (
              <button
                onClick={onApplyPlan}
                className="btn btn-sm btn-primary"
                style={{
                  padding: '6px 16px',
                  background: 'var(--accent-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                生成 Apply Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Tab 按钮 */
const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label, active, onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 16px',
      border: 'none',
      borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
      background: 'transparent',
      color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

export default MenuPreviewDialog;
