/**
 * ATM - 菜单管理 IPC 处理器（V5.5 可视化菜单编辑）
 *
 * IPC 通道：
 * - menu:load-profiles      加载所有菜单方案
 * - menu:save-draft         保存草稿到 menu_profile.json
 * - menu:validate           执行菜单引用检查
 * - menu:generate-preview   预览 generated_menu.il
 * - menu:create-apply-plan  生成 Apply Plan
 * - menu:execute-apply-plan 执行菜单 Apply Plan
 * - menu:load               兼容旧版 — 加载菜单配置
 * - menu:save               兼容旧版 — 保存菜单配置
 * - menu:preview-il         兼容旧版 — 预览 IL
 * - menu:generate-plan      兼容旧版 — 生成 Apply Plan
 * - menu:check-bootstrap    检查 bootstrap 加载
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import {
  loadMenuProfileStore,
  saveMenuProfileStore,
  getActiveProfile,
  loadMenuProfile,
  saveMenuProfile,
  generateMenuIlContent,
  getMenuApplyPlanSteps,
  getMenuApplyPlanRisks,
  getMenuProfilePath,
  getMenuIlPath,
  getBootstrapPath,
  checkBootstrapMenuLoad,
  ensureBootstrapMenuLoad,
  countMenuItems,
  rebuildMenuPaths,
} from '../../core/menu/menuManager';
import { createApplyPlan, createBackupStep, executeApplyPlan } from '../../core/apply/applyPlanEngine';
import { generateBootstrapLines } from '../../core/generator/generateBootstrap';
import { insertBootstrapToIlinit } from '../../core/generator/generateManagedEnvBlock';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import { buildMenuCommandCatalog } from '../../core/menu/menuCommandCatalog';
import type { ApplyPlan, ApplyPlanStepType } from '../../src/types/applyPlan';

/** 获取 atm_generated 目录路径 */
function getAtmDir(): string {
  const envInfo = locateEnvironment();
  return envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
}

async function scanMenuSkills() {
  const envInfo = locateEnvironment();
  const companySkillPaths = [process.env.CDS_SITE, ...(process.env.SKILL_PATH || '').split(/[;,]/)]
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value));
  return scanEnhancedSkills({ ...envInfo, companySkillPaths });
}

export function registerMenuIpc(): void {
  // ═══════════════════════════════════════════════════
  // 加载所有菜单方案（V5.5 新版）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:load-profiles', async () => {
    try {
      const atmDir = getAtmDir();
      const store = loadMenuProfileStore(atmDir);
      const activeProfile = getActiveProfile(store);
      return {
        success: true,
        data: {
          store,
          activeProfile,
          atmGeneratedPath: atmDir,
          profilePath: getMenuProfilePath(atmDir),
          menuIlPath: getMenuIlPath(atmDir),
        },
      };
    } catch (err) {
      return { success: false, error: `加载菜单方案失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 保存草稿（V5.5 新版 — 不走 Apply Plan）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:save-draft', async (_event, storeJson: string) => {
    try {
      const atmDir = getAtmDir();
      const store = JSON.parse(storeJson);
      // 重建路径和顺序
      for (const profile of store.profiles) {
        profile.items = rebuildMenuPaths(profile.items);
      }
      const saved = saveMenuProfileStore(atmDir, store);
      return { success: saved, data: { saved } };
    } catch (err) {
      return { success: false, error: `保存菜单草稿失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 验证菜单（V5.5 新版）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:validate', async (_event, itemsJson: string, commandsJson: string, skillsJson: string) => {
    try {
      const { validateProfile, commandToRef, skillToRef } = require('../../core/menu/menuValidator');
      const items = JSON.parse(itemsJson);
      const commands = JSON.parse(commandsJson || '[]').map((c: any) =>
        commandToRef(c.commandName, c.sourceSkillId, c.sourceSkillName, c.sourceSkillFile, c.isLoaded),
      );
      const skills = JSON.parse(skillsJson || '[]').map((s: any) =>
        skillToRef(s.id, s.name, s.file, s.isEnabled, s.isLoaded),
      );

      // 构造一个临时 profile 来验证
      const profile = {
        id: 'validate',
        name: '验证',
        enabled: true,
        items,
        createdAt: '',
        updatedAt: '',
      };
      const issues = validateProfile(profile, commands, skills);
      return { success: true, data: { issues, items: profile.items } };
    } catch (err) {
      return { success: false, error: `验证菜单失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 预览 generated_menu.il（V5.5 新版）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:generate-preview', async (_event, profileJson: string) => {
    try {
      const profile = JSON.parse(profileJson);
      const ilContent = generateMenuIlContent(profile);
      const counts = countMenuItems(profile.items || []);
      return {
        success: true,
        data: {
          ilContent,
          profileJson: JSON.stringify(profile, null, 2),
          itemCount: counts,
        },
      };
    } catch (err) {
      return { success: false, error: `预览菜单 IL 失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 生成 Apply Plan（V5.5 新版）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:create-apply-plan', async (_event, profileJson: string, storeJson?: string) => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const profile = JSON.parse(profileJson);
      const currentStore = storeJson
        ? JSON.parse(storeJson)
        : loadMenuProfileStore(atmDir);
      const profilePath = getMenuProfilePath(atmDir);
      const menuIlPath = getMenuIlPath(atmDir);
      const bootstrapPath = getBootstrapPath(atmDir);
      const ilinitPath = envInfo.ilinitFilePath || path.join(envInfo.pcbenvPath || '', 'allegro.ilinit');

      // 重建路径
      profile.items = rebuildMenuPaths(profile.items);
      const profileIndex = currentStore.profiles.findIndex((item: { id: string }) => item.id === profile.id);
      if (profileIndex >= 0) currentStore.profiles[profileIndex] = profile;
      else currentStore.profiles.push(profile);
      currentStore.activeProfileId = profile.id;
      currentStore.updatedAt = new Date().toISOString();

      // 生成步骤
      const steps = getMenuApplyPlanSteps(profilePath, menuIlPath, profile, currentStore);
      const risks = getMenuApplyPlanRisks(profile);

      // 检查 bootstrap
      const bootstrapCheck = checkBootstrapMenuLoad(atmDir);
      if (bootstrapCheck.needsUpdate) {
        const currentBootstrap = fs.existsSync(bootstrapPath)
          ? fs.readFileSync(bootstrapPath, { encoding: 'utf-8' })
          : '';
        const nextBootstrap = ensureBootstrapMenuLoad(currentBootstrap, atmDir);
        steps.push({
          type: 'ensure_bootstrap',
          title: '确保 ATM 启动脚本加载菜单',
          description: `在 bootstrap.il 中添加 generated_menu.il 加载行`,
          targetFile: bootstrapPath,
          after: nextBootstrap,
        });
      }

      const currentIlinit = fs.existsSync(ilinitPath)
        ? fs.readFileSync(ilinitPath, { encoding: 'utf-8' })
        : '';
      const bootstrapBlock = generateBootstrapLines(atmDir);
      const nextIlinit = insertBootstrapToIlinit(currentIlinit, bootstrapBlock);
      if (nextIlinit !== null) {
        steps.push({
          type: 'modify_ilinit',
          title: '配置 Allegro 启动加载',
          description: '在 allegro.ilinit 中加载 ATM bootstrap.il',
          targetFile: ilinitPath,
          after: nextIlinit,
        });
      }

      // 所有即将被覆盖的现有文件都先进入备份步骤
      const backupDir = path.join(atmDir, 'backups');
      const backupTargets = [profilePath, menuIlPath, bootstrapPath, ilinitPath]
        .filter(target => fs.existsSync(target));
      const backupEntries = backupTargets.map(target => createBackupStep(target, backupDir));

      const plan = createApplyPlan({
        title: '应用菜单修改',
        module: 'menu',
        steps: [
          ...backupEntries.map(entry => entry.step),
          ...steps.map((s) => ({
            type: s.type,
            title: s.title,
            description: s.description,
            targetFile: s.targetFile,
            before: s.before,
            after: s.after,
          })),
        ],
        risks: risks.map((r, idx) => ({
          id: `risk_${Date.now()}_${idx}`,
          severity: r.severity,
          title: r.title,
          description: r.description,
        })),
        backups: backupEntries.map(entry => entry.backup),
        requiresRestart: true,
        targetFiles: [profilePath, menuIlPath, bootstrapPath, ilinitPath],
      });

      return { success: true, data: plan };
    } catch (err) {
      return { success: false, error: `生成菜单 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 执行菜单 Apply Plan（禁止借用快捷键专用执行器）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:execute-apply-plan', async (_event, planJson: string) => {
    try {
      const plan: ApplyPlan = JSON.parse(planJson);
      if (plan.module !== 'menu') {
        return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: '拒绝执行非菜单 Apply Plan' };
      }
      const atmDir = getAtmDir();
      return await executeApplyPlan(plan, {
        backupDir: path.join(atmDir, 'backups'),
        historyDir: path.join(atmDir, 'history'),
      });
    } catch (err) {
      return { success: false, appliedSteps: 0, totalSteps: 0, error: `执行菜单 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 获取命令列表（给命令选择器用）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:get-linked-commands', async () => {
    try {
      let skills: Awaited<ReturnType<typeof scanMenuSkills>>['all'] = [];
      try {
        skills = (await scanMenuSkills()).all;
      } catch {
        // Skill 扫描失败时仍返回 Allegro 内置命令，选择器不能退化为 0 条。
      }
      const commands = buildMenuCommandCatalog(skills);
      return { success: true, data: commands };
    } catch (err) {
      return { success: false, error: `获取命令列表失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 获取 Skill 信息（给联动显示用）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:get-linked-skills', async () => {
    try {
      const skills = (await scanMenuSkills()).all;
      return { success: true, data: skills };
    } catch (err) {
      return { success: false, error: `获取 Skill 信息失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 检查菜单文件状态（V5.5）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:check-status', async () => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const { checkMenuFileStatus, loadMenuProfileStore } = require('../../core/menu/menuManager');
      const fileStatus = checkMenuFileStatus(atmDir, envInfo.pcbenvPath || '');
      const store = loadMenuProfileStore(atmDir);
      const profileCount = store.profiles.reduce((sum: number, p: any) => sum + (p.items?.length || 0), 0);
      return {
        success: true,
        data: {
          ...fileStatus,
          profileItemCount: profileCount,
          hasMenuItems: profileCount > 0,
        },
      };
    } catch (err) {
      return { success: false, error: `检查菜单状态失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 从 CommandIndex 生成推荐菜单（V5.5）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:recommend-from-commands', async (_event, commandsJson: string, optionsJson: string) => {
    try {
      const { generateRecommendedMenu } = require('../../core/menu/menuManager');
      const commands = JSON.parse(commandsJson || '[]');
      const options = JSON.parse(optionsJson || '{}');
      const menuItems = generateRecommendedMenu(commands, options);
      return { success: true, data: menuItems };
    } catch (err) {
      return { success: false, error: `生成推荐菜单失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 菜单方案 CRUD（V5.5）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:profile-create', async (_event, name: string, description?: string) => {
    try {
      const atmDir = getAtmDir();
      const { loadMenuProfileStore, saveMenuProfileStore, createProfile } = require('../../core/menu/menuManager');
      const store = loadMenuProfileStore(atmDir);
      const updated = createProfile(store, name, description);
      saveMenuProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `新建菜单方案失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('menu:profile-copy', async (_event, profileId: string, newName?: string) => {
    try {
      const atmDir = getAtmDir();
      const { loadMenuProfileStore, saveMenuProfileStore, copyProfile } = require('../../core/menu/menuManager');
      const store = loadMenuProfileStore(atmDir);
      const updated = copyProfile(store, profileId, newName);
      saveMenuProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `复制菜单方案失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('menu:profile-rename', async (_event, profileId: string, newName: string) => {
    try {
      const atmDir = getAtmDir();
      const { loadMenuProfileStore, saveMenuProfileStore, renameProfile } = require('../../core/menu/menuManager');
      const store = loadMenuProfileStore(atmDir);
      const updated = renameProfile(store, profileId, newName);
      saveMenuProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `重命名菜单方案失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('menu:profile-delete', async (_event, profileId: string) => {
    try {
      const atmDir = getAtmDir();
      const { loadMenuProfileStore, saveMenuProfileStore, deleteProfile } = require('../../core/menu/menuManager');
      const store = loadMenuProfileStore(atmDir);
      const updated = deleteProfile(store, profileId);
      saveMenuProfileStore(atmDir, updated);
      return { success: true, data: { store: updated } };
    } catch (err) {
      return { success: false, error: `删除菜单方案失败: ${(err as Error).message}` };
    }
  });

  ipcMain.handle('menu:profile-set-active', async (_event, profileId: string) => {
    try {
      const atmDir = getAtmDir();
      const { loadMenuProfileStore, saveMenuProfileStore, setActiveProfile, getActiveProfile, rebuildMenuPaths } = require('../../core/menu/menuManager');
      const store = loadMenuProfileStore(atmDir);
      const updated = setActiveProfile(store, profileId);
      // 重建路径
      for (const p of updated.profiles) {
        p.items = rebuildMenuPaths(p.items);
      }
      saveMenuProfileStore(atmDir, updated);
      const active = getActiveProfile(updated);
      return { success: true, data: { store: updated, activeProfile: active } };
    } catch (err) {
      return { success: false, error: `切换菜单方案失败: ${(err as Error).message}` };
    }
  });

  // ═════════════════════════════════════════════════════════
  // 兼容旧版 API
  // ═════════════════════════════════════════════════════════

  /**
   * 加载菜单配置（旧版兼容）
   */
  ipcMain.handle('menu:load', async () => {
    try {
      const atmDir = getAtmDir();
      const profilePath = path.join(atmDir, 'menu_profile.json');
      const profile = loadMenuProfile(profilePath);
      return { success: true, data: profile };
    } catch (err) {
      return { success: false, error: `加载菜单配置失败: ${(err as Error).message}` };
    }
  });

  /**
   * 保存菜单配置（旧版兼容 — 不走 Apply Plan）
   */
  ipcMain.handle('menu:save', async (_event, menusJson: string) => {
    try {
      const atmDir = getAtmDir();
      const profilePath = path.join(atmDir, 'menu_profile.json');
      const menus = JSON.parse(menusJson);
      const saved = saveMenuProfile(profilePath, {
        profileVersion: '1.0',
        updatedAt: new Date().toISOString(),
        menus,
      });
      return { success: saved };
    } catch (err) {
      return { success: false, error: `保存菜单配置失败: ${(err as Error).message}` };
    }
  });

  /**
   * 生成 Apply Plan（旧版兼容）
   */
  ipcMain.handle('menu:generate-plan', async () => {
    try {
      const atmDir = getAtmDir();
      const profilePath = path.join(atmDir, 'menu_profile.json');
      const menuIlPath = path.join(atmDir, 'generated_menu.il');

      const store = loadMenuProfileStore(atmDir);
      const steps = getMenuApplyPlanSteps(profilePath, menuIlPath, getActiveProfile(store)!, store);
      const plan = createApplyPlan({
        title: '更新菜单配置',
        module: 'menu',
        steps: steps.map((s) => ({
          type: s.type,
          title: s.title,
          description: s.description,
          targetFile: s.targetFile,
          after: s.after,
        })),
        requiresRestart: true,
        targetFiles: [profilePath, menuIlPath],
      });

      return { success: true, data: plan };
    } catch (err) {
      return { success: false, error: `生成菜单 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  /**
   * 预览 generated_menu.il（旧版兼容）
   */
  ipcMain.handle('menu:preview-il', async () => {
    try {
      const atmDir = getAtmDir();
      const store = loadMenuProfileStore(atmDir);
      const profile = getActiveProfile(store);
      const ilContent = profile ? generateMenuIlContent(profile) : ';; 暂无菜单配置';
      return { success: true, data: ilContent };
    } catch (err) {
      return { success: false, error: `预览菜单 IL 失败: ${(err as Error).message}` };
    }
  });

  /**
   * 检查 bootstrap 加载
   */
  ipcMain.handle('menu:check-bootstrap', async () => {
    try {
      const atmDir = getAtmDir();
      const result = checkBootstrapMenuLoad(atmDir);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `检查 bootstrap 失败: ${(err as Error).message}` };
    }
  });
}
