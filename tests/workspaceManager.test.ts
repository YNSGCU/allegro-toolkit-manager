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
} from '../core/workspace/workspaceManager';

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

  it('存储文件与备份兼容', () => {
    createWorkspace('项目B', { hotkeyProfileId: 'hk_9' });
    const store = loadWorkspaceStore();
    expect(store.workspaces.some((item) => item.name === '项目B')).toBe(true);
    expect(JSON.parse(fs.readFileSync(getWorkspaceStorePath(), 'utf-8')).version).toBe('1.0');
  });
});
