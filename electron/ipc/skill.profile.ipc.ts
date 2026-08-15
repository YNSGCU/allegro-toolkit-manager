/**
 * ATM - Skill Profile IPC 处理器（V5.5）
 */
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
import { checkSkillProfileCompatibility } from '../../core/environment/compatibility';
import { getAllegroTextEncoding, readAllegroTextFile } from '../../core/environment/allegroTextEncoding';
import { createApplyPlan, createBackupStep, executeApplyPlan } from '../../core/apply/applyPlanEngine';
import { generateBootstrapIlContent, generateBootstrapLines, insertBootstrapToIlinit } from '../../core/generator/generateBootstrap';
import type { ApplyPlan } from '../../src/types/applyPlan';
import type { SkillProfile } from '../../src/types/skillProfile';
import { generateSkillProfileId } from '../../src/types/skillProfile';
import { consumeTrustedApplyPlan, registerTrustedApplyPlan } from './trustedApplyPlan';
import {
  loadSkillProfileStore,
  saveSkillProfileStore,
  getActiveSkillProfile,
  listSkillProfiles,
  setActiveSkillProfile,
  createSkillProfile,
  copySkillProfile,
  renameSkillProfile,
  deleteSkillProfile,
  buildSkillProfileFromScan,
  computeSkillProfileDiff,
  generateSkillProfileLoader,
} from '../../core/skill/skillProfileManager';

function getAtmDir(): string {
  const envInfo = locateEnvironment();
  return envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
}

export function registerSkillProfileIpc(): void {
  // 加载所有 Skill 方案
  ipcMain.handle('skill-profile:load-all', async () => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const active = getActiveSkillProfile(store);
      return { success: true, data: { store, activeProfile: active, atmGeneratedPath: atmDir } };
    } catch (err) {
      return { success: false, error: `加载 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 保存草稿
  ipcMain.handle('skill-profile:save-draft', async (_event, storeJson: string) => {
    try {
      const atmDir = getAtmDir();
      const store = JSON.parse(storeJson);
      const saved = saveSkillProfileStore(atmDir, store);
      return { success: saved, data: { saved } };
    } catch (err) {
      return { success: false, error: `保存 Skill 方案草稿失败: ${(err as Error).message}` };
    }
  });

  // 新建方案
  ipcMain.handle('skill-profile:create', async (_event, name: string, description?: string) => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const updated = createSkillProfile(store, name, description);
      const envInfo = locateEnvironment();
      const created = updated.profiles[updated.profiles.length - 1];
      if (created) {
        created.sourceEnvironmentId = envInfo.environmentId ?? null;
        created.sourceAllegroVersion = envInfo.allegroVersion ?? null;
        created.testedAllegroVersions = envInfo.allegroVersion ? [envInfo.allegroVersion] : [];
      }
      saveSkillProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `新建 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 复制方案
  ipcMain.handle('skill-profile:copy', async (_event, profileId: string, newName?: string) => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const updated = copySkillProfile(store, profileId, newName);
      saveSkillProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `复制 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 重命名方案
  ipcMain.handle('skill-profile:rename', async (_event, profileId: string, newName: string) => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const updated = renameSkillProfile(store, profileId, newName);
      saveSkillProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `重命名 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 删除方案
  ipcMain.handle('skill-profile:delete', async (_event, profileId: string) => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const updated = deleteSkillProfile(store, profileId);
      saveSkillProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `删除 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 设置活动方案
  ipcMain.handle('skill-profile:set-active', async (_event, profileId: string) => {
    try {
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const updated = setActiveSkillProfile(store, profileId);
      saveSkillProfileStore(atmDir, updated);
      const active = getActiveSkillProfile(updated);
      return { success: true, data: { store: updated, activeProfile: active } };
    } catch (err) {
      return { success: false, error: `切换 Skill 方案失败: ${(err as Error).message}` };
    }
  });

  // 构建 Profile 快照
  ipcMain.handle('skill-profile:build-snapshot', async (_event, skillsJson: string, loadOrderJson: string, profileId: string) => {
    try {
      const skills = JSON.parse(skillsJson);
      const loadOrder = JSON.parse(loadOrderJson);
      const items = buildSkillProfileFromScan(skills, loadOrder);
      const atmDir = getAtmDir();
      const store = loadSkillProfileStore(atmDir);
      const target = store.profiles.find(p => p.id === profileId) || store.profiles[0];
      if (target) {
        target.skillStates = items;
        target.loadOrder = loadOrder;
        target.updatedAt = new Date().toISOString();
        saveSkillProfileStore(atmDir, store);
      }
      return { success: true, data: { store, items } };
    } catch (err) {
      return { success: false, error: `构建 Skill 快照失败: ${(err as Error).message}` };
    }
  });

  // 计算差异
  ipcMain.handle('skill-profile:compute-diff', async (
    _event,
    currentProfileJson: string,
    targetProfileJson: string,
    hotkeyRefsJson?: string,
    menuRefsJson?: string,
  ) => {
    try {
      const current = JSON.parse(currentProfileJson);
      const target = JSON.parse(targetProfileJson);
      const hotkeyRefs = hotkeyRefsJson ? JSON.parse(hotkeyRefsJson) : undefined;
      const menuRefs = menuRefsJson ? JSON.parse(menuRefsJson) : undefined;
      const diff = computeSkillProfileDiff(current, target, hotkeyRefs, menuRefs);
      return { success: true, data: diff };
    } catch (err) {
      return { success: false, error: `计算 Skill 方案差异失败: ${(err as Error).message}` };
    }
  });

  // 生成 Apply Plan
  ipcMain.handle('skill-profile:create-apply-plan', async (_event, profileJson: string) => {
    try {
      const envInfo = locateEnvironment();
      const allegroTextEncoding = getAllegroTextEncoding(envInfo.allegroVersion);
      const atmDir = getAtmDir();
      const profile: SkillProfile = JSON.parse(profileJson);
      const profilePath = path.join(atmDir, 'skill_profiles.json');
      const loaderIlPath = path.join(atmDir, 'generated_skill_loader.il');
      const bootstrapPath = path.join(atmDir, 'bootstrap.il');
      const ilinitPath = envInfo.ilinitFilePath || (envInfo.pcbenvPath ? path.join(envInfo.pcbenvPath, 'allegro.ilinit') : null);

      const store = loadSkillProfileStore(atmDir);
      const profileIndex = store.profiles.findIndex(item => item.id === profile.id);
      if (profileIndex >= 0) store.profiles[profileIndex] = profile;
      else store.profiles.push(profile);
      store.activeProfileId = profile.id;
      store.updatedAt = new Date().toISOString();

      const steps: Array<{
        type: 'update_json' | 'write_file' | 'ensure_bootstrap' | 'modify_ilinit';
        title: string;
        description: string;
        targetFile: string;
        after: string;
      }> = [
        {
          type: 'update_json',
          title: '更新 Skill 方案配置',
          description: `保存并激活方案“${profile.name}”`,
          targetFile: profilePath,
          after: JSON.stringify(store, null, 2),
        },
        {
          type: 'write_file',
          title: '更新 Skill 加载器',
          description: `按方案生成 ${profile.skillStates.filter(item => item.enabled && item.loadEnabled).length} 个加载项`,
          targetFile: loaderIlPath,
          after: generateSkillProfileLoader(profile),
        },
      ];

      const loaderLine = `load("${loaderIlPath.replace(/\\/g, '/')}")`;
      const bootstrapRead = fs.existsSync(bootstrapPath)
        ? readAllegroTextFile(bootstrapPath, allegroTextEncoding)
        : { text: '', detectedEncoding: allegroTextEncoding };
      const currentBootstrap = bootstrapRead.text;
      if (!currentBootstrap.includes('generated_skill_loader.il')
        || bootstrapRead.detectedEncoding !== allegroTextEncoding) {
        steps.push({
          type: 'ensure_bootstrap',
          title: '确保 ATM 启动脚本加载 Skill',
          description: '在 bootstrap.il 中加入 Skill 加载器引用',
          targetFile: bootstrapPath,
          after: currentBootstrap.trim()
            ? `${currentBootstrap.replace(/\s*$/, '')}\n\n${loaderLine}\n`
            : generateBootstrapIlContent(atmDir),
        });
      }

      if (ilinitPath) {
        const ilinitRead = fs.existsSync(ilinitPath)
          ? readAllegroTextFile(ilinitPath, allegroTextEncoding)
          : { text: '', detectedEncoding: allegroTextEncoding };
        const currentIlinit = ilinitRead.text;
        const nextIlinit = insertBootstrapToIlinit(currentIlinit, generateBootstrapLines(atmDir));
        if (nextIlinit !== null || ilinitRead.detectedEncoding !== allegroTextEncoding) {
          steps.push({
            type: 'modify_ilinit',
            title: '配置 Allegro 启动加载',
            description: '在 allegro.ilinit 中加载 ATM bootstrap.il',
            targetFile: ilinitPath,
            after: nextIlinit ?? currentIlinit,
          });
        }
      }

      const backupDir = path.join(atmDir, 'backups');
      const backupTargets = [...new Set(steps.map(step => step.targetFile))]
        .filter(target => fs.existsSync(target));
      const backupEntries = backupTargets.map(target => createBackupStep(target, backupDir));
      const plan = createApplyPlan({
        title: '应用 Skill 方案',
        description: `应用“${profile.name}”并更新 Skill 加载链`,
        module: 'skill',
        steps: [
          ...backupEntries.map(entry => entry.step),
          ...steps,
        ],
        backups: backupEntries.map(entry => entry.backup),
        requiresRestart: true,
        targetFiles: [...new Set(steps.map(step => step.targetFile))],
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
        allegroTextEncoding,
      });
      return { success: true, data: registerTrustedApplyPlan(plan, 'skill-profile') };
    } catch (err) {
      return { success: false, error: `生成 Skill 方案 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('skill-profile:execute-apply-plan', async (_event, planJson: string) => {
    try {
      const plan: ApplyPlan = consumeTrustedApplyPlan(planJson, 'skill-profile', 'skill');
      const envInfo = locateEnvironment();
      if (plan.environmentId && plan.environmentId !== envInfo.environmentId) return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: '当前 Allegro 环境已变化，请重新生成 Apply Plan' };
      if (plan.environmentPcbenvPath && path.normalize(plan.environmentPcbenvPath).toLowerCase() !== path.normalize(envInfo.pcbenvPath || '').toLowerCase()) return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: 'Apply Plan 目标 pcbenv 已变化，请重新生成计划' };
      if (plan.module !== 'skill') {
        return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: '拒绝执行非 Skill Apply Plan' };
      }
      const atmDir = getAtmDir();
      return await executeApplyPlan(plan, {
        backupDir: path.join(atmDir, 'backups'),
        historyDir: path.join(atmDir, 'history'),
      });
    } catch (err) {
      return { success: false, appliedSteps: 0, totalSteps: 0, error: `执行 Skill 方案 Apply Plan 失败: ${(err as Error).message}` };
    }
  });
  ipcMain.handle('skill-profile:check-compatibility', (_event, profileId: string, targetEnvironmentId: string) => {
    try {
      const store = loadSkillProfileStore(getAtmDir());
      const profile = store.profiles.find((p) => p.id === profileId);
      const registry = loadEnvironmentRegistry();
      const target = registry.environments.find((item) => item.id === targetEnvironmentId);
      if (!profile || !target) return { success: false, error: '来源方案或目标环境不存在' };
      return { success: true, data: checkSkillProfileCompatibility(profile, target) };
    } catch (err) {
      return { success: false, error: `Skill 兼容性检查失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('skill-profile:migrate', (_event, profileId: string, targetEnvironmentId: string) => {
    try {
      const envInfo = locateEnvironment();
      const store = loadSkillProfileStore(getAtmDir());
      const profile = store.profiles.find((p) => p.id === profileId);
      const registry = loadEnvironmentRegistry();
      const target = registry.environments.find((item) => item.id === targetEnvironmentId);
      if (!profile || !target) return { success: false, error: '来源方案或目标环境不存在' };
      const report = checkSkillProfileCompatibility(profile, target);
      if (report.verdict === 'blocked') return { success: false, error: '兼容性预检发现阻断项，请先处理绝对路径等问题', data: report };
      const sourcePcbenv = (envInfo.pcbenvPath || '').toLowerCase();
      const targetPcbenv = (target.pcbenvPath || '').toLowerCase();
      if (targetPcbenv && targetPcbenv === sourcePcbenv) {
        return { success: true, data: { profile, report, sharedPcbenv: true } };
      }
      const targetAtmDir = path.join(target.pcbenvPath || '', 'atm_generated');
      const targetStore = loadSkillProfileStore(targetAtmDir);
      const now = new Date().toISOString();
      const migrated: SkillProfile = {
        ...JSON.parse(JSON.stringify(profile)),
        id: generateSkillProfileId(),
        name: `${profile.name}（迁移）`,
        description: `从 Allegro ${profile.sourceAllegroVersion || envInfo.allegroVersion || '未知版本'} 迁移`,
        createdAt: now,
        updatedAt: now,
        sourceEnvironmentId: profile.sourceEnvironmentId || envInfo.environmentId || null,
        sourceAllegroVersion: profile.sourceAllegroVersion || envInfo.allegroVersion || null,
        targetCompatibility: {
          intendedEnvironmentId: target.id,
          intendedAllegroVersion: target.allegroVersion,
          lastCheckedAt: now,
          lastVerdict: report.verdict,
        },
      };
      targetStore.profiles.push(migrated);
      const saved = saveSkillProfileStore(targetAtmDir, targetStore);
      return saved
        ? { success: true, data: { profile: migrated, report, sharedPcbenv: false } }
        : { success: false, error: '无法在目标环境创建方案' };
    } catch (err) {
      return { success: false, error: `迁移 Skill 方案失败: ${(err as Error).message}` };
    }
  });
}
