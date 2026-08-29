/**
 * ATM - 统一工作区方案导入/导出模块（V6.2）
 *
 * 只导出工作区的「组合关系」（环境 + 子方案 ID），不复制子方案本身内容；
 * 导入时生成全新工作区 ID（避免与应用内既有工作区冲突），
 * 名称重名时自动追加「（导入）」后缀。
 */
import {
  WORKSPACE_EXPORT_EXTENSION,
  WorkspaceBindingOption,
  WorkspaceBindingResolution,
  WorkspaceExportPackage,
  WorkspaceImportRemap,
  WorkspaceImportPreview,
  WorkspaceProfile,
} from '../../src/types/workspaceProfile';
import { createWorkspace, loadWorkspaceStore } from './workspaceManager';

/** 从现有工作区构建导出包 */
export function buildWorkspaceExportPackage(
  workspace: WorkspaceProfile,
  names?: {
    hotkeyProfileName?: string;
    skillProfileName?: string;
    menuProfileName?: string;
    colorSchemeName?: string;
  },
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
      hotkeyProfileName: names?.hotkeyProfileName,
      skillProfileId: workspace.skillProfileId ?? '',
      skillProfileName: names?.skillProfileName,
      menuProfileId: workspace.menuProfileId ?? '',
      menuProfileName: names?.menuProfileName,
      colorSchemeId: workspace.colorSchemeId,
      colorSchemeName: names?.colorSchemeName,
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
      hotkeyProfileName: toOptionalId(workspace.hotkeyProfileName),
      skillProfileId: toRequiredId(workspace.skillProfileId),
      skillProfileName: toOptionalId(workspace.skillProfileName),
      menuProfileId: toRequiredId(workspace.menuProfileId),
      menuProfileName: toOptionalId(workspace.menuProfileName),
      colorSchemeId: toOptionalId(workspace.colorSchemeId),
      colorSchemeName: toOptionalId(workspace.colorSchemeName),
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
  remap?: WorkspaceImportRemap,
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
    hotkeyProfileId: remap?.hotkeyProfileId !== undefined ? remap.hotkeyProfileId : pkg.workspace.hotkeyProfileId,
    skillProfileId: remap?.skillProfileId !== undefined ? remap.skillProfileId : pkg.workspace.skillProfileId,
    menuProfileId: remap?.menuProfileId !== undefined ? remap.menuProfileId : pkg.workspace.menuProfileId,
    colorSchemeId: remap?.colorSchemeId !== undefined ? remap.colorSchemeId : pkg.workspace.colorSchemeId,
  });
}

/** 名称相似度评分：完全一致 100；互相包含 80；去符号后一致 90；去符号后包含 70；否则 0 */
export function scoreNameSimilarity(left: string, right: string): number {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const compactA = a.replace(/[\s\-_()（）[\]【】]+/g, '');
  const compactB = b.replace(/[\s\-_()（）[\]【】]+/g, '');
  if (compactA === compactB) return 90;
  if (compactA.includes(compactB) || compactB.includes(compactA)) return 70;
  return 0;
}

function resolveBinding(
  scope: WorkspaceBindingResolution['scope'],
  label: string,
  boundId: string,
  boundName: string | undefined,
  options: WorkspaceBindingOption[],
): WorkspaceBindingResolution {
  // 未绑定（空 ID）的子方案无需重绑，不产生候选提示
  if (!boundId) {
    return { scope, label, boundId: '', exists: true, candidates: [] };
  }
  const exists = Boolean(boundId) && options.some((option) => option.id === boundId);
  if (exists) {
    return { scope, label, boundId, exists: true, candidates: [] };
  }
  const matchingSubject = boundName?.trim() || boundId;
  const candidates = options
    .map((option) => ({ option, score: scoreNameSimilarity(matchingSubject, option.name) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((candidate) => candidate.option);
  const recommended = candidates[0];
  return {
    scope,
    label,
    boundId,
    exists: false,
    candidates,
    recommendedId: recommended?.id,
    recommendedName: recommended?.name,
  };
}

/**
 * 解析导入方案在本机的子方案存在性，并为缺失的子方案推荐重绑候选。
 * 纯函数、可测试；用于换机导入「一键重绑」。
 */
export function resolveWorkspaceImportBindings(
  bindings: Pick<WorkspaceProfile, 'hotkeyProfileId' | 'skillProfileId' | 'menuProfileId' | 'colorSchemeId'> & {
    hotkeyProfileName?: string;
    skillProfileName?: string;
    menuProfileName?: string;
    colorSchemeName?: string;
  },
  local: {
    hotkeyProfiles: WorkspaceBindingOption[];
    skillProfiles: WorkspaceBindingOption[];
    menuProfiles: WorkspaceBindingOption[];
    colorSchemes: WorkspaceBindingOption[];
  },
): WorkspaceBindingResolution[] {
  return [
    resolveBinding('hotkey', '快捷键方案', bindings.hotkeyProfileId ?? '', bindings.hotkeyProfileName, local.hotkeyProfiles),
    resolveBinding('skill', 'Skill 方案', bindings.skillProfileId ?? '', bindings.skillProfileName, local.skillProfiles),
    resolveBinding('menu', '菜单方案', bindings.menuProfileId ?? '', bindings.menuProfileName, local.menuProfiles),
    resolveBinding('color', '配色方案', bindings.colorSchemeId ?? '', bindings.colorSchemeName, local.colorSchemes),
  ];
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
