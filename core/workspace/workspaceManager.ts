/**
 * ATM - 统一工作区方案管理（Workspace Unified Profile）
 *
 * 把「Allegro 环境 + 快捷键方案 + Skill 方案 + 菜单方案 + 配色方案」绑定为
 * 一个工作区方案。存储于 %APPDATA%/AllegroToolkitManager/workspaces.json
 * （应用级全局资源，随设置备份一起迁移）。
 *
 * 本模块只管理组合关系，不复制各子方案内容；应用仍走各模块的 Apply Plan。
 * 纯 TypeScript，仅依赖 Node.js 内置模块，可独立测试。
 */
import fs from 'fs';
import path from 'path';
import { configRoot } from '../color/colorSchemeManager';
import {
  WorkspaceProfile,
  WorkspaceProfileStore,
  createEmptyWorkspaceStore,
  generateWorkspaceId,
} from '../../src/types/workspaceProfile';

export const WORKSPACE_STORE_VERSION = '1.0';

/** 工作区存储文件路径 */
export function getWorkspaceStorePath(): string {
  return path.join(configRoot(), 'workspaces.json');
}

/** 加载工作区存储（不存在或损坏时回退到空存储） */
export function loadWorkspaceStore(): WorkspaceProfileStore {
  try {
    const filePath = getWorkspaceStorePath();
    if (!fs.existsSync(filePath)) {
      return createEmptyWorkspaceStore();
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<WorkspaceProfileStore>;
    if (raw && Array.isArray(raw.workspaces)) {
      return {
        version: raw.version ?? WORKSPACE_STORE_VERSION,
        activeWorkspaceId: raw.activeWorkspaceId ?? raw.workspaces[0]?.id ?? '',
        workspaces: raw.workspaces,
        updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
      };
    }
  } catch {
    // 首次运行或文件损坏时回退到空存储
  }
  return createEmptyWorkspaceStore();
}

/** 保存工作区存储 */
export function saveWorkspaceStore(store: WorkspaceProfileStore): boolean {
  try {
    const filePath = getWorkspaceStorePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/** 列出全部工作区（按创建时间排序） */
export function listWorkspaces(): WorkspaceProfile[] {
  const store = loadWorkspaceStore();
  return [...store.workspaces].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 当前激活工作区；无激活时回退到第一个 */
export function getActiveWorkspace(): WorkspaceProfile | null {
  const store = loadWorkspaceStore();
  if (store.activeWorkspaceId) {
    const active = store.workspaces.find((item) => item.id === store.activeWorkspaceId);
    if (active) return active;
  }
  return store.workspaces[0] ?? null;
}

/** 按 ID 获取工作区 */
export function getWorkspace(workspaceId: string): WorkspaceProfile | null {
  const store = loadWorkspaceStore();
  return store.workspaces.find((item) => item.id === workspaceId) ?? null;
}

/** 创建工作区 */
export function createWorkspace(
  name: string,
  options: Partial<Pick<WorkspaceProfile, 'description' | 'environmentId' | 'hotkeyProfileId' | 'skillProfileId' | 'menuProfileId' | 'colorSchemeId'>> = {},
): WorkspaceProfile {
  const now = new Date().toISOString();
  const workspace: WorkspaceProfile = {
    id: generateWorkspaceId(),
    name: name.trim() || '未命名工作区',
    description: options.description?.trim() || undefined,
    environmentId: options.environmentId,
    hotkeyProfileId: options.hotkeyProfileId ?? '',
    skillProfileId: options.skillProfileId ?? '',
    menuProfileId: options.menuProfileId ?? '',
    colorSchemeId: options.colorSchemeId,
    createdAt: now,
    updatedAt: now,
  };

  const store = loadWorkspaceStore();
  store.workspaces.push(workspace);
  if (!store.activeWorkspaceId) {
    store.activeWorkspaceId = workspace.id;
  }
  saveWorkspaceStore(store);
  return workspace;
}

/** 复制工作区 */
export function copyWorkspace(workspaceId: string, newName?: string): WorkspaceProfile | null {
  const store = loadWorkspaceStore();
  const source = store.workspaces.find((item) => item.id === workspaceId);
  if (!source) return null;

  const now = new Date().toISOString();
  const copy: WorkspaceProfile = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateWorkspaceId(),
    name: newName?.trim() || `${source.name}（副本）`,
    createdAt: now,
    updatedAt: now,
  };
  store.workspaces.push(copy);
  saveWorkspaceStore(store);
  return copy;
}

/** 重命名工作区 */
export function renameWorkspace(workspaceId: string, newName: string): WorkspaceProfile | null {
  const store = loadWorkspaceStore();
  const workspace = store.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || newName.trim() === '') return null;
  workspace.name = newName.trim();
  workspace.updatedAt = new Date().toISOString();
  saveWorkspaceStore(store);
  return workspace;
}

/** 删除工作区：默认工作区不可删；删除激活工作区后自动激活剩余第一个 */
export function deleteWorkspace(workspaceId: string): { success: boolean; error?: string } {
  const store = loadWorkspaceStore();
  const target = store.workspaces.find((item) => item.id === workspaceId);
  if (!target) {
    return { success: false, error: '工作区不存在' };
  }
  if (workspaceId === 'default') {
    return { success: false, error: '默认工作区不可删除' };
  }
  store.workspaces = store.workspaces.filter((item) => item.id !== workspaceId);
  if (store.activeWorkspaceId === workspaceId) {
    store.activeWorkspaceId = store.workspaces[0]?.id ?? '';
  }
  saveWorkspaceStore(store);
  return { success: true };
}

/** 设置激活工作区 */
export function setActiveWorkspace(workspaceId: string): WorkspaceProfile | null {
  const store = loadWorkspaceStore();
  const target = store.workspaces.find((item) => item.id === workspaceId);
  if (!target) return null;
  store.activeWorkspaceId = workspaceId;
  saveWorkspaceStore(store);
  return target;
}
