/**
 * ATM - env 文件导入相关类型定义
 *
 * 从外部 .env 文件导入快捷键时使用的类型。
 * 支持四种导入模式：新建方案、合并到方案、作为参考 env、高级合并到用户 env。
 */

/** 导入模式 */
export type ImportMode = 'new_profile' | 'merge_profile' | 'as_reference' | 'merge_user_env';

/** env 角色（导入识别） */
export type EnvImportRole = 'user_env' | 'install_default_env' | 'site_env' | 'company_env' | 'unknown';

/** 导入预览数据 */
export interface EnvImportPreview {
  /** 文件路径 */
  filePath: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 识别的 env 角色 */
  identifiedRole: EnvImportRole;
  /** 识别置信度 */
  roleConfidence: 'high' | 'medium' | 'low';
  /** 显示名称 */
  displayName: string;
  /** 快捷键总数 */
  totalHotkeys: number;
  /** funckey 数量 */
  funckeyCount: number;
  /** alias 数量 */
  aliasCount: number;
  /** 解析出的快捷键条目 */
  entries: Array<{
    key: string;
    command: string;
    type: 'funckey' | 'alias';
  }>;
  /** 与当前快捷键的冲突列表 */
  conflicts: ImportConflictItem[];
  /** 未识别的命令列表 */
  unrecognizedCommands: string[];
  /** 覆盖保留键的数量 */
  reservedOverrideCount: number;
}

/** 冲突类型 */
export type ConflictType =
  | 'duplicate'           // 相同 key + 相同 command → 重复
  | 'conflict'            // 相同 key + 不同 command → 真冲突
  | 'multi_binding'       // 不同 key + 相同 command → 多绑定（非冲突）
  | 'alias_conflict'      // alias 同名 + 不同 command → 冲突
  | 'reserved_override';  // 覆盖保留键

/** 冲突处理方式 */
export type ConflictResolution =
  | 'keep_current'        // 保留当前
  | 'use_imported'        // 使用导入
  | 'use_recommended_key' // 改用推荐键位
  | 'skip'                // 跳过
  | 'import_disabled'     // 导入为禁用项
  | 'rename_alias';       // 改名导入（仅 alias）

/** 冲突项 */
export interface ImportConflictItem {
  /** 唯一 ID */
  id: string;
  /** 快捷键按键 */
  key: string;
  /** 当前命令（无冲突时为 null） */
  currentCommand: string | null;
  /** 导入的命令 */
  importedCommand: string;
  /** 类型 */
  type: 'funckey' | 'alias';
  /** 冲突类型 */
  conflictType: ConflictType;
  /** 建议的处理方式 */
  suggestedResolution: ConflictResolution;
  /** 用户选择的处理方式 */
  userResolution?: ConflictResolution;
  /** 推荐的替代键位（use_recommended_key 时使用） */
  recommendedKey?: string;
}

/** 导入结果 */
export interface ImportResult {
  /** 是否成功 */
  success: boolean;
  /** 导入模式 */
  mode: ImportMode;
  /** 结果数据（根据模式不同） */
  data?: any;
  /** 统计数据 */
  stats: {
    total: number;
    added: number;
    skipped: number;
    resolved: number;
    conflicts: number;
  };
  /** 错误信息 */
  error?: string;
}

/** 导入执行请求参数 */
export interface ImportExecuteParams {
  /** 导入模式 */
  mode: ImportMode;
  /** 导入文件路径 */
  filePath: string;
  /** 已解析的 env 内容 */
  envContent?: string;
  /** 解析后的 entries（JSON） */
  entriesJson?: string;
  /** 用户选择的冲突处理 */
  conflictResolutions?: Record<string, ConflictResolution>;
  /** 目标 profile ID（merge_profile 时需要） */
  profileId?: string;
  /** 新方案名称（new_profile 时可选） */
  profileName?: string;
  /** 用户指定的 env 角色（unknown 时用户选择） */
  userRole?: EnvImportRole;
  /** pcbenv 路径 */
  pcbenvPath: string;
}
