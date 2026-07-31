/**
 * ATM - Apply Plan 执行模块
 * 执行 Apply Plan，失败时自动回滚
 */
import fs from 'fs';
import path from 'path';
import { readFileContent, writeFileContent, ensureDirectoryExists } from '../environment/fileAccess';
import { createBackup } from '../backup/createBackup';
import { generateRollbackManifest, writeRollbackManifest, executeRollback } from '../backup/rollbackManifest';
import { updateEnvWithManagedBlock, generateBootstrapLines, insertBootstrapToIlinit } from '../generator/generateManagedEnvBlock';
import { generateManagedEnvBlock } from '../generator/generateManagedEnvBlock';
import type { ApplyPlan, ApplyResult, HotkeyBinding } from '../../src/types/hotkey';

/**
 * 执行 Apply Plan
 * @param plan ApplyPlan
 * @param bindings 要写入的快捷键绑定（用于托管块）
 * @param pcbenvPath pcbenv 路径
 * @returns ApplyResult
 */
export function applyChanges(
  plan: ApplyPlan,
  bindings: HotkeyBinding[],
  pcbenvPath: string
): ApplyResult {
  const effectiveBindings = plan.managedBindings && plan.managedBindings.length > 0
    ? plan.managedBindings
    : bindings;
  const appliedSteps: string[] = [];
  let currentStep = 0;
  let rollbackManifestPath = '';
  const atmDir = path.join(pcbenvPath, 'atm_generated');

  try {
    // Step 1: 确保 atm_generated 目录结构
    ensureDirectoryExists(atmDir);
    ensureDirectoryExists(path.join(atmDir, 'backup'));
    ensureDirectoryExists(path.join(atmDir, 'logs'));
    currentStep++;

    // Step 2: 备份
    const backupPlanSteps = plan.steps.filter((s) => s.type === 'backup');
    const backedUpFiles: { originalPath: string; backupPath: string }[] = [];

    for (const step of backupPlanSteps) {
      const backupResult = createBackup(
        step.target,
        path.join(atmDir, 'backup'),
        `Apply Plan: ${plan.id}`
      );
      if (!backupResult.success) {
        // 文件不存在不算错误
        if (backupResult.error?.includes('不存在')) {
          currentStep++;
          continue;
        }
        return {
          success: false,
          planId: plan.id,
          appliedSteps: currentStep,
          totalSteps: plan.steps.length,
          error: `备份失败: ${backupResult.error}`,
        };
      }

      for (const file of backupResult.files) {
        backedUpFiles.push({
          originalPath: file.originalPath,
          backupPath: file.backupPath,
        });
      }
      currentStep++;
    }

    // 生成并写入 rollback manifest
    if (backedUpFiles.length > 0) {
      const manifest = generateRollbackManifest(
        {
          backupId: plan.id.replace('apply_', ''),
          files: backedUpFiles.map((f) => ({
            originalPath: f.originalPath,
            backupPath: f.backupPath,
            sha256: 'applied',
            size: 0,
          })),
        },
        `Apply Plan: ${plan.summary}`
      );

      const manifestResult = writeRollbackManifest(
        manifest,
        path.join(atmDir, 'backup', plan.id.replace('apply_', ''))
      );

      if (manifestResult.success) {
        rollbackManifestPath = manifestResult.path;
      }
    }

    // Step 3: 执行实际修改
    for (const step of plan.steps) {
      if (step.type === 'modify_managed_block') {
        const envPath = path.join(pcbenvPath, 'env');

        // 读取当前 env 内容
        const { content: currentContent, error: readError } = readFileContent(envPath);
        if (readError) {
          // 如果文件不存在，创建新文件
          if (!fs.existsSync(envPath)) {
            const newBlock = generateManagedEnvBlock(effectiveBindings);
            const writeResult = writeFileContent(envPath, newBlock + '\n');
            if (!writeResult.success) {
              throw new Error(`创建 env 文件失败: ${writeResult.error}`);
            }
          } else {
            throw new Error(`读取 env 失败: ${readError}`);
          }
        } else {
          // 生成新的托管块内容
          const newBlockContent = generateManagedEnvBlock(effectiveBindings);
          // 更新 env 中的托管块
          const updatedContent = updateEnvWithManagedBlock(currentContent, newBlockContent);
          // 写回
          const writeResult = writeFileContent(envPath, updatedContent);
          if (!writeResult.success) {
            throw new Error(`写入 env 失败: ${writeResult.error}`);
          }
        }
        currentStep++;
      } else if (step.type === 'insert_bootstrap') {
        const ilinitPath = path.join(pcbenvPath, 'allegro.ilinit');

        // 生成 bootstrap 行
        const bootstrapContent = generateBootstrapLines(
          path.join(atmDir, 'bootstrap.il')
        );

        // 读取当前 ilinit 内容
        let currentContent = '';
        if (fs.existsSync(ilinitPath)) {
          const result = readFileContent(ilinitPath);
          if (result.error) {
            throw new Error(`读取 allegro.ilinit 失败: ${result.error}`);
          }
          currentContent = result.content;
        }

        // 插入 bootstrap（如果已存在会返回 null）
        const updatedContent = insertBootstrapToIlinit(currentContent, bootstrapContent);

        if (updatedContent !== null) {
          const writeResult = writeFileContent(ilinitPath, updatedContent);
          if (!writeResult.success) {
            throw new Error(`写入 allegro.ilinit 失败: ${writeResult.error}`);
          }
        }
        currentStep++;
      } else if (step.type === 'create_directory') {
        ensureDirectoryExists(step.target);
        currentStep++;
      } else if (step.type === 'write_file') {
        // 预留：后续阶段实现文件写入
        currentStep++;
      }
    }

    // 记录 apply log
    const logContent = [
      `[${new Date().toISOString()}] Apply Plan: ${plan.id}`,
      `Summary: ${plan.summary}`,
      `Steps: ${currentStep}/${plan.steps.length}`,
      `Status: SUCCESS`,
      '',
    ].join('\n');
    fs.appendFileSync(path.join(atmDir, 'logs', 'atm_apply.log'), logContent, {
      encoding: 'utf-8',
    });

    return {
      success: true,
      planId: plan.id,
      appliedSteps: currentStep,
      totalSteps: plan.steps.length,
      rollbackPath: rollbackManifestPath || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // 尝试回滚
    if (rollbackManifestPath && fs.existsSync(rollbackManifestPath)) {
      try {
        const { readRollbackManifest } = require('../backup/rollbackManifest');
        const manifest = readRollbackManifest(rollbackManifestPath);
        if (manifest) {
          executeRollback(manifest);
        }
      } catch {
        // 回滚失败，保留备份供手动恢复
      }
    }

    // 记录失败日志
    try {
      const logContent = [
        `[${new Date().toISOString()}] Apply Plan: ${plan.id}`,
        `Summary: ${plan.summary}`,
        `Steps: ${currentStep}/${plan.steps.length}`,
        `Status: FAILED`,
        `Error: ${message}`,
        '',
      ].join('\n');
      fs.appendFileSync(path.join(atmDir, 'logs', 'atm_apply.log'), logContent, {
        encoding: 'utf-8',
      });
    } catch {
      // 日志写入失败不阻塞错误返回
    }

    return {
      success: false,
      planId: plan.id,
      appliedSteps: currentStep,
      totalSteps: plan.steps.length,
      error: message,
      rollbackPath: rollbackManifestPath || undefined,
    };
  }
}
