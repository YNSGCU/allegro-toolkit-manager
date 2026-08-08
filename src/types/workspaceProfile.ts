/**
 * ATM - Workspace Profile 类型定义（V5.5 预留）
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
