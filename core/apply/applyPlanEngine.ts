/**
 * ATM - Apply Plan 统一引擎（V5.3）
 *
 * 所有模块共用同一套 Apply Plan 生成、执行、备份、回滚、历史流程。
 */
import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
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
  },
): ApplyPlan {
  const now = new Date().toISOString();
  const id = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const steps: ApplyPlanStep[] = params.steps.map((s, i) => ({
    ...s,
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
  const setUpdates: Array<{ planId: string; stepId: string; status: string }> = [];

  try {
    // 1. 创建备份目录
    if (!fs.existsSync(options.backupDir)) {
      fs.mkdirSync(options.backupDir, { recursive: true });
    }

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
        await tryRollback(plan, appliedSteps, options.backupDir);
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
      const content = fs.readFileSync(step.targetFile, { encoding: 'utf-8' });
      const updated = content.replace(step.before, step.after || `# ATM disabled: ${step.before.trim()}`);
      fs.writeFileSync(step.targetFile, updated, { encoding: 'utf-8' });
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
        fs.writeFileSync(step.targetFile, step.after, { encoding: 'utf-8' });
      }
      break;
    }
    case 'generate_menu': {
      if (step.targetFile && step.after !== undefined) {
        const dir = path.dirname(step.targetFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        // Allegro 17.4 在简体中文 Windows 上按系统代码页读取 .il。
        fs.writeFileSync(step.targetFile, iconv.encode(step.after, 'gbk'));
      }
      break;
    }
    case 'modify_line':
    case 'append_line': {
      if (step.targetFile && step.after !== undefined) {
        let content = '';
        if (fs.existsSync(step.targetFile)) {
          content = fs.readFileSync(step.targetFile, { encoding: 'utf-8' });
        }
        if (step.type === 'append_line') {
          content += '\n' + step.after;
        } else if (step.type === 'modify_line' && step.before) {
          content = content.replace(step.before, step.after);
        }
        fs.writeFileSync(step.targetFile, content, { encoding: 'utf-8' });
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
        fs.writeFileSync(step.targetFile, step.after, { encoding: 'utf-8' });
      }
      break;
    }
    case 'record_history':
    case 'create_directory':
    case 'move_file':
    case 'delete_file':
    case 'archive_file': {
      // 预留 — 未来实现
      break;
    }
  }
}

/**
 * 尝试回滚
 */
async function tryRollback(
  plan: ApplyPlan,
  appliedSteps: number,
  backupDir: string,
): Promise<void> {
  const applied = plan.steps.slice(0, appliedSteps);
  for (const step of applied.reverse()) {
    if (step.backupTo && fs.existsSync(step.backupTo)) {
      try {
        if (step.targetFile) {
          // 备份可能是 GBK 菜单脚本或其他二进制内容，按字节恢复，禁止转码。
          fs.copyFileSync(step.backupTo, step.targetFile);
        }
      } catch {
        // 回滚失败时静默继续
      }
    }
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
  const historyFile = path.join(historyDir, 'change_history.json');

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
  const historyFile = path.join(historyDir, 'change_history.json');
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
      if (fs.existsSync(backup.backupFile)) {
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
  const historyFile = path.join(historyDir, 'change_history.json');
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
