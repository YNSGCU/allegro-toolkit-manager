/**
 * ATM - 统一工作区方案管理单元测试（V6.2）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  copyWorkspace,
  createWorkspace,
  deleteWorkspace,
  getActiveWorkspace,
  getWorkspace,
  getWorkspaceStorePath,
  listWorkspaces,
  loadWorkspaceStore,
  renameWorkspace,
  setActiveWorkspace,
  updateWorkspace,
} from '../core/workspace/workspaceManager';
import { buildWorkspacePreview } from '../core/workspace/buildWorkspacePreview';
import { planWorkspaceApplySequence } from '../core/workspace/planWorkspaceApply';

let configHome = '';

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-workspace-'));
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  delete process.env.ATM_CONFIG_HOME;
  try {
    fs.rmSync(configHome, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('workspaceManager', () => {
  it('首次访问回退到默认工作区并持久化', () => {
    const store = loadWorkspaceStore();
    expect(store.workspaces[0].id).toBe('default');
    expect(store.workspaces[0].name).toBe('默认工作区');
    expect(fs.existsSync(getWorkspaceStorePath())).toBe(false);
  });

  it('创建、复制、重命名、删除与激活', () => {
    const created = createWorkspace('项目A', {
      environmentId: 'env_1',
      hotkeyProfileId: 'hk_1',
      skillProfileId: 'sk_1',
      menuProfileId: 'mn_1',
      colorSchemeId: 'color_1',
    });
    expect(created.id).toMatch(/^ws_/);
    expect(created.environmentId).toBe('env_1');
    expect(created.colorSchemeId).toBe('color_1');
    expect(getWorkspace(created.id)?.name).toBe('项目A');

    const copied = copyWorkspace(created.id, '项目A（副本）');
    expect(copied?.name).toBe('项目A（副本）');
    expect(copied?.environmentId).toBe('env_1');
    expect(copied?.id).not.toBe(created.id);

    const renamed = renameWorkspace(created.id, '项目A新版');
    expect(renamed?.name).toBe('项目A新版');

    const active = setActiveWorkspace(copied!.id);
    expect(active?.id).toBe(copied!.id);
    expect(getActiveWorkspace()?.id).toBe(copied!.id);

    const removed = deleteWorkspace(created.id);
    expect(removed.success).toBe(true);
    expect(getWorkspace(created.id)).toBeNull();
    // 删除激活工作区后自动激活剩余第一个
    expect(getActiveWorkspace()).not.toBeNull();
  });

  it('默认工作区不可删除', () => {
    const result = deleteWorkspace('default');
    expect(result.success).toBe(false);
    expect(result.error).toContain('默认工作区不可删除');
  });

  it('当前使用中的工作区不可删除', () => {
    const created = createWorkspace('当前项目');
    setActiveWorkspace(created.id);
    const result = deleteWorkspace(created.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('当前使用中');
  });

  it('更新环境与四类方案绑定并持久化', () => {
    const created = createWorkspace('项目C');
    const updated = updateWorkspace(created.id, {
      environmentId: 'env_2',
      hotkeyProfileId: 'hk_2',
      skillProfileId: 'sk_2',
      menuProfileId: 'mn_2',
      colorSchemeId: 'color_2',
    });
    expect(updated).toMatchObject({
      environmentId: 'env_2',
      hotkeyProfileId: 'hk_2',
      skillProfileId: 'sk_2',
      menuProfileId: 'mn_2',
      colorSchemeId: 'color_2',
    });
    expect(getWorkspace(created.id)?.skillProfileId).toBe('sk_2');
  });

  it('存储写入失败时抛错，不返回假成功', () => {
    const invalidRoot = path.join(configHome, 'not-a-directory');
    fs.writeFileSync(invalidRoot, 'file', 'utf-8');
    process.env.ATM_CONFIG_HOME = invalidRoot;
    expect(() => createWorkspace('不会持久化')).toThrow('保存工作区失败');
  });

  it('存储文件与备份兼容', () => {
    createWorkspace('项目B', { hotkeyProfileId: 'hk_9' });
    const store = loadWorkspaceStore();
    expect(store.workspaces.some((item) => item.name === '项目B')).toBe(true);
    expect(JSON.parse(fs.readFileSync(getWorkspaceStorePath(), 'utf-8')).version).toBe('1.0');
  });
});

describe('buildWorkspacePreview', () => {
  const workspace = {
    id: 'ws_1',
    name: '项目A',
    environmentId: 'env_1',
    hotkeyProfileId: 'hk_1',
    skillProfileId: 'sk_1',
    menuProfileId: 'mn_1',
    colorSchemeId: 'color_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('汇总四类子方案与环境信息', () => {
    const preview = buildWorkspacePreview(
      workspace,
      { environmentId: 'env_1', name: '17.4 环境', pcbenvPath: 'C:/pcbenv', allegroVersion: '17.4' },
      {
        hotkeyProfiles: [{ id: 'hk_1', name: '我的快捷键', bindingCount: 42 }],
        skillProfiles: [{ id: 'sk_1', name: '我的 Skill', itemCount: 5 }],
        menuProfiles: [{ id: 'mn_1', name: '我的菜单', itemCount: 3 }],
        colorSchemes: [{ id: 'color_1', name: '板A配色', layerCount: 498, colorCount: 192 }],
      },
    );

    expect(preview.workspaceName).toBe('项目A');
    expect(preview.environment?.allegroVersion).toBe('17.4');
    expect(preview.hotkey).toMatchObject({ exists: true, name: '我的快捷键', detail: '42 条绑定' });
    expect(preview.skill).toMatchObject({ exists: true, detail: '5 个条目' });
    expect(preview.menu).toMatchObject({ exists: true, detail: '3 个菜单项' });
    expect(preview.color).toMatchObject({ exists: true, detail: '498 个图层 · 192 色调色板' });
    expect(preview.totalItems).toBe(4);
  });

  it('缺失的方案标记为不存在并提示', () => {
    const preview = buildWorkspacePreview(
      { ...workspace, colorSchemeId: 'missing_color' },
      null,
      {
        hotkeyProfiles: [{ id: 'hk_1', name: '我的快捷键', bindingCount: 1 }],
        skillProfiles: [{ id: 'sk_1', name: '我的 Skill', itemCount: 1 }],
        menuProfiles: [{ id: 'mn_1', name: '我的菜单', itemCount: 1 }],
        colorSchemes: [],
      },
    );

    expect(preview.color?.exists).toBe(false);
    expect(preview.color?.missing).toContain('配色方案不存在');
    expect(preview.totalItems).toBe(3);
  });

  it('未绑定的子方案不进入预览', () => {
    const preview = buildWorkspacePreview(
      { ...workspace, colorSchemeId: undefined, skillProfileId: '' },
      null,
      {
        hotkeyProfiles: [{ id: 'hk_1', name: '我的快捷键', bindingCount: 1 }],
        skillProfiles: [],
        menuProfiles: [{ id: 'mn_1', name: '我的菜单', itemCount: 1 }],
        colorSchemes: [],
      },
    );

    expect(preview.color).toBeNull();
    expect(preview.skill).toBeNull();
    expect(preview.totalItems).toBe(2);
  });
});

describe('planWorkspaceApplySequence', () => {
  const workspace = {
    id: 'ws_1',
    name: '项目A',
    environmentId: 'env_1',
    hotkeyProfileId: 'hk_1',
    skillProfileId: 'sk_1',
    menuProfileId: 'mn_1',
    colorSchemeId: 'color_1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('按 Skill → 菜单 → 快捷键 → 配色 顺序排列', () => {
    const sequence = planWorkspaceApplySequence(workspace, 'env_1', {
      skill: true,
      menu: true,
      hotkey: true,
      color: true,
    });

    expect(sequence.blocked).toBe(false);
    expect(sequence.order.map((step) => step.module)).toEqual(['skill', 'menu', 'hotkey', 'color']);
  });

  it('环境锁不匹配时拒绝执行', () => {
    const sequence = planWorkspaceApplySequence(workspace, 'env_2', {
      skill: true,
      menu: true,
      hotkey: true,
      color: true,
    });

    expect(sequence.blocked).toBe(true);
    expect(sequence.blockedReason).toContain('环境');
  });

  it('工作区已绑定环境但当前环境为空时拒绝执行', () => {
    const sequence = planWorkspaceApplySequence(workspace, null, {
      skill: true,
      menu: true,
      hotkey: true,
      color: true,
    });

    expect(sequence.blocked).toBe(true);
    expect(sequence.blockedReason).toContain('未设置');
  });

  it('缺失的快捷键/Skill/菜单方案警告并跳过，配色未绑定可忽略', () => {
    const sequence = planWorkspaceApplySequence(
      { ...workspace, colorSchemeId: undefined },
      'env_1',
      { skill: true, menu: false, hotkey: false, color: false },
    );

    expect(sequence.order.map((step) => step.module)).toEqual(['skill']);
    expect(sequence.warnings.some((w) => w.includes('菜单方案未绑定或不存在'))).toBe(true);
    expect(sequence.warnings.some((w) => w.includes('快捷键方案未绑定或不存在'))).toBe(true);
    expect(sequence.blocked).toBe(false);
  });

  it('没有任何可应用方案时标记阻塞', () => {
    const sequence = planWorkspaceApplySequence(
      { ...workspace, skillProfileId: '', menuProfileId: '', hotkeyProfileId: '', colorSchemeId: undefined },
      'env_1',
      { skill: false, menu: false, hotkey: false, color: false },
    );

    expect(sequence.blocked).toBe(true);
  });
});
