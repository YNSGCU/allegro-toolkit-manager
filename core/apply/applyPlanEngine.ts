/**
 * ATM - Apply Plan 统一引擎（V5.3）
 *
 * 所有模块共用同一套 Apply Plan 生成、执行、备份、回滚、历史流程。
 */
import fs from 'fs';
import path from 'path';
import {
  readAllegroTextFile,
  writeAllegroTextFile,
  type AllegroTextEncoding,
} from '../environment/allegroTextEncoding';
import type {
  ApplyPlan,
  ApplyPlanStep,
  ApplyPlanStepType,
  ApplyPlanRisk,
  ApplyPlanBackup,
  ApplyPlanModule,
  ApplyPlanStatus,
  ApplyResult,
  ChangeHistoryItem,
} from '../../src/types/applyPlan';

/** 当前模块描述 */
const MODULE_DESC: Record<ApplyPlanModule, string> = {
  hotkey: '快捷键',
  skill: 'Skill',
  menu: '菜单',
  sync: '同步',
  environment: '环境',
};

// 旧快捷键历史使用 { records: [...] } 结构；统一计划使用数组结构，必须分文件存储，
// 否则两类执行器交替写入时会互相破坏历史数据。
const APPLY_PLAN_HISTORY_FILE = 'apply_plan_history.json';

/**
 * 创建 ApplyPlan 的工厂函数
 */
export function createApplyPlan(
  params: {
    title: string;
    description?: string;
    module: ApplyPlanModule;
    steps: Array<Omit<ApplyPlanStep, 'id' | 'status'>>;
    risks?: ApplyPlanRisk[];
    backups?: ApplyPlanBackup[];
    requiresRestart?: boolean;
    targetFiles?: string[];
    environmentId?: string | null;
    environmentPcbenvPath?: string | null;
    allegroTextEncoding?: AllegroTextEncoding;
  },
): ApplyPlan {
  const now = new Date().toISOString();
  const id = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const steps: ApplyPlanStep[] = params.steps.map((s, i) => ({
    ...s,
    textEncoding: s.textEncoding
      ?? (params.allegroTextEncoding && isAllegroTextTarget(s)
        ? params.allegroTextEncoding
        : undefined),
    id: `step_${id}_${i}`,
    status: 'pending',
  }));

  const targetFiles = params.targetFiles || [
    ...new Set(steps.filter(s => s.targetFile).map(s => s.targetFile!))
  ];

  return {
    id,
    title: params.title,
    description: params.description,
    module: params.module,
    createdAt: now,
    steps,
    risks: params.risks || [],
    backups: params.backups || [],
    requiresRestart: params.requiresRestart,
    targetFiles,
    status: 'ready',
    environmentId: params.environmentId,
    environmentPcbenvPath: params.environmentPcbenvPath,
    summary: `${MODULE_DESC[params.module]}：${params.title} — ${steps.length} 步`,
  };
}

/**
 * 生成通用备份步骤
 */
export function createBackupStep(
  targetFile: string,
  backupDir: string,
): { step: Omit<ApplyPlanStep, 'id' | 'status'>; backup: ApplyPlanBackup } {
  const backupFileName = `${path.basename(targetFile)}.${Date.now()}.bak`;
  const backupFile = path.join(backupDir, backupFileName);

  return {
    step: {
      type: 'backup_file',
      title: '备份文件',
      description: `备份 ${path.basename(targetFile)}`,
      targetFile,
      backupTo: backupFile,
      previewText: `备份到: ${backupFile}`,
    },
    backup: {
      sourceFile: targetFile,
      backupFile,
      required: true,
    },
  };
}

/**
 * 执行 Apply Plan
 */
export async function executeApplyPlan(
  plan: ApplyPlan,
  options: {
    backupDir: string;
    historyDir?: string;
    onStepStart?: (step: ApplyPlanStep) => void;
    onStepDone?: (step: ApplyPlanStep) => void;
    onStepFail?: (step: ApplyPlanStep, error: Error) => void;
  },
): Promise<ApplyResult> {
  let appliedSteps = 0;
  const totalSteps = plan.steps.length;

  try {
    // 1. 创建备份目录
    if (!fs.existsSync(options.backupDir)) {
      fs.mkdirSync(options.backupDir, { recursive: true });
    }

    // 在任何写入前建立完整事务快照。不能只依赖计划中备份步骤的顺序，
    // 否则新建文件无法撤销，缺失备份步骤的计划也可能直接覆盖用户文件。
    prepareTransactionBackups(plan, options.backupDir);

    // 2. 执行每个步骤
    for (const step of plan.steps) {
      options.onStepStart?.(step);

      try {
        await executeStep(step, options.backupDir);
        appliedSteps++;
        options.onStepDone?.(step);
      } catch (err) {
        options.onStepFail?.(step, err as Error);
        // 尝试回滚
        await tryRollback(plan);
        return {
          success: false,
          planId: plan.id,
          appliedSteps,
          totalSteps,
          error: `步骤 ${step.title} 失败: ${(err as Error).message}`,
          rollbackPath: options.backupDir,
        };
      }
    }

    // 3. 记录变更历史
    if (options.historyDir) {
      await recordHistory(plan, options.historyDir, options.backupDir);
    }

    return {
      success: true,
      planId: plan.id,
      appliedSteps,
      totalSteps,
    };
  } catch (err) {
    if (appliedSteps > 0) {
      await tryRollback(plan);
    }
    return {
      success: false,
      planId: plan.id,
      appliedSteps,
      totalSteps,
      error: `执行 Apply Plan 失败: ${(err as Error).message}`,
    };
  }
}

/**
 * 执行单个步骤
 */
async function executeStep(
  step: ApplyPlanStep,
  backupDir: string,
): Promise<void> {
  switch (step.type) {
    case 'backup_file':
    case 'backup': {
      const sourceFile = step.targetFile || step.target;
      if (!sourceFile || !fs.existsSync(sourceFile)) break;
      const backupFile = step.backupTo || path.join(
        backupDir,
        `${path.basename(sourceFile)}.${Date.now()}.bak`,
      );
      const dir = path.dirname(backupFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(sourceFile, backupFile);
      break;
    }
    case 'comment_line': {
      if (!step.targetFile || !step.before) {
        // 如果没有 before，可能是备份步骤，跳过
        break;
      }
      const content = readStepText(step.targetFile, step.textEncoding);
      const updated = content.replace(step.before, step.after || `# ATM disabled: ${step.before.trim()}`);
      writeStepText(step.targetFile, updated, step.textEncoding);
      break;
    }
    case 'write_file':
    case 'create_file':
    case 'generate_loader':
    case 'write_skill_loader':
    case 'write_bootstrap': {
      if (step.targetFile && step.after !== undefined) {
        const dir = path.dirname(step.targetFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        writeStepText(step.targetFile, step.after, step.textEncoding);
      }
      break;
    }
    case 'generate_menu': {
      if (step.targetFile && step.after !== undefined) {
        const dir = path.dirname(step.targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        writeStepText(step.targetFile, step.after, step.textEncoding);
      }
      break;
    }
    case 'modify_line':
    case 'append_line': {
      if (step.targetFile && step.after !== undefined) {
        let content = '';
        if (fs.existsSync(step.targetFile)) {
          content = readStepText(step.targetFile, step.textEncoding);
        }
        if (step.type === 'append_line') {
          content += '\n' + step.after;
        } else if (step.type === 'modify_line' && step.before) {
          content = content.replace(step.before, step.after);
        }
        writeStepText(step.targetFile, content, step.textEncoding);
      }
      break;
    }
    case 'update_json': {
      if (step.targetFile && step.after !== undefined) {
        const dir = path.dirname(step.targetFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(step.targetFile, step.after, { encoding: 'utf-8' });
      }
      break;
    }
    case 'ensure_bootstrap':
    case 'modify_ilinit': {
      if (step.targetFile && step.after !== undefined) {
        const dir = path.dirname(step.targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        writeStepText(step.targetFile, step.after, step.textEncoding);
      }
      break;
    }
    case 'create_directory': {
      const target = step.targetFile || step.target;
      if (!target) throw new Error('创建目录步骤缺少目标路径');
      fs.mkdirSync(target, { recursive: true });
      break;
    }
    case 'delete_file': {
      const target = step.targetFile || step.target;
      if (!target) throw new Error('删除文件步骤缺少目标路径');
      if (!fs.existsSync(target)) break;
      if (!fs.statSync(target).isFile()) throw new Error(`拒绝删除非文件目标: ${target}`);
      fs.rmSync(target);
      break;
    }
    case 'move_file':
    case 'archive_file': {
      throw new Error(`尚未定义安全的 ${step.type} 目标路径协议，已拒绝执行`);
    }
    case 'record_history': {
      // 历史由 executeApplyPlan 在事务成功后统一写入。
      break;
    }
  }
}

function isAllegroTextTarget(
  step: Omit<ApplyPlanStep, 'id' | 'status'>,
): boolean {
  const target = step.targetFile || step.target;
  if (!target) return false;
  const fileName = path.basename(target).toLowerCase();
  return fileName === 'allegro.ilinit' || ['.il', '.ils'].includes(path.extname(fileName));
}

function readStepText(filePath: string, encoding?: AllegroTextEncoding): string {
  return encoding
    ? readAllegroTextFile(filePath, encoding).text
    : fs.readFileSync(filePath, { encoding: 'utf-8' });
}

function writeStepText(
  filePath: string,
  content: string,
  encoding?: AllegroTextEncoding,
): void {
  if (encoding) {
    writeAllegroTextFile(filePath, content, encoding);
    return;
  }
  fs.writeFileSync(filePath, content, { encoding: 'utf-8' });
}

/**
 * 尝试回滚
 */
async function tryRollback(
  plan: ApplyPlan,
): Promise<void> {
  for (const backup of [...plan.backups].reverse()) {
    try {
      if (backup.existedBefore === false) {
        if (fs.existsSync(backup.sourceFile)) fs.rmSync(backup.sourceFile, { force: true });
      } else if (backup.backupFile && fs.existsSync(backup.backupFile)) {
        const targetDir = path.dirname(backup.sourceFile);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        // 备份可能是 GBK 菜单脚本或其他二进制内容，按字节恢复，禁止转码。
        fs.copyFileSync(backup.backupFile, backup.sourceFile);
      }
    } catch {
      // 回滚失败时继续恢复其他目标，备份仍保留供手动处理。
    }
  }
}

const MUTATING_STEP_TYPES = new Set<ApplyPlanStepType>([
  'comment_line',
  'write_file',
  'create_file',
  'generate_loader',
  'write_skill_loader',
  'write_bootstrap',
  'generate_menu',
  'modify_line',
  'append_line',
  'update_json',
  'ensure_bootstrap',
  'modify_ilinit',
  'delete_file',
  'archive_file',
  'move_file',
]);

/** 在第一项修改前补齐并写入每个目标的事务备份。 */
function prepareTransactionBackups(plan: ApplyPlan, backupDir: string): void {
  const targets = [...new Set(
    plan.steps
      .filter(step => MUTATING_STEP_TYPES.has(step.type))
      .map(step => step.targetFile || step.target)
      .filter((target): target is string => Boolean(target)),
  )];

  for (const target of targets) {
    const existedBefore = fs.existsSync(target);
    let backup = plan.backups.find(item => path.resolve(item.sourceFile) === path.resolve(target));

    if (!backup) {
      backup = {
        sourceFile: target,
        backupFile: existedBefore
          ? path.join(backupDir, `${path.basename(target)}.${Date.now()}_${Math.random().toString(36).slice(2, 8)}.bak`)
          : '',
        required: existedBefore,
      };
      plan.backups.push(backup);
    }

    backup.existedBefore = existedBefore;
    if (!existedBefore) continue;

    if (!backup.backupFile) {
      throw new Error(`目标文件缺少备份路径: ${target}`);
    }
    const backupParent = path.dirname(backup.backupFile);
    if (!fs.existsSync(backupParent)) fs.mkdirSync(backupParent, { recursive: true });
    fs.copyFileSync(target, backup.backupFile);
  }
}

/**
 * 记录变更历史
 */
export async function recordHistory(
  plan: ApplyPlan,
  historyDir: string,
  backupDir: string,
): Promise<void> {
  const historyFile = path.join(historyDir, APPLY_PLAN_HISTORY_FILE);

  let history: ChangeHistoryItem[] = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, { encoding: 'utf-8' }));
    } catch {
      history = [];
    }
  }

  const item: ChangeHistoryItem = {
    id: `ch_${Date.now()}`,
    appliedAt: new Date().toISOString(),
    title: plan.title,
    module: plan.module,
    planId: plan.id,
    targetFiles: plan.targetFiles,
    steps: plan.steps.map(s => ({ ...s, status: 'done' })),
    backups: plan.backups,
    canUndo: true,
  };

  history.unshift(item);
  // 保留最近 100 条
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), { encoding: 'utf-8' });
}

/**
 * 撤销最近一次变更
 */
export async function undoLastChange(
  historyDir: string,
  backupDir: string,
): Promise<{ success: boolean; error?: string }> {
  const historyFile = path.join(historyDir, APPLY_PLAN_HISTORY_FILE);
  if (!fs.existsSync(historyFile)) {
    return { success: false, error: '没有可撤销的历史记录' };
  }

  try {
    const history: ChangeHistoryItem[] = JSON.parse(fs.readFileSync(historyFile, { encoding: 'utf-8' }));
    if (history.length === 0) {
      return { success: false, error: '没有可撤销的历史记录' };
    }

    const last = history[0];
    if (!last.canUndo) {
      return { success: false, error: '上次变更不可撤销' };
    }

    // 从备份恢复
    for (const backup of last.backups) {
      if (backup.existedBefore === false) {
        if (fs.existsSync(backup.sourceFile)) {
          const currentBackup = path.join(
            backupDir,
            `${path.basename(backup.sourceFile)}.${Date.now()}.undo`,
          );
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          fs.copyFileSync(backup.sourceFile, currentBackup);
          fs.rmSync(backup.sourceFile, { force: true });
        }
      } else if (backup.backupFile && fs.existsSync(backup.backupFile)) {
        // 先备份当前文件（用于重做）
        const currentBackup = backup.backupFile + '.undo';
        if (fs.existsSync(backup.sourceFile)) {
          fs.copyFileSync(backup.sourceFile, currentBackup);
        }
        // 恢复历史备份
        fs.copyFileSync(backup.backupFile, backup.sourceFile);
      }
    }

    // 标记为已撤销
    history[0].canUndo = false;
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), { encoding: 'utf-8' });

    return { success: true };
  } catch (err) {
    return { success: false, error: `撤销失败: ${(err as Error).message}` };
  }
}

/**
 * 获取变更历史
 */
export function getChangeHistory(
  historyDir: string,
): ChangeHistoryItem[] {
  const historyFile = path.join(historyDir, APPLY_PLAN_HISTORY_FILE);
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(historyFile, { encoding: 'utf-8' }));
  } catch {
    return [];
  }
}

/**
 * 应用 Apply Plan 前的安全检查
 */
export function checkApplyPlanSafety(
  plan: ApplyPlan,
): ApplyPlanRisk[] {
  const risks: ApplyPlanRisk[] = [];

  for (const step of plan.steps) {
    // 检查目标文件是否存在（create_file 除外）
    if (step.targetFile && step.type !== 'create_file') {
      if (!fs.existsSync(step.targetFile)) {
        risks.push({
          id: `risk_file_not_found_${step.id}`,
          severity: 'error',
          title: '目标文件不存在',
          description: `文件 ${step.targetFile} 不存在，无法执行修改。`,
        });
      }
    }

    // 检查目标文件是否可写
    if (step.targetFile && fs.existsSync(step.targetFile)) {
      try {
        fs.accessSync(step.targetFile, fs.constants.W_OK);
      } catch {
        risks.push({
          id: `risk_not_writable_${step.id}`,
          severity: 'error',
          title: '目标文件不可写',
          description: `文件 ${step.targetFile} 没有写入权限。`,
        });
      }
    }
  }

  return risks;
}
