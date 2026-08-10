/**
 * ATM - 快捷键管理 IPC 处理器（V1.5）
 * 集成：冲突检测 + 命令分类 + Profile 管理 + 编辑校验 + 保留键
 */
import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { parseEnvFile } from '../../core/parser/parseEnv';
import { validateHotkeys } from '../../core/validator/validateHotkeys';
import { createBackup } from '../../core/backup/createBackup';
import { createApplyPlan, type PlanAction } from '../../core/apply/createApplyPlan';
import { applyChanges } from '../../core/apply/applyChanges';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { getAllegroTextEncoding, readAllegroTextFile } from '../../core/environment/allegroTextEncoding';
import { checkHotkeyProfileCompatibility } from '../../core/environment/compatibility';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
import { validateSkillReferences } from '../../core/validator/validateSkillRefs';
import { scanAllSkills } from '../../core/skill/scanSkill';
import { buildCommandRegistry } from '../../core/skill/commandRegistry';
import { classifyCommand, isSoftwareDefaultKey } from '../../core/validator/commandClassifier';
import { createDictionary } from '../../core/dictionary/commandDictionary';
import { loadUserOverrides, getOverrideFilePath } from '../../core/dictionary/userCommandOverrides';
import {
  loadAllProfiles, loadProfile, saveProfile, createProfile,
  copyProfile, deleteProfile, renameProfile,
  exportProfileToJson, importProfileFromJson,
  diffProfiles, getOrCreateDefaultProfile,
  bindingToProfileBinding, getProfilesDir, getProfileFilePath,
} from '../../core/profile/hotkeyProfile';
import type { ApplyPlan, HotkeyBinding, HotkeyEditValidation, ProfileDiff } from '../../src/types/hotkey';
import type { CommandRegistry } from '../../src/types/skill';
import { materializeProfileBindings } from '../../src/utils/hotkeyProfiles';

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

/** 获取 envInfo + 公司路径 */
function getFullEnvInfo() {
  const envInfo = locateEnvironment();
  const companySkillPaths = getCompanySkillPaths();
  return { envInfo, companySkillPaths };
}

/** 读取 loader 和 ilinit 内容 */
function getLoadContext(envInfo: ReturnType<typeof locateEnvironment>) {
  let loaderContent: string | undefined;
  let ilinitContent: string | undefined;
  const textEncoding = getAllegroTextEncoding(envInfo.allegroVersion);
  try {
    if (envInfo.atmGeneratedPath) {
      const lp = path.join(envInfo.atmGeneratedPath, 'generated_skill_loader.il');
      if (fs.existsSync(lp)) loaderContent = readAllegroTextFile(lp, textEncoding).text;
    }
    if (envInfo.ilinitFilePath && fs.existsSync(envInfo.ilinitFilePath)) {
      ilinitContent = readAllegroTextFile(envInfo.ilinitFilePath, textEncoding).text;
    }
  } catch {}
  return { loaderContent, ilinitContent };
}

export function registerHotkeyIpc(): void {
  // ── 解析 env 文件 ──
  ipcMain.handle('hotkey:parse-env', async (_event, filePath: string) => {
    try {
      const result = await parseEnvFile(filePath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `解析 env 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ── 检测快捷键冲突（含 Skill 引用校验 + 命令分类 V1.5） ──
  ipcMain.handle('hotkey:validate', async (_event, filePath: string) => {
    try {
      const parseResult = await parseEnvFile(filePath);
      if (!parseResult.entries.length && parseResult.warnings.length > 0) {
        return { success: false, error: parseResult.warnings.join('; ') };
      }
      const validationResult = validateHotkeys(parseResult.entries);

      // Skill 引用校验
      let skillRefChecks = null;
      let registry: CommandRegistry | null = null;
      try {
        const { envInfo, companySkillPaths } = getFullEnvInfo();
        const refResult = validateSkillReferences(
          { ...envInfo, companySkillPaths },
          validationResult.bindings,
        );
        skillRefChecks = refResult.refChecks;
        registry = refResult.registry;
      } catch {}

      // 命令分类
      const dictionary = createDictionary();
      const dicts = [dictionary.merged, dictionary.builtin];
      const { envInfo } = getFullEnvInfo();
      const { loaderContent, ilinitContent } = getLoadContext(envInfo);
      const overridePath = getOverrideFilePath(envInfo.pcbenvPath || '');
      const userOverrides = loadUserOverrides(overridePath);

      const classifiedBindings: HotkeyBinding[] = validationResult.bindings.map((b) => {
        const classification = classifyCommand(
          b.command, dicts, registry, userOverrides,
          { baseDir: null, loaderContent, ilinitContent },
        );
        return {
          ...b,
          bindingSource: b.source === 'atm_managed' ? 'atm_managed_block' : 'user_env_original',
          chineseName: classification.chineseName,
          category: classification.category,
          description: classification.description,
          commandSource: classification.source,
          skillName: classification.skillName,
          skillFilePath: classification.skillFilePath,
          skillTier: classification.skillTier,
          confidence: classification.confidence,
          loadStatus: classification.loadStatus,
          isSourceOverridden: classification.isOverridden,
          extraHint: classification.extraHint || null,
          sameNameSkill: classification.sameNameSkill || null,
        };
      });

      return {
        success: true,
        data: {
          ...validationResult,
          bindings: classifiedBindings,
          skillRefChecks,
        },
      };
    } catch (err) {
      return { success: false, error: `冲突检测失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ── 创建备份 ──
  ipcMain.handle('hotkey:create-backup', async (_event, filePath: string) => {
    try {
      const envInfo = locateEnvironment();
      const backupBase = envInfo.pcbenvPath
        ? path.join(envInfo.pcbenvPath, 'atm_generated', 'backup')
        : path.dirname(filePath);
      const result = createBackup(filePath, backupBase);
      return { success: result.success, data: result };
    } catch (err) {
      return { success: false, error: `创建备份失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ── 生成 Apply Plan ──
  ipcMain.handle('hotkey:create-apply-plan', async (_event, filePath: string, profileId?: string) => {
    try {
      const envInfo = locateEnvironment();
      if (!envInfo.pcbenvPath) return { success: false, error: '未找到 pcbenv 路径' };

      const parseResult = await parseEnvFile(filePath);
      const validationResult = validateHotkeys(parseResult.entries);
      const actions: PlanAction[] = [];
      const userBindings = validationResult.bindings
        .filter((binding) => binding.source !== 'atm_managed')
        .map((binding) => ({
          ...binding,
          bindingSource: 'user_env_original' as const,
        }));
      const activeProfile = profileId ? loadProfile(envInfo.pcbenvPath, profileId) : null;
      const managedBindings = activeProfile
        ? materializeProfileBindings(activeProfile)
        : validationResult.bindings
            .filter((binding) => binding.source === 'atm_managed')
            .map((binding) => ({
              ...binding,
              bindingSource: 'atm_managed_block' as const,
            }));
      const planBindings = [...userBindings, ...managedBindings];

      actions.push({ type: 'modify_env_managed_block', bindings: planBindings, envPath: filePath });
      if (envInfo.ilinitExists) {
        actions.push({ type: 'insert_bootstrap', ilinitPath: envInfo.ilinitFilePath || undefined, atmGeneratedPath: envInfo.atmGeneratedPath || undefined });
      }

      if (actions.length === 0) return { success: false, error: '没有需要执行的操作' };
      const plan = createApplyPlan(actions, envInfo.pcbenvPath);
      plan.managedBindings = planBindings;
      plan.environmentId = envInfo.environmentId ?? null;
      plan.environmentPcbenvPath = envInfo.pcbenvPath;
      return { success: true, data: plan };
    } catch (err) {
      return { success: false, error: `生成 Apply Plan 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ── 执行 Apply Plan ──
  ipcMain.handle('hotkey:apply-plan', async (_event, planJson: string) => {
    try {
      const plan: ApplyPlan = JSON.parse(planJson);
      const envInfo = locateEnvironment();
      if (!envInfo.pcbenvPath) return { success: false, error: '未找到 pcbenv 路径' };
      if (plan.environmentId && plan.environmentId !== envInfo.environmentId) return { success: false, error: '当前 Allegro 环境已变化，请重新生成 Apply Plan' };
      if (plan.environmentPcbenvPath && path.normalize(plan.environmentPcbenvPath).toLowerCase() !== path.normalize(envInfo.pcbenvPath).toLowerCase()) return { success: false, error: 'Apply Plan 目标 pcbenv 已变化，请重新生成计划' };
      const result = applyChanges(plan, plan.managedBindings || [], envInfo.pcbenvPath);
      return result;
    } catch (err) {
      return { success: false, error: `执行 Apply Plan 失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Profile 管理 IPC
  // ═══════════════════════════════════════════════════════════

  /** 获取所有 Profile */
  ipcMain.handle('profile:list', async () => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      getOrCreateDefaultProfile(envInfo.pcbenvPath); // 确保默认方案存在
      const profiles = loadAllProfiles(envInfo.pcbenvPath);
      return { success: true, data: profiles };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 创建 Profile */
  ipcMain.handle('profile:create', async (_event, name: string, description?: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const profile = createProfile(envInfo.pcbenvPath, name, description, undefined, {
        sourceEnvironmentId: envInfo.environmentId ?? null,
        sourceAllegroVersion: envInfo.allegroVersion ?? null,
        testedAllegroVersions: envInfo.allegroVersion ? [envInfo.allegroVersion] : [],
      });
      return { success: !!profile, data: profile };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('profile:check-compatibility', async (_event, profileId: string, targetEnvironmentId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: '当前环境未找到 pcbenv' };
      const profile = loadProfile(envInfo.pcbenvPath, profileId);
      const registry = loadEnvironmentRegistry();
      const target = registry.environments.find((item) => item.id === targetEnvironmentId);
      if (!profile || !target) return { success: false, error: '来源方案或目标环境不存在' };
      return { success: true, data: checkHotkeyProfileCompatibility(profile, target) };
    } catch (err) {
      return { success: false, error: `兼容性检查失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('profile:migrate', async (_event, profileId: string, targetEnvironmentId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: '当前环境未找到 pcbenv' };
      const profile = loadProfile(envInfo.pcbenvPath, profileId);
      const registry = loadEnvironmentRegistry();
      const target = registry.environments.find((item) => item.id === targetEnvironmentId);
      if (!profile || !target) return { success: false, error: '来源方案或目标环境不存在' };
      const report = checkHotkeyProfileCompatibility(profile, target);
      if (report.verdict === 'blocked') return { success: false, error: '兼容性预检发现阻断项，请先处理绝对路径等问题', data: report };
      if (path.normalize(target.pcbenvPath).toLowerCase() === path.normalize(envInfo.pcbenvPath).toLowerCase()) {
        return { success: true, data: { profile, report, sharedPcbenv: true } };
      }
      const migrated = createProfile(
        target.pcbenvPath,
        `${profile.name}（迁移）`,
        `从 Allegro ${profile.sourceAllegroVersion || envInfo.allegroVersion || '未知版本'} 迁移`,
        JSON.parse(JSON.stringify(profile.bindings)),
        {
          sourceEnvironmentId: profile.sourceEnvironmentId || envInfo.environmentId || null,
          sourceAllegroVersion: profile.sourceAllegroVersion || envInfo.allegroVersion || null,
          testedAllegroVersions: profile.testedAllegroVersions || [],
          targetCompatibility: {
            intendedEnvironmentId: target.id,
            intendedAllegroVersion: target.allegroVersion,
            lastCheckedAt: new Date().toISOString(),
            lastVerdict: report.verdict,
          },
        },
      );
      return migrated
        ? { success: true, data: { profile: migrated, report, sharedPcbenv: false } }
        : { success: false, error: '无法在目标环境创建方案' };
    } catch (err) {
      return { success: false, error: `迁移方案失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 复制 Profile */
  ipcMain.handle('profile:copy', async (_event, profileId: string, newName?: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const copy = copyProfile(envInfo.pcbenvPath, profileId, newName);
      return { success: !!copy, data: copy };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 重命名 Profile */
  ipcMain.handle('profile:rename', async (_event, profileId: string, newName: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const ok = renameProfile(envInfo.pcbenvPath, profileId, newName);
      return { success: ok };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 删除 Profile */
  ipcMain.handle('profile:delete', async (_event, profileId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const ok = deleteProfile(envInfo.pcbenvPath, profileId);
      return { success: ok };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 设置已应用的快捷键方案 */
  ipcMain.handle('profile:set-applied', async (_event, profileId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const appliedPath = path.join(envInfo.pcbenvPath, 'atm_generated', 'settings', 'applied_profile.json');
      if (!require('fs').existsSync(path.dirname(appliedPath))) {
        require('fs').mkdirSync(path.dirname(appliedPath), { recursive: true });
      }
      require('fs').writeFileSync(appliedPath, JSON.stringify({ profileId, appliedAt: new Date().toISOString() }, null, 2), 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 获取已应用的快捷键方案 ID */
  ipcMain.handle('profile:get-applied', async () => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: true, data: { profileId: '' } };
      const appliedPath = path.join(envInfo.pcbenvPath, 'atm_generated', 'settings', 'applied_profile.json');
      if (require('fs').existsSync(appliedPath)) {
        const raw = require('fs').readFileSync(appliedPath, { encoding: 'utf-8' });
        const data = JSON.parse(raw);
        return { success: true, data: { profileId: data.profileId || '' } };
      }
      return { success: true, data: { profileId: '' } };
    } catch (err) {
      return { success: true, data: { profileId: '' } };
    }
  });

  /** 导出 Profile */
  ipcMain.handle('profile:export', async (_event, profileId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const json = exportProfileToJson(envInfo.pcbenvPath, profileId);
      return { success: !!json, data: json };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 导入 Profile */
  ipcMain.handle('profile:import', async (_event, jsonStr: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const profile = importProfileFromJson(envInfo.pcbenvPath, jsonStr);
      return { success: !!profile, data: profile };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 差异比较两个 Profile */
  ipcMain.handle('profile:diff', async (_event, sourceId: string, targetId: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const src = loadProfile(envInfo.pcbenvPath, sourceId);
      const tgt = loadProfile(envInfo.pcbenvPath, targetId);
      if (!src || !tgt) return { success: false, error: '方案不存在' };
      const diff = diffProfiles(src, tgt);
      return { success: true, data: diff };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 保存 Profile 的快捷键绑定 */
  ipcMain.handle('profile:save-bindings', async (_event, profileId: string, bindings: any[]) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const profile = loadProfile(envInfo.pcbenvPath, profileId);
      if (!profile) return { success: false, error: '方案不存在' };
      profile.bindings = bindings;
      profile.updatedAt = new Date().toISOString();
      const ok = saveProfile(envInfo.pcbenvPath, profile);
      return { success: ok, data: profile };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 编辑校验 IPC
  // ═══════════════════════════════════════════════════════════

  /** 编辑快捷键时的实时检测 */
  ipcMain.handle('hotkey:validate-edit', async (_event, editData: {
    bindingId?: string;
    type: 'funckey' | 'alias';
    key: string;
    command: string;
    currentEnvBindings?: any[];
    currentProfileBindings?: any[];
    profileId?: string;
    filePath?: string;
  }) => {
    try {
      const result: HotkeyEditValidation = {
        valid: true, warnings: [], errors: [],
        duplicateInEnv: false, duplicateInProfile: false,
        isReservedKey: false, isReservedWarning: false,
        commandRecognized: true,
        skillMaybeUnloaded: false,
        isSoftwareDefault: false,
      };

      const lowerKey = editData.key.toLowerCase();

      // 1. 检测系统保留键
      const SYSTEM_RESERVED = ['alt+f4', 'ctrl+alt+del', 'ctrl+shift+esc', 'alt+tab', 'ctrl+esc', 'win', 'pause', 'break'];
      if (SYSTEM_RESERVED.includes(lowerKey)) {
        result.isReservedKey = true;
        result.errors.push('该按键是系统保留键，无法绑定');
        result.valid = false;
      }

      // 2. 检测软件默认占用键（F3 等）
      if (isSoftwareDefaultKey(editData.key)) {
        result.isSoftwareDefault = true;
        result.warnings.push(`提示：${editData.key} 可能是 Allegro 软件默认占用键，绑定后可能不生效`);
      }

      // 3. 检测 env 是否已有相同按键
      if (editData.currentEnvBindings) {
        const dup = editData.currentEnvBindings.find(
          (b: any) => b.id !== editData.bindingId && b.key?.toLowerCase() === lowerKey && b.type === editData.type,
        );
        if (dup) {
          result.duplicateInEnv = true;
          result.warnings.push(`env 中已存在相同 ${editData.type}：${dup.key} → ${dup.command}`);
        }
      }

      // 4. 检测 Profile 是否已有相同按键
      if (editData.currentProfileBindings) {
        const dup = editData.currentProfileBindings.find(
          (b: any) => b.id !== editData.bindingId && b.key?.toLowerCase() === lowerKey && b.type === editData.type,
        );
        if (dup) {
          result.duplicateInProfile = true;
          result.warnings.push(`当前方案中已存在相同 ${editData.type}：${dup.key} → ${dup.command}`);
        }
      }

      // 5. 检测 command 是否可识别
      const dictionary = createDictionary();
      const dicts = [dictionary.merged, dictionary.builtin];
      try {
        const { envInfo } = getFullEnvInfo();
        const companySkillPaths = getCompanySkillPaths();
        const refResult = validateSkillReferences(
          { ...envInfo, companySkillPaths },
          [],
        );
        const classification = classifyCommand(editData.command, dicts, refResult.registry);
        result.commandRecognized = classification.source !== 'unknown';

        if (classification.loadStatus === 'maybe_unloaded') {
          result.skillMaybeUnloaded = true;
          result.warnings.push(`命令 "${editData.command}" 可能来自 Skill，但未发现启动加载配置`);
        }
        if (!result.commandRecognized) {
          result.warnings.push(`命令 "${editData.command}" 未识别，将显示为"未识别命令"`);
        }
      } catch {
        result.commandRecognized = false;
      }

      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 获取软件默认/系统保留快捷键（V2.2 使用 data/default_reserved_keys.json） */
  ipcMain.handle('hotkey:get-reserved', async () => {
    try {
      const { loadAndConvert } = await import('../../core/dictionary/reservedKeyLoader');
      const result = loadAndConvert();
      if (!result.success) {
        return {
          success: true,
          data: { allBindings: [], allegroDefault: [], systemReserved: [] },
          warning: result.error,
        };
      }
      const allBindings = result.bindings;
      const allegroDefault = allBindings.filter((b) => b.bindingSource === 'allegro_default');
      const systemReserved = allBindings.filter((b) => b.bindingSource === 'system_reserved');
      return { success: true, data: { allBindings, allegroDefault, systemReserved } };
    } catch (err) {
      return {
        success: true,
        data: { allBindings: [], allegroDefault: [], systemReserved: [] },
        warning: '加载默认快捷键参考库失败: ' + String(err),
      };
    }
  });

  /** 生成编辑快捷键的 Apply Plan */
  ipcMain.handle('hotkey:generate-edit-plan', async (_event, editRequest: any, currentBinding: any, filePath: string) => {
    try {
      const { generateEditPlan } = await import('../../core/apply/hotkeyEditPlan');
      const { parseEnvFile } = await import('../../core/parser/parseEnv');
      const { envInfo } = getFullEnvInfo();
      const profileId = editRequest.profileId || currentBinding.profileId;
      let profileFilePath: string | undefined;
      if (currentBinding.bindingSource === 'active_profile' || currentBinding.bindingSource === 'imported_profile') {
        if (!envInfo.pcbenvPath || !profileId) {
          return { success: false, error: '当前绑定缺少方案信息，无法编辑' };
        }
        profileFilePath = getProfileFilePath(getProfilesDir(envInfo.pcbenvPath), profileId);
      }

      // 解析当前 env
      const parseResult = await parseEnvFile(filePath);
      const plan = generateEditPlan(
        editRequest,
        currentBinding,
        filePath,
        parseResult.entries || [],
        profileFilePath,
      );

      return { success: true, data: plan };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 执行编辑 Apply Plan */
  ipcMain.handle('hotkey:execute-edit-plan', async (_event, planJson: string, filePath: string) => {
    try {
      const plan = JSON.parse(planJson);
      const { parseEnvFile } = await import('../../core/parser/parseEnv');
      const parseResult = await parseEnvFile(filePath);
      const { executeEditPlan } = await import('../../core/apply/hotkeyEditPlan');
      const result = executeEditPlan(JSON.parse(planJson), filePath, parseResult.entries || []);
      return result;
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 保存用户命令来源修正 */
  ipcMain.handle('command:save-override', async (_event, commandName: string, source: string, note?: string) => {
    try {
      const { envInfo } = getFullEnvInfo();
      if (!envInfo.pcbenvPath) return { success: false, error: 'pcbenv 路径未设置' };
      const overridePath = getOverrideFilePath(envInfo.pcbenvPath);
      const { setCommandOverride, loadUserOverrides, saveUserOverrides } = await import('../../core/dictionary/userCommandOverrides');
      const overrides = loadUserOverrides(overridePath);
      const updated = setCommandOverride(overrides, commandName, source as any, 'high', note);
      const ok = saveUserOverrides(overridePath, updated);
      return { success: ok };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** 生成添加快捷键的 Apply Plan */
  ipcMain.handle('hotkey:generate-add-plan', async (_event,
    key: string,
    command: string,
    type: string,
    filePath: string,
  ) => {
    try {
      const { generateAddPlan } = await import('../../core/apply/hotkeyEditPlan');
      const { parseEnvFile } = await import('../../core/parser/parseEnv');
      const parseResult = await parseEnvFile(filePath);
      const plan = generateAddPlan(
        key,
        command,
        type as 'funckey' | 'alias',
        filePath,
        parseResult.entries || [],
      );
      return { success: true, data: plan };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // V4.0 增强冲突检测
  // ═══════════════════════════════════════════════════════════

  /** 检测增强冲突 */
  ipcMain.handle('hotkey:enhanced-conflicts', async (_event, params: any) => {
    try {
      const { detectEnhancedConflicts } = await import('../../core/validator/enhancedConflictDetector');
      const conflictMatrix = detectEnhancedConflicts(params);
      return { success: true, data: conflictMatrix };
    } catch (err) {
      return { success: false, error: `增强冲突检测失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // V4.0 推荐可用键位
  // ═══════════════════════════════════════════════════════════

  /** 获取推荐可用键位 */
  ipcMain.handle('hotkey:recommended-keys', async (_event, options: any) => {
    try {
      const { getRecommendedKeys } = await import('../../core/dictionary/availableKeyRecommender');
      const recommendations = getRecommendedKeys(options);
      return { success: true, data: recommendations };
    } catch (err) {
      return { success: false, error: `推荐可用键位失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // V4.0 导出速查表
  // ═══════════════════════════════════════════════════════════

  /** 生成导出内容 */
  ipcMain.handle('hotkey:export', async (_event, bindingsJson: string, options: any) => {
    try {
      const bindings = JSON.parse(bindingsJson);
      const { exportHotkeyCheatsheet } = await import('../../core/dictionary/hotkeyExportService');
      const result = exportHotkeyCheatsheet(bindings, options);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `导出失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 保存导出文件到磁盘 */
  ipcMain.handle('hotkey:save-export', async (_event, content: string, defaultName: string, filter: any) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '导出快捷键速查表',
        defaultPath: defaultName,
        filters: filter || [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'HTML', extensions: ['html', 'htm'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: true, data: null, info: '取消保存' };
      }

      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, data: result.filePath };
    } catch (err) {
      return { success: false, error: `保存文件失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // V4.0 收藏管理
  // ═══════════════════════════════════════════════════════════

  /** 切换收藏状态 */
  ipcMain.handle('favorite:toggle', async (_event, pcbenvPath: string, bindingId: string) => {
    try {
      const { toggleFavorite } = await import('../../core/dictionary/hotkeyFavorites');
      const result = toggleFavorite(pcbenvPath, bindingId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `切换收藏失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 加载收藏列表 */
  ipcMain.handle('favorite:load', async (_event, pcbenvPath: string) => {
    try {
      const { loadFavorites } = await import('../../core/dictionary/hotkeyFavorites');
      const favorites = loadFavorites(pcbenvPath);
      return { success: true, data: favorites };
    } catch (err) {
      return { success: false, error: `加载收藏失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  /** 获取收藏的快捷键 */
  ipcMain.handle('favorite:get-bindings', async (_event, pcbenvPath: string, bindingsJson: string) => {
    try {
      const allBindings = JSON.parse(bindingsJson);
      const { getFavoriteBindings } = await import('../../core/dictionary/hotkeyFavorites');
      const favorites = getFavoriteBindings(pcbenvPath, allBindings);
      return { success: true, data: favorites };
    } catch (err) {
      return { success: false, error: `获取收藏快捷键失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
