/** 快捷键工作区数据装载服务：只负责读取与归一化，不包含页面 UI。 */
import type { Conflict, EnvEntry, HotkeyBinding, HotkeyProfile } from '../types/hotkey';
import type { AtmSettings, EnvironmentInfo, EnvSourceList } from '../types/environment';
import type { HotkeyReference } from '../types/skill';
import type { HotkeyWorkspaceUndoStatus } from '../components/hotkeys/types';
import { mergeBindingsWithActiveProfile } from '../utils/hotkeyProfiles';

// ── 在模块作用域声明 HB 别名 ──
type HB = HotkeyBinding;

export interface LoadedHotkeyWorkspaceData {
  envInfo: EnvironmentInfo;
  entries: EnvEntry[];
  parseWarnings: string[];
  profiles: HotkeyProfile[];
  activeProfileId: string;
  appliedProfileId: string;
  bindings: HB[];
  reservedBindings: HB[];
  reservedKeysWarning: string | null;
  conflicts: Conflict[];
  envSources: EnvSourceList | null;
  settings: AtmSettings | null;
  favoriteIds: string[];
  undoStatus: HotkeyWorkspaceUndoStatus;
}

function mapReservedLibraryEntries(reservedData: any[]): HB[] {
  return reservedData.map((entry: any) => {
    const isAllegro = entry.bindingSource === 'allegro_default';
    return {
      id: entry.id || `reserved_${entry.rawKey}`,
      key: entry.rawKey,
      command: entry.command || '',
      type: 'funckey',
      bindingSource: entry.bindingSource || 'allegro_default',
      status: 'reserved' as const,
      chineseName: entry.zhName || '',
      commandSource: isAllegro ? 'allegro_builtin' as const : 'unknown' as const,
      confidence: 'high' as const,
      primaryKey: entry.physicalKey,
      modifiers: entry.modifiers || [],
      displayKey: entry.displayKey || entry.rawKey,
      editable: false,
      warnWhenOverride: true,
      defaultOccupier: {
        command: entry.command || '(no default command)',
        description: entry.zhName || '',
        source: entry.bindingSource || 'allegro_default',
      },
    } as HB;
  });
}

function normalizeLoadedBindings(bindings: HB[]): HB[] {
  return bindings.map((binding) => ({
    ...binding,
    bindingSource:
      binding.bindingSource ||
      (binding.source === 'atm_managed' ? 'atm_managed_block' : 'user_env_original'),
  }));
}

function mapDirectSkillHotkeys(skillScanData: any): HB[] {
  const allSkills = Array.isArray(skillScanData?.all) ? skillScanData.all : [];
  const mapped: HB[] = [];
  const seen = new Set<string>();

  for (const skill of allSkills) {
    const refs = Array.isArray(skill?.hotkeyRefs) ? skill.hotkeyRefs : [];
    for (const ref of refs as HotkeyReference[]) {
      if (ref.sourceType !== 'skill_direct') {
        continue;
      }

      const key = ref.key?.trim();
      if (!key) {
        continue;
      }

      const command = ref.command?.trim() || '(skill direct)';
      const dedupeKey = `${key.toLowerCase()}::${command.toLowerCase()}::${skill?.path || skill?.name || ''}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      mapped.push({
        id: `skill_direct_${skill?.id || skill?.name || 'unknown'}_${key}_${ref.lineNumber || 0}`,
        key,
        command,
        type: ref.type === 'alias' ? 'alias' : 'funckey',
        bindingSource: 'skill_direct',
        status: 'reserved',
        editable: false,
        warnWhenOverride: true,
        visibleInReservedMap: true,
        commandSource:
          skill?.sourceType === 'company_skill'
            ? 'company_skill'
            : skill?.sourceType === 'atm_managed_skill'
              ? 'atm_managed_skill'
              : 'user_skill',
        skillName: skill?.name || null,
        skillFilePath: skill?.path || ref.source || null,
        skillTier: skill?.tier || null,
        lineNumber: ref.lineNumber || 0,
        notes: [`来自 Skill 直接注册: ${skill?.path || ref.source || skill?.name || 'unknown skill'}`],
        defaultOccupier: {
          command,
          description: skill?.name || 'Skill 直接注册',
          source: 'skill_direct',
        },
      });
    }
  }

  return mapped;
}

function mergeReservedBindings(existing: HB[], incoming: HB[]): HB[] {
  const merged: HB[] = [];
  const seen = new Set<string>();

  for (const binding of [...existing, ...incoming]) {
    const dedupeKey = [
      binding.bindingSource,
      binding.type,
      binding.key.toLowerCase(),
      binding.command.toLowerCase(),
      binding.skillFilePath || binding.envSourceId || binding.source || binding.id,
    ].join('::');

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    merged.push(binding);
  }

  return merged;
}

export async function loadHotkeyWorkspaceData(
  activeProfileId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedHotkeyWorkspaceData> {
  const envResult = await window.atm.locateEnvironment();
  if (!envResult.success || !envResult.data) {
    throw new Error(`环境检测失败: ${envResult.error || '未知错误'}`);
  }

  let envSources: EnvSourceList | null = null;
  let settings: AtmSettings | null = null;
  if (typeof window.atm.scanAllEnvironments === 'function') {
    try {
      const scanResult = await window.atm.scanAllEnvironments();
      if (scanResult.success && scanResult.data) {
        envSources = scanResult.data.sources;
        settings = scanResult.data.settings;
      }
    } catch {
      envSources = null;
      settings = null;
    }
  }

  let reservedBindings: HB[] = [];
  let reservedKeysWarning: string | null = null;
  const isJsdomNativeFetch =
    typeof navigator !== 'undefined' &&
    navigator.userAgent.includes('jsdom') &&
    /\[native code\]/.test(Function.prototype.toString.call(fetchImpl));
  if (!isJsdomNativeFetch) {
    try {
      const reservedLibraryUrl =
        typeof window !== 'undefined'
          ? new URL('/data/default_reserved_keys.json', window.location.href).toString()
          : '/data/default_reserved_keys.json';
      const response = await fetchImpl(reservedLibraryUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reservedData: any[] = await response.json();
      if (!Array.isArray(reservedData) || reservedData.length === 0) {
        reservedKeysWarning =
          '默认/保留键参考库加载失败，请检查 public/data/default_reserved_keys.json 是否存在。';
      } else {
        reservedBindings = mapReservedLibraryEntries(reservedData);
      }
    } catch {
      reservedKeysWarning =
        '默认/保留键参考库加载失败，请检查 public/data/default_reserved_keys.json 是否存在。';
    }
  }

  const profileResult = await window.atm.listProfiles();
  const profiles = profileResult.success && profileResult.data ? profileResult.data : [];
  const resolvedActiveProfileId = activeProfileId || profiles[0]?.id || '';
  const activeProfile = profiles.find((profile) => profile.id === resolvedActiveProfileId) || null;

  const appliedResult = await window.atm.getAppliedHotkeyProfile();
  const appliedProfileId =
    appliedResult.success && appliedResult.data?.profileId ? appliedResult.data.profileId : '';

  let entries: EnvEntry[] = [];
  let parseWarnings: string[] = [];
  let bindings: HB[] = [];
  let conflicts: Conflict[] = [];
  let userBindings: HB[] = [];

  if (envResult.data.envExists && envResult.data.envFilePath) {
    const parseResult = await window.atm.parseEnvFile(envResult.data.envFilePath);
    if (parseResult.success && parseResult.data) {
      entries = parseResult.data.entries;
      parseWarnings = parseResult.data.warnings || [];

      const validateResult = await window.atm.validateHotkeys(envResult.data.envFilePath);
      if (validateResult.success && validateResult.data) {
        userBindings = normalizeLoadedBindings(validateResult.data.bindings || []);
        bindings = userBindings;
        conflicts = validateResult.data.conflicts || [];
      }
    }
  } else {
    parseWarnings = ['env 文件不存在，请先创建或选择 pcbenv 目录'];
  }

  if (envSources) {
    const referenceSources = envSources.sources.filter((source) => source.isReference && source.exists);
    const referenceBindings: HB[] = [];

    for (const referenceSource of referenceSources) {
      try {
        const parseResult = await window.atm.parseEnvFile(referenceSource.path);
        if (!parseResult.success || !parseResult.data) {
          continue;
        }

        const validateResult = await window.atm.validateHotkeys(referenceSource.path);
        if (!validateResult.success || !validateResult.data) {
          continue;
        }

        const bindingSourceForRef =
          referenceSource.role === 'install_default_env'
            ? 'install_default_env'
            : referenceSource.role === 'site_env'
              ? 'site_env'
              : referenceSource.role === 'company_env'
                ? 'company_env'
                : 'reference_env';

        for (const binding of validateResult.data.bindings || []) {
          referenceBindings.push({
            ...binding,
            id: `ref_${referenceSource.id}_${binding.id}`,
            bindingSource: bindingSourceForRef,
            envSourceId: referenceSource.id,
            envRole: referenceSource.role,
            editable: false,
            status: 'reserved',
            notes: [...(binding.notes || []), `来自参考 env: ${referenceSource.path}`],
          });
        }
      } catch {}
    }

    if (referenceBindings.length > 0) {
      bindings = [...bindings, ...referenceBindings];

      const userKeyMap = new Map<string, HB>();
      for (const binding of userBindings) {
        const normalizedKey = binding.key.toLowerCase();
        if (!userKeyMap.has(normalizedKey)) {
          userKeyMap.set(normalizedKey, binding);
        }
      }

      const seenOverridePairs = new Set<string>();
      const crossEnvConflicts: Conflict[] = [];
      for (const referenceBinding of referenceBindings) {
        const normalizedKey = referenceBinding.key.toLowerCase();
        const userBinding = userKeyMap.get(normalizedKey);
        if (!userBinding || userBinding.command === referenceBinding.command) {
          continue;
        }

        const pairKey = `${normalizedKey}_${referenceBinding.envSourceId}`;
        if (seenOverridePairs.has(pairKey)) {
          continue;
        }

        seenOverridePairs.add(pairKey);
        crossEnvConflicts.push({
          type: 'cross_env_override',
          severity: 'info',
          message: `用户 env 覆盖参考配置: ${normalizedKey}`,
          bindings: [userBinding, referenceBinding],
        });
      }

      if (crossEnvConflicts.length > 0) {
        conflicts = [...conflicts, ...crossEnvConflicts];
      }
    }
  }

  bindings = mergeBindingsWithActiveProfile(bindings, activeProfile);

  if (typeof window.atm.enhancedScanSkills === 'function') {
    try {
      const skillScanResult = await window.atm.enhancedScanSkills();
      if (skillScanResult.success && skillScanResult.data) {
        const directSkillBindings = mapDirectSkillHotkeys(skillScanResult.data);
        if (directSkillBindings.length > 0) {
          reservedBindings = mergeReservedBindings(reservedBindings, directSkillBindings);
        }
      }
    } catch {}
  }

  let favoriteIds: string[] = [];
  if (envResult.data.pcbenvPath) {
    try {
      const favoritesResult = await window.atm.loadFavorites(envResult.data.pcbenvPath);
      if (favoritesResult.success && favoritesResult.data) {
        favoriteIds = favoritesResult.data.favoriteBindingIds || [];
      }
    } catch {}
  }

  let undoStatus: HotkeyWorkspaceUndoStatus = { canUndo: false, message: '' };
  if (envResult.data.pcbenvPath) {
    try {
      const lastChangeResult = await window.atm.getLastChange(envResult.data.pcbenvPath);
      if (lastChangeResult.success && lastChangeResult.data) {
        undoStatus = {
          canUndo: lastChangeResult.data.canUndo,
          message: lastChangeResult.data.record
            ? `上次操作: ${lastChangeResult.data.record.summary}`
            : '',
        };
      }
    } catch {}
  }

  return {
    envInfo: envResult.data,
    entries,
    parseWarnings,
    profiles,
    activeProfileId: resolvedActiveProfileId,
    appliedProfileId,
    bindings,
    reservedBindings,
    reservedKeysWarning,
    conflicts,
    envSources,
    settings,
    favoriteIds,
    undoStatus,
  };
}


