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
import SkillCard from '../components/SkillCard';
import SkillDetailSidebar from '../components/SkillDetailSidebar';
import CommandRegistryTable from '../components/CommandRegistryTable';
import EnhancedRefCheck from '../components/EnhancedRefCheck';
import CompanySkillManager from '../components/CompanySkillManager';
import SkillMetaDialog from '../components/SkillMetaDialog';
import SkillDeleteImpactDialog from '../components/SkillDeleteImpactDialog';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu from '../components/MoreActionsMenu';
import CoreWorkspaceHero from '../components/CoreWorkspaceHero';

type TabType = 'list' | 'registry' | 'refs';

/** Apply Plan action 类型 → 中文映射 */
import { getStepLabel } from '../utils/stepLabels';
function getStepTypeLabel(type: string): string {
  const info = getStepLabel(type);
  return `${info.icon} ${info.label}`;
}

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

  // ===== 详情侧边栏 =====
  const [detailSkill, setDetailSkill] = useState<SkillFileItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasSelectedSkill = Boolean(detailSkill);

  // ===== 小屏检测 =====
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ===== Apply Plan =====
  const [pendingPlan, setPendingPlan] = useState<SkillApplyPlan | null>(null);
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

      // V5.1 检查失效引用（外部删除的 Skill）
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

  useEffect(() => {
    loadEnhancedSkills();
  }, [loadEnhancedSkills]);

  useEffect(() => {
    if (activeTab === 'registry' && commands.length === 0) {
      loadCommands();
    }
    if (activeTab === 'refs' && refIssues.length === 0) {
      loadRefChecks();
    }
  }, [activeTab, commands.length, refIssues.length, loadCommands, loadRefChecks]);

  // ════════════════════════════════════════════════
  // 操作处理
  // ════════════════════════════════════════════════

  const handleToggle = async (skillPath: string, enabled: boolean) => {
    setApplyResult(null);
    setPendingPlan(null);
    // 查找 Skill ID 并标记待应用状态
    const skill = allSkills.find(s => s.path === skillPath);
    if (skill) {
      setPendingSkills(prev => ({ ...prev, [skill.id]: enabled ? 'pending_enable' : 'pending_disable' }));
    }
    try {
      const result = await window.atm.toggleSkill(skillPath, enabled);
      if (result.success && result.data) {
        setPendingPlan(result.data);
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
      const result = await window.atm.applySkillChanges(JSON.stringify(pendingPlan));
      if (result.success) {
        setApplyResult('✅ Apply 成功！请重启 Allegro 生效。');
        setPendingPlan(null);
        setPendingSkills({}); // 清除所有待应用标记
        loadEnhancedSkills();
      } else {
        setApplyResult(`❌ Apply 失败: ${result.error}`);
      }
    } catch (err) {
      setApplyResult(`❌ Apply 失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setApplying(false);
    }
  };

  const handleCancelPlan = () => {
    setPendingPlan(null);
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
    setApplyResult(`✅ 备注保存成功`);
    setTimeout(() => setApplyResult(prev => prev?.startsWith('✅') ? null : prev), 3000);
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
    setApplyResult(`🔄 正在分析 ${skill.name}...`);
    try {
      const result = await window.atm.skillMetaAnalyze(JSON.stringify(skill));
      if (result.success && result.data) {
        setSkillMetaMap((prev) => ({
          ...prev,
          [skill.id]: result.data,
        }));
        setApplyResult(`✅ ${skill.name} 分析完成！`);
        // 3秒后自动清除提示
        setTimeout(() => setApplyResult(prev => prev?.startsWith('✅') ? null : prev), 3000);
      } else {
        setApplyResult(`❌ 分析失败: ${result.error || '未知错误'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setApplyResult(`❌ 分析出错: ${msg}`);
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
        setApplyResult(`❌ 影响分析失败: ${result.error}`);
      }
    } catch (err) {
      setApplyResult(`❌ 影响分析失败: ${err instanceof Error ? err.message : String(err)}`);
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
        setDeleteImpact(null);
        setDeleteTarget(null);
      } else {
        setApplyResult(`❌ 创建删除计划失败: ${result.error}`);
      }
    } catch (err) {
      setApplyResult(`❌ 创建删除计划失败: ${err instanceof Error ? err.message : String(err)}`);
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
    setApplyResult('ℹ️ 请切换到快捷键管理页进行删除操作。');
  };

  const handleViewEnvRawLine = (_source: string, _lineNumber: number) => {
    setApplyResult('ℹ️ 原始行查看功能请使用快捷键页的原始行查看器。');
  };

  const handleAddMenu = (_commandName: string) => {
    setApplyResult('ℹ️ 菜单管理模块未完成，请期待后续版本。');
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
    setApplyResult('ℹ️ 请手动打开文件管理器浏览目录。');
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
        setApplyResult('❌ 生成 README 失败');
      }
    } catch (err) {
      setApplyResult(`❌ 生成 README 失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** 复制 README */
  const handleCopyReadme = () => {
    if (readmeContent) {
      navigator.clipboard?.writeText(readmeContent).catch(() => {});
      setApplyResult('✅ README 已复制到剪贴板');
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
        setApplyResult('❌ 获取加载顺序失败');
      }
    } catch (err) {
      setApplyResult(`❌ 获取加载顺序失败: ${err instanceof Error ? err.message : String(err)}`);
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
          (preview.warning ? `\n⚠️ ${preview.warning}` : '')
        );
      }
    } catch (err) {
      setApplyResult(`❌ 导出预览失败: ${err instanceof Error ? err.message : String(err)}`);
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

  /** 分组后的 visibleSkills */
  const groupedVisibleSkills = useMemo(() => {
    const groups: Record<string, SkillFileItem[]> = {
      company: [],
      user: [],
      atm: [],
    };
    for (const skill of visibleSkills) {
      if (skill.tier === 'company') groups.company.push(skill);
      else if (skill.tier === 'user') groups.user.push(skill);
      else if (skill.tier === 'atm') groups.atm.push(skill);
    }
    return groups;
  }, [visibleSkills]);

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
        enabled_but_not_loaded: '可能未加载', readonly_reference: '只读参考', unknown: '未知',
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
      <CoreWorkspaceHero
        eyebrow="Capability Workspace"
        title="Skill 编排台"
        description="把 Skill 扫描、启停、引用检查和命令注册收拢成一个能力工作区，先看可用性，再看组织方式。"
        metrics={[
          { label: 'Skill 总量', value: String(allSkills.length), tone: 'accent' },
          { label: '用户 Skill', value: String(userSkills.length) },
          { label: '公司 Skill', value: String(companySkills.length) },
          {
            label: '引用状态',
            value:
              refStats.errors > 0
                ? `${refStats.errors} 个错误`
                : refStats.warnings > 0
                  ? `${refStats.warnings} 个警告`
                  : '已通过',
          },
        ]}
      />

      {/* Skill 方案栏 */}
      {skillProfileStore && (
        <ProfileBar
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
          onApply={() => {
            if (activeSkillProfile) {
              window.atm.skillProfileCreateApplyPlan(JSON.stringify(activeSkillProfile))
                .then(res => {
                  if (res.success) alert('Skill 方案 Apply Plan 已生成，请前往 Apply Plan 面板确认执行。');
                });
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
            value: refStats.total > 0
              ? `${refStats.total} 个问题`
              : '无问题',
            status: refStats.errors > 0 ? 'error' : refStats.warnings > 0 ? 'warning' : (refStats.total === 0 ? 'ok' : 'muted'),
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
      <div className="tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
        {([
          { key: 'list', label: '📋 Skill 列表', count: visibleSkills.length },
          { key: 'registry', label: '命令注册中心', count: commands.length },
          { key: 'refs', label: '引用检查', count: refStats.total },
        ] as { key: TabType; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: activeTab === tab.key ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="badge badge-info" style={{ fontSize: 10 }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {pendingPlan && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent-yellow)', marginBottom: 20 }}>
          <div className="card-header">
            <span>📋 应用计划预览</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>
              {pendingPlan.requiresRestart ? ' ⚠️ 需重启' : ''}
            </span>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>{pendingPlan.title || pendingPlan.summary || '应用计划'}</strong>
            {pendingPlan.description && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{pendingPlan.description}</p>
            )}
          </div>
          {/* 步骤列表 */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              执行步骤（{pendingPlan.steps.length} 步）
            </div>
            {pendingPlan.steps.map((step, i) => (
              <div key={step.id || i} style={{
                padding: '5px 8px', marginBottom: 2,
                background: 'rgba(125, 207, 255, 0.04)',
                borderRadius: 4,
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 20 }}>{i + 1}.</span>
                <span style={{ color: 'var(--accent-blue)', minWidth: 80, flexShrink: 0 }}>{getStepTypeLabel(step.type)}</span>
                <span style={{ flex: 1 }}>{step.description || step.title}</span>
              </div>
            ))}
          </div>
          {/* 风险提示 */}
          {pendingPlan.risks && pendingPlan.risks.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--accent-red)', marginBottom: 4 }}>
                风险提示（{pendingPlan.risks.length}）
              </div>
              {pendingPlan.risks.map((risk) => (
                <div key={risk.id} className={`message message-${risk.severity === 'error' ? 'error' : risk.severity === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: 11, padding: '6px 10px', marginBottom: 4 }}>
                  {risk.severity === 'error' ? '❌' : risk.severity === 'warning' ? '⚠️' : 'ℹ️'} {risk.title}
                  {risk.description && <div style={{ marginTop: 2 }}>{risk.description}</div>}
                </div>
              ))}
            </div>
          )}
          {/* 兼容旧版 warnings */}
          {(!pendingPlan.risks || pendingPlan.risks.length === 0) && pendingPlan.warnings && pendingPlan.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {pendingPlan.warnings.map((w, i) => (
                <div key={i} className={`message message-${w.level === 'danger' ? 'error' : w.level}`} style={{ fontSize: 11, padding: '6px 10px', marginBottom: 4 }}>
                  {w.level === 'danger' ? '❌' : '⚠️'} {w.message}
                </div>
              ))}
            </div>
          )}
          {/* 备份信息 */}
          {pendingPlan.backups && pendingPlan.backups.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, padding: '6px 8px', background: 'rgba(108, 108, 138, 0.08)', borderRadius: 4 }}>
              📦 将备份 {pendingPlan.backups.length} 个文件
            </div>
          )}
          {pendingPlan.requiresRestart && (
            <div className="message message-warning" style={{ marginBottom: 12 }}>
              ⚠️ 此操作需要重启 Allegro 才能生效
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleApplyPlan} disabled={applying}>
              {applying ? '执行中...' : '✅ 确认执行'}
            </button>
            <button className="btn" onClick={handleCancelPlan} disabled={applying}>
              取消
            </button>
          </div>
        </div>
      )}

      {applyResult && (
        <div className={`message ${applyResult.startsWith('✅') || applyResult.startsWith('ℹ️') ? 'message-info' : 'message-error'}`} style={{ marginBottom: 20 }}>
          {applyResult}
        </div>
      )}
    </>
  );

  /** Tab 1: Skill 列表内容（不含顶栏） */
  const renderSkillListContent = () => (
    <div className={showSplitLayout ? 'skill-list-area' : ''}>
      {/* 操作栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={loadEnhancedSkills} disabled={loading}>
          🔄 {loading ? '扫描中...' : '重新扫描'}
        </button>

        <MoreActionsMenu
          actions={[
            {
              label: '预览 Loader',
              icon: '📄',
              onClick: handlePreviewLoader,
              disabled: loaderLoading,
            },
            {
              label: '加载顺序',
              icon: '📋',
              onClick: handlePreviewLoaderOrder,
              disabled: loaderOrderLoading,
            },
            {
              label: '全部重新分析',
              icon: '🔄',
              onClick: handleReAnalyzeAll,
              disabled: analyzingAll,
            },
          ]}
        />
      </div>

      {/* 筛选栏 */}
      <div className="skill-filter-bar" style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="search-input"
          placeholder="搜索 Skill / 命令 / 路径..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: 13,
            flex: '1 1 180px',
            outline: 'none',
          }}
        />
        <select
          value={filters.sourceFilter}
          onChange={(e) => updateFilter('sourceFilter', e.target.value)}
          className="atm-input"
          style={{ fontSize: 12, padding: '5px 8px' }}
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
          style={{ fontSize: 12, padding: '5px 8px' }}
        >
          <option value="all">全部加载状态</option>
          <option value="loaded_configured">已配置加载</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
          <option value="enabled_but_not_loaded">可能未加载</option>
          <option value="readonly_reference">只读参考</option>
        </select>
        <select
          value={filters.referenceFilter}
          onChange={(e) => updateFilter('referenceFilter', e.target.value)}
          className="atm-input"
          style={{ fontSize: 12, padding: '5px 8px' }}
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
          style={{ fontSize: 12, padding: '5px 8px' }}
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
          style={{ fontSize: 12, padding: '5px 8px' }}
        >
          {Object.entries(sortLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} title="切换升序/降序">
          {sortDir === 'asc' ? '↑ 升序' : '↓ 降序'}
        </button>
        {/* V5.3 显示模式切换 */}
        <div className="display-mode-toggle" style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          {([
            { key: 'original', label: '英文' },
            { key: 'bilingual', label: '中英' },
            { key: 'chinese', label: '中文' },
          ] as const).map(opt => (
            <button
              key={opt.key}
              className={`btn btn-sm ${displayMode === opt.key ? 'btn-primary' : ''}`}
              onClick={() => setDisplayMode(opt.key)}
              style={{ fontSize: 11, padding: '3px 8px' }}
              title={opt.key === 'original' ? '仅显示英文原名' : opt.key === 'chinese' ? '优先显示中文名' : '英文名+中文备注'}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 结果计数 + 筛选条件 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>
          当前显示：
          <strong style={{ color: 'var(--text-primary)' }}>{visibleSkills.length}</strong>
          {' '}/ {totalRawCount} 个 Skill
          {hasActiveFilters && (
            <span style={{ marginLeft: 8 }}>
              <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => setFilters({
                search: '', sourceFilter: 'all', loadStatusFilter: 'all', referenceFilter: 'all', errorFilter: 'all',
              })}>
                清除筛选
              </button>
            </span>
          )}
        </span>
        <span>{filterSummary ? `筛选: ${filterSummary}` : ''}</span>
        <span>排序: {sortSummary}</span>
      </div>

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
              <span style={{ color: 'var(--accent-green)' }}>✅ {loaderOrder.order.filter(o => o.fileExists).length} 正常</span>
              <span style={{ color: 'var(--accent-red)' }}>❌ {loaderOrder.order.filter(o => !o.fileExists).length} 缺失</span>
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
                    <td>{item.isEnabled ? (item.loadStatus === 'loaded_configured' ? '✅' : '⚠️') : '⛔'} {item.loadStatus}</td>
                    <td>{item.hasDependencies ? item.dependencies.join(', ') : '无'}</td>
                    <td>{item.fileExists ? '✅' : '❌'}</td>
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
                  {issue.severity === 'error' ? '❌' : '⚠️'} {issue.message}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={handleCloseLoaderOrder}>
            关闭
          </button>
        </div>
      )}

      {/* 公司 Skill 区域 */}
      {(groupedVisibleSkills.company.length > 0 || !hasActiveFilters) && (
        <CompanySkillManager
          directories={readonlyDirs}
          skills={groupedVisibleSkills.company}
          onAddDirectory={handleAddReadonlyDir}
          onRemoveDirectory={handleRemoveReadonlyDir}
          onRescanDirectory={handleRescanDir}
          onOpenDirectory={handleOpenDir}
          onRefresh={loadEnhancedSkills}
          scanning={loading}
        />
      )}

      {/* 用户 Skill */}
      {groupedVisibleSkills.user.length > 0 ? (
        <div className="skill-section" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--accent-cyan)' }}>
            👤 用户 Skill（可管理）({groupedVisibleSkills.user.length})
          </h3>
          <div className={`skill-grid ${showSplitLayout ? 'skill-grid-compact' : ''}`}>
            {groupedVisibleSkills.user.map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                onToggle={handleToggleSafe}
                onShowDetail={handleShowDetail}
                selected={detailSkill?.id === s.id}
                meta={skillMetaMap[s.id]}
                onEditNote={handleEditNote}
                onReAnalyze={handleReAnalyze}
                onDelete={handleDeleteSkill}
                usageInfo={usageStatuses[s.id]}
                pendingAction={pendingSkills[s.id]}
                displayMode={displayMode}
              />
            ))}
          </div>
        </div>
      ) : hasActiveFilters ? null : (
        <div className="skill-section" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--accent-cyan)' }}>
            👤 用户 Skill（可管理）({groupedVisibleSkills.user.length})
          </h3>
          <div className="empty-state" style={{ padding: 20 }}>
            <p>暂无用户 Skill</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              将 .il / .cls 文件放入 pcbenv/skill/ 目录
            </p>
          </div>
        </div>
      )}

      {/* ATM Skill */}
      {groupedVisibleSkills.atm.length > 0 ? (
        <div className="skill-section" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--accent-green)' }}>
            🤖 ATM Skill（完全托管）({groupedVisibleSkills.atm.length})
          </h3>
          <div className={`skill-grid ${showSplitLayout ? 'skill-grid-compact' : ''}`}>
            {groupedVisibleSkills.atm.map((s) => (
              <SkillCard
                key={s.id}
                skill={s}
                onToggle={handleToggleSafe}
                onShowDetail={handleShowDetail}
                selected={detailSkill?.id === s.id}
                meta={skillMetaMap[s.id]}
                onEditNote={handleEditNote}
                onReAnalyze={handleReAnalyze}
                onDelete={handleDeleteSkill}
                usageInfo={usageStatuses[s.id]}
                pendingAction={pendingSkills[s.id]}
                displayMode={displayMode}
              />
            ))}
          </div>
        </div>
      ) : hasActiveFilters ? null : (
        <div className="skill-section" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--accent-green)' }}>
            🤖 ATM Skill（完全托管）({groupedVisibleSkills.atm.length})
          </h3>
          <div className="empty-state" style={{ padding: 20 }}>
            <p>暂无 ATM 托管 Skill</p>
          </div>
        </div>
      )}

      {/* 无匹配结果 */}
      {visibleSkills.length === 0 && hasActiveFilters && (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>🔍 没有符合当前筛选条件的 Skill</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            当前筛选条件: {filterSummary}
          </p>
          <button className="btn btn-sm" onClick={() => setFilters({
            search: '', sourceFilter: 'all', loadStatusFilter: 'all', referenceFilter: 'all', errorFilter: 'all',
          })}>
            清除全部筛选
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
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
          <div>
            {commands.length === 0 && !registryLoading && (
              <div style={{ marginBottom: 12 }}>
                <button className="btn btn-sm" onClick={loadCommands}>
                  加载命令注册中心
                </button>
              </div>
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
          <div>
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-sm" onClick={() => { setRefIssues([]); loadRefChecks(); }} disabled={refsLoading}>
                {refsLoading ? '检查中...' : '重新检查'}
              </button>
            </div>
            <EnhancedRefCheck
              issues={refIssues}
              stats={refStats}
              loading={refsLoading}
              onBindHotkey={handleBindHotkey}
              onAddMenu={handleAddMenu}
              onIgnoreIssue={handleIgnoreIssue}
            />
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
              <button className="btn btn-sm" onClick={handleCloseReadme}>✕</button>
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
    </div>
  );
};

export default SkillPage;
