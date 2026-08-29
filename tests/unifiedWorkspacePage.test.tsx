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
      hotkeyProfileId: 'hk_default',
      skillProfileId: 'sk_default',
      menuProfileId: 'mn_default',
      colorSchemeId: 'color_default',
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
    workspaceCopy: () => Promise.resolve(ok({ id: 'ws_copy', name: '项目A（副本）' })),
    workspaceUpdate: () => Promise.resolve(ok(workspaces.workspaces[1])),
    workspaceBindingOptions: () => Promise.resolve(ok({
      environmentId: 'env_1',
      environments: [{ id: 'env_1', name: '17.4 环境' }],
      hotkeyProfiles: [{ id: 'hk_1', name: '我的快捷键' }],
      skillProfiles: [{ id: 'sk_1', name: '我的 Skill' }],
      menuProfiles: [{ id: 'mn_1', name: '我的菜单' }],
      colorSchemes: [{ id: 'color_1', name: '板A配色' }],
    })),
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

  it('应用非当前卡片时按被点击工作区执行，而不是误用当前工作区', async () => {
    const executor = vi.fn().mockResolvedValue({ success: true, data: {} });
    const skillPlan = vi.fn().mockResolvedValue({ success: true, data: { module: 'skill' } });
    mockAtm({
      skillProfileLoadAll: () => Promise.resolve({ success: true, data: {
        store: { profiles: [
          { id: 'sk_default', name: '默认 Skill' },
          { id: 'sk_1', name: '我的 Skill' },
        ] },
        activeProfile: { id: 'sk_1' },
        atmGeneratedPath: 'C:/pcbenv/atm_generated',
      } }),
      skillProfileCreateApplyPlan: skillPlan,
      skillProfileExecuteApplyPlan: executor,
      menuLoadProfiles: () => Promise.resolve({ success: true, data: {
        store: { profiles: [{ id: 'mn_default', name: '默认菜单' }] },
        activeProfile: { id: 'mn_default' },
        atmGeneratedPath: 'C:/pcbenv/atm_generated',
      } }),
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
    expect(screen.getByText('按顺序应用「默认工作区」的 4 个方案')).toBeInTheDocument();
    expect(screen.getByText('Skill 方案')).toBeInTheDocument();
    expect(screen.getByText('配色方案')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认应用' }));
    await waitFor(() => {
      expect(skillPlan).toHaveBeenCalledWith(expect.stringContaining('sk_default'));
    });
  });

  it('失败步骤不计入已完成数量', async () => {
    mockAtm({
      skillProfileLoadAll: () => Promise.resolve({ success: true, data: {
        store: { profiles: [{ id: 'sk_default' }] },
        activeProfile: { id: 'sk_default' },
        atmGeneratedPath: 'C:/pcbenv/atm_generated',
      } }),
      skillProfileCreateApplyPlan: () => Promise.resolve({ success: true, data: { module: 'skill' } }),
      skillProfileExecuteApplyPlan: () => Promise.resolve({ success: false, error: '写入失败' }),
    });
    render(<UnifiedWorkspacePage />);
    fireEvent.click((await screen.findAllByRole('button', { name: '应用此工作区' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认应用' }));
    expect(await screen.findByText('已完成 0/4 个步骤')).toBeInTheDocument();
  });

  it('确认后环境锁变化时停止执行并要求重新审阅', async () => {
    const executor = vi.fn();
    let planCall = 0;
    mockAtm({
      workspaceApplyPlan: () => {
        planCall += 1;
        return Promise.resolve({
          success: true,
          data: planCall === 1
            ? {
                sequence: { order: [{ module: 'skill', label: 'Skill 方案' }], warnings: [], blocked: false },
                env: { environmentId: 'env_1', pcbenvPath: 'C:/pcbenv', envFilePath: 'C:/pcbenv/env' },
                applyOrder: [],
                applyVisibility: false,
              }
            : {
                sequence: { order: [], warnings: [], blocked: true, blockedReason: '当前 Allegro 环境已变化' },
                env: { environmentId: 'env_2', pcbenvPath: 'D:/pcbenv', envFilePath: 'D:/pcbenv/env' },
                applyOrder: [],
                applyVisibility: false,
              },
        });
      },
      skillProfileExecuteApplyPlan: executor,
    });
    render(<UnifiedWorkspacePage />);
    fireEvent.click((await screen.findAllByRole('button', { name: '应用此工作区' }))[0]);
    fireEvent.click(await screen.findByRole('button', { name: '确认应用' }));

    expect((await screen.findAllByText('当前 Allegro 环境已变化')).length).toBeGreaterThan(0);
    expect(executor).not.toHaveBeenCalled();
  });

  it('按真实 IPC 响应结构（store.profiles）执行 Skill 步骤，不误报方案不存在', async () => {
    const executor = vi.fn().mockResolvedValue({ success: true, data: {} });
    const skillPlan = vi.fn().mockResolvedValue({ success: true, data: { module: 'skill' } });
    const menuPlan = vi.fn().mockResolvedValue({ success: true, data: { module: 'menu' } });
    mockAtm({
      // 与 electron/ipc/skill.profile.ipc.ts 的真实返回保持一致：方案列表在 data.store.profiles
      skillProfileLoadAll: () => Promise.resolve({
        success: true,
        data: { store: { profiles: [{ id: 'sk_1', name: '我的 Skill' }] }, activeProfile: null, atmGeneratedPath: '' },
      }),
      skillProfileCreateApplyPlan: skillPlan,
      skillProfileExecuteApplyPlan: executor,
      // menu:load-profiles 同样返回 data.store
      menuLoadProfiles: () => Promise.resolve({
        success: true,
        data: { store: { profiles: [{ id: 'mn_1', name: '我的菜单' }] }, activeProfile: null, atmGeneratedPath: '' },
      }),
      menuCreateApplyPlan: menuPlan,
      menuExecuteApplyPlan: executor,
      createApplyPlan: () => Promise.resolve({ success: true, data: { module: 'hotkey' } }),
      applyPlan: executor,
      colorApply: executor,
    });
    render(<UnifiedWorkspacePage />);

    fireEvent.click((await screen.findAllByRole('button', { name: '应用此工作区' }))[1]);
    fireEvent.click(await screen.findByRole('button', { name: '确认应用' }));

    await waitFor(() => {
      expect(skillPlan).toHaveBeenCalledWith(expect.stringContaining('"id":"sk_1"'));
      expect(menuPlan).toHaveBeenCalled();
      expect(screen.queryByText('Skill 方案不存在')).not.toBeInTheDocument();
      expect(screen.queryByText('菜单方案不存在')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('已完成 4/4 个步骤')).toBeInTheDocument();
  });

  it('提供工作区绑定配置入口', async () => {
    mockAtm();
    render(<UnifiedWorkspacePage />);
    fireEvent.click(await screen.findByRole('button', { name: '配置 项目A' }));
    expect(await screen.findByRole('dialog', { name: '配置工作区' })).toBeInTheDocument();
    expect(screen.getByLabelText('Allegro 环境')).toBeInTheDocument();
    expect(screen.getByLabelText('快捷键方案')).toBeInTheDocument();
  });

  it('新建工作区弹窗可提交', async () => {
    mockAtm();
    render(<UnifiedWorkspacePage />);

    fireEvent.click(await screen.findByRole('button', { name: '新建工作区' }));
    const input = screen.getByPlaceholderText(/工作区名称/);
    fireEvent.change(input, { target: { value: '项目B' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByRole('dialog', { name: '配置工作区' })).toBeInTheDocument();
  });

  it('引用校验展示跨模块命令告警', async () => {
    const ok = (data: unknown) => ({ success: true, data });
    mockAtm({
      workspaceCheckRefs: () => Promise.resolve(ok({
        issues: [
          {
            severity: 'warning',
            scope: 'hotkey',
            source: '快捷键 F4',
            command: 'drc_run',
            detail: '命令「drc_run」由 Skill「drc_helper.il」提供，但目标 Skill 方案未启用，应用后命令将失效',
          },
        ],
        errors: [],
        warnings: [
          {
            severity: 'warning',
            scope: 'hotkey',
            source: '快捷键 F4',
            command: 'drc_run',
            detail: '命令「drc_run」由 Skill「drc_helper.il」提供，但目标 Skill 方案未启用，应用后命令将失效',
          },
        ],
        infos: [],
        blocked: false,
        summary: { checked: 1, resolved: 0, builtin: 0, disabledProvider: 1, unresolved: 0 },
      })),
    });
    render(<UnifiedWorkspacePage />);

    fireEvent.click(await screen.findByRole('button', { name: '引用校验 项目A' }));

    expect(await screen.findByRole('dialog', { name: '引用一致性校验' })).toBeInTheDocument();
    expect(screen.getByText('快捷键 F4')).toBeInTheDocument();
    expect(screen.getByText(/drc_helper\.il/)).toBeInTheDocument();
  });

  it('导入时缺失子方案可重绑并随提交传回', async () => {
    const ok = (data: unknown) => ({ success: true, data });
    const importCommit = vi.fn().mockResolvedValue(ok({ workspace: { name: '项目A（导入）' }, fileName: 'ws.json' }));
    mockAtm({
      workspaceImportOpen: () => Promise.resolve(ok({
        filePath: 'D:/share/ws.json',
        fileName: 'ws.json',
        name: '项目A',
        hasHotkeyProfile: true,
        hasSkillProfile: true,
        hasMenuProfile: true,
        hasColorScheme: false,
        resolutions: [
          { scope: 'hotkey', label: '快捷键方案', boundId: 'hk-old', exists: true, candidates: [] },
          {
            scope: 'skill',
            label: 'Skill 方案',
            boundId: 'sk-old',
            exists: false,
            candidates: [
              { id: 'sk_1', name: '我的 Skill' },
              { id: 'sk_default', name: '默认 Skill' },
            ],
            recommendedId: 'sk_1',
            recommendedName: '我的 Skill',
          },
          { scope: 'menu', label: '菜单方案', boundId: 'mn-old', exists: true, candidates: [] },
          { scope: 'color', label: '配色方案', boundId: '', exists: false, candidates: [] },
        ],
      })),
      workspaceImportCommit: importCommit,
    });
    render(<UnifiedWorkspacePage />);

    fireEvent.click(await screen.findByRole('button', { name: '导入方案' }));

    const dialog = await screen.findByRole('dialog', { name: '导入工作区方案' });
    expect(dialog).toBeInTheDocument();
    const remapSelect = screen.getByLabelText('重绑 Skill 方案');
    expect(remapSelect).toHaveValue('sk_1');

    fireEvent.change(remapSelect, { target: { value: 'sk_default' } });
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));

    await waitFor(() => {
      expect(importCommit).toHaveBeenCalledWith('D:/share/ws.json', '项目A', { skillProfileId: 'sk_default' });
    });
  });
});
