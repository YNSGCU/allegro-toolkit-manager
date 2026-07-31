/**
 * ATM - env 文件导入编排器（V4.0）
 *
 * 从外部 .env 文件导入快捷键，支持四种模式：
 *   new_profile    — 新建快捷键方案
 *   merge_profile  — 合并到当前方案
 *   as_reference   — 作为只读参考 env
 *   merge_user_env — 高级合并到用户 env（生成 Apply Plan）
 *
 * 安全规则：所有写入用户 env 的操作都通过 Apply Plan，不直接写。
 */
import fs from 'fs';
import path from 'path';
import { parseEnv } from '../parser/parseEnv';
import { createProfile, loadProfile, saveProfile, loadAllProfiles } from './hotkeyProfile';
import { addReferenceEnvPath } from '../settings/atmSettings';
import { ATM_MANAGED_BLOCK_END } from '../../src/types/hotkey';
import type { HotkeyBinding, HotkeyProfile, HotkeyProfileBinding, EnvEntry } from '../../src/types/hotkey';
import type { AtmSettings } from '../../src/types/environment';
import type {
  EnvImportRole,
  EnvImportPreview,
  ImportConflictItem,
  ImportConflictItem as ConflictItem,
  ConflictType,
  ConflictResolution,
  ImportResult,
  ImportExecuteParams,
} from '../../src/types/importEnv';

// ── 路径常量 ──

/** Allegro 安装目录中的默认 env 路径（通过 CDSROOT 环境变量定位） */
const ALLEGRO_DEFAULT_ENV_RELATIVE = path.join('share', 'pcb', 'text', 'env');

// ── env 角色识别 ──

/**
 * 根据文件路径识别 env 角色
 * @param filePath env 文件路径
 * @returns 角色、显示名称、置信度
 */
export function identifyEnvRole(filePath: string): {
  role: EnvImportRole;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const normalized = path.normalize(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // 1. 检查是否位于用户 pcbenv 目录
  if (normalized.includes('pcbenv')) {
    return { role: 'user_env', displayName: '用户环境 (pcbenv)', confidence: 'high' };
  }

  // 2. 检查是否位于 Allegro 安装目录
  const cdsRoot = process.env.CDSROOT;
  if (cdsRoot) {
    const defaultEnvPath = path.normalize(path.join(cdsRoot, ALLEGRO_DEFAULT_ENV_RELATIVE)).toLowerCase();
    if (normalized === defaultEnvPath || normalized.startsWith(path.dirname(defaultEnvPath))) {
      return { role: 'install_default_env', displayName: '安装默认环境', confidence: 'high' };
    }
  }

  // 3. 检查 CDS_SITE 环境变量
  const cdsSite = process.env.CDS_SITE;
  if (cdsSite && normalized.includes(cdsSite.toLowerCase())) {
    return { role: 'site_env', displayName: '站点环境 (CDS_SITE)', confidence: 'medium' };
  }

  // 4. 检查网络路径
  if (normalized.startsWith('\\\\') || normalized.startsWith('//')) {
    return { role: 'company_env', displayName: '公司环境 (网络路径)', confidence: 'medium' };
  }

  // 5. 检查文件名
  if (fileName.toLowerCase() === 'env' || fileName.toLowerCase().endsWith('.env')) {
    return { role: 'unknown', displayName: '外部 env 文件', confidence: 'low' };
  }

  return { role: 'unknown', displayName: path.basename(filePath), confidence: 'low' };
}

// ── 导入预览 ──

/**
 * 构建 env 导入预览
 * @param filePath 文件路径
 * @param content 文件内容
 * @returns 导入预览数据
 */
export function buildEnvImportPreview(filePath: string, content: string): EnvImportPreview {
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;

  // 角色识别
  const { role, displayName, confidence } = identifyEnvRole(filePath);

  // 解析 env 内容
  const parseResult = parseEnv(content);
  const entries = parseResult.entries
    .filter((e) => e.type === 'funckey' || e.type === 'alias')
    .map((e) => ({
      key: e.key || '',
      command: e.command || '',
      type: e.type as 'funckey' | 'alias',
    }));

  const funckeyCount = entries.filter((e) => e.type === 'funckey').length;
  const aliasCount = entries.filter((e) => e.type === 'alias').length;

  return {
    filePath,
    fileSize,
    identifiedRole: role,
    roleConfidence: confidence,
    displayName,
    totalHotkeys: entries.length,
    funckeyCount,
    aliasCount,
    entries,
    conflicts: [], // 前端填充（需要 currentBindings 上下文）
    unrecognizedCommands: [],
    reservedOverrideCount: 0,
  };
}

// ── 冲突计算 ──

/**
 * 计算导入快捷键与当前环境的冲突
 * @param importEntries 导入的快捷键条目
 * @param currentBindings 当前 env 绑定
 * @param reservedBindings 保留键绑定
 * @returns 冲突列表
 */
export function computeImportConflicts(
  importEntries: Array<{ key: string; command: string; type: 'funckey' | 'alias' }>,
  currentBindings: HotkeyBinding[],
  reservedBindings?: HotkeyBinding[],
): ImportConflictItem[] {
  const conflicts: ImportConflictItem[] = [];
  let counter = 0;

  // 构建当前绑定的查找映射
  const currentByKey = new Map<string, HotkeyBinding[]>();
  for (const b of currentBindings) {
    const key = b.key.toLowerCase();
    if (!currentByKey.has(key)) currentByKey.set(key, []);
    currentByKey.get(key)!.push(b);
  }

  // 保留键映射
  const reservedKeys = new Set<string>();
  if (reservedBindings) {
    for (const b of reservedBindings) {
      reservedKeys.add(b.key.toLowerCase());
    }
  }

  for (const entry of importEntries) {
    const lowerKey = entry.key.toLowerCase();
    const currentMatches = currentByKey.get(lowerKey) || [];
    const isReserved = reservedKeys.has(lowerKey);

    let conflictType: ConflictType;
    let suggestedResolution: ConflictResolution;
    let currentCommand: string | null = null;

    if (currentMatches.length > 0) {
      // 有当前绑定
      currentCommand = currentMatches[0].command;
      const isSameCommand = currentMatches.some(
        (b) => b.command.toLowerCase() === entry.command.toLowerCase(),
      );

      if (entry.type === 'alias' && currentMatches.some((b) => b.type === 'alias')) {
        const sameNameAlias = currentMatches.find(
          (b) => b.type === 'alias' && b.key.toLowerCase() === lowerKey,
        );
        if (sameNameAlias && sameNameAlias.command.toLowerCase() !== entry.command.toLowerCase()) {
          conflictType = 'alias_conflict';
          suggestedResolution = 'use_imported';
        } else if (isSameCommand) {
          conflictType = 'duplicate';
          suggestedResolution = 'skip';
        } else {
          conflictType = 'conflict';
          suggestedResolution = 'use_imported';
        }
      } else if (isSameCommand) {
        conflictType = 'duplicate';
        suggestedResolution = 'skip';
      } else {
        conflictType = 'conflict';
        suggestedResolution = 'use_imported';
      }
    } else if (isReserved) {
      conflictType = 'reserved_override';
      suggestedResolution = 'use_imported';
    } else {
      // 检查是否为多绑定（相同 command 不同 key）
      const sameCommandElsewhere = currentBindings.some(
        (b) => b.command.toLowerCase() === entry.command.toLowerCase() && b.key.toLowerCase() !== lowerKey,
      );
      if (sameCommandElsewhere) {
        conflictType = 'multi_binding';
        suggestedResolution = 'use_imported';
      } else {
        // 无冲突，跳过加入冲突列表
        continue;
      }
    }

    counter++;
    conflicts.push({
      id: `import_conflict_${counter}`,
      key: entry.key,
      currentCommand,
      importedCommand: entry.command,
      type: entry.type,
      conflictType,
      suggestedResolution,
      userResolution: suggestedResolution,
    });
  }

  return conflicts;
}

// ── 导入模式 1：新建快捷键方案 ──

/**
 * 将导入的快捷键创建为新的 Hotkey Profile
 * @param pcbenvPath pcbenv 目录
 * @param entries 导入的快捷键
 * @param profileName 方案名称（可选）
 * @returns 创建的 Profile
 */
export function importAsNewProfile(
  pcbenvPath: string,
  entries: Array<{ key: string; command: string; type: 'funckey' | 'alias' }>,
  profileName?: string,
): HotkeyProfile | null {
  // 生成默认名称
  let name = profileName;
  if (!name) {
    name = `从 env 导入 - ${path.basename(process.cwd())}`;
  }

  // 检查名称是否已存在
  const existingProfiles = loadAllProfiles(pcbenvPath);
  const existingNames = new Set(existingProfiles.map((p) => p.name));
  if (existingNames.has(name)) {
    // 自动添加"副本"
    let suffix = 1;
    while (existingNames.has(`${name} 副本${suffix > 1 ? ` (${suffix})` : ''}`)) {
      suffix++;
    }
    name = `${name} 副本${suffix > 1 ? ` (${suffix})` : ''}`;
  }

  // 转换 entries 为 ProfileBinding
  const bindings: HotkeyProfileBinding[] = entries.map((e, i) => ({
    id: `import_${Date.now()}_${i}`,
    key: e.key,
    command: e.command,
    type: e.type,
    enabled: true,
    note: `从外部 env 导入`,
  }));

  return createProfile(pcbenvPath, name, `从 ${path.basename(process.cwd())} 导入的快捷键方案`, bindings);
}

// ── 导入模式 2：合并到当前方案 ──

/**
 * 将导入的快捷键合并到现有 Profile
 * @param pcbenvPath pcbenv 目录
 * @param profileId 目标 Profile ID
 * @param entries 导入的快捷键
 * @param resolutions 冲突处理选择
 * @returns 合并结果
 */
export function importMergeToProfile(
  pcbenvPath: string,
  profileId: string,
  entries: Array<{ key: string; command: string; type: 'funckey' | 'alias' }>,
  resolutions: Record<string, ConflictResolution> = {},
): {
  profile: HotkeyProfile | null;
  added: number;
  skipped: number;
  resolved: number;
} {
  const profile = loadProfile(pcbenvPath, profileId);
  if (!profile) {
    return { profile: null, added: 0, skipped: 0, resolved: 0 };
  }

  let added = 0;
  let skipped = 0;
  let resolved = 0;

  // 当前 profile 的 key 映射
  const existingKeyMap = new Map<string, HotkeyProfileBinding>();
  for (const b of profile.bindings) {
    existingKeyMap.set(b.key.toLowerCase(), b);
  }

  for (const entry of entries) {
    const lowerKey = entry.key.toLowerCase();
    const existing = existingKeyMap.get(lowerKey);
    const resolution = resolutions[`import_conflict_${entry.key}`] || 'use_imported';

    if (!existing) {
      // 无冲突，直接添加
      profile.bindings.push({
        id: `import_${Date.now()}_${added}_${Math.random().toString(36).slice(2, 6)}`,
        key: entry.key,
        command: entry.command,
        type: entry.type,
        enabled: resolution !== 'import_disabled',
        note: `从外部 env 导入`,
      });
      added++;
    } else {
      switch (resolution) {
        case 'use_imported':
          // 使用导入的命令替换当前
          existing.command = entry.command;
          existing.type = entry.type;
          existing.enabled = true;
          existing.note = `从外部 env 导入覆盖`;
          resolved++;
          break;
        case 'keep_current':
          skipped++;
          break;
        case 'skip':
          skipped++;
          break;
        case 'import_disabled':
          profile.bindings.push({
            id: `import_${Date.now()}_${added}_${Math.random().toString(36).slice(2, 6)}`,
            key: entry.key,
            command: entry.command,
            type: entry.type,
            enabled: false,
            note: `从外部 env 导入（已禁用）`,
          });
          added++;
          break;
        case 'rename_alias':
          // 改名为 alias 加后缀
          let newKey = entry.key + '_imported';
          let keySuffix = 1;
          while (existingKeyMap.has(newKey.toLowerCase())) {
            newKey = `${entry.key}_imported${keySuffix}`;
            keySuffix++;
          }
          profile.bindings.push({
            id: `import_${Date.now()}_${added}_${Math.random().toString(36).slice(2, 6)}`,
            key: newKey,
            command: entry.command,
            type: entry.type,
            enabled: true,
            note: `从外部 env 导入（原键名: ${entry.key}）`,
          });
          added++;
          break;
        default:
          skipped++;
          break;
      }
    }
  }

  // 保存更新后的 profile
  profile.updatedAt = new Date().toISOString();
  saveProfile(pcbenvPath, profile);

  return { profile, added, skipped, resolved };
}

// ── 导入模式 3：作为只读参考 env ──

/**
 * 将导入文件作为参考 env 源添加到设置
 * @param pcbenvPath pcbenv 目录
 * @param filePath 导入文件路径
 * @returns 更新后的设置
 */
export function importAsReferenceEnv(pcbenvPath: string, filePath: string): AtmSettings | null {
  try {
    return addReferenceEnvPath(pcbenvPath, filePath);
  } catch {
    return null;
  }
}

// ── 导入模式 4：高级合并到用户 env（生成 Apply Plan） ──

/**
 * 生成高级合并的 Apply Plan
 * 将导入的快捷键通过 Apply Plan 写入用户 env 的 ATM 托管块
 *
 * @param pcbenvPath pcbenv 目录
 * @param envFilePath 用户 env 文件路径
 * @param entries 导入的快捷键
 * @param resolutions 冲突处理选择
 * @returns EditApplyPlan
 */
export function importMergeToUserEnvPlan(
  pcbenvPath: string,
  envFilePath: string,
  entries: Array<{ key: string; command: string; type: 'funckey' | 'alias' }>,
  resolutions: Record<string, ConflictResolution> = {},
): {
  id: string;
  createdAt: string;
  summary: string;
  steps: any[];
  requiresRestart: boolean;
} | null {
  try {
    // 读取当前 env 内容
    if (!fs.existsSync(envFilePath)) {
      return null;
    }
    const envContent = fs.readFileSync(envFilePath, 'utf-8');
    const lines = envContent.split(/\r?\n/);

    // 查找 ATM 托管块末尾位置
    let managedBlockEndLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim() === ATM_MANAGED_BLOCK_END) {
        managedBlockEndLine = i;
        break;
      }
    }

    const backupDir = path.join(pcbenvPath, 'atm_generated', 'backup');
    const backupId = `import_env_${Date.now()}`;
    const backupPath = path.join(backupDir, backupId);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 确定哪些条目需要添加
    const entriesToAdd = entries.filter((entry) => {
      const resolution = resolutions[`import_conflict_${entry.key}`];
      return !resolution || resolution === 'use_imported' || resolution === 'use_recommended_key';
    });

    if (entriesToAdd.length === 0) {
      return {
        id: `import_plan_${Date.now()}`,
        createdAt: new Date().toISOString(),
        summary: '导入到用户 env（无新增条目）',
        steps: [],
        requiresRestart: true,
      };
    }

    // 生成要添加的行内容
    const linesToAdd = entriesToAdd.map((entry) => {
      const cmd = entry.command.includes(' ') ? `"${entry.command}"` : entry.command;
      return `${entry.type} ${entry.key} ${cmd}`;
    }).join('\n');

    // 备份步骤
    const steps: any[] = [
      {
        opType: 'backup',
        target: envFilePath,
        description: `备份当前用户 env（导入前）`,
        before: '',
        after: '',
        backupPath,
      },
      {
        opType: 'add_env_line',
        target: envFilePath,
        description: `添加 ${entriesToAdd.length} 个导入的快捷键到 ATM 托管块`,
        before: '',
        after: linesToAdd,
        lineNumber: managedBlockEndLine >= 0 ? managedBlockEndLine + 1 : lines.length + 1,
      },
    ];

    return {
      id: `import_plan_${Date.now()}`,
      createdAt: new Date().toISOString(),
      summary: `导入 ${entriesToAdd.length} 个快捷键到用户 env`,
      steps,
      requiresRestart: true,
    };
  } catch {
    return null;
  }
}

// ── 主执行函数 ──

/**
 * 执行 env 导入（根据 mode 分发到对应处理函数）
 * @param params 导入参数
 * @returns 导入结果
 */
export function executeImport(params: ImportExecuteParams): ImportResult {
  const { mode, filePath, pcbenvPath } = params;

  // 读取并解析 env 文件
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      mode,
      stats: { total: 0, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
      error: `文件不存在: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parseResult = parseEnv(content);
  const entries = parseResult.entries
    .filter((e) => e.type === 'funckey' || e.type === 'alias')
    .map((e) => ({
      key: e.key || '',
      command: e.command || '',
      type: e.type as 'funckey' | 'alias',
    }));

  const resolutions = params.conflictResolutions || {};

  switch (mode) {
    case 'new_profile': {
      const profile = importAsNewProfile(pcbenvPath, entries, params.profileName);
      if (!profile) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '创建快捷键方案失败',
        };
      }
      return {
        success: true,
        mode,
        data: profile,
        stats: { total: entries.length, added: entries.length, skipped: 0, resolved: 0, conflicts: 0 },
      };
    }

    case 'merge_profile': {
      if (!params.profileId) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '缺少目标方案 ID',
        };
      }
      const mergeResult = importMergeToProfile(pcbenvPath, params.profileId, entries, resolutions);
      if (!mergeResult.profile) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '合并快捷键方案失败',
        };
      }
      return {
        success: true,
        mode,
        data: mergeResult.profile,
        stats: {
          total: entries.length,
          added: mergeResult.added,
          skipped: mergeResult.skipped,
          resolved: mergeResult.resolved,
          conflicts: mergeResult.resolved,
        },
      };
    }

    case 'as_reference': {
      const settings = importAsReferenceEnv(pcbenvPath, filePath);
      if (!settings) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '添加参考 env 失败',
        };
      }
      return {
        success: true,
        mode,
        data: settings,
        stats: { total: entries.length, added: entries.length, skipped: 0, resolved: 0, conflicts: 0 },
      };
    }

    case 'merge_user_env': {
      const envFile = params.pcbenvPath
        ? path.join(params.pcbenvPath, 'env')
        : null;
      if (!envFile || !fs.existsSync(envFile)) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '未找到用户 env 文件',
        };
      }
      const plan = importMergeToUserEnvPlan(
        pcbenvPath,
        envFile,
        entries,
        resolutions,
      );
      if (!plan) {
        return {
          success: false,
          mode,
          stats: { total: entries.length, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
          error: '生成 Apply Plan 失败',
        };
      }
      return {
        success: true,
        mode,
        data: plan,
        stats: {
          total: entries.length,
          added: entries.length - Object.keys(resolutions).filter(
            (k) => resolutions[k] === 'skip' || resolutions[k] === 'keep_current',
          ).length,
          skipped: Object.keys(resolutions).filter(
            (k) => resolutions[k] === 'skip' || resolutions[k] === 'keep_current',
          ).length,
          resolved: 0,
          conflicts: 0,
        },
      };
    }

    default:
      return {
        success: false,
        mode,
        stats: { total: 0, added: 0, skipped: 0, resolved: 0, conflicts: 0 },
        error: `未知导入模式: ${mode}`,
      };
  }
}
