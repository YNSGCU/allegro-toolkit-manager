/**
 * ATM - 跨版本方案同步 IPC（V6.4）
 *
 * 通道：
 *  - sync:environments       环境列表（源/目标选择）
 *  - sync:check-env-pair     环境对前置校验（目录独立/版本不同/存在性）
 *  - sync:build-plan         生成同步计划（命令分类 + 默认决策）
 *  - sync:update-rule        记忆规则（always_sync / always_skip / ask）
 *  - sync:apply              合并并保存为目标环境「新方案」（不覆盖现有）
 */
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { loadEnvironmentRegistry } from '../../core/environment/environmentRegistry';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanAllSkills } from '../../core/skill/scanSkill';
import { parseSkillFile } from '../../core/parser/parseSkillMeta';
import { buildCommandAvailability } from '../../core/sync/commandAvailability';
import { checkEnvironmentPair } from '../../core/sync/environmentPairCheck';
import { planCrossVersionSync } from '../../core/sync/planCrossVersionSync';
import { mergeSyncProfiles } from '../../core/sync/mergeSyncProfiles';
import {
  buildEnvironmentSnapshotProfiles,
  isEmptyHotkeyProfile,
  isEmptySkillProfile,
} from '../../core/sync/snapshotProfiles';
import {
  loadSyncRuleStore,
  saveSyncRuleStore,
  setRule,
} from '../../core/sync/syncRules';
import { loadAllProfiles, saveProfile } from '../../core/profile/hotkeyProfile';
import { loadSkillProfileStore, saveSkillProfileStore } from '../../core/skill/skillProfileManager';
import { loadMenuProfileStore, saveMenuProfileStore } from '../../core/menu/menuManager';
import type {
  CrossVersionSyncPlan,
  CrossVersionSyncEnvironmentRef,
  SyncDecisionsInput,
  SyncItemKind,
  SyncRuleDecision,
} from '../../src/types/sync';
import type { EnvironmentInfo } from '../../src/types/environment';

function withCompanySkillPaths(envInfo: EnvironmentInfo): EnvironmentInfo & { companySkillPaths: string[] } {
  const companySkillPaths: string[] = [];
  const cdsSite = process.env.CDS_SITE;
  const skillPath = process.env.SKILL_PATH;
  if (cdsSite) companySkillPaths.push(cdsSite);
  if (skillPath) {
    companySkillPaths.push(...skillPath.split(/[;,]/).map((part) => part.trim()).filter(Boolean));
  }
  return { ...envInfo, companySkillPaths };
}

/** 收集环境 Skill 命令：排除 ATM 生成的 loader/bootstrap 文件，命令取函数名 */
function collectSkillCommands(envInfo: EnvironmentInfo & { companySkillPaths?: string[] }) {
  return scanAllSkills(envInfo).all
    .filter((skill) => !/^(generated_|bootstrap)/i.test(skill.name))
    .map((skill) => {
      let registeredCommands: string[] = [];
      try {
        registeredCommands = (parseSkillFile(skill.filePath).axlRegistrations ?? [])
          .map((registration) => registration.commandName)
          .filter((name): name is string => Boolean(name));
      } catch {
        // 解析失败时仅使用函数名
      }
      return {
        skillId: skill.id,
        name: skill.name,
        commands: (skill.functions ?? []).map((fn) => fn.name).filter((name): name is string => Boolean(name)),
        registeredCommands,
      };
    });
}

function toEnvRef(environmentId: string): CrossVersionSyncEnvironmentRef | null {
  const registry = loadEnvironmentRegistry();
  const environment = registry.environments.find((item) => item.id === environmentId) ?? null;
  if (!environment) return null;
  return {
    environmentId: environment.id,
    version: environment.allegroVersion ?? '',
    pcbenvPath: environment.pcbenvPath ?? undefined,
    homePath: environment.homePath ?? undefined,
  };
}

function loadProfilesForEnv(
  environmentId: string,
  profileIds: { hotkeyProfileId?: string; skillProfileId?: string; menuProfileId?: string },
) {
  const envInfo = locateEnvironment(toEnvRef(environmentId)?.pcbenvPath);
  const pcbenvPath = envInfo.pcbenvPath ?? null;
  const atmDir = envInfo.atmGeneratedPath;

  const hotkeyProfiles = pcbenvPath ? loadAllProfiles(pcbenvPath) : [];
  const skillStore = atmDir ? loadSkillProfileStore(atmDir) : null;
  const menuStore = atmDir ? loadMenuProfileStore(atmDir) : null;

  const hotkey = profileIds.hotkeyProfileId
    ? hotkeyProfiles.find((profile) => profile.id === profileIds.hotkeyProfileId) ?? null
    : hotkeyProfiles[0] ?? null;
  const skill = profileIds.skillProfileId
    ? (skillStore?.profiles ?? []).find((profile) => profile.id === profileIds.skillProfileId) ?? null
    : (skillStore?.profiles ?? [])[0] ?? null;
  const menu = profileIds.menuProfileId
    ? (menuStore?.profiles ?? []).find((profile) => profile.id === profileIds.menuProfileId) ?? null
    : (menuStore?.profiles ?? [])[0] ?? null;
  return { envInfo, pcbenvPath, atmDir, hotkey, skill, menu };
}

/** 加载源方案；方案为空时自动用当前环境实时快照（不落盘），并记录说明 */
function loadSourceProfilesWithSnapshot(
  environmentId: string,
  profileIds: { hotkeyProfileId?: string; skillProfileId?: string; menuProfileId?: string },
  label: string,
) {
  const profiles = loadProfilesForEnv(environmentId, profileIds);
  const notes: string[] = [];
  if (!profiles.envInfo.pcbenvPath) return { ...profiles, notes };

  const scanned = scanAllSkills(withCompanySkillPaths(profiles.envInfo)).all
    .filter((skill) => !/^(generated_|bootstrap)/i.test(skill.name));
  const snapshot = buildEnvironmentSnapshotProfiles({
    pcbenvPath: profiles.envInfo.pcbenvPath,
    envFilePath: profiles.envInfo.envFilePath ?? undefined,
    scannedSkills: scanned.map((skill) => ({
      id: skill.id,
      name: skill.name,
      path: skill.filePath,
      enabled: true,
      loadStatus: skill.status ?? 'loaded',
    })),
    label,
  });

  let hotkey = profiles.hotkey;
  if (isEmptyHotkeyProfile(hotkey) && snapshot.hotkey) {
    hotkey = snapshot.hotkey;
    notes.push(`${label}快捷键：使用当前 env 实时快照（未保存为方案）`);
  }
  let skill = profiles.skill;
  if (isEmptySkillProfile(skill) && snapshot.skill) {
    skill = snapshot.skill;
    notes.push(`${label}Skill：使用当前环境扫描实时快照（未保存为方案）`);
  }
  return { ...profiles, hotkey, skill, notes };
}

/** 将用户勾选覆盖应用到计划条目 */
export function applyDecisionOverrides(
  plan: CrossVersionSyncPlan,
  decisions: SyncDecisionsInput[],
): CrossVersionSyncPlan {
  if (!decisions || decisions.length === 0) return plan;
  const byRef = new Map(decisions.map((entry) => [`${entry.kind}:${entry.ref}`, entry.decision]));
  return {
    ...plan,
    items: plan.items.map((item) => {
      const override = byRef.get(`${item.kind}:${item.ref}`);
      if (!override) return item;
      return { ...item, decision: override, askConfirm: false };
    }),
  };
}

/** 按勾选内容过滤计划（kinds 为空视为全部） */
export function filterPlanKinds(
  plan: CrossVersionSyncPlan,
  kinds: SyncItemKind[],
): CrossVersionSyncPlan {
  if (!kinds || kinds.length === 0) return plan;
  const selected = new Set(kinds);
  const items = plan.items.filter((item) => selected.has(item.kind));
  const stats = { sync: 0, skip_ver: 0, skip_unknown: 0, keep_target: 0, user_force: 0 };
  for (const item of items) stats[item.decision] += 1;
  return { ...plan, items, stats };
}

export function registerSyncIpc(): void {
  ipcMain.handle('sync:environments', () => {
    try {
      const registry = loadEnvironmentRegistry();
      return {
        success: true,
        data: registry.environments.map((environment) => ({
          id: environment.id,
          name: environment.name,
          version: environment.allegroVersion ?? '',
          pcbenvPath: environment.pcbenvPath,
          homePath: environment.homePath,
        })),
      };
    } catch (err) {
      return { success: false, error: `加载环境列表失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('sync:check-env-pair', (_event, sourceEnvironmentId: string, targetEnvironmentId: string) => {
    try {
      const source = toEnvRef(sourceEnvironmentId);
      const target = toEnvRef(targetEnvironmentId);
      if (!source || !target) {
        return { success: false, error: '源或目标环境不存在，请先在环境页确认' };
      }
      const result = checkEnvironmentPair({
        source,
        target,
        sourceExists: source.pcbenvPath ? fs.existsSync(source.pcbenvPath) : false,
        targetExists: target.pcbenvPath ? fs.existsSync(target.pcbenvPath) : false,
      });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: `环境对校验失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('sync:build-plan', (
    _event,
    options: {
      sourceEnvironmentId: string;
      targetEnvironmentId: string;
      hotkeyProfileId?: string;
      skillProfileId?: string;
      menuProfileId?: string;
      kinds?: SyncItemKind[];
    },
  ) => {
    try {
      const sourceRef = toEnvRef(options.sourceEnvironmentId);
      const targetRef = toEnvRef(options.targetEnvironmentId);
      if (!sourceRef || !targetRef) return { success: false, error: '源或目标环境不存在' };

      const pair = checkEnvironmentPair({
        source: sourceRef,
        target: targetRef,
        sourceExists: sourceRef.pcbenvPath ? fs.existsSync(sourceRef.pcbenvPath) : false,
        targetExists: targetRef.pcbenvPath ? fs.existsSync(targetRef.pcbenvPath) : false,
      });
      if (!pair.ok) {
        return { success: false, error: pair.issues.join('；') };
      }

      const sourceEnvInfo = locateEnvironment(sourceRef.pcbenvPath);
      const targetEnvInfo = locateEnvironment(targetRef.pcbenvPath);
      const targetCommands = buildCommandAvailability(collectSkillCommands(withCompanySkillPaths(targetEnvInfo)));
      const sourceCommands = buildCommandAvailability(collectSkillCommands(withCompanySkillPaths(sourceEnvInfo)));

      const sourceProfiles = loadSourceProfilesWithSnapshot(options.sourceEnvironmentId, {
        hotkeyProfileId: options.hotkeyProfileId,
        skillProfileId: options.skillProfileId,
        menuProfileId: options.menuProfileId,
      }, `${sourceRef.version}（源）`);
      const targetProfiles = loadProfilesForEnv(options.targetEnvironmentId, {
        hotkeyProfileId: options.hotkeyProfileId,
        skillProfileId: options.skillProfileId,
        menuProfileId: options.menuProfileId,
      });

      const plan = planCrossVersionSync({
        source: sourceRef,
        target: targetRef,
        targetCommands,
        sourceCommands,
        sourceHotkey: sourceProfiles.hotkey,
        targetHotkey: targetProfiles.hotkey,
        sourceSkill: sourceProfiles.skill,
        targetSkill: targetProfiles.skill,
        sourceMenu: sourceProfiles.menu,
        targetMenu: targetProfiles.menu,
        rules: loadSyncRuleStore(),
        notes: sourceProfiles.notes,
      });
      return { success: true, data: filterPlanKinds(plan, options.kinds ?? []) };
    } catch (err) {
      return { success: false, error: `生成同步计划失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('sync:update-rule', (
    _event,
    command: string,
    targetVersion: string,
    decision: SyncRuleDecision,
    note?: string,
  ) => {
    try {
      const store = loadSyncRuleStore();
      setRule(store, command, targetVersion, decision, note);
      saveSyncRuleStore(store);
      return { success: true, data: { store } };
    } catch (err) {
      return { success: false, error: `保存同步规则失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });

  ipcMain.handle('sync:apply', (
    _event,
    options: {
      sourceEnvironmentId: string;
      targetEnvironmentId: string;
      hotkeyProfileId?: string;
      skillProfileId?: string;
      menuProfileId?: string;
      decisions?: SyncDecisionsInput[];
      nameSuffix?: string;
      kinds?: SyncItemKind[];
    },
  ) => {
    try {
      const sourceRef = toEnvRef(options.sourceEnvironmentId);
      const targetRef = toEnvRef(options.targetEnvironmentId);
      if (!sourceRef || !targetRef) return { success: false, error: '源或目标环境不存在' };

      // 重新生成计划（保证与主进程当前状态一致）并应用用户决策覆盖
      const sourceEnvInfo = locateEnvironment(sourceRef.pcbenvPath);
      const targetEnvInfo = locateEnvironment(targetRef.pcbenvPath);
      const targetCommands = buildCommandAvailability(collectSkillCommands(withCompanySkillPaths(targetEnvInfo)));
      const sourceCommands = buildCommandAvailability(collectSkillCommands(withCompanySkillPaths(sourceEnvInfo)));
      const sourceProfiles = loadSourceProfilesWithSnapshot(options.sourceEnvironmentId, {
        hotkeyProfileId: options.hotkeyProfileId,
        skillProfileId: options.skillProfileId,
        menuProfileId: options.menuProfileId,
      }, `${sourceRef.version}（源）`);
      const targetProfiles = loadProfilesForEnv(options.targetEnvironmentId, {
        hotkeyProfileId: options.hotkeyProfileId,
        skillProfileId: options.skillProfileId,
        menuProfileId: options.menuProfileId,
      });
      const plan = applyDecisionOverrides(
        filterPlanKinds(
          planCrossVersionSync({
            source: sourceRef,
            target: targetRef,
            targetCommands,
            sourceCommands,
            sourceHotkey: sourceProfiles.hotkey,
            targetHotkey: targetProfiles.hotkey,
            sourceSkill: sourceProfiles.skill,
            targetSkill: targetProfiles.skill,
            sourceMenu: sourceProfiles.menu,
            targetMenu: targetProfiles.menu,
            rules: loadSyncRuleStore(),
            notes: sourceProfiles.notes,
          }),
          options.kinds ?? [],
        ),
        options.decisions ?? [],
      );
      if (plan.blocked) return { success: false, error: plan.blockedReason ?? '同步计划不可执行' };

      const merged = mergeSyncProfiles({
        plan,
        source: {
          hotkey: sourceProfiles.hotkey,
          skill: sourceProfiles.skill,
          menu: sourceProfiles.menu,
        },
        target: {
          hotkey: targetProfiles.hotkey,
          skill: targetProfiles.skill,
          menu: targetProfiles.menu,
        },
        nameSuffix: options.nameSuffix,
      });

      const saved: Array<{ kind: string; name: string }> = [];
      if (merged.hotkey && targetProfiles.pcbenvPath) {
        saveProfile(targetProfiles.pcbenvPath, merged.hotkey);
        saved.push({ kind: 'hotkey', name: merged.hotkey.name });
      }
      if (merged.skill && targetProfiles.atmDir) {
        const store = loadSkillProfileStore(targetProfiles.atmDir);
        store.profiles.push(merged.skill);
        saveSkillProfileStore(targetProfiles.atmDir, store);
        saved.push({ kind: 'skill', name: merged.skill.name });
      }
      if (merged.menu && targetProfiles.atmDir) {
        const store = loadMenuProfileStore(targetProfiles.atmDir);
        store.profiles.push(merged.menu);
        saveMenuProfileStore(targetProfiles.atmDir, store);
        saved.push({ kind: 'menu', name: merged.menu.name });
      }

      return { success: true, data: { plan, saved, targetEnvironment: targetRef } };
    } catch (err) {
      return { success: false, error: `同步应用失败: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}
