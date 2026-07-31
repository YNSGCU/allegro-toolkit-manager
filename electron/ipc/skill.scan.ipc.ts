/**
 * ATM - Skill 扫描相关 IPC 处理器（从 skill.ipc.ts 拆分，V5.4）
 *
 * 处理：扫描、解析、目录管理、加载检查等读取操作
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanAllSkills, scanSkillDirectory } from '../../core/skill/scanSkill';
import { parseSkillFile } from '../../core/parser/parseSkillMeta';
import { scanEnhancedSkills, buildEnhancedCommandList, convertToSkillFileItem } from '../../core/skill/enhancedScan';
import { checkSkillLoad, scanLoadSources, checkAllSkillLoadStatuses } from '../../core/validator/skillLoadChecker';
import type { SkillFileItem, SkillCommandItem } from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';
import { buildCommandRegistry } from '../../core/skill/commandRegistry';

/** 获取公司 Skill 路径列表 */
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

/** 获取带公司路径的环境信息 */
function getEnvInfoWithCompanyPaths() {
  const envInfo = locateEnvironment();
  const companySkillPaths = getCompanySkillPaths();
  return { ...envInfo, companySkillPaths };
}

/** 从 env 文件加载快捷键绑定列表 */
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

export function registerSkillScanIpc(): void {
  // V1 / V2 原有 IPC
  ipcMain.handle('skill:scan', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const result = scanAllSkills(envInfo);
      for (const skill of result.all) {
        if (skill.functions.length === 0) {
          const parseResult = parseSkillFile(skill.filePath);
          skill.functions = parseResult.functions;
        }
      }
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `扫描 Skill 失败: ${message}` };
    }
  });

  ipcMain.handle('skill:parse-file', async (_event, filePath: string) => {
    try {
      const result = parseSkillFile(filePath);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `解析 Skill 文件失败: ${message}` };
    }
  });

  ipcMain.handle('skill:get-registry', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = scanAllSkills(envInfo);
      const registry = buildCommandRegistry(scanResult.all);
      return { success: true, data: { registry, skills: scanResult } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `构建命令注册中心失败: ${message}` };
    }
  });

  // V4.0 加载检查
  ipcMain.handle('skill:check-load', async (_event, skillName: string, envInfo: any) => {
    try {
      const loadSources = scanLoadSources(envInfo);
      const result = checkSkillLoad(skillName, loadSources, null);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `检查 Skill 加载状态失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('skill:check-all-load', async (_event, skillNames: string[], envInfo: any) => {
    try {
      const results = await checkAllSkillLoadStatuses(skillNames, envInfo, null);
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: `检查 Skill 加载状态失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('skill:scan-load-sources', async (_event, envInfo: any) => {
    try {
      const sources = scanLoadSources(envInfo);
      return { success: true, data: sources };
    } catch (err) {
      return { success: false, error: `扫描加载源失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V4.5 增强扫描
  ipcMain.handle('skill:enhanced-scan', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const allBindings = loadBindingsFromEnv(envInfo);
      const result = await scanEnhancedSkills(envInfo, allBindings.length > 0 ? allBindings : undefined);
      return { success: true, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `增强扫描 Skill 失败: ${message}` };
    }
  });

  ipcMain.handle('skill:enhanced-commands', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const commandList = buildEnhancedCommandList(scanResult.all);
      return { success: true, data: { commandList, skills: scanResult } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `获取增强命令列表失败: ${message}` };
    }
  });

  ipcMain.handle('skill:file-detail', async (_event, skillPath: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = scanAllSkills(envInfo);
      const skill = scanResult.all.find((s) => s.filePath === skillPath);
      if (!skill) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const parseResult = parseSkillFile(skill.filePath);
      const loadSources = scanLoadSources(envInfo as any);
      const loadResult = checkSkillLoad(skill.name, loadSources, null);
      const detail = convertToSkillFileItem(skill, parseResult, undefined, loadResult);
      if (fs.existsSync(skill.filePath)) {
        const stat = fs.statSync(skill.filePath);
        detail.fileSize = stat.size;
        detail.lastModified = stat.mtime.toISOString();
      }
      return { success: true, data: detail };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `获取 Skill 详情失败: ${message}` };
    }
  });

  ipcMain.handle('skill:add-readonly-dir', async (_event, dirPath: string) => {
    try {
      if (!fs.existsSync(dirPath)) return { success: false, error: `目录不存在: ${dirPath}` };
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) return { success: false, error: `路径不是目录: ${dirPath}` };
      const skills = scanSkillDirectory(dirPath, 'company');
      return { success: true, data: { dirPath, skillCount: skills.length, skills: skills.map((s) => ({ name: s.name, filePath: s.filePath })) } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `添加只读目录失败: ${message}` };
    }
  });

  ipcMain.handle('skill:select-readonly-dir', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择只读 Skill 目录' });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: true, data: null };
      return { success: true, data: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: `选择目录失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('skill:import-preview', async (_event, filePathOrDir: string) => {
    try {
      const normalizedPath = path.normalize(filePathOrDir);
      if (!fs.existsSync(normalizedPath)) return { success: false, error: `路径不存在: ${normalizedPath}` };
      const stat = fs.statSync(normalizedPath);
      const files: Array<{ path: string; functions: any[]; entryCount: number; totalFunctions: number }> = [];
      if (stat.isFile()) {
        const parseResult = parseSkillFile(normalizedPath);
        files.push({ path: normalizedPath, functions: parseResult.enhancedFunctions || [], entryCount: parseResult.parseDetail?.entryCount || 0, totalFunctions: parseResult.functions.length });
      } else if (stat.isDirectory()) {
        const entries = fs.readdirSync(normalizedPath);
        for (const entry of entries) {
          const fullPath = path.join(normalizedPath, entry);
          const entryStat = fs.statSync(fullPath);
          if (entryStat.isFile() && entry.toLowerCase().endsWith('.il')) {
            const parseResult = parseSkillFile(fullPath);
            files.push({ path: fullPath, functions: parseResult.enhancedFunctions || [], entryCount: parseResult.parseDetail?.entryCount || 0, totalFunctions: parseResult.functions.length });
          }
        }
      }
      const skillNames = files.map((f) => path.parse(f.path).name.toLowerCase());
      const envInfo = getEnvInfoWithCompanyPaths();
      const existingSkils = scanAllSkills(envInfo).all;
      const existingNames = new Set(existingSkils.map((s) => s.name.toLowerCase()));
      const hasExistingDuplicate = skillNames.some((n) => existingNames.has(n));
      return { success: true, data: { name: path.parse(normalizedPath).name, files, totalFiles: files.length, totalFunctions: files.reduce((s, f) => s + f.totalFunctions, 0), totalEntryCommands: files.reduce((s, f) => s + f.entryCount, 0), hasExistingDuplicate, duplicateCommands: [], duplicateSkills: skillNames.filter((n) => existingNames.has(n)), suggestedHotkeys: [], needsLoader: true } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `导入预览失败: ${message}` };
    }
  });

  // V5.2 Loader 顺序分析
  ipcMain.handle('skill:loader-order', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const enabledSkills = scanResult.all.filter((s) => s.enabled && s.tier !== 'company');
      const sorted = [...enabledSkills].sort((a, b) => {
        if (a.dependencies.includes(b.name)) return 1;
        if (b.dependencies.includes(a.name)) return -1;
        return 0;
      });
      const result = {
        order: sorted.map((s, i) => ({ index: i + 1, name: s.name, path: s.path, loadStatus: s.loadStatus, hasDependencies: s.dependencies.length > 0, dependencies: s.dependencies, fileExists: s.parseStatus !== 'error', isEnabled: s.enabled })),
        issues: [] as Array<{ type: string; severity: string; message: string }>,
      };
      const loadedNames = new Set(sorted.map((s) => s.name.toLowerCase()));
      for (const skill of sorted) {
        if (skill.parseStatus === 'error') result.issues.push({ type: 'file_not_found', severity: 'error', message: `文件不存在: ${skill.name}` });
        for (const dep of skill.dependencies) {
          if (!loadedNames.has(dep.toLowerCase())) result.issues.push({ type: 'dependency_missing', severity: 'warning', message: `${skill.name} 依赖 ${dep} 但未找到` });
        }
      }
      for (const s of scanResult.all.filter((sk) => !sk.enabled && sk.loadStatus === 'loaded_configured')) result.issues.push({ type: 'disabled_in_loader', severity: 'warning', message: `已禁用的 ${s.name} 仍在 Loader 中` });
      for (const s of scanResult.all.filter((sk) => sk.enabled && sk.loadStatus !== 'loaded_configured' && sk.tier !== 'company')) result.issues.push({ type: 'enabled_not_in_loader', severity: 'warning', message: `已启用 ${s.name} 不在 Loader 中` });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `获取加载顺序失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
