/**
 * ATM - Skill 使用状态/健康度 IPC 处理器（从 skill.ipc.ts 拆分，V5.4）
 *
 * 处理：使用状态、健康度评分、使用关系树、配置扫描、README 生成、未使用检测
 */
import { ipcMain } from 'electron';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import { CommandIndex } from '../../core/skill/commandIndex';
import {
  computeAllUsageStatuses,
  computeHealthScore,
  buildUsageTree,
  scanConfigFiles,
  generateReadme,
  findUnusedSkills,
} from '../../core/skill/skillUsageStatus';
import type { SkillUsageInfo, HealthDeduction } from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';
import fs from 'fs';

function getCompanySkillPaths(): string[] {
  const paths: string[] = [];
  const cdsSite = process.env.CDS_SITE;
  const skillPath = process.env.SKILL_PATH;
  if (cdsSite) paths.push(cdsSite);
  if (skillPath) {
    const parts = skillPath.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
    paths.push(...parts);
  }
  return paths;
}

function getEnvInfoWithCompanyPaths() {
  const envInfo = locateEnvironment();
  const companySkillPaths = getCompanySkillPaths();
  return { ...envInfo, companySkillPaths };
}

function loadBindingsFromEnv(envInfo: any): HotkeyBinding[] {
  const allBindings: HotkeyBinding[] = [];
  try {
    const envPath = envInfo.envFilePath;
    if (envPath && fs.existsSync(envPath)) {
      const { parseEnvFile } = require('../../core/parser/parseEnv');
      const parseResult = parseEnvFile(envPath);
      if (parseResult && parseResult.entries) {
        for (const e of parseResult.entries) {
          if (e.type === 'funckey' || e.type === 'alias') {
            allBindings.push({
              id: `${e.type}_${e.key}_${e.lineNumber}`,
              key: e.key || '',
              command: e.command || '',
              type: e.type,
              bindingSource: 'user_env_original' as const,
              source: 'user_original',
              status: 'normal' as const,
              lineNumber: e.lineNumber,
            });
          }
        }
      }
    }
  } catch {}
  return allBindings;
}

export function registerSkillUsageIpc(): void {
  // V5.2 批量计算使用状态
  ipcMain.handle('skill:usage-statuses', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const allBindings = loadBindingsFromEnv(envInfo);
      const scanResult = await scanEnhancedSkills(envInfo, allBindings.length > 0 ? allBindings : undefined);
      const statuses = computeAllUsageStatuses(scanResult.all, allBindings);
      const result: Record<string, SkillUsageInfo> = {};
      for (const [id, info] of statuses) result[id] = info;
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `计算使用状态失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 批量计算健康度
  ipcMain.handle('skill:health-scores', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const allBindings = loadBindingsFromEnv(envInfo);
      const scanResult = await scanEnhancedSkills(envInfo, allBindings.length > 0 ? allBindings : undefined);
      const result: Record<string, { score: number; deductions: HealthDeduction[] }> = {};
      for (const skill of scanResult.all) result[skill.id] = computeHealthScore(skill, scanResult.all);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `计算健康度失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 构建使用关系树
  ipcMain.handle('skill:usage-tree', async (_event, skillPath: string, bindingsJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const allBindings: HotkeyBinding[] = JSON.parse(bindingsJson || '[]');
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const idx = new CommandIndex();
      idx.build(scanResult.all);
      const tree = buildUsageTree(target, allBindings, idx);
      return { success: true, data: tree };
    } catch (err) {
      return { success: false, error: `构建使用关系树失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 扫描配置文件
  ipcMain.handle('skill:config-files', async (_event, skillDir: string, skillName: string) => {
    try {
      const configFiles = scanConfigFiles(skillDir, skillName);
      return { success: true, data: configFiles };
    } catch (err) {
      return { success: false, error: `扫描配置文件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 生成 README
  ipcMain.handle('skill:generate-readme', async (_event, skillPath: string, metaJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const meta = metaJson ? JSON.parse(metaJson) : undefined;
      const readme = generateReadme(target, meta);
      return { success: true, data: readme };
    } catch (err) {
      return { success: false, error: `生成 README 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 检测未使用 Skill
  ipcMain.handle('skill:find-unused', async (_event, bindingsJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const allBindings: HotkeyBinding[] = JSON.parse(bindingsJson || '[]');
      const unused = findUnusedSkills(scanResult.all, allBindings);
      return { success: true, data: unused.map((s) => ({ id: s.id, name: s.name, path: s.path, tier: s.tier, entryCommands: s.entryCommands.map((c) => c.name), lastModified: s.lastModified, loadStatus: s.loadStatus })) };
    } catch (err) {
      return { success: false, error: `检测未使用 Skill 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
