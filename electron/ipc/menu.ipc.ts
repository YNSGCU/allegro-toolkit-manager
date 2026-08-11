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
 * - menu:export-profile     导出单个菜单方案包
 * - menu:open-import-profile 选择并预览菜单方案包
 * - menu:create-import-plan 生成菜单方案导入 Apply Plan
 * - menu:load               兼容旧版 — 加载菜单配置
 * - menu:save               兼容旧版 — 保存菜单配置
 * - menu:preview-il         兼容旧版 — 预览 IL
 * - menu:generate-plan      兼容旧版 — 生成 Apply Plan
 * - menu:check-bootstrap    检查 bootstrap 加载
 */
import { app, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { getAllegroTextEncoding, readAllegroTextFile } from '../../core/environment/allegroTextEncoding';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
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
  findMenuProfileRecovery,
  copyMenuProfileStoreFromEnvironment,
} from '../../core/menu/menuManager';
import { createApplyPlan, createBackupStep, executeApplyPlan } from '../../core/apply/applyPlanEngine';
import { generateBootstrapLines } from '../../core/generator/generateBootstrap';
import { insertBootstrapToIlinit } from '../../core/generator/generateManagedEnvBlock';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import { buildMenuCommandCatalog } from '../../core/menu/menuCommandCatalog';
import {
  MENU_PROFILE_PACKAGE_EXTENSION,
  createMenuProfilePackage,
  importMenuProfilePackage,
  parseMenuProfilePackage,
  previewMenuProfileImport,
  sanitizeMenuProfileFileName,
  serializeMenuProfilePackage,
} from '../../core/menu/menuProfileTransfer';
import type { ApplyPlan, ApplyPlanStepType } from '../../src/types/applyPlan';
import type { MenuProfile } from '../../src/types/menu';
import { consumeTrustedApplyPlan, registerTrustedApplyPlan } from './trustedApplyPlan';

const MAX_MENU_PROFILE_IMPORT_BYTES = 5 * 1024 * 1024;

function readMenuProfileImportFile(filePath: string): string {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('选择的路径不是文件');
  if (stat.size > MAX_MENU_PROFILE_IMPORT_BYTES) throw new Error('菜单方案文件超过 5 MB，拒绝导入');
  return fs.readFileSync(filePath, 'utf-8');
}

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
      const envInfo = locateEnvironment();
      const atmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      const store = loadMenuProfileStore(atmDir);
      const activeProfile = getActiveProfile(store);
      const recovery = findMenuProfileRecovery(atmDir, store);
      const currentPcbenv = path.normalize(envInfo.pcbenvPath || '').toLowerCase();
      const alternatives = loadEnvironmentRegistry().environments
        .filter(environment => path.normalize(environment.pcbenvPath).toLowerCase() !== currentPcbenv)
        .map(environment => {
          const alternativeAtmDir = path.join(environment.pcbenvPath, 'atm_generated');
          const alternativeStore = loadMenuProfileStore(alternativeAtmDir);
          const alternativeRecovery = findMenuProfileRecovery(alternativeAtmDir, alternativeStore);
          const profileItemCount = alternativeStore.profiles.reduce(
            (sum, profile) => sum + countMenuItems(profile.items || []).total,
            0,
          );
          return {
            id: environment.id,
            name: environment.name,
            version: environment.allegroVersion,
            pcbenvPath: environment.pcbenvPath,
            profileItemCount,
            recoveryItemCount: alternativeRecovery?.itemCount ?? 0,
            generatedMenuExists: fs.existsSync(getMenuIlPath(alternativeAtmDir)),
          };
        })
        .filter(item => item.profileItemCount > 0 || item.recoveryItemCount > 0 || item.generatedMenuExists);
      return {
        success: true,
        data: {
          store,
          activeProfile,
          atmGeneratedPath: atmDir,
          profilePath: getMenuProfilePath(atmDir),
          menuIlPath: getMenuIlPath(atmDir),
          recovery,
          alternatives,
          environment: {
            id: envInfo.environmentId,
            name: envInfo.allegroVersion ? `Allegro ${envInfo.allegroVersion}` : '当前 Allegro 环境',
            version: envInfo.allegroVersion,
            pcbenvPath: envInfo.pcbenvPath,
          },
        },
      };
    } catch (err) {
      return { success: false, error: `加载菜单方案失败: ${(err as Error).message}` };
    }
  });

  // 从 ATM 自身备份恢复丢失的菜单方案。只恢复 menu_profile.json；
  // 恢复后用户仍需审阅并应用，才会重新生成 generated_menu.il。
  ipcMain.handle('menu:create-recovery-plan', async () => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const currentStore = loadMenuProfileStore(atmDir);
      const recovery = findMenuProfileRecovery(atmDir, currentStore);
      if (!recovery) return { success: false, error: '没有可恢复的菜单方案备份' };
      const profilePath = getMenuProfilePath(atmDir);
      const backupDir = path.join(atmDir, 'backups');
      const backupEntry = fs.existsSync(profilePath) ? createBackupStep(profilePath, backupDir) : null;
      const plan = createApplyPlan({
        title: '恢复菜单方案备份',
        description: `从 ${path.basename(recovery.backupPath)} 恢复 ${recovery.profileCount} 个方案；恢复后需再次审阅应用菜单。`,
        module: 'menu',
        steps: [
          ...(backupEntry ? [backupEntry.step] : []),
          {
            type: 'update_json',
            title: '恢复 menu_profile.json',
            description: `恢复方案“${recovery.activeProfile.name}”（${recovery.itemCount} 个菜单项）`,
            targetFile: profilePath,
            after: JSON.stringify({ ...recovery.store, updatedAt: new Date().toISOString() }, null, 2),
          },
        ],
        backups: backupEntry ? [backupEntry.backup] : [],
        risks: [{
          id: 'menu-recovery-review',
          severity: 'info',
          title: '恢复后仍需审阅应用',
          description: '本次只恢复 ATM 菜单方案，不会立即替换 Allegro 当前菜单。',
        }],
        targetFiles: [profilePath],
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
      });
      return { success: true, data: registerTrustedApplyPlan(plan, 'menu') };
    } catch (err) {
      return { success: false, error: `生成菜单恢复计划失败: ${(err as Error).message}` };
    }
  });

  // 显式复制其他 Allegro 环境中的菜单源方案到当前环境。
  // 只复制 menu_profile.json 中的一个非空方案，不直接生成或加载 IL。
  ipcMain.handle('menu:create-environment-copy-plan', async (_event, sourceEnvironmentId: string) => {
    try {
      const envInfo = locateEnvironment();
      const registry = loadEnvironmentRegistry();
      const sourceEnvironment = registry.environments.find(item => item.id === sourceEnvironmentId);
      if (!sourceEnvironment) return { success: false, error: '未找到来源 Allegro 环境' };
      if (sourceEnvironment.id === envInfo.environmentId) {
        return { success: false, error: '来源环境与当前环境相同，无需复制' };
      }

      const sourceAtmDir = path.join(sourceEnvironment.pcbenvPath, 'atm_generated');
      const sourceStore = loadMenuProfileStore(sourceAtmDir);
      const targetAtmDir = envInfo.atmGeneratedPath || path.join(envInfo.pcbenvPath || '', 'atm_generated');
      const targetStore = loadMenuProfileStore(targetAtmDir);
      const copied = copyMenuProfileStoreFromEnvironment(targetStore, sourceStore, {
        id: sourceEnvironment.id,
        version: sourceEnvironment.allegroVersion,
        name: sourceEnvironment.name,
      });
      for (const profile of copied.store.profiles) {
        profile.items = rebuildMenuPaths(profile.items || []);
      }

      const profilePath = getMenuProfilePath(targetAtmDir);
      const backupDir = path.join(targetAtmDir, 'backups');
      const backupEntry = fs.existsSync(profilePath) ? createBackupStep(profilePath, backupDir) : null;
      const plan = createApplyPlan({
        title: `复制菜单方案到 ${envInfo.allegroVersion ? `Allegro ${envInfo.allegroVersion}` : '当前环境'}`,
        description: `从 ${sourceEnvironment.name} 复制“${copied.profile.name}”作为当前环境的新草稿，不会立即修改 Allegro 菜单。`,
        module: 'menu',
        steps: [
          ...(backupEntry ? [backupEntry.step] : []),
          {
            type: 'update_json',
            title: '复制菜单方案草稿',
            description: `写入 ${countMenuItems(copied.profile.items || []).total} 个菜单项`,
            targetFile: profilePath,
            after: JSON.stringify(copied.store, null, 2),
          },
        ],
        backups: backupEntry ? [backupEntry.backup] : [],
        risks: [{
          id: 'menu-cross-environment-review',
          severity: 'info',
          title: '复制后需要重新审阅应用',
          description: '本计划只复制 ATM 菜单草稿；目标版本的命令兼容性与脚本编码会在后续普通菜单 Apply Plan 中处理。',
        }],
        targetFiles: [profilePath],
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
      });
      return { success: true, data: registerTrustedApplyPlan(plan, 'menu') };
    } catch (err) {
      return { success: false, error: `生成跨环境菜单复制计划失败: ${(err as Error).message}` };
    }
  });

  // 导出当前单个菜单方案为便携 .atmmenu 文件。
  ipcMain.handle('menu:export-profile', async (_event, profileId: string) => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const store = loadMenuProfileStore(atmDir);
      const profile = store.profiles.find(item => item.id === profileId);
      if (!profile) return { success: false, error: '未找到要导出的菜单方案' };

      const profilePackage = createMenuProfilePackage(profile, {
        environmentName: envInfo.allegroVersion ? `Allegro ${envInfo.allegroVersion}` : '当前环境',
        allegroVersion: envInfo.allegroVersion ?? null,
      }, app.getVersion());
      const defaultName = `${sanitizeMenuProfileFileName(profile.name)}.${MENU_PROFILE_PACKAGE_EXTENSION}`;
      const result = await dialog.showSaveDialog({
        title: '导出菜单方案',
        defaultPath: defaultName,
        filters: [
          { name: 'ATM 菜单方案', extensions: [MENU_PROFILE_PACKAGE_EXTENSION] },
          { name: 'JSON 文件', extensions: ['json'] },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { success: true, data: null, info: '取消导出' };
      }

      fs.writeFileSync(result.filePath, serializeMenuProfilePackage(profilePackage), 'utf-8');
      return {
        success: true,
        data: {
          filePath: result.filePath,
          fileName: path.basename(result.filePath),
          itemCount: countMenuItems(profile.items || []).total,
        },
      };
    } catch (err) {
      return { success: false, error: `导出菜单方案失败: ${(err as Error).message}` };
    }
  });

  // 选择并解析菜单方案文件，只返回摘要，不写入当前环境。
  ipcMain.handle('menu:open-import-profile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: '导入菜单方案',
        properties: ['openFile'],
        filters: [
          { name: 'ATM 菜单方案', extensions: [MENU_PROFILE_PACKAGE_EXTENSION] },
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null, info: '取消选择' };
      }

      const filePath = result.filePaths[0];
      const parsed = parseMenuProfilePackage(readMenuProfileImportFile(filePath));
      const envInfo = locateEnvironment();
      const store = loadMenuProfileStore(getAtmDir());
      const preview = previewMenuProfileImport(store, parsed, {
        filePath,
        fileName: path.basename(filePath),
        targetEnvironmentId: envInfo.environmentId ?? null,
        targetAllegroVersion: envInfo.allegroVersion ?? null,
      });
      return { success: true, data: preview };
    } catch (err) {
      return { success: false, error: `读取菜单方案失败: ${(err as Error).message}` };
    }
  });

  // 重新读取所选文件并构造可信 Apply Plan。只合并为新草稿，不生成或加载菜单 IL。
  ipcMain.handle('menu:create-import-plan', async (_event, filePath: string) => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const store = loadMenuProfileStore(atmDir);
      const parsed = parseMenuProfilePackage(readMenuProfileImportFile(filePath));
      const imported = importMenuProfilePackage(store, parsed, {
        filePath,
        fileName: path.basename(filePath),
        targetEnvironmentId: envInfo.environmentId ?? null,
        targetAllegroVersion: envInfo.allegroVersion ?? null,
      });
      const profilePath = getMenuProfilePath(atmDir);
      const backupDir = path.join(atmDir, 'backups');
      const backupEntry = fs.existsSync(profilePath) ? createBackupStep(profilePath, backupDir) : null;
      const plan = createApplyPlan({
        title: `导入菜单方案“${imported.profile.name}”`,
        description: `从 ${path.basename(filePath)} 导入 ${imported.preview.itemCount} 个菜单项；导入后仅保存为草稿。`,
        module: 'menu',
        steps: [
          ...(backupEntry ? [backupEntry.step] : []),
          {
            type: 'update_json',
            title: '合并菜单方案',
            description: `新增方案“${imported.profile.name}”，不覆盖现有方案`,
            targetFile: profilePath,
            after: JSON.stringify(imported.store, null, 2),
          },
        ],
        backups: backupEntry ? [backupEntry.backup] : [],
        risks: [
          {
            id: 'menu-import-draft-only',
            severity: 'info',
            title: '导入后仅保存为草稿',
            description: '本计划不会生成 generated_menu.il，也不会立即改变 Allegro 菜单。',
          },
          ...imported.preview.warnings.map((warning, index) => ({
            id: `menu-import-warning-${index}`,
            severity: imported.preview.compatibilityWarningCount > 0 && warning.includes('英文兼容显示名')
              ? 'warning' as const
              : 'info' as const,
            title: '导入检查提示',
            description: warning,
          })),
        ],
        requiresRestart: false,
        targetFiles: [profilePath],
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
      });
      return { success: true, data: registerTrustedApplyPlan(plan, 'menu') };
    } catch (err) {
      return { success: false, error: `生成菜单导入计划失败: ${(err as Error).message}` };
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
      const envInfo = locateEnvironment();
      const profile = JSON.parse(profileJson);
      const ilContent = generateMenuIlContent(profile, {
        allegroVersion: envInfo.allegroVersion,
      });
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
      const allegroTextEncoding = getAllegroTextEncoding(envInfo.allegroVersion);
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
      const generationOptions = { allegroVersion: envInfo.allegroVersion };
      const steps = getMenuApplyPlanSteps(
        profilePath,
        menuIlPath,
        profile,
        currentStore,
        generationOptions,
      );
      const risks = getMenuApplyPlanRisks(profile, generationOptions);

      // 检查 bootstrap
      const bootstrapCheck = checkBootstrapMenuLoad(atmDir);
      const bootstrapRead = fs.existsSync(bootstrapPath)
        ? readAllegroTextFile(bootstrapPath, allegroTextEncoding)
        : { text: '', detectedEncoding: allegroTextEncoding };
      if (bootstrapCheck.needsUpdate
        || bootstrapRead.detectedEncoding !== allegroTextEncoding) {
        const currentBootstrap = bootstrapRead.text;
        const nextBootstrap = ensureBootstrapMenuLoad(currentBootstrap, atmDir);
        steps.push({
          type: 'ensure_bootstrap',
          title: '确保 ATM 启动脚本加载菜单',
          description: `在 bootstrap.il 中添加 generated_menu.il 加载行`,
          targetFile: bootstrapPath,
          after: nextBootstrap,
        });
      }

      const ilinitRead = fs.existsSync(ilinitPath)
        ? readAllegroTextFile(ilinitPath, allegroTextEncoding)
        : { text: '', detectedEncoding: allegroTextEncoding };
      const currentIlinit = ilinitRead.text;
      const bootstrapBlock = generateBootstrapLines(atmDir);
      const nextIlinit = insertBootstrapToIlinit(currentIlinit, bootstrapBlock);
      if (nextIlinit !== null || ilinitRead.detectedEncoding !== allegroTextEncoding) {
        steps.push({
          type: 'modify_ilinit',
          title: '配置 Allegro 启动加载',
          description: '在 allegro.ilinit 中加载 ATM bootstrap.il',
          targetFile: ilinitPath,
          after: nextIlinit ?? currentIlinit,
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
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
        allegroTextEncoding,
      });

      return { success: true, data: registerTrustedApplyPlan(plan, 'menu') };
    } catch (err) {
      return { success: false, error: `生成菜单 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  // ═══════════════════════════════════════════════════
  // 执行菜单 Apply Plan（禁止借用快捷键专用执行器）
  // ═══════════════════════════════════════════════════
  ipcMain.handle('menu:execute-apply-plan', async (_event, planJson: string) => {
    try {
      const plan: ApplyPlan = consumeTrustedApplyPlan(planJson, 'menu', 'menu');
      if (plan.module !== 'menu') {
        return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: '拒绝执行非菜单 Apply Plan' };
      }
      const envInfo = locateEnvironment();
      if (plan.environmentId && plan.environmentId !== envInfo.environmentId) return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: '当前 Allegro 环境已变化，请重新生成 Apply Plan' };
      if (plan.environmentPcbenvPath && path.normalize(plan.environmentPcbenvPath).toLowerCase() !== path.normalize(envInfo.pcbenvPath || '').toLowerCase()) return { success: false, appliedSteps: 0, totalSteps: plan.steps?.length || 0, error: 'Apply Plan 目标 pcbenv 已变化，请重新生成计划' };
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
      const profileCount = store.profiles.reduce(
        (sum: number, profile: MenuProfile) => sum + countMenuItems(profile.items || []).total,
        0,
      );
      const recovery = findMenuProfileRecovery(atmDir, store);
      return {
        success: true,
        data: {
          ...fileStatus,
          profileItemCount: profileCount,
          hasMenuItems: profileCount > 0,
          recoveryAvailable: Boolean(recovery),
          generatedMenuStale: fileStatus.ilExists && profileCount === 0,
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
      const envInfo = locateEnvironment();
      const created = updated.profiles[updated.profiles.length - 1];
      if (created) {
        created.sourceEnvironmentId = envInfo.environmentId ?? null;
        created.sourceAllegroVersion = envInfo.allegroVersion ?? null;
        created.testedAllegroVersions = envInfo.allegroVersion ? [envInfo.allegroVersion] : [];
      }
      if (!saveMenuProfileStore(atmDir, updated)) throw new Error('menu_profile.json 写入失败');
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
      if (!saveMenuProfileStore(atmDir, updated)) throw new Error('menu_profile.json 写入失败');
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
      if (!saveMenuProfileStore(atmDir, updated)) throw new Error('menu_profile.json 写入失败');
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
      if (!saveMenuProfileStore(atmDir, updated)) throw new Error('menu_profile.json 写入失败');
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
      if (!saveMenuProfileStore(atmDir, updated)) throw new Error('menu_profile.json 写入失败');
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
      const envInfo = locateEnvironment();
      const allegroTextEncoding = getAllegroTextEncoding(envInfo.allegroVersion);
      const atmDir = getAtmDir();
      const profilePath = path.join(atmDir, 'menu_profile.json');
      const menuIlPath = path.join(atmDir, 'generated_menu.il');

      const store = loadMenuProfileStore(atmDir);
      const steps = getMenuApplyPlanSteps(
        profilePath,
        menuIlPath,
        getActiveProfile(store)!,
        store,
        { allegroVersion: envInfo.allegroVersion },
      );
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
        environmentId: envInfo.environmentId ?? null,
        environmentPcbenvPath: envInfo.pcbenvPath,
        allegroTextEncoding,
      });

      return { success: true, data: registerTrustedApplyPlan(plan, 'menu') };
    } catch (err) {
      return { success: false, error: `生成菜单 Apply Plan 失败: ${(err as Error).message}` };
    }
  });

  /**
   * 预览 generated_menu.il（旧版兼容）
   */
  ipcMain.handle('menu:preview-il', async () => {
    try {
      const envInfo = locateEnvironment();
      const atmDir = getAtmDir();
      const store = loadMenuProfileStore(atmDir);
      const profile = getActiveProfile(store);
      const ilContent = profile
        ? generateMenuIlContent(profile, { allegroVersion: envInfo.allegroVersion })
        : ';; 暂无菜单配置';
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
