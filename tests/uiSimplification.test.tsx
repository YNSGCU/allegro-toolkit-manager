import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProfileBar from '../src/components/ProfileBar';

afterEach(() => cleanup());

describe('UI 简化契约', () => {
  it('紧凑方案栏只常驻方案管理与必要的审阅动作', () => {
    const callbacks = {
      onCreate: vi.fn(),
      onCopy: vi.fn(),
      onRename: vi.fn(),
      onDelete: vi.fn(),
      onSwitch: vi.fn(),
      onApply: vi.fn(),
    };

    const { rerender } = render(
      <ProfileBar
        compact
        title="测试方案"
        profiles={[{ id: 'profile-1', name: '方案一' }]}
        activeProfileId="profile-1"
        applyLabel="审阅更改"
        {...callbacks}
      />,
    );

    expect(screen.getByRole('button', { name: '方案管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '审阅更改' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '复制' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '方案管理' }));
    expect(screen.getByRole('button', { name: '新建方案' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制方案' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重命名方案' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '删除方案' })).toBeInTheDocument();

    rerender(
      <ProfileBar
        compact
        title="测试方案"
        profiles={[{ id: 'profile-1', name: '方案一' }]}
        activeProfileId="profile-1"
        appliedProfileId="profile-1"
        applyLabel="审阅更改"
        {...callbacks}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('已应用');
    expect(screen.queryByRole('button', { name: '审阅更改' })).not.toBeInTheDocument();
  });

  it('Skill 默认工具栏只保留搜索与筛选入口，详情压缩为三个标签', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/SkillPage.tsx'), 'utf8');
    const detailSource = readFileSync(resolve(process.cwd(), 'src/components/SkillDetailSidebar.tsx'), 'utf8');

    const toolbarSource = pageSource.slice(
      pageSource.indexOf('<section className="skill-workspace-toolbar"'),
      pageSource.indexOf('{showAdvancedFilters &&'),
    );

    expect(toolbarSource).toContain('aria-label="搜索 Skill"');
    expect(toolbarSource).toContain('筛选{hasActiveFilters');
    expect(toolbarSource).not.toContain('aria-label="按来源筛选"');
    expect(toolbarSource).not.toContain('aria-label="按加载状态筛选"');
    expect(detailSource).toContain("'overview' | 'commands' | 'actions'");
    expect(detailSource).not.toContain("['files', '文件与加载']");
    expect(detailSource).not.toContain("['maintenance', '维护']");
    expect(detailSource).toContain('label="使用命令"');
    expect(detailSource).toContain('label="使用此 Skill"');
  });

  it('菜单主界面没有常驻多视图标签，写入仍通过 Apply Plan', () => {
    const pageSource = readFileSync(resolve(process.cwd(), 'src/pages/MenuPage.tsx'), 'utf8');
    const hookSource = readFileSync(resolve(process.cwd(), 'src/hooks/useMenuApplyPlan.ts'), 'utf8');

    expect(pageSource).not.toContain('className="menu-editor-tabs"');
    expect(pageSource).toContain('className="menu-tree-toolbar"');
    expect(pageSource).toContain('审阅并应用');
    expect(pageSource).toContain('await generatePlan(');
    expect(hookSource).toContain('window.atm.menuExecuteApplyPlan');
  });
});
