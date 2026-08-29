/**
 * ATM - Workspace Profile 类型定义（V5.5）
 */
export interface WorkspaceProfile {
  id: string;
  name: string;
  description?: string;
  /** 目标 Allegro 环境（environmentId → pcbenv / 版本）；可选，旧工作区不绑定环境 */
  environmentId?: string;
  hotkeyProfileId: string;
  skillProfileId: string;
  menuProfileId: string;
  /** 配色方案（V6.1 全局资源）；可选，旧工作区不绑定配色 */
  colorSchemeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceProfileStore {
  version: string;
  activeWorkspaceId: string;
  workspaces: WorkspaceProfile[];
  updatedAt: string;
}

export type WorkspaceProfileBindings = Pick<
  WorkspaceProfile,
  'environmentId' | 'hotkeyProfileId' | 'skillProfileId' | 'menuProfileId' | 'colorSchemeId'
>;

export interface WorkspaceBindingOption {
  id: string;
  name: string;
}

/** 工作区配置弹窗所需的环境与子方案候选项。 */
export interface WorkspaceBindingOptions {
  environmentId?: string;
  environments: WorkspaceBindingOption[];
  hotkeyProfiles: WorkspaceBindingOption[];
  skillProfiles: WorkspaceBindingOption[];
  menuProfiles: WorkspaceBindingOption[];
  colorSchemes: WorkspaceBindingOption[];
}

export function generateWorkspaceId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyWorkspaceStore(): WorkspaceProfileStore {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    activeWorkspaceId: 'default',
    workspaces: [
      {
        id: 'default',
        name: '默认工作区',
        description: '当前快捷键方案、Skill 方案和菜单方案的组合',
        hotkeyProfileId: 'default',
        skillProfileId: 'default',
        menuProfileId: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ],
    updatedAt: now,
  };
}

/** 统一应用计划的执行步骤 */
export interface WorkspaceApplyStepView {
  module: 'skill' | 'menu' | 'hotkey' | 'color';
  label: string;
}

/** workspace:apply-plan 返回的视图模型 */
export interface WorkspaceApplyPlanView {
  sequence: {
    order: WorkspaceApplyStepView[];
    warnings: string[];
    blocked: boolean;
    blockedReason?: string;
  };
  env: {
    environmentId?: string;
    pcbenvPath?: string | null;
    envFilePath?: string | null;
  };
  applyOrder: WorkspaceApplyStepView[];
  applyVisibility: boolean;
}

/** 工作区方案导入/导出包（只导出组合关系，不包含子方案内容） */
export interface WorkspaceExportPackage {
  app: 'atm';
  type: 'workspace-profile';
  version: '1.0';
  exportedAt: string;
  workspace: {
    name: string;
    description?: string;
    environmentId?: string;
    hotkeyProfileId: string;
    skillProfileId: string;
    menuProfileId: string;
    colorSchemeId?: string;
  };
}

/** 导入文件解析后的预览摘要（供 UI 确认） */
export interface WorkspaceImportPreview {
  filePath: string;
  fileName: string;
  name: string;
  description?: string;
  environmentId?: string;
  hasHotkeyProfile: boolean;
  hasSkillProfile: boolean;
  hasMenuProfile: boolean;
  hasColorScheme: boolean;
}

/** 工作区导出文件扩展名 */
export const WORKSPACE_EXPORT_EXTENSION = 'atm-workspace.json';
