/**
 * ATM - Skill Apply Plan IPC 处理器（从 skill.ipc.ts 拆分，V5.4）
 *
 * 处理：Toggle、执行 Apply Plan、删除计划、导出包等写入操作
 */
import { ipcMain } from 'electron';
import path from 'path';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanAllSkills } from '../../core/skill/scanSkill';
import { parseSkillFile } from '../../core/parser/parseSkillMeta';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import { generateSkillLoader, updateSkillStatus } from '../../core/generator/generateSkillLoader';
import {
  generateBootstrapIlContent,
  generateBootstrapLines,
  insertBootstrapToIlinit,
} from '../../core/generator/generateBootstrap';
import { readFileContent, writeFileContent, ensureDirectoryExists } from '../../core/environment/fileAccess';
import { createBackup } from '../../core/backup/createBackup';
import { CommandIndex } from '../../core/skill/commandIndex';
import { enrichBindings } from '../../core/validator/validateHotkeys';
import { analyzeSkillDeleteImpact, createDeletePlan } from '../../core/skill/skillImpactAnalysis';
import { scanConfigFiles } from '../../core/skill/skillUsageStatus';
import type { SkillApplyPlan, SkillApplyStep, ScannedSkill, SkillFileItem } from '../../src/types/skill';
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

export function registerSkillApplyIpc(): void {
  // 切换 Skill 启用/禁用 → 生成 Apply Plan
  ipcMain.handle('skill:toggle', async (_event, skillPath: string, enabled: boolean) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = scanAllSkills(envInfo);
      const newStatus = enabled ? 'enabled' : 'disabled';
      const targetSkill = scanResult.all.find((s) => s.filePath === skillPath);
      if (!targetSkill) return { success: false, error: `未找到 Skill: ${skillPath}` };
      if (targetSkill.tier === 'company') return { success: false, error: '公司 Skill 不允许切换状态' };
      const updatedAll = updateSkillStatus(scanResult.all, skillPath, newStatus);
      const userSkills = updatedAll.filter((s) => s.tier === 'user');
      const atmSkills = updatedAll.filter((s) => s.tier === 'atm');
      const loaderContent = generateSkillLoader(userSkills, atmSkills, envInfo.pcbenvPath || '');
      const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      const plan = createSkillTogglePlan(targetSkill, newStatus, loaderContent, atmDir, envInfo);
      return { success: true, data: plan };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `切换 Skill 状态失败: ${message}` };
    }
  });

  // 预览 Skill Loader 内容
  ipcMain.handle('skill:generate-loader', async () => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = scanAllSkills(envInfo);
      for (const skill of scanResult.all) {
        if (skill.functions.length === 0) {
          const parseResult = parseSkillFile(skill.filePath);
          skill.functions = parseResult.functions;
        }
      }
      const userSkills = scanResult.all.filter((s) => s.tier === 'user');
      const atmSkills = scanResult.all.filter((s) => s.tier === 'atm');
      const loaderContent = generateSkillLoader(userSkills, atmSkills, envInfo.pcbenvPath || '');
      return { success: true, data: loaderContent };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `生成 Skill Loader 失败: ${message}` };
    }
  });

  // 执行 Skill Apply Plan
  ipcMain.handle('skill:apply-skill-changes', async (_event, planJson: string) => {
    try {
      const plan: SkillApplyPlan = JSON.parse(planJson);
      const envInfo = getEnvInfoWithCompanyPaths();
      const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      let appliedSteps = 0;
      ensureDirectoryExists(atmDir);
      ensureDirectoryExists(path.join(atmDir, 'backup'));
      appliedSteps++;
      const backupPlanSteps = plan.steps.filter((s) => s.type === 'backup');
      for (const step of backupPlanSteps) {
        const backupResult = createBackup(step.target, path.join(atmDir, 'backup'), `Skill Plan: ${plan.id}`);
        if (!backupResult.success && !backupResult.error?.includes('不存在')) {
          return { success: false, planId: plan.id, appliedSteps, totalSteps: plan.steps.length, error: `备份失败: ${backupResult.error}` };
        }
        appliedSteps++;
      }
      const writeLoaderStep = plan.steps.find((s) => s.type === 'write_skill_loader');
      if (writeLoaderStep) {
        const scanResult = scanAllSkills(envInfo);
        for (const skill of scanResult.all) {
          if (skill.functions.length === 0) skill.functions = parseSkillFile(skill.filePath).functions;
        }
        const userSkills = scanResult.all.filter((s) => s.tier === 'user');
        const atmSkills = scanResult.all.filter((s) => s.tier === 'atm');
        const loaderContent = generateSkillLoader(userSkills, atmSkills, envInfo.pcbenvPath || '');
        const writeResult = writeFileContent(writeLoaderStep.target, loaderContent);
        if (!writeResult.success) return { success: false, planId: plan.id, appliedSteps, totalSteps: plan.steps.length, error: `写入 Skill Loader 失败: ${writeResult.error}` };
        appliedSteps++;
      }
      const writeBootstrapStep = plan.steps.find((s) => s.type === 'write_bootstrap');
      if (writeBootstrapStep) {
        const bootstrapIlContent = generateBootstrapIlContent(atmDir);
        const writeResult = writeFileContent(writeBootstrapStep.target, bootstrapIlContent);
        if (!writeResult.success) return { success: false, planId: plan.id, appliedSteps, totalSteps: plan.steps.length, error: `写入 bootstrap.il 失败: ${writeResult.error}` };
        appliedSteps++;
      }
      const modifyIlinitStep = plan.steps.find((s) => s.type === 'modify_ilinit');
      if (modifyIlinitStep) {
        const { content, error: readError } = readFileContent(modifyIlinitStep.target);
        if (!readError && content !== undefined) {
          const bootstrapLines = generateBootstrapLines(atmDir);
          const updatedContent = insertBootstrapToIlinit(content, bootstrapLines);
          if (updatedContent !== null) {
            const writeResult = writeFileContent(modifyIlinitStep.target, updatedContent);
            if (!writeResult.success) return { success: false, planId: plan.id, appliedSteps, totalSteps: plan.steps.length, error: `更新 allegro.ilinit 失败: ${writeResult.error}` };
          }
        }
        appliedSteps++;
      }
      return { success: true, planId: plan.id, appliedSteps, totalSteps: plan.steps.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `执行 Skill Plan 失败: ${message}` };
    }
  });

  // V5.1 影响分析
  ipcMain.handle('skill:impact-analysis', async (_event, skillPath: string, bindingsJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const allBindings: HotkeyBinding[] = JSON.parse(bindingsJson);
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const commandIndex = new CommandIndex();
      commandIndex.build(scanResult.all);
      const enrichedBindings = enrichBindings(allBindings, commandIndex);
      const impact = analyzeSkillDeleteImpact(target, scanResult.all, enrichedBindings, commandIndex);
      return { success: true, data: impact };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `影响分析失败: ${message}` };
    }
  });

  // V5.1 创建删除计划
  ipcMain.handle('skill:create-delete-plan', async (_event, skillPath: string, option: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const plan = createDeletePlan(target, option as any, envInfo);
      return { success: true, data: plan };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `创建删除计划失败: ${message}` };
    }
  });

  // V5.2 安全禁用
  ipcMain.handle('skill:toggle-safe', async (_event, skillPath: string, enabled: boolean) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      if (target.tier === 'company') return { success: false, error: '公司 Skill 不允许切换' };
      if (!enabled && (target.hotkeyRefs.length > 0 || target.menuRefs.length > 0)) {
        const allBindings: HotkeyBinding[] = [];
        try {
          const envPath = envInfo.envFilePath;
          if (envPath && fs.existsSync(envPath)) {
            const { parseEnvFile } = require('../../core/parser/parseEnv');
            const parseResult = parseEnvFile(envPath);
            if (parseResult && parseResult.entries) {
              for (const e of parseResult.entries) {
                if (e.type === 'funckey' || e.type === 'alias') {
                  allBindings.push({ id: `${e.type}_${e.key}_${e.lineNumber}`, key: e.key || '', command: e.command || '', type: e.type, bindingSource: 'user_env_original' as const, source: 'user_original', status: 'normal' as const, lineNumber: e.lineNumber });
                }
              }
            }
          }
        } catch {}
        const impact = analyzeSkillDeleteImpact(target, scanResult.all, allBindings);
        return { success: true, data: { needImpactAnalysis: true, impact } };
      }
      const newStatus = enabled ? 'enabled' : 'disabled';
      const scanResultOld = scanAllSkills(envInfo);
      const updatedAll = updateSkillStatus(scanResultOld.all, skillPath, newStatus);
      const userSkills = updatedAll.filter((s) => s.tier === 'user');
      const atmSkills = updatedAll.filter((s) => s.tier === 'atm');
      const loaderContent = generateSkillLoader(userSkills, atmSkills, envInfo.pcbenvPath || '');
      const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      const targetOld = scanResultOld.all.find((s) => s.filePath === skillPath);
      const plan = createSkillTogglePlan(targetOld!, newStatus as 'enabled' | 'disabled', loaderContent, atmDir, envInfo);
      return { success: true, data: { needImpactAnalysis: false, plan } };
    } catch (err) {
      return { success: false, error: `安全切换失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // V5.2 导出包预览
  ipcMain.handle('skill:export-package', async (_event, skillPath: string, optionsJson: string) => {
    try {
      const envInfo = getEnvInfoWithCompanyPaths();
      const scanResult = await scanEnhancedSkills(envInfo);
      const target = scanResult.all.find((s) => s.path === skillPath || s.id === skillPath);
      if (!target) return { success: false, error: `未找到 Skill: ${skillPath}` };
      const options = optionsJson ? JSON.parse(optionsJson) : {};
      const preview = { name: target.name, path: target.path, tier: target.tier, entryCommands: target.entryCommands.map((c) => c.name), hotkeyCount: target.hotkeyRefs.length, menuCount: target.menuRefs.length, configFiles: scanConfigFiles(target.dirPath, target.name), includeSource: options.includeSource !== false, isCompany: target.tier === 'company', warning: target.tier === 'company' ? '该 Skill 可能属于公司资产，请确认是否允许导出。' : undefined };
      return { success: true, data: preview };
    } catch (err) {
      return { success: false, error: `导出预览失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

/**
 * 生成 Skill 切换操作的 Apply Plan
 */
function createSkillTogglePlan(
  skill: ScannedSkill,
  newStatus: 'enabled' | 'disabled',
  loaderContent: string,
  atmDir: string,
  envInfo: any,
): SkillApplyPlan {
  const backupId = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBase = path.join(atmDir, 'backup', backupId);
  const steps: SkillApplyStep[] = [];
  const warnings: { level: 'info' | 'warning' | 'danger'; message: string }[] = [];
  const loaderPath = path.join(atmDir, 'generated_skill_loader.il');
  const bootstrapIlPath = path.join(atmDir, 'bootstrap.il');
  const ilinitPath = envInfo.ilinitFilePath || path.join(envInfo.pcbenvPath || '', 'allegro.ilinit');
  const action = newStatus === 'enabled' ? '启用' : '禁用';
  steps.push({ type: 'backup', target: loaderPath, description: `备份 generated_skill_loader.il（${action} ${skill.name} 前）`, backupTo: path.join(backupBase, 'generated_skill_loader.il') });
  steps.push({ type: 'write_skill_loader', target: loaderPath, description: `${action} Skill "${skill.name}" → 重新生成 generated_skill_loader.il` });
  // Bootstrap 备份与写入
  try {
    if (fs.existsSync(bootstrapIlPath)) {
      steps.push({ type: 'backup', target: bootstrapIlPath, description: `备份 bootstrap.il（${action} ${skill.name} 前）`, backupTo: path.join(backupBase, 'bootstrap.il') });
    }
  } catch {}
  steps.push({ type: 'write_bootstrap', target: bootstrapIlPath, description: `更新 bootstrap.il（${action} ${skill.name} 后）` });
  // ilinit 备份与修改
  try {
    if (fs.existsSync(ilinitPath)) {
      steps.push({ type: 'backup', target: ilinitPath, description: `备份 allegro.ilinit（${action} ${skill.name} 前）`, backupTo: path.join(backupBase, 'allegro.ilinit') });
    }
  } catch {}
  steps.push({ type: 'modify_ilinit', target: ilinitPath, description: `确保 allegro.ilinit 包含 ATM bootstrap 加载指令` });
  warnings.push({ level: 'info', message: `${action} "${skill.name}" 后需要重启 Allegro 才能生效。` });
  return { id: `skill-toggle-${backupId}`, createdAt: new Date().toISOString(), summary: `${action} Skill: ${skill.name}`, steps, warnings, requiresRestart: true };
}
