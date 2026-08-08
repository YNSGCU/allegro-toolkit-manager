/**
 * ATM - 统一工作区方案预览构建器（V6.2）
 *
 * 给定工作区与各子方案摘要，生成统一预览。纯函数、可测试。
 * 数据由 IPC 层从各模块加载后传入，本模块不直接访问文件系统。
 */
import type { WorkspaceProfile } from '../../src/types/workspaceProfile';

export interface WorkspacePreviewEnvironment {
  environmentId?: string;
  name?: string;
  pcbenvPath?: string;
  allegroVersion?: string;
}

export interface WorkspacePreviewItem {
  id: string;
  name: string;
  detail: string;
  exists: boolean;
  missing?: string;
}

export interface WorkspacePreview {
  workspaceId: string;
  workspaceName: string;
  environment: WorkspacePreviewEnvironment | null;
  hotkey: WorkspacePreviewItem | null;
  skill: WorkspacePreviewItem | null;
  menu: WorkspacePreviewItem | null;
  color: WorkspacePreviewItem | null;
  /** 存在的子方案条目数 */
  totalItems: number;
}

export interface WorkspacePreviewStores {
  hotkeyProfiles: Array<{ id: string; name: string; bindingCount?: number }>;
  skillProfiles: Array<{ id: string; name: string; itemCount?: number }>;
  menuProfiles: Array<{ id: string; name: string; itemCount?: number }>;
  colorSchemes: Array<{ id: string; name: string; layerCount?: number; colorCount?: number }>;
}

function findItem<T extends { id: string; name: string }>(
  list: T[],
  id: string | undefined,
  kind: string,
): { item: T | null; exists: boolean } {
  if (!id) return { item: null, exists: false };
  const item = list.find((entry) => entry.id === id) ?? null;
  return { item, exists: item !== null };
}

/**
 * 构建统一预览：环境 + 四类子方案的存在性、名称与摘要。
 */
export function buildWorkspacePreview(
  workspace: WorkspaceProfile,
  environment: WorkspacePreviewEnvironment | null,
  stores: WorkspacePreviewStores,
): WorkspacePreview {
  const { item: hotkey, exists: hotkeyExists } = findItem(stores.hotkeyProfiles, workspace.hotkeyProfileId, '快捷键');
  const { item: skill, exists: skillExists } = findItem(stores.skillProfiles, workspace.skillProfileId, 'Skill');
  const { item: menu, exists: menuExists } = findItem(stores.menuProfiles, workspace.menuProfileId, '菜单');
  const { item: color, exists: colorExists } = findItem(stores.colorSchemes, workspace.colorSchemeId, '配色');

  const hotkeyPreview: WorkspacePreviewItem | null = workspace.hotkeyProfileId
    ? {
        id: workspace.hotkeyProfileId,
        name: hotkey?.name ?? '（方案缺失）',
        detail: hotkey && 'bindingCount' in hotkey
          ? `${hotkey.bindingCount ?? 0} 条绑定`
          : '',
        exists: hotkeyExists,
        missing: hotkeyExists ? undefined : '快捷键方案不存在，应用前需先创建',
      }
    : null;

  const skillPreview: WorkspacePreviewItem | null = workspace.skillProfileId
    ? {
        id: workspace.skillProfileId,
        name: skill?.name ?? '（方案缺失）',
        detail: skill && 'itemCount' in skill ? `${skill.itemCount ?? 0} 个条目` : '',
        exists: skillExists,
        missing: skillExists ? undefined : 'Skill 方案不存在，应用前需先创建',
      }
    : null;

  const menuPreview: WorkspacePreviewItem | null = workspace.menuProfileId
    ? {
        id: workspace.menuProfileId,
        name: menu?.name ?? '（方案缺失）',
        detail: menu && 'itemCount' in menu ? `${menu.itemCount ?? 0} 个菜单项` : '',
        exists: menuExists,
        missing: menuExists ? undefined : '菜单方案不存在，应用前需先创建',
      }
    : null;

  const colorPreview: WorkspacePreviewItem | null = workspace.colorSchemeId
    ? {
        id: workspace.colorSchemeId,
        name: color?.name ?? '（方案缺失）',
        detail: color && 'layerCount' in color
          ? `${color.layerCount ?? 0} 个图层 · ${color.colorCount ?? 0} 色调色板`
          : '',
        exists: colorExists,
        missing: colorExists ? undefined : '配色方案不存在，应用前需先创建',
      }
    : null;

  const totalItems = [hotkeyPreview, skillPreview, menuPreview, colorPreview]
    .filter((item): item is WorkspacePreviewItem => item !== null && item.exists).length;

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    environment,
    hotkey: hotkeyPreview,
    skill: skillPreview,
    menu: menuPreview,
    color: colorPreview,
    totalItems,
  };
}
