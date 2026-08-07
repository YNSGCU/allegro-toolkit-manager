/**
 * ATM - Allegro Symphony 协同模式适配相关类型定义
 *
 * Symphony（Team Design）并发协作环境下，Cadence 出于数据一致性保护，
 * 默认禁用所有 SKILL 命令；只有登记在 symphony_skill.txt 中的命令才被放行。
 * 本模块类型用于：命令登记文件生成、兼容体检、菜单恢复与 Apply Plan 集成。
 */

/** AXL 函数在 Symphony 环境下的支持类别（官方分类） */
export type MuFunctionCategory = 'R' | 'S' | 'I' | 'U' | 'B' | 'unknown';

/** AXL 函数支持表条目 */
export interface MuFunctionSupportEntry {
  /** 官方类别：R=只读安全 / S=支持变更 / I=变更被忽略 / U=不支持 / B=已废弃 */
  category: MuFunctionCategory;
  /** 是否同时被标记为 obsolete */
  obsolete: boolean;
}

/** symphony_skill.txt 中的单条命令登记 */
export interface SymphonyCommandEntry {
  /** 命令名（axlCmdRegister 注册名），多词命令在输出时加引号 */
  name: string;
  /** 是否带 rw（read-write）标记：允许数据库更新广播到 Symphony 服务器 */
  rw: boolean;
  /** 来源：atm=ATM 自动生成 / manual=用户手写 / existing=保留的既有条目 */
  source: 'atm' | 'manual' | 'existing';
  /** 注释（可选） */
  comment?: string;
  /** 关联 Skill 名（可选，用于 UI 展示） */
  skillName?: string;
}

/** symphony_skill.txt 解析结果 */
export interface SymphonySkillFileContent {
  /** 解析出的命令登记列表 */
  commands: SymphonyCommandEntry[];
  /** 需要保留的既有非命令行（头部注释等），生成新文件时回填 */
  preservedLines: string[];
  /** 原有内容是否为 ATM 生成格式（含 ATM 标记头） */
  isAtmGenerated: boolean;
}

/** 源码中检测到的 AXL 函数调用 */
export interface AxlCallUsage {
  functionName: string;
  category: MuFunctionCategory;
  obsolete: boolean;
  sourceFile: string;
  lineNumber: number;
  /** 所在 Skill id */
  skillId?: string;
  /** 所在 Skill 名称 */
  skillName?: string;
}

/** Symphony 兼容体检问题严重级别 */
export type SymphonyIssueSeverity = 'error' | 'warning' | 'info';

/** Symphony 兼容体检问题 */
export interface SymphonyCompatibilityIssue {
  id: string;
  severity: SymphonyIssueSeverity;
  /** unsupported_axl / command_not_registered / menu_trigger_missing / menu_load_missing / info */
  type: 'unsupported_axl' | 'command_not_registered' | 'menu_trigger_missing' | 'menu_load_missing' | 'info';
  title: string;
  description: string;
  skillId?: string;
  skillName?: string;
  sourceFile?: string;
  lineNumber?: number;
  functionName?: string;
  commandName?: string;
  suggestedActions: string[];
}

/** 单条命令的 Symphony 登记状态 */
export interface SymphonyCommandStatus {
  commandName: string;
  skillName?: string;
  skillId?: string;
  registered: boolean;
  rw: boolean;
  /** 是否由 ATM 管理该登记 */
  source?: 'atm' | 'manual' | 'existing';
}

/** Symphony 兼容体检结果 */
export interface SymphonyCompatibilityResult {
  checkedAt: string;
  environmentId?: string | null;
  pcbenvPath?: string | null;
  symphonyFile: {
    path: string | null;
    exists: boolean;
    commandCount: number;
    rwCount: number;
  };
  /** 当前已启用 Skill 的命令登记状态 */
  commandStatuses: SymphonyCommandStatus[];
  /** 源码中检测到的 AXL 函数调用（含官方分类） */
  axlCalls: AxlCallUsage[];
  /** 未支持（U 类）函数调用 */
  unsupportedCalls: AxlCallUsage[];
  /** 已加载但未登记的入口命令 */
  unregisteredCommands: SymphonyCommandStatus[];
  issues: SymphonyCompatibilityIssue[];
  stats: {
    totalSkills: number;
    enabledSkills: number;
    totalCommands: number;
    registeredCommands: number;
    unregisteredCommands: number;
    rwCommands: number;
    unsupportedAxCalls: number;
    supportedAxCalls: number;
  };
}

/** 生成 symphony_skill.txt 的参数 */
export interface GenerateSymphonySkillOptions {
  /** 需要登记的 ATM 命令列表（已启用 Skill 的入口命令） */
  commands: SymphonyCommandEntry[];
  /** 已有文件内容（用于保留手动条目与注释） */
  existingContent?: string;
  /** 是否包含 ATM 生成标记头 */
  includeAtmHeader?: boolean;
}

/** Apply Plan 中 Symphony 相关步骤元信息 */
export interface SymphonyApplyPlanMeta {
  operation: 'sync-symphony-file';
  targetFiles: string[];
  commandCount: number;
  rwCount: number;
  existingCommandsPreserved: number;
  addedCommands: number;
}
