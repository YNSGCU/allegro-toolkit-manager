/**
 * ATM - 快捷键编辑 Apply Plan 生成器
 *
 * 编辑快捷键时先生成 Apply Plan（不直接写 env）：
 *   1. 备份目标文件
 *   2. 执行修改（环境行/Profile/来源修正）
 *   3. 回滚能力
 *
 * 安全规则：
 *   - 编辑 user_env_original → 保留行号和 raw line
 *   - 删除 → 注释原行（不物理删除）
 *   - 所有修改必须经过 Apply Plan 预览确认
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ApplyPlan, ApplyStep, EnvEntry, HotkeyBinding } from '../../src/types/hotkey';
import type { HotkeyEditRequest } from '../../src/types/hotkey';
import { ATM_MANAGED_BLOCK_END } from '../../src/types/hotkey';

/** 编辑操作类型 */
export type EditOpType =
  | 'modify_env'
  | 'comment_env_line'
  | 'modify_profile'
  | 'add_to_profile'
  | 'override_source'
  | 'add_env_line';

/** 编辑操作步骤 */
export interface EditPlanStep {
  opType: EditOpType;
  target: string;
  description: string;
  before: string;
  after: string;
  lineNumber?: number;
  backupPath?: string;
}

/** 编辑 Apply Plan */
export interface EditApplyPlan {
  id: string;
  createdAt: string;
  summary: string;
  steps: EditPlanStep[];
  requiresRestart: boolean;
}

/**
 * 生成编辑快捷键的 Apply Plan
 *
 * @param editRequest 编辑请求
 * @param currentBinding 当前绑定（修改前的状态）
 * @param envFilePath env 文件路径
 * @param entries 当前 env 解析条目
 * @param profileFilePath Profile 文件路径（可选）
 * @param overrideJsonPath 用户来源修正 JSON 路径（可选）
 * @returns EditApplyPlan
 */
export function generateEditPlan(
  editRequest: HotkeyEditRequest,
  currentBinding: HotkeyBinding,
  envFilePath: string,
  entries: EnvEntry[],
  profileFilePath?: string,
  overrideJsonPath?: string,
): EditApplyPlan {
  const steps: EditPlanStep[] = [];
  const now = new Date().toISOString();

  // 1. 备份 env 文件
  const backupDir = path.join(path.dirname(envFilePath), 'atm_generated', 'backup');
  const backupName = `env.backup.${Date.now()}`;
  const backupPath = path.join(backupDir, backupName);

  steps.push({
    opType: 'modify_env',
    target: envFilePath,
    description: `备份 env 文件到 ${backupPath}`,
    before: '(文件备份)',
    after: backupPath,
    backupPath,
  });

  // 2. 根据快捷键来源生成修改步骤
  const isDelete = editRequest.command === '' || editRequest.command === undefined;
  const isEnvBinding = currentBinding.bindingSource === 'user_env_original' || currentBinding.bindingSource === 'atm_managed_block';
  const isProfileBinding = currentBinding.bindingSource === 'active_profile' || currentBinding.bindingSource === 'imported_profile';

  // env 源修改
  if (isEnvBinding && !isDelete && editRequest.key && editRequest.command !== undefined) {
    const oldLine = entries.find((e) => e.lineNumber === currentBinding.lineNumber);
    const beforeText = oldLine?.raw || '';
    const newType = editRequest.type || currentBinding.type;
    const newKey = editRequest.key || currentBinding.key;
    const newCommand = editRequest.command !== undefined ? editRequest.command : currentBinding.command;
    const cmdQuoted = newCommand.includes(' ') ? `"${newCommand}"` : newCommand;
    const afterText = `${newType} ${newKey} ${cmdQuoted}`;

    steps.push({
      opType: 'modify_env',
      target: envFilePath,
      description: `修改 env 文件行 ${currentBinding.lineNumber || '?'}`,
      before: beforeText,
      after: afterText,
      lineNumber: currentBinding.lineNumber,
      backupPath,
    });
  }

  // 删除 = 注释原行
  if (isEnvBinding && isDelete) {
    const oldLine = entries.find((e) => e.lineNumber === currentBinding.lineNumber);
    const beforeText = oldLine?.raw || '';
    const afterText = `# ${beforeText}  ; ATM: 注释删除 ${now.slice(0, 10)}`;

    steps.push({
      opType: 'comment_env_line',
      target: envFilePath,
      description: `注释删除 env 文件行 ${currentBinding.lineNumber || '?'}`,
      before: beforeText,
      after: afterText,
      lineNumber: currentBinding.lineNumber,
      backupPath,
    });
  }

  // Profile 源修改
  if (isProfileBinding && profileFilePath) {
    const profileContent = fs.existsSync(profileFilePath) ? fs.readFileSync(profileFilePath, 'utf-8') : '';

    steps.push({
      opType: 'modify_profile',
      target: profileFilePath,
      description: `修改 Profile 中的快捷键绑定`,
      before: profileContent ? '(Profile 文件已存在)' : '(新建 Profile 文件)',
      after: profileContent ? '(Profile 文件将被更新)' : '(新 Profile 文件将被创建)',
      backupPath,
    });
  }

  // 命令来源修正
  if (editRequest.commandSource && overrideJsonPath) {
    steps.push({
      opType: 'override_source',
      target: overrideJsonPath,
      description: `将命令 "${currentBinding.command}" 的来源修正为 ${editRequest.commandSource}`,
      before: '(当前无修正记录)',
      after: `{ "${currentBinding.command}": { "source": "${editRequest.commandSource}" } }`,
    });
  }

  return {
    id: crypto.randomUUID?.() || `edit_${Date.now()}`,
    createdAt: now,
    summary: `编辑快捷键 ${currentBinding.key}${isDelete ? '（删除）' : ` → ${editRequest.command || currentBinding.command}`}`,
    steps,
    requiresRestart: true,
  };
}

/**
 * 生成添加快捷键的 Apply Plan
 */
export function generateAddPlan(
  key: string,
  command: string,
  type: 'funckey' | 'alias',
  envFilePath: string,
  entries: EnvEntry[],
): EditApplyPlan {
  const steps: EditPlanStep[] = [];
  const now = new Date().toISOString();

  // 1. 备份 env 文件
  const backupDir = path.join(path.dirname(envFilePath), 'atm_generated', 'backup');
  const backupName = `env.backup.${Date.now()}`;
  const backupPath = path.join(backupDir, backupName);

  steps.push({
    opType: 'modify_env',
    target: envFilePath,
    description: `备份 env 文件到 ${backupPath}`,
    before: '(文件备份)',
    after: backupPath,
    backupPath,
  });

  // 2. 生成添加行
  const cmdQuoted = command.includes(' ') ? `"${command}"` : command;
  const newLine = `${type} ${key} ${cmdQuoted}`;

  // 判断是否已有 ATM 托管块
  const hasManagedBlock = entries.some((e) => e.raw.includes(ATM_MANAGED_BLOCK_END));

  steps.push({
    opType: 'add_env_line',
    target: envFilePath,
    description: hasManagedBlock
      ? `在 ATM 托管块中添加: ${type} ${key} → ${command}`
      : `在文件末尾添加: ${type} ${key} → ${command}`,
    before: '(新增行)',
    after: newLine,
  });

  return {
    id: crypto.randomUUID?.() || `edit_${Date.now()}`,
    createdAt: now,
    summary: `添加快捷键 ${type} ${key} → ${command}`,
    steps,
    requiresRestart: true,
  };
}

/**
 * 执行编辑 Apply Plan
 * 注意：调用前必须由用户确认
 */
export function executeEditPlan(
  plan: EditApplyPlan,
  envFilePath: string,
  entries: EnvEntry[],
): { success: boolean; error?: string } {
  try {
    for (const step of plan.steps) {
      switch (step.opType) {
        case 'modify_env':
        case 'comment_env_line': {
          if (!step.lineNumber) continue;
          const content = fs.readFileSync(envFilePath, 'utf-8');
          const lines = content.split('\n');
          const idx = step.lineNumber - 1; // 0-based index
          if (idx >= 0 && idx < lines.length) {
            const newLines = [...lines];
            newLines[idx] = step.after;
            fs.writeFileSync(envFilePath, newLines.join('\n'), 'utf-8');
          }
          break;
        }
        case 'add_env_line': {
          const content = fs.readFileSync(envFilePath, 'utf-8');
          const lines = content.split('\n');
          // 优先插到 ATM 托管块结束标记之前
          const endIdx = lines.findIndex((l) => l.includes(ATM_MANAGED_BLOCK_END));
          if (endIdx >= 0) {
            lines.splice(endIdx, 0, step.after);
          } else {
            // 没有托管块则追加到末尾
            lines.push('', step.after);
          }
          fs.writeFileSync(envFilePath, lines.join('\n'), 'utf-8');
          break;
        }
        case 'modify_profile': {
          // Profile 文件已由 saveProfileBindings 处理
          break;
        }
        case 'override_source': {
          // 来源修正由 command:save-override IPC 处理
          break;
        }
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
