import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MenuTreeAddBar from '../src/components/MenuTreeAddBar';
import MenuTree from '../src/components/MenuTree';
import type { MenuItemConfig } from '../src/types/menu';

afterEach(() => cleanup());

describe('菜单编辑工作区', () => {
  it('DataTransfer 在 dragover 读不到 payload 时仍可调换同级菜单位置', () => {
    const onReorder = vi.fn();
    const child = (id: string, label: string): MenuItemConfig => ({
      id,
      label,
      type: 'command',
      command: id,
      parentId: 'parent',
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
    });
    const items: MenuItemConfig[] = [{
      id: 'parent',
      label: '测试3',
      type: 'menu',
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      children: [child('test4', '测试4'), child('test5', '测试5')],
    }];
    render(
      <MenuTree
        items={items}
        selectedId={null}
        onSelect={vi.fn()}
        onAddChild={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onReorder={onReorder}
      />,
    );

    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      // Chromium dragover 的 protected mode 不允许目标读取 dragstart payload。
      getData: vi.fn(() => ''),
    };
    const source = screen.getByRole('button', { name: /测试4，可拖动调整同级位置/ });
    const target = screen.getByRole('button', { name: /测试5，可拖动调整同级位置/ });

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    expect(target).toHaveClass('is-drop-target');
    fireEvent.drop(target, { dataTransfer });

    expect(onReorder).toHaveBeenCalledWith('test4', 'test5');
  });

  it('选中菜单目录后通过单一添加入口提供三种内容类型', () => {
    const onAddSubmenu = vi.fn();
    const onAddCommand = vi.fn();
    const onAddSeparator = vi.fn();

    render(
      <MenuTreeAddBar
        selectedMenuLabel="测试菜单"
        onAddSubmenu={onAddSubmenu}
        onAddCommand={onAddCommand}
        onAddSeparator={onAddSeparator}
      />,
    );

    expect(screen.getByText('添加到“测试菜单”')).toBeInTheDocument();
    const addButton = screen.getByRole('button', { name: '添加' });
    fireEvent.click(addButton);
    fireEvent.click(screen.getByRole('button', { name: '添加子菜单' }));
    fireEvent.click(addButton);
    fireEvent.click(screen.getByRole('button', { name: '添加命令' }));
    fireEvent.click(addButton);
    fireEvent.click(screen.getByRole('button', { name: '添加分隔线' }));

    expect(onAddSubmenu).toHaveBeenCalledOnce();
    expect(onAddCommand).toHaveBeenCalledOnce();
    expect(onAddSeparator).toHaveBeenCalledOnce();
  });

  it('未选中菜单目录时给出操作提示并禁用添加按钮', () => {
    render(
      <MenuTreeAddBar
        selectedMenuLabel={null}
        onAddSubmenu={vi.fn()}
        onAddCommand={vi.fn()}
        onAddSeparator={vi.fn()}
      />,
    );

    expect(screen.getByText('请先在左侧选择一个菜单目录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
  });

  it('菜单页使用紧凑无乱码页头和有最小高度的编辑区', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/MenuPage.tsx'), 'utf8');
    const cssSource = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8');
    const workspaceCssSource = readFileSync(resolve(process.cwd(), 'src/shared/ui/foundations/workspace.css'), 'utf8');
    const hookSource = readFileSync(resolve(process.cwd(), 'src/hooks/useMenuApplyPlan.ts'), 'utf8');
    const preloadSource = readFileSync(resolve(process.cwd(), 'electron/preload.ts'), 'utf8');

    expect(pageSource).not.toContain('???');
    expect(pageSource).not.toContain('<MinimalSurface');
    expect(pageSource).toContain('className="menu-page-header"');
    expect(pageSource).toContain('applyLabel="审阅更改"');
    expect(pageSource).toContain('showApplyAction={false}');
    expect(pageSource).toContain('JSON.stringify(previewStore)');
    expect(pageSource).not.toContain('showCompactManagementActions');
    expect(pageSource).toContain('新建顶级菜单');
    expect(pageSource).toContain('<MoreActionsMenu');
    expect(pageSource).toContain('<WorkspaceHeader');
    expect(pageSource).toContain('<PageState');
    expect(pageSource).toContain('appliedProfileId={hasUnappliedDraft ? undefined : store.appliedProfileId}');
    expect(pageSource).toContain('needsRestart={needsAllegroRestart ? true : undefined}');
    expect(pageSource).not.toContain('return true; // has menu items, needs restart');
    expect(pageSource).toContain('<MenuTreeAddBar');
    expect(pageSource).not.toContain('className="menu-editor-tabs"');
    expect(pageSource).toContain('className="menu-tree-toolbar"');
    expect(pageSource).toContain('compact');
    expect(cssSource).not.toMatch(/\.menu-editor-content\s*\{[^}]*min-height:\s*520px/s);
    expect(workspaceCssSource).toMatch(/\.workspace-page-menu \.menu-editor-content\s*\{[^}]*min-height:\s*0/s);
    expect(workspaceCssSource).toMatch(
      /\.workspace-page-menu \.menu-editor-split\s*\{[^}]*display:\s*grid;[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
    );
    expect(workspaceCssSource).toMatch(
      /\.workspace-page-menu \.menu-tree-pane\s*\{[^}]*overflow-y:\s*auto;/s,
    );
    expect(workspaceCssSource).toMatch(
      /\.workspace-page-menu \.menu-detail-pane\s*\{[^}]*overflow:\s*hidden;/s,
    );
    expect(hookSource).toContain('window.atm.menuExecuteApplyPlan');
    expect(hookSource).toContain('window.atm.menuCreateRecoveryPlan');
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:execute-apply-plan'");
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:create-recovery-plan'");
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:create-environment-copy-plan'");
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:export-profile'");
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:open-import-profile'");
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:create-import-plan'");
    expect(pageSource).toContain('导出当前方案');
    expect(pageSource).toContain('<MenuProfileImportDialog');
    expect(pageSource).not.toContain('导入功能将在后续版本中提供');
    expect(pageSource).toContain('发现可恢复的菜单方案');
    expect(pageSource).toContain('当前 menu_profile.json 为空');
    expect(pageSource).toContain('setActiveAllegroEnvironment');
    expect(pageSource).toContain("registerEnvironmentSwitchGuard('menu-draft'");
    expect(pageSource).toContain('复制到当前');
    expect(pageSource).toContain('hasUnsavedChanges && !await handleSaveDraft()');
  });
});
