/**
 * ATM - Symphony 协同模式适配 IPC 处理器
 *
 * 提供：
 *   - skill:symphony-check    兼容体检（U 类函数 / 未登记命令 / 菜单触发器）
 *   - skill:symphony-generate 生成 symphony_skill.txt 的 Apply Plan
 *   - skill:symphony-apply    执行 Symphony 登记计划（复用统一 Apply Plan 引擎）
 */
import { ipcMain } from 'electron';
import path from 'path';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import { checkSymphonyCompatibility } from '../../core/symphony/symphonyCompatibility';
import { createSymphonyApplyPlan } from '../../core/symphony/symphonyApplyPlan';
import {
  createApplyPlan as createUnifiedApplyPlan,
  executeApplyPlan as executeUnifiedApplyPlan,
} from '../../core/apply/applyPlanEngine';
import { getMuTableInfo, getMuTableSize } from '../../core/symphony/muFunctionTable';
import type { SkillApplyPlan } from '../../src/types/skill';
import type { SymphonyCompatibilityResult } from '../../src/types/symphony';

function getEnvInfoWithCompanyPaths() {
  const envInfo = locateEnvironment();
  const cdsSite = process.env.CDS_SITE;
  return { ...envInfo, cdsSite: cdsSite || null };
}

export function registerSkillSymphonyIpc(): void {
  // 兼容体检
  ipcMain.handle('skill:symphony-check', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const result: SymphonyCompatibilityResult = checkSymphonyCompatibility(
        scanResult.all,
        envInfo,
      );
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Symphony 兼容体检失败: ${message}` };
    }
  });

  // 生成 Symphony 登记 Apply Plan
  ipcMain.handle(
    'skill:symphony-generate',
    async (_event, optionsJson: string) => {
      try {
        const envInfo = getEnvInfoWithCompanyPaths();
        const scanResult = await scanEnhancedSkills(envInfo);
        const options = optionsJson ? JSON.parse(optionsJson) : {};
        const rwCommandNames: string[] = Array.isArray(options.rwCommandNames)
          ? options.rwCommandNames.filter((c: unknown) => typeof c === 'string')
          : [];
        const syncSite = options.syncSite === true;
        const sitePath = typeof options.sitePath === 'string' && options.sitePath
          ? options.sitePath
          : envInfo.cdsSite;

        const plan = createSymphonyApplyPlan(envInfo, {
          skills: scanResult.all,
          rwCommandNames,
          syncSite,
          sitePath: syncSite ? (sitePath || undefined) : undefined,
        });
        return { success: true, data: plan };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `生成 Symphony 登记计划失败: ${message}` };
      }
    },
  );

  // 执行 Symphony 登记计划（复用统一 Apply Plan 引擎）
  ipcMain.handle('skill:symphony-apply', async (_event, planJson: string) => {
    try {
      const plan: SkillApplyPlan = JSON.parse(planJson);
      const envInfo = getEnvInfoWithCompanyPaths();
      const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      const materialized = plan.steps
        .filter((step) => step.type !== 'backup' && step.type !== 'create_directory')
        .map((step) => {
          if (!step.target || step.after === undefined) {
            throw new Error(`Symphony 计划步骤缺少写入内容: ${step.description}`);
          }
          return {
            type: step.type as 'write_file',
            title: step.title || step.description,
            description: step.description,
            targetFile: step.target,
            after: step.after,
          };
        });
      const unifiedPlan = createUnifiedApplyPlan({
        title: plan.summary,
        description: 'Symphony 命令登记（symphony_skill.txt）',
        module: 'skill',
        steps: materialized,
        requiresRestart: plan.requiresRestart,
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
      });
      return await executeUnifiedApplyPlan(unifiedPlan, {
        backupDir: path.join(atmDir, 'backups'),
        historyDir: path.join(atmDir, 'history'),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `执行 Symphony 登记计划失败: ${message}` };
    }
  });

  // 支持表信息（版本/条数，供 UI 展示）
  ipcMain.handle('skill:symphony-table-info', async () => {
    try {
      const info = getMuTableInfo();
      return { success: true, data: { ...info, size: getMuTableSize() } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `读取支持表失败: ${message}` };
    }
  });
}
