/**
 * ATM - 统一工作区方案导入/导出模块（V6.2）
 *
 * 只导出工作区的「组合关系」（环境 + 子方案 ID），不复制子方案本身内容；
 * 导入时生成全新工作区 ID（避免与应用内既有工作区冲突），
 * 名称重名时自动追加「（导入）」后缀。
 */
import {
  WORKSPACE_EXPORT_EXTENSION,
  WorkspaceExportPackage,
  WorkspaceImportPreview,
  WorkspaceProfile,
} from '../../src/types/workspaceProfile';
import { createWorkspace, loadWorkspaceStore } from './workspaceManager';

/** 从现有工作区构建导出包 */
export function buildWorkspaceExportPackage(
  workspace: WorkspaceProfile,
): WorkspaceExportPackage {
  return {
    app: 'atm',
    type: 'workspace-profile',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    workspace: {
      name: workspace.name,
      description: workspace.description,
      environmentId: workspace.environmentId,
      hotkeyProfileId: workspace.hotkeyProfileId ?? '',
      skillProfileId: workspace.skillProfileId ?? '',
      menuProfileId: workspace.menuProfileId ?? '',
      colorSchemeId: workspace.colorSchemeId,
    },
  };
}

/** 序列化导出包为 JSON 文本 */
export function serializeWorkspaceExportPackage(pkg: WorkspaceExportPackage): string {
  return JSON.stringify(pkg, null, 2);
}

function assertString(value: unknown): value is string {
  return typeof value === 'string';
}

/** 解析并校验导入的 JSON 文本，返回导出包；格式非法时抛出中文错误 */
export function parseWorkspaceExportPackage(text: string): WorkspaceExportPackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON，请选择由 ATM 导出的工作区方案文件');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('文件内容不是对象，无法导入');
  }
  const root = parsed as Record<string, unknown>;
  if (root.app !== 'atm' || root.type !== 'workspace-profile') {
    throw new Error('这不是 ATM 工作区方案文件（缺少类型标识）');
  }
  const workspace = root.workspace as Record<string, unknown> | undefined;
  if (!workspace || typeof workspace !== 'object' || !assertString(workspace.name) || !workspace.name.trim()) {
    throw new Error('工作区文件缺少名称（workspace.name）');
  }

  const toOptionalId = (value: unknown): string | undefined =>
    assertString(value) && value.trim() ? value.trim() : undefined;
  const toRequiredId = (value: unknown): string =>
    assertString(value) ? value.trim() : '';

  return {
    app: 'atm',
    type: 'workspace-profile',
    version: root.version === '1.0' ? '1.0' : '1.0',
    exportedAt: assertString(root.exportedAt) ? root.exportedAt : new Date().toISOString(),
    workspace: {
      name: workspace.name.trim(),
      description: assertString(workspace.description) ? workspace.description.trim() || undefined : undefined,
      environmentId: toOptionalId(workspace.environmentId),
      hotkeyProfileId: toRequiredId(workspace.hotkeyProfileId),
      skillProfileId: toRequiredId(workspace.skillProfileId),
      menuProfileId: toRequiredId(workspace.menuProfileId),
      colorSchemeId: toOptionalId(workspace.colorSchemeId),
    },
  };
}

/** 生成导入预览摘要（不写入存储） */
export function previewWorkspaceImport(
  pkg: WorkspaceExportPackage,
  filePath: string,
): WorkspaceImportPreview {
  return {
    filePath,
    fileName: filePath.split(/[\\/]/).pop() || filePath,
    name: pkg.workspace.name,
    description: pkg.workspace.description,
    environmentId: pkg.workspace.environmentId,
    hasHotkeyProfile: Boolean(pkg.workspace.hotkeyProfileId),
    hasSkillProfile: Boolean(pkg.workspace.skillProfileId),
    hasMenuProfile: Boolean(pkg.workspace.menuProfileId),
    hasColorScheme: Boolean(pkg.workspace.colorSchemeId),
  };
}

/**
 * 将导入包写入工作区存储（生成新 ID；名称重名时追加「（导入）」后缀）。
 * 返回新建的工作区。
 */
export function applyWorkspaceImport(
  pkg: WorkspaceExportPackage,
  nameOverride?: string,
): WorkspaceProfile {
  const store = loadWorkspaceStore();
  const existingNames = new Set(store.workspaces.map((item) => item.name.trim().toLowerCase()));
  let name = (nameOverride?.trim() || pkg.workspace.name.trim()) || '导入的工作区';
  if (existingNames.has(name.toLowerCase())) {
    name = `${name}（导入）`;
  }

  return createWorkspace(name, {
    description: pkg.workspace.description,
    environmentId: pkg.workspace.environmentId,
    hotkeyProfileId: pkg.workspace.hotkeyProfileId,
    skillProfileId: pkg.workspace.skillProfileId,
    menuProfileId: pkg.workspace.menuProfileId,
    colorSchemeId: pkg.workspace.colorSchemeId,
  });
}

/** 生成安全的默认导出文件名 */
export function buildWorkspaceExportFileName(name: string): string {
  const safe = name
    .trim()
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 60);
  return `${safe || '工作区'}.${WORKSPACE_EXPORT_EXTENSION}`;
}
