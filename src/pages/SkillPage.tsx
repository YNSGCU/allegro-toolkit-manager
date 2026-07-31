/**
 * ATM - Skill 管理页面（V4.5 增强版）
 * 布局优化：未选中 Skill 时全宽列表，选中后左右分栏
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  SkillFileItem,
  SkillCommandItem,
  SkillReferenceIssue,
  SkillApplyPlan,
  SkillParseResult,
  ReadonlySkillDirectory,
  SkillMeta,
  ImpactAnalysis,
  StaleRefInfo,
  HotkeyReference,
  SkillUsageInfo,
  UsageTreeNode,
  SkillConfigFile,
} from '../types/skill';
import type { HotkeyBinding, ValidationResult } from '../types/hotkey';
import SkillDetailSidebar from '../components/SkillDetailSidebar';
import SkillWorkspaceTable from '../components/SkillWorkspaceTable';
import CommandRegistryTable from '../components/CommandRegistryTable';
import EnhancedRefCheck from '../components/EnhancedRefCheck';
import CompanySkillManager from '../components/CompanySkillManager';
import SkillMetaDialog from '../components/SkillMetaDialog';
import SkillDeleteImpactDialog from '../components/SkillDeleteImpactDialog';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu from '../components/MoreActionsMenu';
import { ApplyPlanDialog, WorkspaceHeader, WorkspacePage } from '../shared/ui';

type TabType = 'list' | 'registry' | 'refs';

/** 筛选选项 */
interface SkillFilters {
  search: string;
  sourceFilter: string;
  loadStatusFilter: string;
  referenceFilter: string;
  errorFilter: string;
}

/** 排序选项 */
type SortField =
  | 'name'
  | 'lastModified'
  | 'entryCommandCount'
  | 'internalFunctionCount'
  | 'totalFunctionCount'
  | 'referenceCount'
  | 'loadStatus'
  | 'sourceType'
  | 'issueCount';
type SortDir = 'asc' | 'desc';

const DETAIL_MODAL_BREAKPOINT = 1180;

const SkillPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== 增强 Skill 数据 =====
  const [companySkills, setCompanySkills] = useState<SkillFileItem[]>([]);
  const [userSkills, setUserSkills] = useState<SkillFileItem[]>([]);
  const [atmSkills, setAtmSkills] = useState<SkillFileItem[]>([]);
  const [allSkills, setAllSkills] = useState<SkillFileItem[]>([]);

  // ===== 命令注册中心 =====
  const [commands, setCommands] = useState<SkillCommandItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);

  // ===== Skill 方案管理 =====
  const [skillProfileStore, setSkillProfileStore] = useState<any>(null);
  const [activeSkillProfile, setActiveSkillProfileLocal] = useState<any>(null);

  // ===== 引用检查 =====
  const [refIssues, setRefIssues] = useState<SkillReferenceIssue[]>([]);
  const [refStats, setRefStats] = useState({ total: 0, errors: 0, warnings: 0, infos: 0 });
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsChecked, setRefsChecked] = useState(false);

  // ===== 详情侧边栏 =====
  const [detailSkill, setDetailSkill] = useState<SkillFileItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasSelectedSkill = Boolean(detailSkill);

  // ===== 小屏检测 =====
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < DETAIL_MODAL_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < DETAIL_MODAL_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ===== Apply Plan =====
  const [pendingPlan, setPendingPlan] = useState<SkillApplyPlan | null>(null);
  const [pendingPlanExecutor, setPendingPlanExecutor] = useState<'skill' | 'skill-profile'>('skill');
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // ===== Loader 预览 =====
  const [loaderPreview, setLoaderPreview] = useState<string | null>(null);
  const [loaderLoading, setLoaderLoading] = useState(false);

  // ===== 筛选和排序 =====
  const [filters, setFilters] = useState<SkillFilters>({
    search: '',
    sourceFilter: 'all',
    loadStatusFilter: 'all',
    referenceFilter: 'all',
    errorFilter: 'all',
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ===== 只读目录 =====
  const [readonlyDirs, setReadonlyDirs] = useState<ReadonlySkillDirectory[]>([]);

  // ===== 快捷键绑定（引用检查用） =====
  const [hotkeyBindings, setHotkeyBindings] = useState<HotkeyBinding[]>([]);

  // ===== V5.0 Skill 元数据（中文备注/自动简介） =====
  const [skillMetaMap, setSkillMetaMap] = useState<Record<string, SkillMeta>>({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaDialogSkill, setMetaDialogSkill] = useState<SkillFileItem | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  // ===== V5.1 影响分析与失效引用 =====
  const [deleteImpact, setDeleteImpact] = useState<ImpactAnalysis | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SkillFileItem | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [staleRefs, setStaleRefs] = useState<StaleRefInfo[]>([]);

  // ===== V5.2 使用状态、健康度、使用关系树、配置 =====
  const [usageStatuses, setUsageStatuses] = useState<Record<string, SkillUsageInfo>>({});
  const [healthScores, setHealthScores] = useState<Record<string, { score: number; deductions: any[] }>>({});
  const [usageTree, setUsageTree] = useState<UsageTreeNode | null>(null);
  const [configFiles, setConfigFiles] = useState<SkillConfigFile[]>([]);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [loaderOrder, setLoaderOrder] = useState<{ order: any[]; issues: any[] } | null>(null);
  const [loaderOrderLoading, setLoaderOrderLoading] = useState(false);
  const [statusesLoading, setStatusesLoading] = useState(false);

  // ===== 待应用操作跟踪（用于卡片视觉状态） =====
  const [pendingSkills, setPendingSkills] = useState<Record<string, 'pending_disable' | 'pending_enable'>>({});

  // ===== V5.3 显示模式切换 =====
  const [displayMode, setDisplayMode] = useState<'original' | 'chinese' | 'bilingual'>('bilingual');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showSourceManager, setShowSourceManager] = useState(false);

  // ════════════════════════════════════════════════
  // 数据加载
  // ════════════════════════════════════════════════

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
        const fallback = await window.atm.scanSkills();
        if (fallback.success && fallback.data) {
          const convertSimple = (old: any[]): SkillFileItem[] =>
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
            }));
          setCompanySkills(convertSimple(fallback.data.company));
          setUserSkills(convertSimple(fallback.data.user));
          setAtmSkills(convertSimple(fallback.data.atm));
          setAllSkills(convertSimple(fallback.data.all));
        }
      }
      // 加载 Skill 方案
      try {
        const spRes = await window.atm.skillProfileLoadAll();
        if (spRes.success && spRes.data) {
          setSkillProfileStore(spRes.data.store);
          setActiveSkillProfileLocal(spRes.data.activeProfile);
        }
      } catch { /* non-critical */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCommands = useCallback(async () => {
    setRegistryLoading(true);
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
      setRegistryLoading(false);
    }
  }, []);

  const loadRefChecks = useCallback(async () => {
    setRefsLoading(true);
    setRefsChecked(false);
    let checkCompleted = false;
    try {
      const envResult = await window.atm.locateEnvironment();
      if (!envResult.success || !envResult.data?.envFilePath) {
        setError('未找到可用于引用检查的 env 文件。');
        return;
      }

      const parseResult = await window.atm.parseEnvFile(envResult.data.envFilePath);
      if (!parseResult.success || !parseResult.data) {
        setError(parseResult.error || 'env 文件解析失败，无法执行引用检查。');
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
        checkCompleted = true;
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
          checkCompleted = true;
        } else {
          setError(oldRefResult.error || refResult.error || '引用检查失败。');
        }
      }

      // V5.1 检查失效引用（外部删除的 Skill）
      try {
        const staleResult = await window.atm.checkStaleRefs(JSON.stringify(bindings));
        if (staleResult.success && staleResult.data) {
          setStaleRefs(staleResult.data);
        }
      } catch {}
    } catch (err) {
      console.error('加载引用检查失败:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefsLoading(false);
      setRefsChecked(checkCompleted);
    }
  }, []);

  useEffect(() => {
    loadEnhancedSkills();
  }, [loadEnhancedSkills]);

  useEffect(() => {
    if (activeTab === 'registry' && commands.length === 0) {
      loadCommands();
    }
    if (activeTab === 'refs' && !refsChecked) {
      loadRefChecks();
    }
  }, [activeTab, commands.length, refsChecked, loadCommands, loadRefChecks]);

  // ════════════════════════════════════════════════
  // 操作处理
  // ════════════════════════════════════════════════

  const handleToggle = async (skillPath: string, enabled: boolean) => {
    setApplyResult(null);
    setPendingPlan(null);
    setPendingPlanExecutor('skill');
    // 查找 Skill ID 并标记待应用状态
    const skill = allSkills.find(s => s.path === skillPath);
    if (skill) {
      setPendingSkills(prev => ({ ...prev, [skill.id]: enabled ? 'pending_enable' : 'pending_disable' }));
    }
    try {
      const result = await window.atm.toggleSkill(skillPath, enabled);
      if (result.success && result.data) {
        setPendingPlan(result.data);
        setPendingPlanExecutor('skill');
      } else {
        setError(result.error || '切换失败');
        // 失败时清除 pending 标记
        if (skill) {
          setPendingSkills(prev => { const n = { ...prev }; delete n[skill.id]; return n; });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (skill) {
        setPendingSkills(prev => { const n = { ...prev }; delete n[skill.id]; return n; });
      }
    }
  };

  const handleApplyPlan = async () => {
    if (!pendingPlan) return;
    setApplying(true);
    try {
      const result = pendingPlanExecutor === 'skill-profile'
        ? await window.atm.skillProfileExecuteApplyPlan(JSON.stringify(pendingPlan))
        : await window.atm.applySkillChanges(JSON.stringify(pendingPlan));
      if (result.success) {
        setApplyResult('Apply 成功，请重启 Allegro 生效。');
        setPendingPlan(null);
        setPendingPlanExecutor('skill');
        setPendingSkills({}); // 清除所有待应用标记
        loadEnhancedSkills();
      } else {
        setApplyResult(`Apply 失败：${result.error}`);
      }
    } catch (err) {
      setApplyResult(`Apply 失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setApplying(false);
    }
  };

  const handleCancelPlan = () => {
    setPendingPlan(null);
    setPendingPlanExecutor('skill');
    setApplyResult(null);
    setPendingSkills({}); // 清除所有待应用标记
  };

  /** 查看详情 */
  const handleShowDetail = async (skill: SkillFileItem) => {
    setDetailLoading(true);
    setDetailSkill(skill);
    try {
      const result = await window.atm.getSkillDetail(skill.path);
      if (result.success && result.data) {
        setDetailSkill(result.data);
      }
    } catch {
      // 使用当前数据
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailSkill(null);
  };

  const handlePreviewLoader = async () => {
    setLoaderLoading(true);
    try {
      const result = await window.atm.generateSkillLoader();
      if (result.success && result.data) {
        setLoaderPreview(result.data);
      } else {
        setLoaderPreview('<!-- 生成失败 -->');
      }
    } catch {
      setLoaderPreview('<!-- 生成失败 -->');
    } finally {
      setLoaderLoading(false);
    }
  };

  const handleBindHotkey = (commandName: string) => {
    if (commandName) {
      navigate(`/hotkeys?highlight=${encodeURIComponent(commandName)}`);
    } else {
      navigate('/hotkeys');
    }
  };

  // ════════════════════════════════════════════════
  // V5.0 Skill 元数据操作
  // ════════════════════════════════════════════════

  /** 加载所有 Skill 元数据 */
  const loadSkillMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      const result = await window.atm.skillMetaGetAll();
      if (result.success && result.data) {
        setSkillMetaMap(result.data);
      }
    } catch {
      // 忽略错误，元数据不是关键功能
    } finally {
      setMetaLoading(false);
    }
  }, []);

  /** 首次加载 Skill 列表后自动加载元数据 */
  useEffect(() => {
    if (allSkills.length > 0 && Object.keys(skillMetaMap).length < allSkills.length) {
      loadSkillMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSkills.length]);

  /** 保存元数据 */
  const handleSaveMeta = async (skillId: string, meta: Partial<SkillMeta>) => {
    // 如果传入了 displayName 但没有 userName，同步写入 userName
    const enhancedMeta = { ...meta };
    if (meta.displayName && !meta.userName) {
      enhancedMeta.userName = meta.displayName;
    }
    const result = await window.atm.skillMetaSave(skillId, enhancedMeta);
    if (!result.success) {
      throw new Error(result.error || '保存失败');
    }
    // 从返回数据中获取完整更新后的元数据，或客户端合并
    const updatedData = result.data || {
      ...enhancedMeta,
      updatedAt: new Date().toISOString(),
    };
    setSkillMetaMap((prev) => ({
      ...prev,
      [skillId]: {
        ...(prev[skillId] || { skillId, filePath: '' }),
        ...updatedData,
      },
    }));
    setApplyResult('备注保存成功');
    setTimeout(() => setApplyResult(prev => prev === '备注保存成功' ? null : prev), 3000);
  };

  /** 打开编辑备注弹窗 */
  const handleEditNote = (skill: SkillFileItem) => {
    setMetaDialogSkill(skill);
  };

  /** 关闭编辑备注弹窗 */
  const handleCloseMetaDialog = () => {
    setMetaDialogSkill(null);
  };

  /** 重新自动分析单个 Skill */
  const handleReAnalyze = async (skill: SkillFileItem) => {
    // 用 applyResult 显示分析状态
    setApplyResult(`正在分析 ${skill.name}…`);
    try {
      const result = await window.atm.skillMetaAnalyze(JSON.stringify(skill));
      if (result.success && result.data) {
        setSkillMetaMap((prev) => ({
          ...prev,
          [skill.id]: result.data,
        }));
        setApplyResult(`${skill.name} 分析完成`);
        // 3秒后自动清除提示
        setTimeout(() => setApplyResult(prev => prev?.includes('分析完成') ? null : prev), 3000);
      } else {
        setApplyResult(`分析失败：${result.error || '未知错误'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setApplyResult(`分析出错：${msg}`);
      console.error('重分析失败:', err);
    }
  };

  /** 批量重新分析所有 Skill */
  const handleReAnalyzeAll = async () => {
    setAnalyzingAll(true);
    try {
      const allSkillsList = [...companySkills, ...userSkills, ...atmSkills];
      const result = await window.atm.skillMetaAnalyzeAll(JSON.stringify(allSkillsList));
      if (result.success && result.data) {
        setSkillMetaMap(result.data);
      }
    } catch (err) {
      console.error('批量分析失败:', err);
    } finally {
      setAnalyzingAll(false);
    }
  };

  /** 复制说明到剪贴板 */
  const handleCopySummary = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  /** 清除自动分析结果 */
  const handleClearAuto = async (skill: SkillFileItem) => {
    try {
      const result = await window.atm.skillMetaClearAuto(skill.id);
      if (result.success) {
        setSkillMetaMap((prev) => ({
          ...prev,
          [skill.id]: {
            ...(prev[skill.id] || { skillId: skill.id, filePath: skill.path }),
            autoName: undefined,
            autoSummary: undefined,
            autoCategory: undefined,
            tags: [],
            confidence: undefined,
            generatedAt: undefined,
            updatedAt: new Date().toISOString(),
          },
        }));
      }
    } catch (err) {
      console.error('清除自动分析失败:', err);
    }
  };

  // ════════════════════════════════════════════════
  // V5.1 删除/禁用影响分析
  // ════════════════════════════════════════════════

  const handleDeleteSkill = async (skill: SkillFileItem) => {
    setImpactLoading(true);
    setApplyResult(null);
    try {
      const result = await window.atm.analyzeSkillImpact(
        skill.path,
        JSON.stringify(hotkeyBindings),
      );
      if (result.success && result.data) {
        setDeleteTarget(skill);
        setDeleteImpact(result.data);
      } else {
        setApplyResult(`影响分析失败：${result.error}`);
      }
    } catch (err) {
      setApplyResult(`影响分析失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDeleteConfirm = async (option: string) => {
    if (!deleteTarget) return;
    setImpactLoading(true);
    try {
      const result = await window.atm.createDeletePlan(deleteTarget.path, option);
      if (result.success && result.data) {
        setPendingPlan(result.data);
        setPendingPlanExecutor('skill');
        setDeleteImpact(null);
        setDeleteTarget(null);
      } else {
        setApplyResult(`创建删除计划失败：${result.error}`);
      }
    } catch (err) {
      setApplyResult(`创建删除计划失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteImpact(null);
    if (deleteTarget) {
      setPendingSkills(prev => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    }
    setDeleteTarget(null);
  };

  const handleJumpToHotkey = (hotkeyKey: string) => {
    navigate(`/hotkeys?highlight=${encodeURIComponent(hotkeyKey)}`);
  };

  const handleEditHotkey = (hotkeyKey: string) => {
    navigate(`/hotkeys?edit=${encodeURIComponent(hotkeyKey)}`);
  };

  const handleDeleteHotkeyBinding = (_ref: HotkeyReference) => {
    setApplyResult('请切换到快捷键管理页进行删除操作。');
  };

  const handleViewEnvRawLine = (_source: string, _lineNumber: number) => {
    setApplyResult('原始行查看功能请使用快捷键页的原始行查看器。');
  };

  const handleAddMenu = (_commandName: string) => {
    setApplyResult('请前往菜单页处理菜单引用。');
  };

  const handleAddReadonlyDir = async () => {
    try {
      const result = await window.atm.selectReadonlySkillDir();
      if (result.success && result.data) {
        const scanResult = await window.atm.addReadonlySkillDir(result.data);
        if (scanResult.success && scanResult.data) {
          const newDir: ReadonlySkillDirectory = {
            id: `dir-${Date.now()}`,
            path: scanResult.data.dirPath,
            sourceType: 'company_skill',
            addedAt: new Date().toISOString(),
            skillCount: scanResult.data.skillCount,
          };
          setReadonlyDirs([...readonlyDirs, newDir]);
          loadEnhancedSkills();
        }
      }
    } catch (err) {
      console.error('添加只读目录失败:', err);
    }
  };

  const handleRemoveReadonlyDir = (dirId: string) => {
    setReadonlyDirs(readonlyDirs.filter((d) => d.id !== dirId));
    loadEnhancedSkills();
  };

  const handleRescanDir = async (_dirId: string) => {
    loadEnhancedSkills();
  };

  const handleOpenDir = (_dirPath: string) => {
    setApplyResult('请手动打开文件管理器浏览目录。');
  };

  const handleIgnoreIssue = (issueId: string) => {
    setRefIssues(refIssues.map((i) => i.id === issueId ? { ...i, ignored: true } : i));
  };

  const handleNavigateToRefs = () => {
    setActiveTab('refs');
  };

  // ════════════════════════════════════════════════
  // V5.2 使用状态 / 健康度 / 安全禁用 / README / Loader 顺序
  // ════════════════════════════════════════════════

  /** 加载使用状态 */
  const loadUsageStatuses = useCallback(async () => {
    setStatusesLoading(true);
    try {
      const result = await window.atm.computeSkillUsageStatuses();
      if (result.success && result.data) {
        setUsageStatuses(result.data);
      }
    } catch {}
    // 同时加载健康度
    try {
      const healthResult = await window.atm.computeSkillHealthScores();
      if (healthResult.success && healthResult.data) {
        setHealthScores(healthResult.data);
      }
    } catch {}
    setStatusesLoading(false);
  }, []);

  /** Skill 列表加载后自动加载状态 */
  useEffect(() => {
    if (allSkills.length > 0 && Object.keys(usageStatuses).length < allSkills.length) {
      loadUsageStatuses();
    }
  }, [allSkills.length]);

  /** 选中 Skill 后加载使用关系树和配置 */
  useEffect(() => {
    if (detailSkill) {
      // 使用关系树
      const loadTree = async () => {
        try {
          const result = await window.atm.buildSkillUsageTree(
            detailSkill.path,
            JSON.stringify(hotkeyBindings),
          );
          if (result.success && result.data) {
            setUsageTree(result.data);
          }
        } catch {}
      };
      loadTree();

      // 配置文件
      const loadConfigs = async () => {
        try {
          const result = await window.atm.scanSkillConfigFiles(detailSkill.dirPath, detailSkill.name);
          if (result.success && result.data) {
            setConfigFiles(result.data);
          }
        } catch {}
      };
      loadConfigs();
    } else {
      setUsageTree(null);
      setConfigFiles([]);
      setReadmeContent(null);
    }
  }, [detailSkill]);

  /** 安全禁用 — 有引用时弹出影响分析 */
  const handleToggleSafe = async (skillPath: string, enabled: boolean) => {
    // 如果是启用，直接切换（无风险）
    if (enabled) {
      handleToggle(skillPath, enabled);
      return;
    }

    // 禁用 — 先检查是否有引用
    const skill = allSkills.find(s => s.path === skillPath);
    if (!skill) { handleToggle(skillPath, enabled); return; }

    // 立即标记待禁用状态
    setPendingSkills(prev => ({ ...prev, [skill.id]: 'pending_disable' }));

    if (skill.hotkeyRefs.length > 0 || skill.menuRefs.length > 0) {
      // 有引用 → 显示影响分析
      setImpactLoading(true);
      try {
        const result = await window.atm.analyzeSkillImpact(
          skillPath,
          JSON.stringify(hotkeyBindings),
        );
        if (result.success && result.data) {
          setDeleteTarget(skill);
          setDeleteImpact(result.data);
          // 预选"仅禁用加载"
          setImpactLoading(false);
          return;
        }
      } catch {}
      setImpactLoading(false);
    }

    // 无引用 → 直接切换
    handleToggle(skillPath, enabled);
  };

  /** 生成 README */
  const handleGenerateReadme = async (skill: SkillFileItem) => {
    try {
      const meta = skillMetaMap[skill.id];
      const result = await window.atm.generateSkillReadme(
        skill.path,
        JSON.stringify(meta || {}),
      );
      if (result.success && result.data) {
        setReadmeContent(result.data);
      } else {
        setApplyResult('生成 README 失败');
      }
    } catch (err) {
      setApplyResult(`生成 README 失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** 复制 README */
  const handleCopyReadme = () => {
    if (readmeContent) {
      navigator.clipboard?.writeText(readmeContent).catch(() => {});
      setApplyResult('README 已复制到剪贴板');
    }
  };

  /** 关闭 README */
  const handleCloseReadme = () => {
    setReadmeContent(null);
  };

  /** 预览 Loader 顺序 */
  const handlePreviewLoaderOrder = async () => {
    setLoaderOrderLoading(true);
    try {
      const result = await window.atm.getSkillLoaderOrder();
      if (result.success && result.data) {
        setLoaderOrder(result.data);
      } else {
        setApplyResult('获取加载顺序失败');
      }
    } catch (err) {
      setApplyResult(`获取加载顺序失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoaderOrderLoading(false);
    }
  };

  /** 关闭 Loader 顺序 */
  const handleCloseLoaderOrder = () => {
    setLoaderOrder(null);
  };

  /** 导出包预览 */
  const handleExportPackage = async (skill: SkillFileItem) => {
    try {
      const result = await window.atm.exportSkillPackage(
        skill.path,
        JSON.stringify({ includeSource: true }),
      );
      if (result.success && result.data) {
        const preview = result.data;
        setApplyResult(
          `📦 导出预览: ${preview.name}\n` +
          `入口命令: ${preview.entryCommands.join(', ')}\n` +
          `快捷键: ${preview.hotkeyCount} 个\n` +
          `配置: ${preview.configFiles?.length || 0} 个\n` +
          (preview.warning ? `\n警告：${preview.warning}` : '')
        );
      }
    } catch (err) {
      setApplyResult(`导出预览失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ════════════════════════════════════════════════
  // 筛选和排序逻辑 — 统一数据流
  // ════════════════════════════════════════════════

  /**
   * 对 refIssues 统计每条 skill 的问题数（用于 issueCount 排序）
   */
  const issueCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of refIssues) {
      if (issue.skillId) {
        map.set(issue.skillId, (map.get(issue.skillId) || 0) + 1);
      }
    }
    return map;
  }, [refIssues]);

  /**
   * visibleSkills — 所有 Skill 经过统一筛选 + 排序后的结果
   * 数据流: raw skills → filter → sort → group → render
   */
  const visibleSkills = useMemo(() => {
    const allRaw = [...companySkills, ...userSkills, ...atmSkills];

    // === 1. 筛选 ===
    let list = allRaw.filter((s) => {
      // 文本搜索（V5.3: 同时搜索原始名、中文名、备注、命令名）
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const meta = skillMetaMap[s.id];
        const searchFields = [
          s.name,                           // 原始文件名
          s.path,                           // 文件路径
          meta?.originalName || '',          // 元数据中的原始名
          meta?.autoName || '',              // 自动中文名
          meta?.userName || '',               // 用户设置中文名
          meta?.displayName || '',           // displayName（向后兼容）
          meta?.userNote || '',              // 用户备注
          meta?.autoSummary || '',           // 自动简介
          ...s.entryCommands.map((c) => c.name),  // 入口命令名
        ];
        const match = searchFields.some(f => f.toLowerCase().includes(q));
        if (!match) return false;
      }

      // 来源筛选
      if (filters.sourceFilter !== 'all') {
        if (filters.sourceFilter === 'readonly_skill') {
          if (!s.readonly) return false;
        } else if (s.sourceType !== filters.sourceFilter) {
          return false;
        }
      }

      // 加载状态筛选
      if (filters.loadStatusFilter !== 'all') {
        if (filters.loadStatusFilter === 'enabled') {
          if (!s.enabled) return false;
        } else if (filters.loadStatusFilter === 'disabled') {
          if (s.enabled) return false;
        } else if (s.loadStatus !== filters.loadStatusFilter) {
          return false;
        }
      }

      // 引用状态筛选
      if (filters.referenceFilter !== 'all') {
        switch (filters.referenceFilter) {
          case 'has_hotkey_ref':
            if (s.hotkeyRefs.length === 0) return false;
            break;
          case 'no_hotkey_ref':
            if (s.hotkeyRefs.length > 0) return false;
            break;
          case 'has_menu_ref':
            if (s.menuRefs.length === 0) return false;
            break;
          case 'no_reference':
            if (s.hotkeyRefs.length > 0 || s.menuRefs.length > 0) return false;
            break;
        }
      }

      // 错误状态筛选
      if (filters.errorFilter !== 'all') {
        switch (filters.errorFilter) {
          case 'normal':
            if (s.parseStatus !== 'ok') return false;
            break;
          case 'warning':
            if (s.parseStatus !== 'warning') return false;
            break;
          case 'error':
          case 'parse_error':
            if (s.parseStatus !== 'error') return false;
            break;
          case 'duplicate_command':
            if (!s.entryCommands.some((c) => c.conflictStatus === 'duplicate_command')) return false;
            break;
          case 'missing_load':
            if (s.loadStatus !== 'enabled_but_not_loaded' && s.loadStatus !== 'maybe_unloaded') return false;
            break;
        }
      }

      return true;
    });

    // === 2. 排序 ===
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'lastModified':
          const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          cmp = aTime - bTime;
          break;
        case 'entryCommandCount':
          cmp = a.entryCommands.length - b.entryCommands.length;
          break;
        case 'internalFunctionCount':
          cmp = a.internalFunctions.length - b.internalFunctions.length;
          break;
        case 'totalFunctionCount':
          cmp = a.totalFunctionCount - b.totalFunctionCount;
          break;
        case 'referenceCount':
          cmp = (a.hotkeyRefs.length + a.menuRefs.length) - (b.hotkeyRefs.length + b.menuRefs.length);
          break;
        case 'loadStatus':
          cmp = a.loadStatus.localeCompare(b.loadStatus);
          break;
        case 'sourceType':
          cmp = a.sourceType.localeCompare(b.sourceType);
          break;
        case 'issueCount':
          cmp = (issueCountMap.get(a.id) || 0) - (issueCountMap.get(b.id) || 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [companySkills, userSkills, atmSkills, filters, sortField, sortDir, issueCountMap]);

  /** 当前是否启用了任何筛选（不含搜索） */
  const hasActiveFilters =
    filters.sourceFilter !== 'all' ||
    filters.loadStatusFilter !== 'all' ||
    filters.referenceFilter !== 'all' ||
    filters.errorFilter !== 'all';

  /** 构建筛选条件摘要文本 */
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.sourceFilter !== 'all') {
      const labels: Record<string, string> = {
        user_skill: '用户', company_skill: '公司', atm_managed_skill: 'ATM', readonly_skill: '只读', unknown: '未知',
      };
      parts.push(`来源: ${labels[filters.sourceFilter] || filters.sourceFilter}`);
    }
    if (filters.loadStatusFilter !== 'all') {
      const labels: Record<string, string> = {
        enabled: '已启用', disabled: '已禁用', loaded_configured: '已加载',
        enabled_but_not_loaded: '未配置启动加载', readonly_reference: '只读参考', unknown: '未知',
      };
      parts.push(`状态: ${labels[filters.loadStatusFilter] || filters.loadStatusFilter}`);
    }
    if (filters.referenceFilter !== 'all') {
      const labels: Record<string, string> = {
        has_hotkey_ref: '有快捷键', no_hotkey_ref: '无快捷键', has_menu_ref: '有菜单', no_reference: '无引用',
      };
      parts.push(`引用: ${labels[filters.referenceFilter] || filters.referenceFilter}`);
    }
    if (filters.errorFilter !== 'all') {
      const labels: Record<string, string> = {
        normal: '正常', warning: '有警告', error: '有错误', parse_error: '解析失败',
        duplicate_command: '命令冲突', missing_load: '可能未加载',
      };
      parts.push(`错误: ${labels[filters.errorFilter] || filters.errorFilter}`);
    }
    if (filters.search.trim()) {
      parts.push(`搜索: "${filters.search.trim()}"`);
    }
    return parts.join(' | ');
  }, [filters]);

  /** 排序描述文本 */
  const sortSummary = useMemo(() => {
    const labels: Record<string, string> = {
      name: '名称', lastModified: '修改时间', entryCommandCount: '入口命令数',
      internalFunctionCount: '内部函数数', totalFunctionCount: '函数总数',
      referenceCount: '引用数', loadStatus: '加载状态', sourceType: '来源', issueCount: '问题数',
    };
    const dir = sortDir === 'asc' ? '升序' : '降序';
    return `${labels[sortField] || sortField} ${dir}`;
  }, [sortField, sortDir]);

  const totalRawCount = companySkills.length + userSkills.length + atmSkills.length;

  /** 当前选中 Skill 相关的引用检查问题 */
  const detailRefIssues = useMemo(() => {
    if (!detailSkill || refIssues.length === 0) return [];
    return refIssues.filter(
      (issue) =>
        issue.skillId === detailSkill.id ||
        issue.commandName?.toLowerCase().includes(detailSkill.name.toLowerCase()) ||
        detailSkill.entryCommands.some((c) => c.name === issue.commandName) ||
        detailSkill.hotkeyRefs.some((r) => r.key === issue.hotkeyKey)
    );
  }, [detailSkill, refIssues]);

  const detailRefStats = useMemo(() => {
    const errs = detailRefIssues.filter((i) => i.severity === 'error').length;
    const warns = detailRefIssues.filter((i) => i.severity === 'warning').length;
    const infos = detailRefIssues.filter((i) => i.severity === 'info').length;
    return detailRefIssues.length > 0
      ? { total: detailRefIssues.length, errors: errs, warnings: warns, infos }
      : undefined;
  }, [detailRefIssues]);

  // ════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════

  const updateFilter = (key: keyof SkillFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const sortLabels: Record<string, string> = {
    name: '排序: 名称',
    lastModified: '排序: 修改时间',
    entryCommandCount: '排序: 入口命令数',
    internalFunctionCount: '排序: 内部函数数',
    totalFunctionCount: '排序: 函数总数',
    referenceCount: '排序: 引用数',
    loadStatus: '排序: 加载状态',
    sourceType: '排序: 来源',
    issueCount: '排序: 问题数',
  };

  // 小屏 + 有选中 → 用弹窗展示详情
  // 宽屏 + 有选中 → 左右分栏
  const showSplitLayout = hasSelectedSkill && !isNarrow;
  const showDetailModal = hasSelectedSkill && isNarrow;
  /** 顶栏 — 各 Tab 共用 */
  const renderPageHeader = () => (
    <>
      <WorkspaceHeader
        className="skill-workspace-header"
        eyebrow="能力管理"
        title="Skill 管理"
        description="扫描、检查并安全应用 Allegro Skill 配置。"
        actions={(
          <>
          <button className="btn btn-primary" onClick={loadEnhancedSkills} disabled={loading}>
            {loading ? '扫描中...' : '重新扫描'}
          </button>
          <MoreActionsMenu
            actions={[
              { label: '管理 Skill 来源', onClick: () => setShowSourceManager((value) => !value) },
              { label: '预览 Loader', onClick: handlePreviewLoader, disabled: loaderLoading },
              { label: '检查加载顺序', onClick: handlePreviewLoaderOrder, disabled: loaderOrderLoading },
              { label: '全部重新分析', onClick: handleReAnalyzeAll, disabled: analyzingAll },
            ]}
          />
          </>
        )}
      />

      {/* Skill 方案栏 */}
      {skillProfileStore && (
        <ProfileBar
          compact
          title="Skill 方案"
          profiles={skillProfileStore.profiles || []}
          activeProfileId={skillProfileStore.activeProfileId}
          onCreate={async (name) => {
            const res = await window.atm.skillProfileCreate(name);
            if (res.success) setSkillProfileStore(res.data.store);
          }}
          onCopy={async (profileId) => {
            const res = await window.atm.skillProfileCopy(profileId);
            if (res.success) setSkillProfileStore(res.data.store);
          }}
          onRename={async (profileId, newName) => {
            const res = await window.atm.skillProfileRename(profileId, newName);
            if (res.success) setSkillProfileStore(res.data.store);
          }}
          onDelete={async (profileId) => {
            const res = await window.atm.skillProfileDelete(profileId);
            if (res.success) setSkillProfileStore(res.data.store);
          }}
          onSwitch={async (profileId) => {
            const res = await window.atm.skillProfileSetActive(profileId);
            if (res.success) {
              setSkillProfileStore(res.data.store);
              setActiveSkillProfileLocal(res.data.activeProfile);
            }
          }}
          onApply={async () => {
            if (activeSkillProfile) {
              const res = await window.atm.skillProfileCreateApplyPlan(JSON.stringify(activeSkillProfile));
              if (res.success && res.data) {
                setPendingPlan(res.data);
                setPendingPlanExecutor('skill-profile');
                setApplyResult(null);
              } else {
                setApplyResult(`生成 Skill 方案应用计划失败：${res.error || '未知错误'}`);
              }
            }
          }}
          applyLabel="生成 Apply Plan"
        />
      )}

      {/* 全局状态总览 */}
      <GlobalStatusBar
        items={[
          {
            label: 'Skill 总数',
            value: `${allSkills.length} 个`,
            status: allSkills.length > 0 ? 'ok' : 'muted',
          },
          {
            label: '用户 Skill',
            value: `${userSkills.length} 个`,
            status: userSkills.length > 0 ? 'ok' : 'muted',
          },
          {
            label: '公司 Skill',
            value: `${companySkills.length} 个`,
            status: companySkills.length > 0 ? 'ok' : 'muted',
          },
          {
            label: '引用检查',
            value: !refsChecked
              ? '尚未检查'
              : refStats.total > 0
                ? `${refStats.total} 个问题`
                : '检查通过',
            status: !refsChecked ? 'muted' : refStats.errors > 0 ? 'error' : refStats.warnings > 0 ? 'warning' : 'ok',
          },
        ]}
      />

      {error && (
        <div className="message message-error">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => { setError(null); loadEnhancedSkills(); }}>
            重试
          </button>
        </div>
      )}

      {/* Tab 导航 */}
      <div className="skill-workspace-tabs" role="tablist" aria-label="Skill 页面视图">
        {([
          { key: 'list', label: 'Skill 管理', count: visibleSkills.length },
          { key: 'registry', label: '命令', count: commands.length },
          { key: 'refs', label: '诊断', count: refsChecked ? refStats.total : 0 },
        ] as { key: TabType; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            <span className="skill-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <ApplyPlanDialog
        open={!!pendingPlan}
        plan={pendingPlan}
        applying={applying}
        title="确认应用 Skill 配置"
        intro="确认后将按计划更新 Skill 方案、加载器和启动配置，并在写入前创建必要备份。"
        confirmLabel="确认执行计划"
        onConfirm={handleApplyPlan}
        onCancel={handleCancelPlan}
      />

      {applyResult && (
        <div className={`message ${/失败|出错/.test(applyResult) ? 'message-error' : 'message-info'} skill-operation-message`}>
          {applyResult}
        </div>
      )}
    </>
  );

  /** Tab 1: Skill 列表内容（不含顶栏） */
  const renderSkillListContent = () => (
    <div className="skill-list-area">
      <section className="skill-workspace-toolbar" aria-label="Skill 筛选与排序">
        <input
          type="text"
          className="search-input"
          placeholder="搜索 Skill / 命令 / 路径..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          aria-label="搜索 Skill"
        />
        <select
          value={filters.sourceFilter}
          onChange={(e) => updateFilter('sourceFilter', e.target.value)}
          className="atm-input"
          aria-label="按来源筛选"
        >
          <option value="all">全部来源</option>
          <option value="user_skill">用户 Skill</option>
          <option value="company_skill">公司 Skill</option>
          <option value="atm_managed_skill">ATM 托管</option>
          <option value="readonly_skill">只读 Skill</option>
        </select>
        <select
          value={filters.loadStatusFilter}
          onChange={(e) => updateFilter('loadStatusFilter', e.target.value)}
          className="atm-input"
          aria-label="按加载状态筛选"
        >
          <option value="all">全部加载状态</option>
          <option value="loaded_configured">已配置加载</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
          <option value="enabled_but_not_loaded">未配置启动加载</option>
          <option value="readonly_reference">只读参考</option>
        </select>
        <button
          type="button"
          className={`btn btn-sm ${showAdvancedFilters || hasActiveFilters ? 'btn-primary' : ''}`}
          onClick={() => setShowAdvancedFilters((value) => !value)}
          aria-expanded={showAdvancedFilters}
        >
          高级筛选{hasActiveFilters ? ' · 已启用' : ''}
        </button>
        <span className="skill-workspace-result-count">
          {visibleSkills.length} / {totalRawCount}
        </span>

        {showAdvancedFilters && (
          <div className="skill-advanced-filters">
            <select
              value={filters.referenceFilter}
              onChange={(e) => updateFilter('referenceFilter', e.target.value)}
              className="atm-input"
              aria-label="按引用状态筛选"
            >
              <option value="all">全部引用状态</option>
              <option value="has_hotkey_ref">有快捷键引用</option>
              <option value="no_hotkey_ref">无快捷键引用</option>
              <option value="has_menu_ref">有菜单引用</option>
              <option value="no_reference">无引用</option>
            </select>
            <select
              value={filters.errorFilter}
              onChange={(e) => updateFilter('errorFilter', e.target.value)}
              className="atm-input"
              aria-label="按错误状态筛选"
            >
              <option value="all">全部错误状态</option>
              <option value="normal">正常</option>
              <option value="warning">有警告</option>
              <option value="error">有错误</option>
              <option value="parse_error">解析失败</option>
              <option value="duplicate_command">命令冲突</option>
              <option value="missing_load">可能未加载</option>
            </select>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="atm-input"
              aria-label="排序字段"
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
              {sortDir === 'asc' ? '升序' : '降序'}
            </button>
            <div className="display-mode-toggle" role="group" aria-label="名称显示模式">
          {([
            { key: 'original', label: '英文' },
            { key: 'bilingual', label: '中英' },
            { key: 'chinese', label: '中文' },
          ] as const).map(opt => (
            <button
              key={opt.key}
              className={`btn btn-sm ${displayMode === opt.key ? 'btn-primary' : ''}`}
              onClick={() => setDisplayMode(opt.key)}
              title={opt.key === 'original' ? '仅显示英文原名' : opt.key === 'chinese' ? '优先显示中文名' : '英文名+中文备注'}
            >
              {opt.label}
            </button>
          ))}
            </div>
            {hasActiveFilters && (
              <button className="btn btn-sm" onClick={() => setFilters({
                search: '', sourceFilter: 'all', loadStatusFilter: 'all', referenceFilter: 'all', errorFilter: 'all',
              })}>
                清除筛选
              </button>
            )}
          </div>
        )}

        {(filterSummary || sortSummary) && (
          <div className="skill-filter-summary">
            <span>{filterSummary || '未启用筛选'}</span>
            <span>排序：{sortSummary}</span>
          </div>
        )}
      </section>

      {/* Loader 预览 */}
      {loaderPreview && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">📄 generated_skill_loader.il 预览</div>
          <pre style={{
            background: 'var(--bg-secondary)',
            padding: 16,
            borderRadius: 'var(--radius)',
            fontSize: 12,
            lineHeight: 1.6,
            overflowX: 'auto',
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {loaderPreview}
          </pre>
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setLoaderPreview(null)}>
            关闭预览
          </button>
        </div>
      )}

      {/* Loader 加载顺序 */}
      {loaderOrder && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">📋 Loader 加载顺序分析</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span>加载顺序（{loaderOrder.order.length} 个 Skill）</span>
              <span className="skill-loader-ok">{loaderOrder.order.filter(o => o.fileExists).length} 正常</span>
              <span className="skill-loader-missing">{loaderOrder.order.filter(o => !o.fileExists).length} 缺失</span>
            </div>
            <table className="data-table" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>名称</th>
                  <th>加载状态</th>
                  <th>依赖</th>
                  <th>文件状态</th>
                </tr>
              </thead>
              <tbody>
                {loaderOrder.order.map((item: any) => (
                  <tr key={item.index} style={{ opacity: item.fileExists ? 1 : 0.5 }}>
                    <td>{item.index}</td>
                    <td><code>{item.name}</code></td>
                    <td>{item.isEnabled ? (item.loadStatus === 'loaded_configured' ? '已加载' : '需检查') : '已禁用'} · {item.loadStatus}</td>
                    <td>{item.hasDependencies ? item.dependencies.join(', ') : '无'}</td>
                    <td>{item.fileExists ? '存在' : '缺失'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loaderOrder.issues.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-yellow)', marginBottom: 4 }}>检测问题</div>
              {loaderOrder.issues.map((issue: any, i: number) => (
                <div key={i} className={`message message-${issue.severity === 'error' ? 'error' : 'warning'}`} style={{ fontSize: 11, padding: '6px 10px', marginBottom: 4 }}>
                  {issue.severity === 'error' ? '错误：' : '警告：'}{issue.message}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={handleCloseLoaderOrder}>
            关闭
          </button>
        </div>
      )}

      {showSourceManager && (
        <CompanySkillManager
          directories={readonlyDirs}
          skills={companySkills}
          onAddDirectory={handleAddReadonlyDir}
          onRemoveDirectory={handleRemoveReadonlyDir}
          onRescanDirectory={handleRescanDir}
          onOpenDirectory={handleOpenDir}
          onRefresh={loadEnhancedSkills}
          scanning={loading}
        />
      )}

      <SkillWorkspaceTable
        skills={visibleSkills}
        selectedSkillId={detailSkill?.id}
        metaMap={skillMetaMap}
        usageStatuses={usageStatuses}
        issueCountMap={issueCountMap}
        pendingSkills={pendingSkills}
        displayMode={displayMode}
        onSelect={handleShowDetail}
        onToggle={handleToggleSafe}
      />
    </div>
  );

  return (
    <WorkspacePage
      density="compact"
      scroll="contained"
      className={`workspace-page workspace-page-skills skill-page-layout ${
        showSplitLayout ? 'skill-page-split' : ''
      }`}
    >
      {/* ===== 主内容区 ===== */}
      <div className="skill-page-main">
        {renderPageHeader()}

        {/* TAB 1: Skill 列表 */}
        {activeTab === 'list' && renderSkillListContent()}

        {/* TAB 2: 命令注册中心 */}
        {activeTab === 'registry' && (
          <div className="skill-secondary-view">
            <div className="skill-secondary-view-header">
              <div>
                <h2>命令</h2>
                <p>查看 Skill 暴露的入口命令、来源及冲突状态。</p>
              </div>
              <button className="btn btn-sm" onClick={loadCommands} disabled={registryLoading}>
                {registryLoading ? '加载中...' : '刷新命令'}
              </button>
            </div>
            {commands.length === 0 && !registryLoading && (
              <div className="message message-info">尚未加载命令数据，点击“刷新命令”开始检查。</div>
            )}
            <CommandRegistryTable
              commands={commands}
              loading={registryLoading}
              onBindHotkey={handleBindHotkey}
              onAddMenu={handleAddMenu}
            />
          </div>
        )}

        {/* TAB 3: 引用检查 */}
        {activeTab === 'refs' && (
          <div className="skill-secondary-view">
            <div className="skill-secondary-view-header">
              <div>
                <h2>诊断</h2>
                <p>集中检查解析、加载、命令冲突与失效引用。</p>
              </div>
              <button className="btn btn-sm" onClick={() => { setRefIssues([]); setRefsChecked(false); loadRefChecks(); }} disabled={refsLoading}>
                {refsLoading ? '检查中...' : refsChecked ? '重新检查' : '开始检查'}
              </button>
            </div>
            {!refsChecked && !refsLoading ? (
              <div className="skill-diagnostic-empty">
                <strong>尚未完成诊断</strong>
                <span>运行检查后，这里会显示引用、加载和命令问题。</span>
              </div>
            ) : (
              <EnhancedRefCheck
                issues={refIssues}
                stats={refStats}
                loading={refsLoading}
                onBindHotkey={handleBindHotkey}
                onAddMenu={handleAddMenu}
                onIgnoreIssue={handleIgnoreIssue}
              />
            )}
          </div>
        )}
      </div>

      {/* ===== 详情侧边栏 — 仅选中时显示 ===== */}
      {hasSelectedSkill && !isNarrow && (
        <SkillDetailSidebar
          skill={detailSkill}
          loading={detailLoading}
          onClose={handleCloseDetail}
          onToggle={handleToggleSafe}
          onBindHotkey={handleBindHotkey}
          onAddMenu={handleAddMenu}
          refIssues={detailRefIssues}
          refStats={detailRefStats}
          onNavigateToRefs={handleNavigateToRefs}
          meta={detailSkill ? skillMetaMap[detailSkill.id] : null}
          onEditNote={handleEditNote}
          onReAnalyze={handleReAnalyze}
          onCopySummary={handleCopySummary}
          onClearAuto={handleClearAuto}
          onDelete={handleDeleteSkill}
          onJumpToHotkey={handleJumpToHotkey}
          onEditHotkey={handleEditHotkey}
          onDeleteHotkeyBinding={handleDeleteHotkeyBinding}
          onViewEnvRawLine={handleViewEnvRawLine}
          usageInfo={detailSkill ? usageStatuses[detailSkill.id] : undefined}
          usageTree={usageTree || undefined}
          configFiles={configFiles}
          onGenerateReadme={handleGenerateReadme}
          onExportPackage={handleExportPackage}
        />
      )}

      {/* ===== 小屏详情弹窗 ===== */}
      {showDetailModal && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <SkillDetailSidebar
              skill={detailSkill}
              loading={detailLoading}
              onClose={handleCloseDetail}
              onToggle={handleToggleSafe}
              onBindHotkey={handleBindHotkey}
              onAddMenu={handleAddMenu}
              refIssues={detailRefIssues}
              refStats={detailRefStats}
              onNavigateToRefs={handleNavigateToRefs}
              meta={detailSkill ? skillMetaMap[detailSkill.id] : null}
              onEditNote={handleEditNote}
              onReAnalyze={handleReAnalyze}
              onCopySummary={handleCopySummary}
              onClearAuto={handleClearAuto}
              onDelete={handleDeleteSkill}
              onJumpToHotkey={handleJumpToHotkey}
              onEditHotkey={handleEditHotkey}
              onDeleteHotkeyBinding={handleDeleteHotkeyBinding}
              onViewEnvRawLine={handleViewEnvRawLine}
              usageInfo={detailSkill ? usageStatuses[detailSkill.id] : undefined}
              usageTree={usageTree || undefined}
              configFiles={configFiles}
              onGenerateReadme={handleGenerateReadme}
              onExportPackage={handleExportPackage}
            />
          </div>
        </div>
      )}

      {/* ===== V5.0 编辑备注弹窗 ===== */}
      {metaDialogSkill && (
        <SkillMetaDialog
          skillName={metaDialogSkill.name}
          skillId={metaDialogSkill.id}
          meta={skillMetaMap[metaDialogSkill.id] || null}
          onSave={handleSaveMeta}
          onClose={handleCloseMetaDialog}
        />
      )}

      {/* V5.1 删除/禁用影响分析弹窗 */}
      {deleteImpact && deleteTarget && (
        <SkillDeleteImpactDialog
          skill={deleteTarget}
          impact={deleteImpact}
          loading={impactLoading}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* V5.2 README 使用说明弹窗 */}
      {readmeContent && (
        <div className="modal-overlay" onClick={handleCloseReadme}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>📝 Skill 使用说明</h3>
              <button className="btn btn-sm" onClick={handleCloseReadme} aria-label="关闭 README 预览">关闭</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <pre style={{
                background: 'var(--bg-primary)',
                padding: 16,
                borderRadius: 'var(--radius)',
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '50vh',
                overflowY: 'auto',
              }}>
                {readmeContent}
              </pre>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
              <button className="btn" onClick={handleCloseReadme}>关闭</button>
              <button className="btn btn-primary" onClick={handleCopyReadme}>📋 复制说明</button>
            </div>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
};

export default SkillPage;
