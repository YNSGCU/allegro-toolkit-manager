/**
 * ATM - Skill 扫描数据加载 Hook（V5.4）
 * 从 SkillPage.tsx 提取，简化主页面数据加载逻辑
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  SkillFileItem,
  SkillCommandItem,
  SkillReferenceIssue,
  SkillMeta,
  SkillUsageInfo,
  HotkeyReference,
  StaleRefInfo,
} from '../types/skill';
import type { HotkeyBinding } from '../types/hotkey';

interface UseSkillDataReturn {
  loading: boolean;
  error: string | null;
  companySkills: SkillFileItem[];
  userSkills: SkillFileItem[];
  atmSkills: SkillFileItem[];
  allSkills: SkillFileItem[];
  commands: SkillCommandItem[];
  commandsLoading: boolean;
  refIssues: SkillReferenceIssue[];
  refStats: { total: number; errors: number; warnings: number; infos: number };
  refsLoading: boolean;
  hotkeyBindings: HotkeyBinding[];
  staleRefs: StaleRefInfo[];
  skillMetaMap: Record<string, SkillMeta>;
  usageStatuses: Record<string, SkillUsageInfo>;
  healthScores: Record<string, { score: number; deductions: any[] }>;
  metaLoading: boolean;
  reload: () => Promise<void>;
  reloadCommands: () => Promise<void>;
  reloadRefChecks: () => Promise<void>;
  reloadMeta: () => Promise<void>;
  reloadUsageStatuses: () => Promise<void>;
}

export function useSkillData(): UseSkillDataReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [companySkills, setCompanySkills] = useState<SkillFileItem[]>([]);
  const [userSkills, setUserSkills] = useState<SkillFileItem[]>([]);
  const [atmSkills, setAtmSkills] = useState<SkillFileItem[]>([]);
  const [allSkills, setAllSkills] = useState<SkillFileItem[]>([]);

  const [commands, setCommands] = useState<SkillCommandItem[]>([]);
  const [commandsLoading, setCommandsLoading] = useState(false);

  const [refIssues, setRefIssues] = useState<SkillReferenceIssue[]>([]);
  const [refStats, setRefStats] = useState({ total: 0, errors: 0, warnings: 0, infos: 0 });
  const [refsLoading, setRefsLoading] = useState(false);

  const [hotkeyBindings, setHotkeyBindings] = useState<HotkeyBinding[]>([]);
  const [staleRefs, setStaleRefs] = useState<StaleRefInfo[]>([]);

  const [skillMetaMap, setSkillMetaMap] = useState<Record<string, SkillMeta>>({});
  const [metaLoading, setMetaLoading] = useState(false);

  const [usageStatuses, setUsageStatuses] = useState<Record<string, SkillUsageInfo>>({});
  const [healthScores, setHealthScores] = useState<Record<string, { score: number; deductions: any[] }>>({});

  /** fallback: 旧版 scanSkills 转换 */
  const convertSimple = useCallback((old: any[]): SkillFileItem[] =>
    (old || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      path: s.filePath,
      dirPath: s.dirPath,
      sourceType: s.tier === 'company' ? 'company_skill' :
                  s.tier === 'atm' ? 'atm_managed_skill' : 'user_skill',
      tier: s.tier,
      readonly: s.tier === 'company',
      writable: s.tier !== 'company',
      enabled: s.status === 'enabled',
      loadStatus: s.status === 'enabled' ? 'loaded_configured' : 'disabled',
      parseStatus: s.error ? 'error' : 'ok',
      parseError: s.error,
      packageType: s.hasPackageJson ? 'atm_package' : 'single_file',
      hasPackageJson: !!s.hasPackageJson,
      dependencies: s.dependencies || [],
      totalFunctionCount: (s.functions || []).length,
      entryCommands: (s.functions || []).map((f: any, idx: number) => ({
        id: `${s.id}-cmd-${idx}`,
        name: f.name,
        sourceSkillId: s.id,
        sourceFile: s.filePath,
        sourceSkillName: s.name,
        commandKind: f.type === 'procedure' ? 'procedure' : 'defun',
        isEntry: true,
        confidence: 'low' as const,
        hotkeys: [],
        menuPaths: [],
        loadStatus: s.status === 'enabled' ? 'loaded_configured' : 'disabled',
        conflictStatus: 'normal' as const,
        tier: s.tier,
        skillEnabled: s.status === 'enabled',
      })),
      internalFunctions: [],
      hotkeyRefs: [],
      menuRefs: [],
      functions: s.functions || [],
    })), []);

  /** 加载增强扫描数据（主数据源） */
  const loadEnhancedSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.atm.enhancedScanSkills();
      if (result.success && result.data) {
        setCompanySkills(result.data.company || []);
        setUserSkills(result.data.user || []);
        setAtmSkills(result.data.atm || []);
        setAllSkills(result.data.all || []);
      } else {
        // fallback 到旧版
        const fallback = await window.atm.scanSkills();
        if (fallback.success && fallback.data) {
          setCompanySkills(convertSimple(fallback.data.company));
          setUserSkills(convertSimple(fallback.data.user));
          setAtmSkills(convertSimple(fallback.data.atm));
          setAllSkills(convertSimple(fallback.data.all));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [convertSimple]);

  /** 加载命令列表 */
  const loadCommands = useCallback(async () => {
    setCommandsLoading(true);
    try {
      const result = await window.atm.getEnhancedCommandList();
      if (result.success && result.data) {
        setCommands(result.data.commandList || []);
        if (result.data.skills) {
          const s = result.data.skills;
          if (s.company) setCompanySkills(s.company);
          if (s.user) setUserSkills(s.user);
          if (s.atm) setAtmSkills(s.atm);
          if (s.all) setAllSkills(s.all);
        }
      } else {
        const fallback = await window.atm.getCommandRegistry();
        if (fallback.success && fallback.data?.registry) {
          const reg = fallback.data.registry;
          const cmdList: SkillCommandItem[] = [];
          for (const [name, entries] of Object.entries(reg.entries)) {
            for (const entry of (entries as any[])) {
              cmdList.push({
                id: `${name}-${entry.skillFilePath}`,
                name,
                sourceSkillId: entry.skillFilePath,
                sourceFile: entry.skillFilePath,
                sourceSkillName: entry.skillName,
                commandKind: entry.type === 'procedure' ? 'procedure' : 'defun',
                isEntry: true,
                confidence: 'low' as const,
                hotkeys: [],
                menuPaths: [],
                loadStatus: entry.skillEnabled ? 'loaded_configured' : 'disabled',
                conflictStatus: 'normal' as const,
                tier: entry.tier,
                skillEnabled: entry.skillEnabled,
              });
            }
          }
          setCommands(cmdList);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommandsLoading(false);
    }
  }, []);

  /** 加载引用检查 */
  const loadRefChecks = useCallback(async () => {
    setRefsLoading(true);
    try {
      const envResult = await window.atm.locateEnvironment();
      if (!envResult.success || !envResult.data?.envFilePath) {
        setRefsLoading(false);
        return;
      }

      const parseResult = await window.atm.parseEnvFile(envResult.data.envFilePath);
      if (!parseResult.success || !parseResult.data) {
        setRefsLoading(false);
        return;
      }

      const bindings: HotkeyBinding[] = parseResult.data.entries
        .filter((e: any) => e.type === 'funckey' || e.type === 'alias')
        .map((e: any) => ({
          id: `${e.type}_${e.key}_${e.lineNumber}`,
          key: e.key || '',
          command: e.command || '',
          type: e.type,
          source: e.source || 'unknown',
          status: 'normal' as const,
          lineNumber: e.lineNumber,
        }));

      setHotkeyBindings(bindings);

      const refResult = await window.atm.enhancedValidateRefs(JSON.stringify(bindings));
      if (refResult.success && refResult.data) {
        setRefIssues(refResult.data.issues || []);
        setRefStats(refResult.data.stats || { total: 0, errors: 0, warnings: 0, infos: 0 });
      } else {
        const oldRefResult = await window.atm.validateSkillRefs(JSON.stringify(bindings));
        if (oldRefResult.success && oldRefResult.data?.refChecks) {
          const rc = oldRefResult.data.refChecks;
          const issues: SkillReferenceIssue[] = (rc.checks || []).map((c: any, i: number) => ({
            id: `check-${i}`,
            severity: c.severity || 'info',
            type: c.type === 'unresolved' ? 'hotkey_command_missing' :
                  c.type === 'disabled_skill' ? 'skill_not_loaded' :
                  c.type === 'ambiguous' ? 'duplicate_command' : 'hotkey_command_missing',
            title: c.type === 'resolved' ? `已匹配: ${c.command}` : `问题: ${c.command}`,
            description: c.message || '',
            commandName: c.command,
            suggestedActions: ['查看引用详情', '手动修正'],
            details: c.matches ? { matchedSkills: c.matches.map((m: any) => m.skillName) } : undefined,
          }));
          setRefIssues(issues);
          setRefStats({
            total: issues.length,
            errors: issues.filter((i) => i.severity === 'error').length,
            warnings: issues.filter((i) => i.severity === 'warning').length,
            infos: issues.filter((i) => i.severity === 'info').length,
          });
        }
      }

      // V5.1 检查失效引用
      try {
        const staleResult = await window.atm.checkStaleRefs(JSON.stringify(bindings));
        if (staleResult.success && staleResult.data) {
          setStaleRefs(staleResult.data);
        }
      } catch {}
    } catch (err) {
      console.error('加载引用检查失败:', err);
    } finally {
      setRefsLoading(false);
    }
  }, []);

  /** 加载元数据 */
  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const result = await window.atm.skillMetaGetAll();
      if (result.success && result.data) {
        setSkillMetaMap(result.data);
      }
    } catch (err) {
      console.error('加载元数据失败:', err);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  /** 加载使用状态 */
  const loadUsageStatuses = useCallback(async () => {
    try {
      const [statusesResult, healthResult] = await Promise.all([
        window.atm.computeSkillUsageStatuses(),
        window.atm.computeSkillHealthScores(),
      ]);
      if (statusesResult.success && statusesResult.data) {
        setUsageStatuses(statusesResult.data);
      }
      if (healthResult.success && healthResult.data) {
        setHealthScores(healthResult.data);
      }
    } catch (err) {
      console.error('加载使用状态失败:', err);
    }
  }, []);

  /** 首次加载 */
  useEffect(() => {
    loadEnhancedSkills();
    loadMeta();
  }, [loadEnhancedSkills, loadMeta]);

  /** 使用状态在 skill 数据加载完成后加载 */
  useEffect(() => {
    if (allSkills.length > 0) {
      loadUsageStatuses();
    }
  }, [allSkills.length, loadUsageStatuses]);

  return {
    loading,
    error,
    companySkills,
    userSkills,
    atmSkills,
    allSkills,
    commands,
    commandsLoading,
    refIssues,
    refStats,
    refsLoading,
    hotkeyBindings,
    staleRefs,
    skillMetaMap,
    usageStatuses,
    healthScores,
    metaLoading,
    reload: loadEnhancedSkills,
    reloadCommands: loadCommands,
    reloadRefChecks: loadRefChecks,
    reloadMeta: loadMeta,
    reloadUsageStatuses: loadUsageStatuses,
  };
}
