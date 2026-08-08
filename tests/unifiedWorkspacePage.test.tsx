/**
 * ATM - 统一工作区页面组件测试（V6.2）
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UnifiedWorkspacePage from '../src/pages/UnifiedWorkspacePage';

const workspaces = {
  version: '1.0',
  activeWorkspaceId: 'ws_1',
  workspaces: [
    {
      id: 'default',
      name: '默认工作区',
      hotkeyProfileId: '',
      skillProfileId: '',
      menuProfileId: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'ws_1',
      name: '项目A',
      environmentId: 'env_1',
      hotkeyProfileId: 'hk_1',
      skillProfileId: 'sk_1',
      menuProfileId: 'mn_1',
      colorSchemeId: 'color_1',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function mockAtm(overrides: Record<string, unknown> = {}) {
  const ok = (data: unknown) => ({ success: true, data });
  const base: Record<string, unknown> = {
    workspaceLoadAll: () => Promise.resolve(ok(workspaces)),
    workspaceSetActive: () => Promise.resolve(ok(workspaces.workspaces[1])),
    workspaceCreate: () => Promise.resolve(ok({ id: 'ws_new', name: '新工作区' })),
    workspaceRename: () => Promise.resolve(ok({})),
    workspaceDelete: () => Promise.resolve({ success: true }),
    workspacePreview: () => Promise.resolve(ok({
      preview: {
        workspaceId: 'ws_1',
        workspaceName: '项目A',
        environment: { environmentId: 'env_1', name: '17.4 环境', allegroVersion: '17.4' },
        hotkey: { id: 'hk_1', name: '我的快捷键', detail: '42 条绑定', exists: true },
        skill: { id: 'sk_1', name: '我的 Skill', detail: '5 个条目', exists: true },
        menu: { id: 'mn_1', name: '我的菜单', detail: '3 个菜单项', exists: true },
        color: { id: 'color_1', name: '板A配色', detail: '498 个图层 · 192 色调色板', exists: true },
        totalItems: 4,
      },
    })),
    workspaceApplyPlan: () => Promise.resolve(ok({
      sequence: {
        order: [
          { module: 'skill', label: 'Skill 方案' },
          { module: 'menu', label: '菜单方案' },
          { module: 'hotkey', label: '快捷键方案' },
          { module: 'color', label: '配色方案' },
        ],
        warnings: [],
        blocked: false,
      },
      env: { environmentId: 'env_1', pcbenvPath: 'C:/pcbenv', envFilePath: 'C:/pcbenv/env' },
      applyOrder: [],
      applyVisibility: false,
    })),
    ...overrides,
  };
  window.atm = base as unknown as typeof window.atm;
}

afterEach(cleanup);

describe('UnifiedWorkspacePage', () => {
  it('渲染工作区列表与当前标记', async () => {
    mockAtm();
    render(<UnifiedWorkspacePage />);

    expect(await screen.findByText('项目A')).toBeInTheDocument();
    expect(screen.getByText('默认工作区')).toBeInTheDocument();
    expect(screen.getByText('当前')).toBeInTheDocument();
    expect(screen.getByText('新建工作区')).toBeInTheDocument();
  });

  it('预览展示环境与四类方案摘要', async () => {
    mockAtm();
    render(<UnifiedWorkspacePage />);

    const previewButton = (await screen.findAllByRole('button', { name: '预览' }))[0];
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText(/17.4 环境/)).toBeInTheDocument();
      expect(screen.getByText(/我的快捷键/)).toBeInTheDocument();
      expect(screen.getByText(/498 个图层/)).toBeInTheDocument();
    });
  });

  it('应用弹窗展示执行顺序，确认后按序调用各模块', async () => {
    const executor = vi.fn().mockResolvedValue({ success: true, data: {} });
    mockAtm({
      skillProfileLoadAll: () => Promise.resolve({ success: true, data: { profiles: [{ id: 'sk_1', name: '我的 Skill' }] } }),
      skillProfileCreateApplyPlan: () => Promise.resolve({ success: true, data: { module: 'skill' } }),
      skillProfileExecuteApplyPlan: executor,
      menuLoadProfiles: () => Promise.resolve({ success: true, data: { profiles: [{ id: 'mn_1', name: '我的菜单' }] } }),
      menuCreateApplyPlan: () => Promise.resolve({ success: true, data: { module: 'menu' } }),
      menuExecuteApplyPlan: executor,
      createApplyPlan: () => Promise.resolve({ success: true, data: { module: 'hotkey' } }),
      applyPlan: executor,
      colorApply: executor,
    });
    render(<UnifiedWorkspacePage />);

    const applyButton = (await screen.findAllByRole('button', { name: '应用此工作区' }))[0];
    fireEvent.click(applyButton);

    await screen.findByText('确认应用');
    expect(screen.getByText('Skill 方案')).toBeInTheDocument();
    expect(screen.getByText('配色方案')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认应用' }));
    await waitFor(() => {
      expect(executor).toHaveBeenCalled();
    });
  });

  it('新建工作区弹窗可提交', async () => {
    mockAtm();
    render(<UnifiedWorkspacePage />);

    fireEvent.click(await screen.findByRole('button', { name: '新建工作区' }));
    const input = screen.getByPlaceholderText(/工作区名称/);
    fireEvent.change(input, { target: { value: '项目B' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
