import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MenuTreeAddBar from '../src/components/MenuTreeAddBar';

afterEach(() => cleanup());

describe('菜单编辑工作区', () => {
  it('选中菜单目录后提供三个明确的就地添加入口', () => {
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
    fireEvent.click(screen.getByRole('button', { name: '添加子菜单' }));
    fireEvent.click(screen.getByRole('button', { name: '添加命令' }));
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
    expect(screen.getByRole('button', { name: '添加命令' })).toBeDisabled();
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
    expect(pageSource).toContain('applyLabel="应用方案"');
    expect(pageSource).toContain('JSON.stringify(previewStore)');
    expect(pageSource).not.toContain('showCompactManagementActions');
    expect(pageSource).toContain('新建顶级菜单');
    expect(pageSource).toContain('<MoreActionsMenu');
    expect(pageSource).toContain('<WorkspaceHeader');
    expect(pageSource).toContain('<PageState');
    expect(pageSource).toContain('appliedProfileId={store.appliedProfileId}');
    expect(pageSource).toContain('needsRestart={needsAllegroRestart ? true : undefined}');
    expect(pageSource).not.toContain('return true; // has menu items, needs restart');
    expect(pageSource).toContain('<MenuTreeAddBar');
    expect(pageSource).toContain('compact');
    expect(cssSource).not.toMatch(/\.menu-editor-content\s*\{[^}]*min-height:\s*520px/s);
    expect(workspaceCssSource).toMatch(/\.workspace-page-menu \.menu-editor-content\s*\{[^}]*min-height:\s*0/s);
    expect(hookSource).toContain('window.atm.menuExecuteApplyPlan');
    expect(preloadSource).toContain("ipcRenderer.invoke('menu:execute-apply-plan'");
  });
});
