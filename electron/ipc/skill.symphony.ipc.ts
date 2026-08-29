/**
 * ATM - Symphony 协同模式适配 IPC 处理器
 *
 * 提供：
 *   - skill:symphony-check    兼容体检（U 类函数 / 未登记命令 / 菜单触发器）
 *   - skill:symphony-generate 生成 symphony_skill.txt 的 Apply Plan
 *   - skill:symphony-apply    执行 Symphony 登记计划（复用统一 Apply Plan 引擎）
 */
import { ipcMain } from 'electron';
import fs from 'fs';
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

/** 追加一行 Symphony 操作日志，便于定位登记流程卡/失败的真实环节 */
function appendSymphonyLog(
  envInfo: ReturnType<typeof getEnvInfoWithCompanyPaths>,
  level: 'INFO' | 'ERROR',
  message: string,
  detail?: unknown,
): void {
  try {
    const atmDir = envInfo.atmGeneratedPath
      || path.join(envInfo.pcbenvPath || '', 'atm_generated');
    const logsDir = path.join(atmDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const detailText = detail === undefined
      ? ''
      : (detail instanceof Error ? (detail.stack || detail.message) : JSON.stringify(detail));
    fs.appendFileSync(
      path.join(logsDir, 'symphony.log'),
      `[${new Date().toISOString()}] [${level}] ${message}${detailText ? ` || ${detailText}` : ''}\n`,
      'utf-8',
    );
  } catch {
    // 日志失败不阻塞 Symphony 主流程
  }
}

export function registerSkillSymphonyIpc(): void {
  // 兼容体检
  ipcMain.handle('skill:symphony-check', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      appendSymphonyLog(envInfo, 'INFO', 'symphony-check 开始');
      const scanResult = await scanEnhancedSkills(envInfo);
      const result: SymphonyCompatibilityResult = checkSymphonyCompatibility(
        scanResult.all,
        envInfo,
      );
      appendSymphonyLog(
        envInfo,
        'INFO',
        `symphony-check 完成: ${scanResult.all.length} skills, ${result.commandStatuses.length} 个入口命令, ${result.issues.length} 个问题`,
      );
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendSymphonyLog(
        getEnvInfoWithCompanyPaths(),
        'ERROR',
        `symphony-check 失败: ${message}`,
        err,
      );
      return { success: false, error: `Symphony 兼容体检失败: ${message}` };
    }
  });

  // 生成 Symphony 登记 Apply Plan
  ipcMain.handle(
    'skill:symphony-generate',
    async (_event, optionsJson: string) => {
      try {
        const envInfo = getEnvInfoWithCompanyPaths();
        appendSymphonyLog(envInfo, 'INFO', `symphony-generate 开始 options=${optionsJson || '(空)'}`);
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
        appendSymphonyLog(
          envInfo,
          'INFO',
          `symphony-generate 完成 id=${plan.id} steps=${plan.steps.length} target=${(plan.targetFiles || []).join(',')}`,
        );
        return { success: true, data: plan };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appendSymphonyLog(
          getEnvInfoWithCompanyPaths(),
          'ERROR',
          `symphony-generate 失败: ${message}`,
          err,
        );
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
      appendSymphonyLog(envInfo, 'INFO', `symphony-apply 开始 plan=${plan.id} steps=${plan.steps?.length ?? 0}`);
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
      const result = await executeUnifiedApplyPlan(unifiedPlan, {
        backupDir: path.join(atmDir, 'backups'),
        historyDir: path.join(atmDir, 'history'),
      });
      appendSymphonyLog(
        envInfo,
        result.success ? 'INFO' : 'ERROR',
        `symphony-apply 结束 success=${result.success} applied=${result.appliedSteps}/${result.totalSteps}${result.error ? ` error=${result.error}` : ''}`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      appendSymphonyLog(
        getEnvInfoWithCompanyPaths(),
        'ERROR',
        `symphony-apply 异常: ${message}`,
        err,
      );
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

  // 渲染端调试日志（跟随同一份 symphony.log 便于对齐时间线）
  ipcMain.handle('skill:symphony-ui-log', async (_event, payload: string) => {
    try {
      appendSymphonyLog(getEnvInfoWithCompanyPaths(), 'INFO', `[UI] ${String(payload ?? '')}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
