/**
 * ATM - 菜单管理类型定义（V5.5 可视化菜单编辑）
 *
 * 菜单数据模型、验证问题、Profile 类型
 */
import type { ProfileCompatibilityMetadata } from './environment';

// ═══════════════════════════════════════════════════
// 菜单项
// ═══════════════════════════════════════════════════

/** 菜单项类型 */
export type MenuItemType = 'menu' | 'command' | 'separator';

/** 命令来源 */
export type MenuCommandSource =
  | 'allegro_builtin'
  | 'user_skill'
  | 'atm_managed_skill'
  | 'company_skill'
  | 'unknown'
  | 'ambiguous';

/** 菜单来源（复用 applyPlan.ts 的 MenuSource 语义） */
export type MenuSource =
  | 'atm_managed'
  | 'skill_package'
  | 'imported'
  | 'manual'
  | 'allegro_default'
  | 'company_menu'
  | 'unknown';

/** 菜单项状态 */
export type MenuItemStatus = 'normal' | 'warning' | 'error' | 'disabled' | 'readonly';

/** 菜单项配置 */
export interface MenuItemConfig {
  id: string;
  label: string;
  /** Allegro 17.2 及更早版本动态菜单使用的 ASCII 显示名；中文原名仍保存在 label。 */
  compatibilityLabel?: string;
  originalLabel?: string;
  description?: string;

  type: MenuItemType;

  parentId?: string;
  children?: MenuItemConfig[];
  /** 完整路径（例如 ["ATM Tools", "快捷工具", "智能吸附"]） */
  path: string[];
  order: number;

  command?: string;
  commandSource?: MenuCommandSource;

  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;

  hotkeys?: string[];
  menuSource: MenuSource;

  enabled: boolean;
  visible: boolean;

  status: MenuItemStatus;
  issues?: MenuIssue[];

  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ═══════════════════════════════════════════════════
// 菜单问题
// ═══════════════════════════════════════════════════

export type MenuIssueType =
  | 'command_missing'
  | 'skill_not_loaded'
  | 'duplicate_menu_label'
  | 'duplicate_command'
  | 'readonly_source'
  | 'empty_label'
  | 'empty_command'
  | 'invalid_parent'
  | 'disabled_skill';

export interface MenuIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  type: MenuIssueType;
  title: string;
  description: string;
  suggestedAction?: string;
}

// ═══════════════════════════════════════════════════
// 菜单方案（Profile）
// ═══════════════════════════════════════════════════

export interface MenuProfile {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  items: MenuItemConfig[];
  createdAt: string;
  updatedAt: string;
  sourceEnvironmentId?: string | null;
  sourceAllegroVersion?: string | null;
  testedAllegroVersions?: string[];
  targetCompatibility?: ProfileCompatibilityMetadata;
}

/** 菜单配置源文件格式（支持多 profile） */
export interface MenuProfileStore {
  version: string;
  activeProfileId: string;
  /** 最近一次真正执行 Apply Plan 的菜单方案 */
  appliedProfileId?: string;
  appliedAt?: string;
  profiles: MenuProfile[];
  updatedAt: string;
}

/** 可跨电脑传输的单个菜单方案包。文件扩展名为 .atmmenu，内容为 UTF-8 JSON。 */
export interface MenuProfilePackage {
  kind: 'atm-menu-profile';
  schemaVersion: 1;
  exportedAt: string;
  exportedByVersion?: string;
  source: {
    environmentName?: string;
    allegroVersion?: string | null;
  };
  profile: MenuProfile;
}

export type MenuProfileImportFormat = 'atm-menu-profile' | 'menu-profile' | 'menu-profile-store';

/** 导入前提供给 Renderer 的只读摘要。 */
export interface MenuProfileImportPreview {
  filePath: string;
  fileName: string;
  format: MenuProfileImportFormat;
  schemaVersion: number;
  sourceProfileName: string;
  proposedProfileName: string;
  itemCount: number;
  commandCount: number;
  menuCount: number;
  separatorCount: number;
  sourceAllegroVersion?: string | null;
  targetAllegroVersion?: string | null;
  nameConflict: boolean;
  compatibilityWarningCount: number;
  commands: string[];
  warnings: string[];
}

/** menu_profile.json 为空/损坏时，从 ATM 历史备份发现的只读恢复候选。 */
export interface MenuProfileRecoveryCandidate {
  backupPath: string;
  modifiedAt: string;
  store: MenuProfileStore;
  activeProfile: MenuProfile;
  profileCount: number;
  itemCount: number;
}

export interface MenuEnvironmentAlternative {
  id: string;
  name: string;
  version?: string | null;
  pcbenvPath: string;
  profileItemCount: number;
  recoveryItemCount: number;
  generatedMenuExists: boolean;
}

// ═══════════════════════════════════════════════════
// CRUD 输入类型
// ═══════════════════════════════════════════════════

export interface MenuItemCreateInput {
  type: MenuItemType;
  label: string;
  compatibilityLabel?: string;
  parentId?: string;
  command?: string;
  commandSource?: MenuCommandSource;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  menuSource?: MenuSource;
  enabled?: boolean;
  visible?: boolean;
  icon?: string;
}

export interface MenuItemUpdateInput {
  label?: string;
  compatibilityLabel?: string;
  type?: MenuItemType;
  command?: string;
  commandSource?: MenuCommandSource;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  menuSource?: MenuSource;
  enabled?: boolean;
  visible?: boolean;
  icon?: string;
}

/** Allegro 17.2 及更早版本的动态菜单 UI 不能可靠显示 Unicode 标签。 */
export function requiresAsciiMenuLabelCompatibility(allegroVersion?: string | null): boolean {
  const match = allegroVersion?.match(/(\d+)(?:\.(\d+))?/);
  if (!match) return false;

  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  return major < 17 || (major === 17 && minor <= 2);
}

/** 17.2 兼容显示名仅允许可打印 ASCII，避免控制字符和 Unicode 再次进入旧版菜单 UI。 */
export function isPrintableAsciiMenuLabel(label?: string | null): boolean {
  return Boolean(label?.trim()) && /^[\x20-\x7e]+$/.test(label!);
}

// ═══════════════════════════════════════════════════
// IPC 响应类型
// ═══════════════════════════════════════════════════

export interface MenuLoadResult {
  store: MenuProfileStore;
  activeProfile: MenuProfile;
  atmGeneratedPath: string;
  recovery?: MenuProfileRecoveryCandidate | null;
  alternatives?: MenuEnvironmentAlternative[];
  environment?: {
    id?: string | null;
    name?: string;
    version?: string | null;
    pcbenvPath?: string | null;
  };
}

export interface MenuPreviewResult {
  ilContent: string;
  profileJson: string;
  itemCount: number;
}

export interface MenuLinkageInfo {
  command: string;
  commandName?: string;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  hotkeys: string[];
  skillLoaded: boolean;
  commands: Array<{
    commandName: string;
    sourceType: string;
    sourceSkillId?: string;
    sourceSkillName?: string;
    hotkeys: string[];
    menuPaths: string[];
  }>;
}

// ═══════════════════════════════════════════════════
// 菜单树结构校验
// ═══════════════════════════════════════════════════

export interface MenuTreeValidationIssue {
  itemId: string;
  label: string;
  severity: 'error' | 'warning';
  type: string;
  message: string;
}

/**
 * 校验菜单树结构合法性
 *
 * 规则：
 * 1. 顶级节点不能是 separator
 * 2. 顶级节点不能是 command
 * 3. separator 不能有 children
 * 4. command 不能有 children
 * 5. command 必须有 command 字段
 * 6. menu label 不能为空
 * 7. command label 不能为空
 * 8. 同级菜单 label 不建议重复（warning）
 * 9. menu item id 不能重复
 * 10. parentId 必须合法
 * 11. 路径不能循环
 * 12. 启用且可见的菜单最多嵌套 8 层（Allegro 菜单栈限制）
 */
export function validateMenuTree(items: MenuItemConfig[]): {
  errors: MenuTreeValidationIssue[];
  warnings: MenuTreeValidationIssue[];
  hasError: boolean;
  hasWarning: boolean;
} {
  const errors: MenuTreeValidationIssue[] = [];
  const warnings: MenuTreeValidationIssue[] = [];
  const allIds = new Set<string>();

  // 收集所有 ID（含子项）
  const collectIds = (list: MenuItemConfig[]) => {
    for (const item of list) {
      if (allIds.has(item.id)) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'duplicate_id',
          message: `菜单项 ID "${item.id}" 重复`,
        });
      }
      allIds.add(item.id);
      if (item.children) collectIds(item.children);
    }
  };
  collectIds(items);

  // 递归校验
  const validate = (list: MenuItemConfig[], isTopLevel: boolean, parentId?: string, depth = 1) => {
    const seenLabels = new Map<string, string[]>();
    for (let i = 0; i < list.length; i++) {
      const item = list[i];

      // 规则 1: 顶级不能是 separator
      if (isTopLevel && item.type === 'separator') {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'top_level_separator',
          message: `分隔线"${item.label}"不能作为顶级节点，请移动到某个菜单下或删除`,
        });
      }

      // 规则 2: 顶级不能是 command
      if (isTopLevel && item.type === 'command') {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'top_level_command',
          message: `命令"${item.label}"不能作为顶级节点，请移动到某个菜单下`,
        });
      }

      // 规则 3: separator 不能有 children
      if (item.type === 'separator' && item.children && item.children.length > 0) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'separator_with_children',
          message: `分隔线"${item.label}"不能包含子项`,
        });
      }

      // 规则 4: command 不能有 children
      if (item.type === 'command' && item.children && item.children.length > 0) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'command_with_children',
          message: `命令"${item.label}"不能包含子项`,
        });
      }

      // 规则 5: command 必须有 command 字段
      if (item.type === 'command' && (!item.command || !item.command.trim())) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'command_missing',
          message: `命令"${item.label}"未绑定命令`,
        });
      }

      // 规则 6+7: menu / command label 不能为空
      if ((item.type === 'menu' || item.type === 'command') && (!item.label || item.label.trim() === '')) {
        errors.push({
          itemId: item.id,
          label: item.label || '(空)',
          severity: 'error',
          type: 'empty_label',
          message: `${item.type === 'menu' ? '菜单' : '命令'}"${item.id}" 标签为空`,
        });
      }

      // 规则 8: 同级 label 重复（warning）
      if (item.label && item.label.trim()) {
        const key = item.label.trim();
        if (seenLabels.has(key)) {
          seenLabels.get(key)!.push(item.id);
          warnings.push({
            itemId: item.id,
            label: item.label,
            severity: 'warning',
            type: 'duplicate_label',
            message: `同级菜单"${item.label}"名称重复（ID: ${seenLabels.get(key)!.join(', ')}, ${item.id}）`,
          });
        } else {
          seenLabels.set(key, [item.id]);
        }
      }

      // 规则 10: parentId 合法
      if (item.parentId && !allIds.has(item.parentId)) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'invalid_parent',
          message: `"${item.label}" 的父级菜单（ID: ${item.parentId}）不存在`,
        });
      }

      // 规则 12: Allegro axlUIMenuInsert 菜单栈最多支持 8 层
      if (item.type === 'menu' && item.enabled && item.visible && depth > 8) {
        errors.push({
          itemId: item.id,
          label: item.label,
          severity: 'error',
          type: 'menu_depth_exceeded',
          message: `菜单“${item.label}”位于第 ${depth} 层，Allegro 最多支持 8 层菜单`,
        });
      }

      // 规则 12: 路径不能循环（parentId 链不能形成环）
      if (item.parentId && allIds.has(item.parentId)) {
        const visited = new Set<string>();
        let currentId = item.parentId;
        while (currentId) {
          if (currentId === item.id) {
            errors.push({
              itemId: item.id,
              label: item.label,
              severity: 'error',
              type: 'circular_reference',
              message: `"${item.label}" 的父级引用形成循环，请检查菜单结构`,
            });
            break;
          }
          if (visited.has(currentId)) break; // 已经在别的循环检查中处理过了
          visited.add(currentId);
          // 找父级
          const findParentId = (list: MenuItemConfig[], searchId: string): string | undefined => {
            for (const n of list) {
              if (n.id === searchId) return n.parentId;
              if (n.children) {
                const found = findParentId(n.children, searchId);
                if (found) return found;
              }
            }
            return undefined;
          };
          currentId = findParentId(items, currentId) || '';
        }
      }

      // 递归子项
      if (item.children) {
        validate(item.children, false, item.id, depth + 1);
      }
    }
  };

  validate(items, true);

  return {
    errors,
    warnings,
    hasError: errors.length > 0,
    hasWarning: warnings.length > 0,
  };
}

// ═══════════════════════════════════════════════════
// 帮助函数
// ═══════════════════════════════════════════════════

/** 生成唯一 ID */
export function generateMenuId(): string {
  return `menu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 菜单来源的中文映射 */
export const MENU_SOURCE_LABELS: Record<string, { label: string; badge: string; readOnly: boolean }> = {
  atm_managed: { label: 'ATM 托管菜单', badge: '托管', readOnly: false },
  skill_package: { label: 'Skill 包菜单', badge: '包', readOnly: false },
  imported: { label: '导入菜单', badge: '导入', readOnly: false },
  manual: { label: '手动添加', badge: '手动', readOnly: false },
  allegro_default: { label: 'Allegro 默认', badge: '默认', readOnly: true },
  company_menu: { label: '公司菜单', badge: '公司', readOnly: true },
  unknown: { label: '未知来源', badge: '未知', readOnly: false },
};

/** 获取菜单来源显示 */
export function getMenuSourceLabel(source: string): string {
  return MENU_SOURCE_LABELS[source]?.label || source;
}

/** 获取菜单来源徽章 */
export function getMenuSourceBadge(source: string): string {
  return MENU_SOURCE_LABELS[source]?.badge || source;
}

/** 菜单来源是否只读 */
export function isMenuSourceReadOnly(source: string): boolean {
  return MENU_SOURCE_LABELS[source]?.readOnly ?? false;
}

/** 菜单问题类型的中文映射 */
export const MENU_ISSUE_LABELS: Record<string, string> = {
  command_missing: '命令不存在',
  skill_not_loaded: 'Skill 未加载',
  duplicate_menu_label: '菜单名重复',
  duplicate_command: '命令重复',
  readonly_source: '只读来源',
  empty_label: '标签为空',
  empty_command: '命令为空',
  invalid_parent: '父级不存在',
  disabled_skill: '关联 Skill 已禁用',
};

/** 问题严重程度样式 */
export const ISSUE_SEVERITY_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  error: { icon: '错误', color: '#b91c1c', bg: 'var(--ui-danger-soft)' },
  warning: { icon: '警告', color: '#b45309', bg: 'var(--ui-warning-soft)' },
  info: { icon: '信息', color: '#1d4ed8', bg: 'var(--ui-info-soft)' },
};
