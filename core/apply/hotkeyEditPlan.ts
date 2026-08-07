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
import type { EnvEntry, HotkeyBinding, HotkeyProfile } from '../../src/types/hotkey';
import type { HotkeyEditRequest } from '../../src/types/hotkey';
import { ATM_MANAGED_BLOCK_END } from '../../src/types/hotkey';
import { addChangeRecord } from '../changeHistory/changeHistory';

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
  expectedContent?: string;
  writeContent?: string;
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
 * @returns EditApplyPlan
 */
export function generateEditPlan(
  editRequest: HotkeyEditRequest,
  currentBinding: HotkeyBinding,
  envFilePath: string,
  entries: EnvEntry[],
  profileFilePath?: string,
): EditApplyPlan {
  const steps: EditPlanStep[] = [];
  const now = new Date().toISOString();
  const nextKey = editRequest.key?.trim();
  const nextCommand = editRequest.command?.trim();

  if (editRequest.key !== undefined && !nextKey) {
    throw new Error('按键或别名不能为空');
  }
  if (editRequest.command !== undefined && !nextCommand) {
    throw new Error('命令不能为空');
  }

  // 2. 根据快捷键来源生成修改步骤
  const isDelete = editRequest.command === '' || editRequest.command === undefined;
  const isEnvBinding = currentBinding.bindingSource === 'user_env_original' || currentBinding.bindingSource === 'atm_managed_block';
  const isProfileBinding = currentBinding.bindingSource === 'active_profile' || currentBinding.bindingSource === 'imported_profile';

  // env 源修改
  if (isEnvBinding && !isDelete && nextKey && nextCommand !== undefined) {
    if (!currentBinding.lineNumber) {
      throw new Error('当前 env 绑定缺少原始行号，无法安全编辑');
    }
    const oldLine = entries.find((e) => e.lineNumber === currentBinding.lineNumber);
    if (!oldLine) {
      throw new Error(`未找到 env 第 ${currentBinding.lineNumber} 行，文件可能已被外部修改`);
    }
    const beforeText = oldLine.raw;
    const newType = editRequest.type || currentBinding.type;
    const newKey = nextKey || currentBinding.key;
    const newCommand = nextCommand !== undefined ? nextCommand : currentBinding.command;
    const duplicate = entries.find((entry) =>
      entry.lineNumber !== currentBinding.lineNumber
      && entry.type === newType
      && entry.key?.toLowerCase() === newKey.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`${newType} ${newKey} 已在 env 第 ${duplicate.lineNumber} 行绑定到 ${duplicate.command}`);
    }
    const cmdQuoted = newCommand.includes(' ') ? `"${newCommand}"` : newCommand;
    const afterText = `${newType} ${newKey} ${cmdQuoted}`;

    steps.push({
      opType: 'modify_env',
      target: envFilePath,
      description: `修改 env 文件行 ${currentBinding.lineNumber || '?'}`,
      before: beforeText,
      after: afterText,
      lineNumber: currentBinding.lineNumber,
    });
  }

  // 删除 = 注释原行
  if (isEnvBinding && isDelete) {
    if (!currentBinding.lineNumber) {
      throw new Error('当前 env 绑定缺少原始行号，无法安全删除');
    }
    const oldLine = entries.find((e) => e.lineNumber === currentBinding.lineNumber);
    if (!oldLine) {
      throw new Error(`未找到 env 第 ${currentBinding.lineNumber} 行，文件可能已被外部修改`);
    }
    const beforeText = oldLine.raw;
    const afterText = `# ${beforeText}  ; ATM: 注释删除 ${now.slice(0, 10)}`;

    steps.push({
      opType: 'comment_env_line',
      target: envFilePath,
      description: `注释删除 env 文件行 ${currentBinding.lineNumber || '?'}`,
      before: beforeText,
      after: afterText,
      lineNumber: currentBinding.lineNumber,
    });
  }

  // Profile 源修改
  if (isProfileBinding) {
    if (!profileFilePath || !fs.existsSync(profileFilePath)) {
      throw new Error('当前方案文件不存在，无法生成编辑计划');
    }
    const profileContent = fs.readFileSync(profileFilePath, 'utf-8');
    const profile = JSON.parse(profileContent) as HotkeyProfile;
    const materializedPrefix = currentBinding.profileId
      ? `profile:${currentBinding.profileId}:`
      : '';
    const profileBindingId = materializedPrefix && currentBinding.id.startsWith(materializedPrefix)
      ? currentBinding.id.slice(materializedPrefix.length)
      : currentBinding.id;
    const bindingIndex = profile.bindings.findIndex((binding) => binding.id === profileBindingId);
    if (bindingIndex < 0) {
      throw new Error(`当前方案中找不到绑定 ${profileBindingId}`);
    }

    const beforeBinding = profile.bindings[bindingIndex];
    const afterBinding = {
      ...beforeBinding,
      type: editRequest.type || beforeBinding.type,
      key: nextKey || beforeBinding.key,
      command: nextCommand !== undefined ? nextCommand : beforeBinding.command,
      enabled: editRequest.enabled ?? beforeBinding.enabled,
      note: editRequest.note ?? beforeBinding.note,
    };
    profile.bindings[bindingIndex] = afterBinding;
    const duplicate = profile.bindings.find((binding, index) =>
      index !== bindingIndex
      && binding.type === afterBinding.type
      && binding.key.toLowerCase() === afterBinding.key.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`${afterBinding.type} ${afterBinding.key} 已在当前方案中绑定到 ${duplicate.command}`);
    }
    profile.updatedAt = now;
    const nextProfileContent = JSON.stringify(profile, null, 2);

    if (JSON.stringify(beforeBinding) === JSON.stringify(afterBinding)) {
      throw new Error('没有检测到需要保存的方案修改');
    }

    steps.push({
      opType: 'modify_profile',
      target: profileFilePath,
      description: `修改方案“${profile.name}”中的快捷键绑定`,
      before: JSON.stringify(beforeBinding, null, 2),
      after: JSON.stringify(afterBinding, null, 2),
      expectedContent: profileContent,
      writeContent: nextProfileContent,
    });
  }

  if (!isEnvBinding && !isProfileBinding) {
    throw new Error(`来源 ${currentBinding.bindingSource} 为只读或暂不支持编辑`);
  }

  if (steps.length === 0) {
    throw new Error('没有生成任何可执行的编辑步骤');
  }

  return {
    id: crypto.randomUUID?.() || `edit_${Date.now()}`,
    createdAt: now,
    summary: `编辑快捷键 ${currentBinding.key}${isDelete ? '（删除）' : ` → ${editRequest.command || currentBinding.command}`}`,
    steps,
    requiresRestart: isEnvBinding,
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
  const normalizedKey = key.trim();
  const normalizedCommand = command.trim();

  if (!normalizedKey) throw new Error('按键或别名不能为空');
  if (!normalizedCommand) throw new Error('命令不能为空');
  const duplicate = entries.find((entry) =>
    entry.type === type && entry.key?.toLowerCase() === normalizedKey.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`${type} ${normalizedKey} 已在 env 第 ${duplicate.lineNumber} 行绑定到 ${duplicate.command}`);
  }

  // 生成添加行
  const cmdQuoted = normalizedCommand.includes(' ') ? `"${normalizedCommand}"` : normalizedCommand;
  const newLine = `${type} ${normalizedKey} ${cmdQuoted}`;

  // 判断是否已有 ATM 托管块
  const hasManagedBlock = entries.some((e) => e.raw.includes(ATM_MANAGED_BLOCK_END));

  steps.push({
    opType: 'add_env_line',
    target: envFilePath,
    description: hasManagedBlock
      ? `在 ATM 托管块中添加: ${type} ${normalizedKey} → ${normalizedCommand}`
      : `在文件末尾添加: ${type} ${normalizedKey} → ${normalizedCommand}`,
    before: '(新增行)',
    after: newLine,
  });

  return {
    id: crypto.randomUUID?.() || `edit_${Date.now()}`,
    createdAt: now,
    summary: `添加快捷键 ${type} ${normalizedKey} → ${normalizedCommand}`,
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
  _entries: EnvEntry[],
): { success: boolean; error?: string; backupPath?: string } {
  const pcbenvPath = path.dirname(envFilePath);
  const writeSteps = plan.steps.filter((step) => [
    'modify_env',
    'comment_env_line',
    'add_env_line',
    'modify_profile',
    'override_source',
  ].includes(step.opType));
  const targets = [...new Set(writeSteps.map((step) => path.resolve(step.target)))];
  const snapshots = new Map<string, { existedBefore: boolean; backupPath: string }>();
  const backupDir = path.join(pcbenvPath, 'atm_generated', 'backup');

  if (targets.length !== 1) {
    return { success: false, error: `编辑计划必须且只能包含一个写入目标，当前为 ${targets.length} 个` };
  }

  const firstTarget = targets[0];
  const backupPath = path.join(
    backupDir,
    `${path.basename(firstTarget)}.backup.${Date.now()}`,
  );

  try {
    for (const target of targets) {
      const relativeTarget = path.relative(pcbenvPath, target);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error(`计划目标超出 pcbenv 范围: ${target}`);
      }
    }

    fs.mkdirSync(backupDir, { recursive: true });
    for (const target of targets) {
      const existedBefore = fs.existsSync(target);
      const targetBackupPath = targets.length === 1
        ? backupPath
        : path.join(backupDir, `${path.basename(target)}.backup.${Date.now()}`);
      if (existedBefore) {
        fs.copyFileSync(target, targetBackupPath);
      }
      snapshots.set(target, { existedBefore, backupPath: targetBackupPath });
    }

    for (const step of plan.steps) {
      switch (step.opType) {
        case 'modify_env':
        case 'comment_env_line': {
          if (!step.lineNumber) continue;
          if (path.resolve(step.target) !== path.resolve(envFilePath)) {
            throw new Error(`计划目标与当前 env 不一致: ${step.target}`);
          }
          const content = fs.readFileSync(envFilePath, 'utf-8');
          const eol = content.includes('\r\n') ? '\r\n' : '\n';
          const lines = content.split(/\r?\n/);
          const idx = step.lineNumber - 1; // 0-based index
          if (idx < 0 || idx >= lines.length) {
            throw new Error(`env 行号超出范围: ${step.lineNumber}`);
          }
          if (lines[idx] !== step.before) {
            throw new Error(`env 第 ${step.lineNumber} 行已被外部修改，请刷新后重试`);
          }
          const newLines = [...lines];
          newLines[idx] = step.after;
          fs.writeFileSync(envFilePath, newLines.join(eol), 'utf-8');
          break;
        }
        case 'add_env_line': {
          if (path.resolve(step.target) !== path.resolve(envFilePath)) {
            throw new Error(`计划目标与当前 env 不一致: ${step.target}`);
          }
          const content = fs.readFileSync(envFilePath, 'utf-8');
          const eol = content.includes('\r\n') ? '\r\n' : '\n';
          const lines = content.split(/\r?\n/);
          // 优先插到 ATM 托管块结束标记之前
          const endIdx = lines.findIndex((l) => l.includes(ATM_MANAGED_BLOCK_END));
          if (endIdx >= 0) {
            lines.splice(endIdx, 0, step.after);
          } else {
            // 没有托管块则追加到末尾
            lines.push('', step.after);
          }
          fs.writeFileSync(envFilePath, lines.join(eol), 'utf-8');
          break;
        }
        case 'modify_profile': {
          const currentContent = fs.readFileSync(step.target, 'utf-8');
          if (step.expectedContent !== undefined && currentContent !== step.expectedContent) {
            throw new Error('方案文件已被外部修改，请刷新后重试');
          }
          fs.writeFileSync(step.target, step.writeContent ?? step.after, 'utf-8');
          break;
        }
        case 'override_source': {
          fs.mkdirSync(path.dirname(step.target), { recursive: true });
          fs.writeFileSync(step.target, step.writeContent ?? step.after, 'utf-8');
          break;
        }
      }
    }

    addChangeRecord(pcbenvPath, {
      operation: plan.steps.some(step => step.opType === 'add_env_line') ? 'add_env_line' : 'plan_apply',
      summary: plan.summary,
      targetFile: firstTarget,
      backupFile: backupPath,
      backupId: path.basename(backupPath),
      stepsCount: plan.steps.length,
      planId: plan.id,
      undoable: true,
    });

    return { success: true, backupPath };
  } catch (err) {
    try {
      for (const [target, snapshot] of snapshots) {
        if (snapshot.existedBefore && fs.existsSync(snapshot.backupPath)) {
          fs.copyFileSync(snapshot.backupPath, target);
        } else if (!snapshot.existedBefore && fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
      }
    } catch (rollbackError) {
      return {
        success: false,
        backupPath,
        error: `${String(err)}；自动回滚失败: ${String(rollbackError)}`,
      };
    }
    return { success: false, backupPath, error: String(err) };
  }
}
