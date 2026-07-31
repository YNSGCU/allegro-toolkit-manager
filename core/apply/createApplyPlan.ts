/**
 * ATM - Apply Plan 生成模块
 * 生成包含步骤列表和警告的应用计划
 */
import path from 'path';
import { generateBackupId } from '../backup/createBackup';
import type {
  ApplyPlan,
  ApplyStep,
  PlanWarning,
  HotkeyBinding,
} from '../../src/types/hotkey';

export interface PlanAction {
  type: 'modify_env_managed_block' | 'insert_bootstrap' | 'create_atm_dirs';
  bindings?: HotkeyBinding[];
  envPath?: string;
  ilinitPath?: string;
  atmGeneratedPath?: string;
}

/**
 * 创建 Apply Plan
 * @param actions 要执行的操作列表
 * @param pcbenvPath pcbenv 路径
 * @returns ApplyPlan
 */
export function createApplyPlan(
  actions: PlanAction[],
  pcbenvPath: string
): ApplyPlan {
  const steps: ApplyStep[] = [];
  const warnings: PlanWarning[] = [];
  const backupId = generateBackupId();
  const backupBase = path.join(pcbenvPath, 'atm_generated', 'backup', backupId);
  let requiresRestart = false;

  // 检查是否有修改 env 或 ilinit 的操作
  const hasEnvModification = actions.some(
    (a) => a.type === 'modify_env_managed_block'
  );
  const hasBootstrapInsertion = actions.some(
    (a) => a.type === 'insert_bootstrap'
  );

  // Step 1: 确保 atm_generated 目录存在
  steps.push({
    type: 'create_directory',
    target: path.join(pcbenvPath, 'atm_generated'),
    backupTo: undefined,
    description: '确保 atm_generated 目录存在',
  });

  steps.push({
    type: 'create_directory',
    target: path.join(pcbenvPath, 'atm_generated', 'backup'),
    backupTo: undefined,
    description: '确保备份目录存在',
  });

  // Step 2: 备份涉及的文件
  if (hasEnvModification) {
    const envPath = path.join(pcbenvPath, 'env');
    steps.push({
      type: 'backup',
      target: envPath,
      backupTo: path.join(backupBase, 'env'),
      description: `备份 env 到 ${backupBase}/env`,
    });
  }

  if (hasBootstrapInsertion) {
    const ilinitPath = path.join(pcbenvPath, 'allegro.ilinit');
    steps.push({
      type: 'backup',
      target: ilinitPath,
      backupTo: path.join(backupBase, 'allegro.ilinit'),
      description: `备份 allegro.ilinit 到 ${backupBase}/allegro.ilinit`,
    });
  }

  // Step 3: 执行实际修改
  if (hasEnvModification) {
    const envAction = actions.find(
      (a) => a.type === 'modify_env_managed_block'
    );

    if (envAction?.bindings && envAction.bindings.length > 0) {
      // 检查是否有覆盖用户原始绑定
      const originalBindings = envAction.bindings.filter(
        (b) => b.bindingSource === 'user_env_original'
      );
      const atmBindings = envAction.bindings.filter(
        (b) => b.bindingSource === 'atm_managed_block'
      );

      for (const atmBinding of atmBindings) {
        const overlapped = originalBindings.find(
          (ob) => ob.key === atmBinding.key && ob.type === atmBinding.type
        );
        if (overlapped) {
          warnings.push({
            level: 'warning',
            message: `"${atmBinding.key}" 已存在用户原始绑定（第 ${overlapped.lineNumber} 行），将由 ATM 托管块覆盖。`,
          });
        }
      }
    }

    steps.push({
      type: 'modify_managed_block',
      target: path.join(pcbenvPath, 'env'),
      backupTo: undefined,
      description: '更新 env 中的 ATM Managed Hotkeys 托管块',
    });
  }

  if (hasBootstrapInsertion) {
    steps.push({
      type: 'insert_bootstrap',
      target: path.join(pcbenvPath, 'allegro.ilinit'),
      backupTo: undefined,
      description: '向 allegro.ilinit 插入 ATM bootstrap 加载行',
    });
    requiresRestart = true;
  }

  // 生成摘要
  const summaryParts: string[] = [];
  const modifySteps = steps.filter((s) => s.type === 'modify_managed_block' || s.type === 'insert_bootstrap');
  if (modifySteps.length > 0) {
    summaryParts.push(`修改 ${modifySteps.length} 项配置`);
  }
  const backupCount = steps.filter((s) => s.type === 'backup').length;
  if (backupCount > 0) {
    summaryParts.push(`备份 ${backupCount} 个文件`);
  }
  const summary = summaryParts.join('，') || '无变更操作';

  return {
    id: `apply_${backupId}`,
    createdAt: new Date().toISOString(),
    summary,
    steps,
    warnings,
    requiresRestart,
    rollbackManifestPath: path.join(backupBase, 'manifest.json'),
  };
}
