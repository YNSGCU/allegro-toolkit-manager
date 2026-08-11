/**
 * ATM - 菜单管理页面（V5.5 可视化菜单编辑）
 *
 * 三种视图：
 * 1. 菜单树视图 — 可视化菜单树 + 右侧详情面板
 * 2. 命令视图 — 命令列表，显示哪些命令已有/没有菜单
 * 3. 引用检查 — 问题列表
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  FolderPlus,
  Info,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type {
  MenuEnvironmentAlternative,
  MenuItemConfig,
  MenuIssue,
  MenuProfile,
  MenuProfileImportPreview,
  MenuProfileRecoveryCandidate,
  MenuProfileStore,
  MenuTreeValidationIssue,
} from '../types/menu';
import { generateMenuId, validateMenuTree } from '../types/menu';
import { reorderMenuItem } from '../utils/menuTreeOrder';
import { showToast } from '../components/common/Toast';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu from '../components/MoreActionsMenu';
import MenuTree from '../components/MenuTree';
import MenuTreeAddBar from '../components/MenuTreeAddBar';
import MenuItemEditor from '../components/MenuItemEditor';
import CommandSelector from '../components/CommandSelector';
import MenuPreviewDialog from '../components/MenuPreviewDialog';
import MenuApplyPlanDialog from '../components/MenuApplyPlanDialog';
import MenuProfileImportDialog from '../components/MenuProfileImportDialog';
import { useMenuApplyPlan } from '../hooks/useMenuApplyPlan';
import {
  registerEnvironmentSwitchGuard,
  runEnvironmentSwitchGuards,
} from '../services/environmentSwitchGuard';
import { formatUserError, PageState, WorkspaceHeader, WorkspacePage } from '../shared/ui';

type TabType = 'tree' | 'commands' | 'refs';

interface LinkedCommand {
  commandName: string;
  sourceSkillId?: string;
  sourceSkillName?: string;
  sourceSkillFile?: string;
  sourceType?: string;
  entryType?: string;
  hotkeys?: string[];
  menuPaths?: string[];
  chineseName?: string;
  skillLoaded?: boolean;
}

interface LinkedSkill {
  id: string;
  name: string;
  file: string;
  isEnabled: boolean;
  isLoaded: boolean;
}

const MenuPage: React.FC = () => {
  const navigate = useNavigate();

  // ═══════════════════════════════════════════════════
  // 状态
  // ═══════════════════════════════════════════════════

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 菜单数据
  const [store, setStore] = useState<MenuProfileStore | null>(null);
  const [profile, setProfile] = useState<MenuProfile | null>(null);
  const [items, setItems] = useState<MenuItemConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 联动数据
  const [commands, setCommands] = useState<LinkedCommand[]>([]);
  const [skills, setSkills] = useState<LinkedSkill[]>([]);

  // UI 状态
  const [tab, setTab] = useState<TabType>('tree');
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');

  // 文件状态
  const [fileStatus, setFileStatus] = useState<{
    profileExists: boolean;
    ilExists: boolean;
    bootstrapHasMenu: boolean;
    ilInitHasBootstrap: boolean;
    ilInitPath: string | null;
    hasMenuItems: boolean;
  } | null>(null);
  const [savedItemsJson, setSavedItemsJson] = useState('[]');
  const [hasUnappliedDraft, setHasUnappliedDraft] = useState(false);
  const [needsAllegroRestart, setNeedsAllegroRestart] = useState(false);
  const [recovery, setRecovery] = useState<MenuProfileRecoveryCandidate | null>(null);
  const [environment, setEnvironment] = useState<{ id?: string | null; name?: string; version?: string | null; pcbenvPath?: string | null } | null>(null);
  const [alternatives, setAlternatives] = useState<MenuEnvironmentAlternative[]>([]);
  const [switchingEnvironment, setSwitchingEnvironment] = useState(false);

  // 弹窗
  const [showCommandSelector, setShowCommandSelector] = useState(false);
  const [commandSelectorTarget, setCommandSelectorTarget] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewJson, setPreviewJson] = useState('');
  const [previewCounts, setPreviewCounts] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<MenuProfileImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Apply Plan
  const {
    pendingPlan,
    applyResult,
    applyError,
    applying,
    generatePlan,
    generateRecoveryPlan,
    generateEnvironmentCopyPlan,
    generateImportPlan,
    executePlan,
    clearPlan,
    clearResult,
  } = useMenuApplyPlan();

  // ═══════════════════════════════════════════════════
  // 数据加载
  // ═══════════════════════════════════════════════════

  /**
   * 标记菜单树中非法项（顶级 separator/command）为 error 状态
   */
  const markIllegalItems = useCallback((items: MenuItemConfig[]): MenuItemConfig[] => {
    const validation = validateMenuTree(items);
    if (!validation.hasError) return items;
    const errorIds = new Set(validation.errors.map(e => e.itemId));
    const markRecursive = (list: MenuItemConfig[]): MenuItemConfig[] =>
      list.map(item => {
        const updated = { ...item };
        if (errorIds.has(item.id)) {
          updated.status = 'error';
          updated.issues = [
            ...(item.issues || []),
            ...validation.errors
              .filter(e => e.itemId === item.id)
              .map(e => ({
                id: `load_${e.itemId}_${e.type}`,
                severity: 'error' as const,
                type: e.type as any,
                title: '菜单树结构错误',
                description: e.message,
                suggestedAction: e.type === 'top_level_separator'
                  ? '请移动到某个菜单下或删除'
                  : e.type === 'top_level_command'
                  ? '请移动到某个菜单下'
                  : '请修正此问题',
              })),
          ];
        }
        if (updated.children) {
          updated.children = markRecursive(updated.children);
        }
        return updated;
      });
    return markRecursive(items);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 加载菜单方案
      const profilesRes = await window.atm.menuLoadProfiles();
      if (!profilesRes.success) {
        setError(formatUserError(profilesRes.error, '加载菜单方案失败'));
        setLoading(false);
        return;
      }
      const data = profilesRes.data;
      setStore(data.store);
      setProfile(data.activeProfile);
      setRecovery(data.recovery ?? null);
      setEnvironment(data.environment ?? null);
      setAlternatives(data.alternatives ?? []);
      // 标记已有非法数据
      const markedItems = markIllegalItems(data.activeProfile?.items || []);
      setItems(markedItems);
      setSavedItemsJson(JSON.stringify(markedItems));
      setHasUnappliedDraft(Boolean(
        data.activeProfile && data.store.appliedProfileId !== data.activeProfile.id,
      ));

      // 加载关联命令
      const cmdRes = await window.atm.menuGetLinkedCommands();
      if (cmdRes.success && cmdRes.data) {
        setCommands(cmdRes.data);
      }

      // 加载关联 Skill
      const skillRes = await window.atm.menuGetLinkedSkills();
      if (skillRes.success && skillRes.data) {
        setSkills(skillRes.data.map((s: any) => ({
          id: s.id || s.skillId || s.name || '',
          name: s.name || s.skillName || '',
          file: s.file || s.path || '',
          isEnabled: s.isEnabled !== false,
          isLoaded: s.isLoaded || s.loadStatus === 'loaded_configured',
        })));
      }

      // 加载文件状态
      try {
        const statusRes = await window.atm.menuCheckStatus();
        if (statusRes.success && statusRes.data) {
          setFileStatus(statusRes.data);
        }
      } catch { /* 非关键 */ }

      setLoading(false);
    } catch (err) {
      setError(formatUserError(err, '加载菜单数据失败'));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(items) !== savedItemsJson,
    [items, savedItemsJson],
  );

  const syncMenuStoreState = useCallback((nextStore: MenuProfileStore) => {
    const nextProfile = nextStore.profiles.find(item => item.id === nextStore.activeProfileId)
      || nextStore.profiles[0]
      || null;
    const nextItems = nextProfile?.items || [];
    setStore(nextStore);
    setProfile(nextProfile);
    setItems(nextItems);
    setSavedItemsJson(JSON.stringify(nextItems));
    setHasUnappliedDraft(Boolean(nextProfile && nextStore.appliedProfileId !== nextProfile.id));
    setSelectedId(null);
  }, []);

  useEffect(() => {
    if (hasUnsavedChanges) {
      setHasUnappliedDraft(true);
    }
  }, [hasUnsavedChanges]);

  // ═══════════════════════════════════════════════════
  // 菜单操作
  // ═══════════════════════════════════════════════════

  /** 创建默认 ATM Tools 顶级菜单 */
  const handleCreateDefaultMenu = useCallback(() => {
    const now = new Date().toISOString();
    const defaultMenu: MenuItemConfig = {
      id: generateMenuId(),
      label: 'ATM Tools',
      type: 'menu',
      path: ['ATM Tools'],
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      children: [],
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };
    setItems([defaultMenu]);
    setSelectedId(defaultMenu.id);
    showToast('success', '已创建 ATM Tools 菜单草稿。请保存草稿并生成 Apply Plan。');
  }, []);

  /** 从 Skill 命令生成推荐菜单 */
  const handleRecommendFromCommands = useCallback(async () => {
    try {
      if (commands.length === 0) {
        showToast('warning', '暂无可用命令数据，请先扫描 Skill。');
        return;
      }
      const res = await window.atm.menuRecommendFromCommands(
        JSON.stringify(commands),
        JSON.stringify({
          skipLoaded: true,
          skipHasMenu: true,
          skipCompanySkill: true,
          byCategory: true,
        }),
      );
      if (res.success && res.data && res.data.length > 0) {
        const newItems = res.data;
        setItems(prev => {
          // 检查是否已有 ATM Tools
          const hasAtmTools = prev.some(pi => pi.label === 'ATM Tools' && pi.type === 'menu' && !pi.parentId);
          if (hasAtmTools) {
            // 合并到现有 ATM Tools
            return prev.map(item => {
              if (item.label === 'ATM Tools' && item.type === 'menu' && !item.parentId) {
                const mergedChildren = [...(item.children || [])];
                for (const newItem of (newItems[0]?.children || [])) {
                  if (!mergedChildren.some(c => c.label === newItem.label)) {
                    mergedChildren.push(newItem);
                  }
                }
                return { ...item, children: mergedChildren };
              }
              return item;
            });
          }
          return [...prev, ...newItems];
        });
        showToast('success', `已从 ${commands.length} 个命令生成推荐菜单草稿。请查看并调整。`);
      } else {
        showToast('warning', '没有符合推荐条件的命令。请检查是否已有 Skill 数据，或调整筛选条件。');
      }
    } catch (err) {
      showToast('error', `生成推荐菜单失败: ${(err as Error).message}`);
    }
  }, [commands]);

  // ═══════════════════════════════════════════════════
  // 选中项
  // ═══════════════════════════════════════════════════

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    const findItem = (list: MenuItemConfig[]): MenuItemConfig | null => {
      for (const item of list) {
        if (item.id === selectedId) return item;
        if (item.children) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findItem(items);
  }, [items, selectedId]);

  // ═══════════════════════════════════════════════════
  // 菜单树校验结果
  // ═══════════════════════════════════════════════════

  const treeValidation = useMemo(() => {
    return validateMenuTree(items);
  }, [items]);

  /** 是否有阻塞性错误（不允许生成 Apply Plan / IL） */
  const hasBlockingError = treeValidation.hasError;

  // ═══════════════════════════════════════════════════
  // 筛选
  // ═══════════════════════════════════════════════════

  const filteredItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches = (item: MenuItemConfig): boolean =>
        item.label.toLowerCase().includes(q) ||
        (item.command || '').toLowerCase().includes(q) ||
        (item.sourceSkillName || '').toLowerCase().includes(q);
      const filterRecursive = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list
          .filter(item => matches(item) || (item.children && item.children.some(c => matches(c))))
          .map(item => ({
            ...item,
            children: item.children ? filterRecursive(item.children) : undefined,
          }));
      result = filterRecursive(result);
    }
    return result;
  }, [items, search]);

  // ═══════════════════════════════════════════════════
  // 处理函数
  // ═══════════════════════════════════════════════════

  /** 新建顶级菜单 */
  const handleAddRootMenu = useCallback(() => {
    const now = new Date().toISOString();
    const newItem: MenuItemConfig = {
      id: generateMenuId(),
      label: '新建菜单',
      type: 'menu',
      path: ['新建菜单'],
      order: items.length,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      children: [],
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };
    setItems(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
  }, [items.length]);

  /** 新建命令菜单项（只能添加到选中的菜单下，不能作为顶级节点） */
  const handleAddCommandItem = useCallback(() => {
    if (!selectedId || selectedItem?.type !== 'menu') {
      showToast('warning', '请先选择一个菜单，再添加菜单项或分隔线。');
      return;
    }
    const now = new Date().toISOString();
    const newItem: MenuItemConfig = {
      id: generateMenuId(),
      label: '新建命令',
      type: 'command',
      path: ['新建命令'],
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };

    // 添加到选中的父级菜单
    newItem.parentId = selectedId;
    setItems(prev => {
      const addToParent = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list.map(item => {
          if (item.id === selectedId) {
            newItem.order = item.children?.length || 0;
            return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) return { ...item, children: addToParent(item.children) };
          return item;
        });
      return addToParent(prev);
    });
    setSelectedId(newItem.id);
  }, [selectedId, selectedItem]);

  /** 新建分隔线（只能添加到选中的菜单下，不能作为顶级节点） */
  const handleAddSeparator = useCallback(() => {
    if (!selectedId || selectedItem?.type !== 'menu') {
      showToast('warning', '请先选择一个菜单，再添加菜单项或分隔线。');
      return;
    }
    const now = new Date().toISOString();
    const newItem: MenuItemConfig = {
      id: generateMenuId(),
      label: '──────────',
      type: 'separator',
      path: ['──────────'],
      order: 0,
      parentId: selectedId,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };

    setItems(prev => {
      const addToParent = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list.map(item => {
          if (item.id === selectedId) {
            newItem.order = item.children?.length || 0;
            return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) return { ...item, children: addToParent(item.children) };
          return item;
        });
      return addToParent(prev);
    });
    setSelectedId(newItem.id);
  }, [selectedId, selectedItem]);

  /** 添加子菜单 */
  const handleAddChild = useCallback((parentId: string) => {
    const now = new Date().toISOString();
    const newItem: MenuItemConfig = {
      id: generateMenuId(),
      label: '新建子菜单',
      type: 'menu',
      parentId,
      path: [],
      order: 0,
      menuSource: 'atm_managed',
      enabled: true,
      visible: true,
      children: [],
      status: 'normal',
      createdAt: now,
      updatedAt: now,
    };
    setItems(prev => {
      const addToParent = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list.map(item => {
          if (item.id === parentId) {
            newItem.order = item.children?.length || 0;
            return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) return { ...item, children: addToParent(item.children) };
          return item;
        });
      return addToParent(prev);
    });
    setSelectedId(newItem.id);
  }, []);

  /** 保存菜单项修改 */
  const handleSaveItem = useCallback((itemId: string, updates: Partial<MenuItemConfig>) => {
    setItems(prev => {
      const updateInTree = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list.map(item => {
          if (item.id === itemId) {
            return { ...item, ...updates, updatedAt: new Date().toISOString() };
          }
          if (item.children) return { ...item, children: updateInTree(item.children) };
          return item;
        });
      return updateInTree(prev);
    });
    showToast('success', '已保存菜单项修改');
  }, []);

  /** 删除菜单项 */
  const handleDeleteItem = useCallback((itemId: string) => {
    const deleteFromTree = (list: MenuItemConfig[]): MenuItemConfig[] =>
      list
        .filter(item => item.id !== itemId)
        .map(item => ({
          ...item,
          children: item.children ? deleteFromTree(item.children) : undefined,
        }));
    setItems(prev => deleteFromTree(prev));
    if (selectedId === itemId) setSelectedId(null);
    showToast('info', '已删除菜单项');
  }, [selectedId]);

  /** 复制菜单项 */
  const handleDuplicateItem = useCallback((itemId: string) => {
    const findAndClone = (list: MenuItemConfig[]): { cloned: MenuItemConfig | null; updated: MenuItemConfig[] } => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === itemId) {
          const cloned: MenuItemConfig = {
            ...JSON.parse(JSON.stringify(list[i])),
            id: generateMenuId(),
            label: `${list[i].label} (副本)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const updated = [...list];
          updated.splice(i + 1, 0, cloned);
          return { cloned, updated };
        }
        if (list[i].children) {
          const result = findAndClone(list[i].children!);
          if (result.cloned) {
            return {
              cloned: result.cloned,
              updated: list.map((item, idx) =>
                idx === i ? { ...item, children: result.updated } : item,
              ),
            };
          }
        }
      }
      return { cloned: null, updated: list };
    };
    const result = findAndClone(items);
    if (result.cloned) {
      setItems(result.updated);
      showToast('success', '已复制菜单项');
    }
  }, [items]);

  /** 上移 */
  const handleMoveUp = useCallback((itemId: string) => {
    setItems(prev => {
      const moveInTree = (list: MenuItemConfig[]): MenuItemConfig[] => {
        const idx = list.findIndex(i => i.id === itemId);
        if (idx > 0) {
          const updated = [...list];
          [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
          return updated;
        }
        return list.map(item => ({
          ...item,
          children: item.children ? moveInTree(item.children) : undefined,
        }));
      };
      return moveInTree(prev);
    });
  }, []);

  /** 下移 */
  const handleMoveDown = useCallback((itemId: string) => {
    setItems(prev => {
      const moveInTree = (list: MenuItemConfig[]): MenuItemConfig[] => {
        const idx = list.findIndex(i => i.id === itemId);
        if (idx >= 0 && idx < list.length - 1) {
          const updated = [...list];
          [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
          return updated;
        }
        return list.map(item => ({
          ...item,
          children: item.children ? moveInTree(item.children) : undefined,
        }));
      };
      return moveInTree(prev);
    });
  }, []);

  const handleReorder = useCallback((draggedId: string, targetId: string) => {
    setItems((prev) => reorderMenuItem(prev, draggedId, targetId));
    showToast('success', '已调整菜单项顺序，应用前仍可继续预览或撤销');
  }, [showToast]);

  /** 选择命令 */
  const handleOpenCommandSelector = useCallback((itemId: string) => {
    setCommandSelectorTarget(itemId);
    setShowCommandSelector(true);
  }, []);

  /** 命令选中回调 */
  const handleCommandSelected = useCallback((cmdInfo: {
    command: string;
    commandSource: string;
    sourceSkillId?: string;
    sourceSkillName?: string;
    sourceSkillFile?: string;
    hotkeys?: string[];
  }) => {
    if (!commandSelectorTarget) return;
    setItems(prev => {
      const updateInTree = (list: MenuItemConfig[]): MenuItemConfig[] =>
        list.map(item => {
          if (item.id === commandSelectorTarget) {
            return {
              ...item,
              command: cmdInfo.command,
              commandSource: cmdInfo.commandSource as any,
              sourceSkillId: cmdInfo.sourceSkillId,
              sourceSkillName: cmdInfo.sourceSkillName,
              sourceSkillFile: cmdInfo.sourceSkillFile,
              hotkeys: cmdInfo.hotkeys,
              type: 'command',
              updatedAt: new Date().toISOString(),
            };
          }
          if (item.children) return { ...item, children: updateInTree(item.children) };
          return item;
        });
      return updateInTree(prev);
    });
    showToast('success', `已绑定命令：${cmdInfo.command}`);
  }, [commandSelectorTarget]);

  /** 菜单树校验提示（有 error 时阻塞保存/预览/Plan） */
  const validateBeforeAction = useCallback((action: string): boolean => {
    const validation = validateMenuTree(items);
    if (validation.hasError) {
      const msgs = validation.errors.slice(0, 3).map(e => `  · ${e.message}`).join('\n');
      const more = validation.errors.length > 3 ? `\n  ...及其他 ${validation.errors.length - 3} 个错误` : '';
      showToast('error', `菜单树结构有误，无法${action}：\n${msgs}${more}`);
      return false;
    }
    if (validation.hasWarning) {
      showToast('warning', `菜单树有 ${validation.warnings.length} 个警告，请检查引用检查视图`);
    }
    return true;
  }, [items]);

  /** 保存草稿 */
  const handleSaveDraft = useCallback(async () => {
    if (!store || !profile) return false;
    if (!validateBeforeAction('保存草稿')) return false;
    const updatedProfile = { ...profile, items, updatedAt: new Date().toISOString() };
    const updatedStore = {
      ...store,
      profiles: store.profiles.map(p =>
        p.id === profile.id ? updatedProfile : p,
      ),
      updatedAt: new Date().toISOString(),
    };
    const res = await window.atm.menuSaveDraft(JSON.stringify(updatedStore));
    if (res.success) {
      setStore(updatedStore);
      setProfile(updatedProfile);
      setSavedItemsJson(JSON.stringify(items));
      setHasUnappliedDraft(true);
      showToast('success', '草稿已保存到 menu_profile.json');
      return true;
    } else {
      showToast('error', `保存失败: ${res.error}`);
      return false;
    }
  }, [store, profile, items, validateBeforeAction]);

  useEffect(() => registerEnvironmentSwitchGuard('menu-draft', async () => {
    if (!hasUnsavedChanges) return true;
    return handleSaveDraft();
  }), [hasUnsavedChanges, handleSaveDraft]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  /** 预览 generated_menu.il */
  const handlePreview = useCallback(async () => {
    if (!profile || !store) return;
    if (!validateBeforeAction('预览菜单')) return;
    const previewProfile = { ...profile, items };
    const res = await window.atm.menuGeneratePreview(JSON.stringify(previewProfile));
    if (res.success && res.data) {
      setPreviewContent(res.data.ilContent);
      setPreviewJson(res.data.profileJson);
      setPreviewCounts(res.data.itemCount);
      setShowPreview(true);
    } else {
      showToast('error', `预览生成失败: ${res.error}`);
    }
  }, [profile, items, validateBeforeAction]);

  /** 生成写入计划并打开最终确认弹窗 */
  const handleGeneratePlan = useCallback(async () => {
    if (!profile || !store) return;
    if (!validateBeforeAction('应用菜单')) return;

    // 检查菜单是否为空
    const allFlat = flattenItems(items);
    if (allFlat.length === 0) {
      showToast('warning', '当前没有菜单项，无法生成有效菜单。请先新建菜单或菜单项。');
      return;
    }

    // 先保存草稿
    const saved = await handleSaveDraft();
    if (!saved) return;
    // 再生成计划
    const previewProfile = { ...profile, items };
    const previewStore = {
      ...store,
      activeProfileId: previewProfile.id,
      profiles: store.profiles.map(item => item.id === previewProfile.id ? previewProfile : item),
      updatedAt: new Date().toISOString(),
    };
    await generatePlan(JSON.stringify(previewProfile), JSON.stringify(previewStore));
  }, [profile, store, items, handleSaveDraft, generatePlan, validateBeforeAction]);

  const handleSwitchMenuEnvironment = useCallback(async (environmentId: string) => {
    setSwitchingEnvironment(true);
    try {
      if (!await runEnvironmentSwitchGuards()) {
        setSwitchingEnvironment(false);
        return;
      }
      const res = await window.atm.setActiveAllegroEnvironment(environmentId);
      if (!res.success) throw new Error(res.error || '切换 Allegro 环境失败');
      window.location.reload();
    } catch (err) {
      setSwitchingEnvironment(false);
      showToast('error', formatUserError(err, '切换 Allegro 环境失败'));
    }
  }, []);

  const handleGenerateRecoveryPlan = useCallback(async () => {
    await generateRecoveryPlan();
  }, [generateRecoveryPlan]);

  const handleGenerateEnvironmentCopyPlan = useCallback(async (sourceEnvironmentId: string) => {
    await generateEnvironmentCopyPlan(sourceEnvironmentId);
  }, [generateEnvironmentCopyPlan]);

  /** 导出当前方案为可跨电脑传输的 .atmmenu 文件。 */
  const handleExportProfile = useCallback(async () => {
    if (!profile) return;
    if (hasUnsavedChanges && !await handleSaveDraft()) return;
    try {
      const res = await window.atm.menuExportProfile(profile.id);
      if (!res.success) throw new Error(res.error || '导出菜单方案失败');
      if (res.data) showToast('success', `已导出 ${res.data.itemCount} 个菜单项：${res.data.fileName}`);
    } catch (err) {
      showToast('error', formatUserError(err, '导出菜单方案失败'));
    }
  }, [profile, hasUnsavedChanges, handleSaveDraft]);

  /** 选择方案包并打开只读摘要；此时不写 menu_profile.json。 */
  const handleOpenImportProfile = useCallback(async () => {
    if (hasUnsavedChanges && !await handleSaveDraft()) return;
    try {
      const res = await window.atm.menuOpenImportProfile();
      if (!res.success) throw new Error(res.error || '读取菜单方案失败');
      if (res.data) setImportPreview(res.data);
    } catch (err) {
      showToast('error', formatUserError(err, '读取菜单方案失败'));
    }
  }, [hasUnsavedChanges, handleSaveDraft]);

  const handleConfirmImportProfile = useCallback(async () => {
    if (!importPreview) return;
    setImportBusy(true);
    const opened = await generateImportPlan(importPreview.filePath);
    setImportBusy(false);
    if (opened) setImportPreview(null);
  }, [importPreview, generateImportPlan]);

  /** 执行 Apply Plan（真正写文件） */
  const handleExecutePlan = useCallback(async () => {
    const isRecoveryPlan = pendingPlan?.title === '恢复菜单方案备份';
    const isEnvironmentCopyPlan = pendingPlan?.title.startsWith('复制菜单方案到') === true;
    const isImportPlan = pendingPlan?.title.startsWith('导入菜单方案') === true;
    const isDraftOnlyPlan = pendingPlan?.requiresRestart !== true;
    const success = await executePlan();
    if (success) {
      setNeedsAllegroRestart(!isDraftOnlyPlan);
      showToast('success', isRecoveryPlan
        ? '菜单方案已从备份恢复。请检查内容后点击“审阅并应用”，重新生成 Allegro 菜单。'
        : isEnvironmentCopyPlan
          ? '菜单方案已复制到当前环境并保存为草稿。请检查后点击“审阅并应用”。'
          : isImportPlan
            ? '菜单方案已作为新草稿导入，现有方案未被覆盖。请检查命令和兼容显示名后再审阅应用。'
          : '菜单配置已写入。请关闭旧 Allegro 窗口，再从左下角点击“按此环境启动”；同环境已加载过 ATM 菜单时也可执行 atmLoadMenus。');
      clearPlan();
      // 重新加载数据
      await loadData();
    } else {
      showToast('error', applyError || '应用失败');
    }
  }, [pendingPlan, executePlan, clearPlan, loadData, applyError]);

  const handleRescan = useCallback(async () => {
    setNeedsAllegroRestart(false);
    await loadData();
  }, [loadData]);

  /** 跳转到 Skill 页 */
  const handleNavigateSkill = useCallback(async (skillId: string) => {
    if (!await runEnvironmentSwitchGuards()) return;
    navigate(`/skills?skill=${encodeURIComponent(skillId)}`);
  }, [navigate]);

  /** 跳转到快捷键页 */
  const handleNavigateHotkey = useCallback(async (command: string) => {
    if (!await runEnvironmentSwitchGuards()) return;
    navigate(`/hotkeys?search=${encodeURIComponent(command)}`);
  }, [navigate]);

  // ═══════════════════════════════════════════════════
  // 命令视图 — 计算哪些命令已有菜单
  // ═══════════════════════════════════════════════════

  const commandViewData = useMemo(() => {
    const allItemsFlat = flattenItems(items);
    const menuCommands = new Set(allItemsFlat.filter(i => i.command).map(i => i.command));
    return commands.map(cmd => ({
      ...cmd,
      hasMenu: menuCommands.has(cmd.commandName),
      menuPaths: allItemsFlat
        .filter(i => i.command === cmd.commandName)
        .map(i => i.path?.join(' > ') || i.label),
    }));
  }, [commands, items]);

  // ═══════════════════════════════════════════════════
  // 引用检查视图
  // ═══════════════════════════════════════════════════

  const refIssues = useMemo((): MenuIssue[] => {
    const issues: MenuIssue[] = [];
    const allItemsFlat = flattenItems(items);
    let counter = 0;

    // 加入菜单树结构校验结果
    const validation = validateMenuTree(items);
    for (const ve of validation.errors) {
      issues.push({
        id: `tree_err_${counter++}`,
        severity: 'error',
        type: (ve.type === 'top_level_separator' ? 'empty_label'
              : ve.type === 'top_level_command' ? 'empty_label'
              : 'empty_label') as any,
        title: '菜单树结构错误',
        description: ve.message,
        suggestedAction: ve.type === 'top_level_separator'
          ? '将分隔线移动到某个菜单下，或删除'
          : ve.type === 'top_level_command'
          ? '将命令移动到某个菜单下'
          : '请修正此问题',
      });
    }
    for (const vw of validation.warnings) {
      issues.push({
        id: `tree_warn_${counter++}`,
        severity: 'warning',
        type: 'duplicate_menu_label' as any,
        title: '菜单树结构警告',
        description: vw.message,
      });
    }

    for (const item of allItemsFlat) {
      // 空标签
      if (!item.label || item.label.trim() === '') {
        issues.push({
          id: `ref_${counter++}`,
          severity: 'error',
          type: 'empty_label',
          title: '菜单标签为空',
          description: `菜单项 ID: ${item.id}`,
          suggestedAction: '请输入菜单名称',
        });
      }
      // 命令为空
      if (item.type === 'command' && !item.command) {
        issues.push({
          id: `ref_${counter++}`,
          severity: 'warning',
          type: 'empty_command',
          title: '命令菜单项未绑定命令',
          description: `"${item.label}" 未绑定任何命令`,
          suggestedAction: '从命令选择器中选择命令',
        });
      }
      // 命令不存在
      if (item.command) {
        const matched = commands.find(c => c.commandName.toLowerCase() === item.command!.toLowerCase());
        if (!matched) {
          issues.push({
            id: `ref_${counter++}`,
            severity: 'warning',
            type: 'command_missing',
            title: '命令不存在',
            description: `"${item.label}" 的命令 "${item.command}" 在命令注册中心中未找到`,
            suggestedAction: '检查命令名称是否正确',
          });
        }
      }
      // 重复标签
      const siblings = allItemsFlat.filter(i => i.parentId === item.parentId && i.id !== item.id);
      if (item.label && siblings.some(s => s.label === item.label)) {
        issues.push({
          id: `ref_${counter++}`,
          severity: 'warning',
          type: 'duplicate_menu_label',
          title: '同级菜单名重复',
          description: `"${item.label}" 与同级菜单项同名`,
          suggestedAction: '修改菜单名称以区分',
        });
      }
    }
    return issues;
  }, [items, commands]);

  // ═══════════════════════════════════════════════════
  // 扁平化工具
  // ═══════════════════════════════════════════════════

  function flattenItems(list: MenuItemConfig[]): MenuItemConfig[] {
    const result: MenuItemConfig[] = [];
    const walk = (items: MenuItemConfig[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children) walk(item.children);
      }
    };
    walk(list);
    return result;
  }

  // ═══════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════

  if (loading) {
    return (
      <WorkspacePage className="workspace-page-menu page-container">
        <WorkspaceHeader eyebrow="界面配置" title="菜单" description="正在读取菜单方案与 Allegro 加载状态。" />
        <PageState kind="loading" title="正在加载菜单配置" description="正在合并方案、命令索引与生成文件状态。" />
      </WorkspacePage>
    );
  }

  if (error) {
    return (
      <WorkspacePage className="workspace-page-menu page-container">
        <WorkspaceHeader eyebrow="界面配置" title="菜单" description="编辑菜单树，并安全写入 Allegro 启动配置。" />
        <PageState
          kind="error"
          title="菜单数据加载失败"
          description={error}
          action={<button className="btn btn-primary" onClick={() => void loadData()}>重新加载</button>}
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage className="workspace-page-menu page-container" density="compact" scroll="contained">
      <WorkspaceHeader
        className="menu-page-header"
        eyebrow="界面配置"
        title="菜单"
        description="维护 ATM 管理的菜单覆盖层，并在写入前预览生成结果与影响范围。"
        actions={(
          <div className="menu-page-actions">
            {hasUnsavedChanges ? (
              <button onClick={handleSaveDraft} className="btn btn-sm btn-primary">保存草稿</button>
            ) : items.length > 0 && (
              hasUnappliedDraft || store?.activeProfileId !== store?.appliedProfileId || !fileStatus?.ilExists || !fileStatus?.bootstrapHasMenu
            ) ? (
              <button onClick={handleGeneratePlan} className="btn btn-sm btn-primary">审阅并应用</button>
            ) : null}
            <MoreActionsMenu
              label="工作区工具"
              actions={[
                { label: '预览 IL', onClick: handlePreview },
                { label: '重新扫描', onClick: handleRescan },
                { label: '新建顶级菜单', onClick: handleAddRootMenu },
                { label: '导出当前方案', onClick: handleExportProfile, disabled: !profile || items.length === 0 },
                { label: '导入菜单方案', onClick: handleOpenImportProfile },
                { label: '查看命令清单', onClick: () => setTab('commands') },
                { label: `引用检查（${refIssues.length}）`, onClick: () => setTab('refs') },
              ]}
            />
          </div>
        )}
      />

      {/* 菜单方案栏 */}
      {store && (
        <ProfileBar
          title="菜单方案"
          profiles={store.profiles || []}
          activeProfileId={store.activeProfileId}
          appliedProfileId={hasUnappliedDraft ? undefined : store.appliedProfileId}
          onCreate={async (name) => {
            if (hasUnsavedChanges && !await handleSaveDraft()) return;
            const res = await window.atm.menuProfileCreate(name);
            if (res.success) syncMenuStoreState(res.data.store);
          }}
          onCopy={async (profileId) => {
            if (hasUnsavedChanges && !await handleSaveDraft()) return;
            const res = await window.atm.menuProfileCopy(profileId);
            if (res.success) syncMenuStoreState(res.data.store);
          }}
          onRename={async (profileId, newName) => {
            if (hasUnsavedChanges && !await handleSaveDraft()) return;
            const res = await window.atm.menuProfileRename(profileId, newName);
            if (res.success) syncMenuStoreState(res.data.store);
          }}
          onDelete={async (profileId) => {
            if (hasUnsavedChanges && !await handleSaveDraft()) return;
            const res = await window.atm.menuProfileDelete(profileId);
            if (res.success) syncMenuStoreState(res.data.store);
          }}
          onSwitch={async (profileId) => {
            if (hasUnsavedChanges && !await handleSaveDraft()) return;
            const res = await window.atm.menuProfileSetActive(profileId);
            if (res.success) {
              syncMenuStoreState(res.data.store);
            }
          }}
          onApply={handleGeneratePlan}
          applyLabel="审阅更改"
          showApplyAction={false}
          compact
        />
      )}

      {/* 全局状态总览 */}
      <GlobalStatusBar
        items={[
          {
            label: '草稿',
            value: !items.length ? '未创建' : hasUnsavedChanges ? '未保存' : '已保存',
            status: !items.length ? 'muted' : hasUnsavedChanges ? 'warning' : 'ok',
          },
          {
            label: 'Allegro',
            value: hasUnsavedChanges || hasUnappliedDraft
              ? '有更改待应用'
              : fileStatus?.ilExists && fileStatus?.bootstrapHasMenu ? '已同步' : '尚未配置',
            status: hasUnsavedChanges || hasUnappliedDraft
              ? 'warning'
              : fileStatus?.ilExists && fileStatus?.bootstrapHasMenu ? 'ok' : 'muted',
          },
        ]}
        needsRestart={needsAllegroRestart ? true : undefined}
      />

      {items.length === 0 && alternatives.length > 0 && (
        <div className="menu-recovery-banner menu-recovery-banner--environment" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>当前 {environment?.name || 'Allegro 环境'} 没有菜单方案</strong>
            <span>
              检测到其他环境仍有菜单数据：{alternatives.map(item =>
                `${item.name}${item.recoveryItemCount ? `（可恢复 ${item.recoveryItemCount} 项）` : item.profileItemCount ? `（${item.profileItemCount} 项）` : '（仅有旧 IL）'}`
              ).join('、')}
            </span>
          </div>
          <div className="menu-recovery-actions">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={switchingEnvironment}
              onClick={() => void handleGenerateEnvironmentCopyPlan(alternatives[0].id)}
            >
              复制到当前 {environment?.version || '环境'}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={switchingEnvironment}
              onClick={() => void handleSwitchMenuEnvironment(alternatives[0].id)}
            >
              {switchingEnvironment ? '切换中…' : `切换到 ${alternatives[0].name}`}
            </button>
          </div>
        </div>
      )}

      {recovery && (
        <div className="menu-recovery-banner" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>发现可恢复的菜单方案“{recovery.activeProfile.name}”</strong>
            <span>
              当前 menu_profile.json 为空，但 ATM 备份中保存了 {recovery.itemCount} 个菜单项。
              Allegro 可能仍在加载旧 generated_menu.il，因此会出现“软件不显示但菜单仍存在”的不一致。
            </span>
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void handleGenerateRecoveryPlan()}>
            审阅恢复计划
          </button>
        </div>
      )}

      {tab !== 'tree' ? (
        <div className="menu-utility-view-bar">
          <div>
            <strong>{tab === 'commands' ? '命令清单' : '引用检查'}</strong>
            <span>{tab === 'commands' ? '用于补充菜单入口' : '用于处理异常引用'}</span>
          </div>
          <button className="btn btn-sm" onClick={() => setTab('tree')}>返回菜单树</button>
        </div>
      ) : null}

      {tab === 'tree' && (
        <div className="menu-tree-toolbar">
          <input
            type="search"
            placeholder="搜索菜单…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="menu-page-search"
            aria-label="搜索菜单"
          />
          <MenuTreeAddBar
            selectedMenuLabel={selectedItem?.type === 'menu' ? selectedItem.label : null}
            onAddSubmenu={() => selectedId && handleAddChild(selectedId)}
            onAddCommand={handleAddCommandItem}
            onAddSeparator={handleAddSeparator}
          />
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* 内容区域 */}
      {/* ════════════════════════════════════════ */}
      <div className="menu-editor-content">
        {tab === 'tree' && (
          <div className="menu-editor-split">
            {/* 菜单树 */}
            <div className={`menu-tree-pane${items.length === 0 ? ' is-empty' : ''}`}>
              {items.length === 0 ? (
                /* 空菜单引导 */
                <div className="menu-empty-guide">
                  <h2>暂无菜单配置</h2>
                  <p>
                    当前没有菜单项。你可以通过以下方式快速开始：
                  </p>

                  <div className="menu-guide-list">
                    {/* 创建默认菜单 */}
                    <GuideCard
                      icon={FolderPlus}
                      title="创建默认 ATM Tools 菜单"
                      desc="创建一个名为 ATM Tools 的顶级菜单，后续可添加子菜单和菜单项"
                      onClick={handleCreateDefaultMenu}
                    />
                    {/* 从 Skill 命令生成 */}
                    <GuideCard
                      icon={Sparkles}
                      title="从 Skill 命令生成推荐菜单"
                      desc={`根据 CommandIndex 中 ${commands.length} 个命令自动分类生成推荐菜单草稿`}
                      onClick={handleRecommendFromCommands}
                    />
                    {/* 导入菜单方案 */}
                    <GuideCard
                      icon={FileDown}
                      title="导入菜单方案"
                      desc="从 .atmmenu 或旧 menu_profile.json 导入为新草稿，不覆盖现有方案"
                      onClick={handleOpenImportProfile}
                    />
                  </div>
                </div>
              ) : (
                <MenuTree
                  items={filteredItems}
                  selectedId={selectedId}
                  onSelect={(item) => setSelectedId(item.id)}
                  onAddChild={handleAddChild}
                  onDelete={handleDeleteItem}
                  onDuplicate={handleDuplicateItem}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onReorder={handleReorder}
                  filterText={search}
                />
              )}
            </div>

            {/* 编辑器（仅在有菜单项时显示） */}
            {items.length > 0 && (
              <div className="menu-detail-pane">
                <MenuItemEditor
                  item={selectedItem}
                  onSave={handleSaveItem}
                  onDelete={handleDeleteItem}
                  onDuplicate={handleDuplicateItem}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onSelectCommand={handleOpenCommandSelector}
                  onNavigateSkill={handleNavigateSkill}
                  onNavigateHotkey={handleNavigateHotkey}
                  allegroVersion={environment?.version}
                />
              </div>
            )}
          </div>
        )}

        {/* 命令视图 */}
        {tab === 'commands' && (
          <div className="menu-command-view">
            <div className="menu-command-toolbar">
              显示 {commandViewData.filter(c => !c.hasMenu).length} 个尚无菜单的命令
              <button
                onClick={() => setFilterSource(f => f === 'all' ? 'nomenu' : 'all')}
                className="btn btn-sm"
              >
                {filterSource === 'nomenu' ? '显示全部' : '仅无菜单'}
              </button>
            </div>

            <table className="data-table menu-command-table">
              <thead>
                <tr>
                  <th>命令名</th>
                  <th>来源</th>
                  <th>快捷键</th>
                  <th>菜单路径</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {(filterSource === 'nomenu' ? commandViewData.filter(c => !c.hasMenu) : commandViewData).map(cmd => (
                  <tr
                    key={cmd.commandName}
                    className={cmd.hasMenu ? 'is-linked' : ''}
                  >
                    <td>
                      <code>{cmd.commandName}</code>
                    </td>
                    <td>
                      <span className="menu-command-source">
                        {cmd.sourceSkillName || cmd.sourceType || '-'}
                      </span>
                    </td>
                    <td>
                      {cmd.hotkeys?.length ? cmd.hotkeys.join(', ') : '-'}
                    </td>
                    <td>
                      {cmd.hasMenu
                        ? <span className="menu-link-state is-linked"><CheckCircle2 aria-hidden="true" />{cmd.menuPaths?.join(', ')}</span>
                        : <span className="menu-link-state">无菜单</span>
                      }
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          // 找到第一个顶级菜单作为父级，如果没有则创建一个
                          const firstMenu = items.find(i => i.type === 'menu' && !i.parentId);
                          if (!firstMenu) {
                            showToast('warning', '请先创建一个顶级菜单，再为命令添加菜单项。');
                            return;
                          }
                          const now = new Date().toISOString();
                          const parentId = firstMenu.id;
                          const newItem: MenuItemConfig = {
                            id: generateMenuId(),
                            label: cmd.chineseName || cmd.commandName,
                            type: 'command',
                            path: [firstMenu.label, cmd.chineseName || cmd.commandName],
                            order: firstMenu.children?.length || 0,
                            parentId,
                            command: cmd.commandName,
                            commandSource: (cmd.sourceType === 'allegro_builtin' ? 'allegro_builtin'
                              : cmd.sourceType === 'company_skill' ? 'company_skill'
                              : 'user_skill') as any,
                            sourceSkillId: cmd.sourceSkillId,
                            sourceSkillName: cmd.sourceSkillName,
                            sourceSkillFile: cmd.sourceSkillFile,
                            hotkeys: cmd.hotkeys,
                            menuSource: 'atm_managed',
                            enabled: true,
                            visible: true,
                            status: 'normal',
                            createdAt: now,
                            updatedAt: now,
                          };
                          setItems(prev => {
                            const addToMenu = (list: MenuItemConfig[]): MenuItemConfig[] =>
                              list.map(item => {
                                if (item.id === parentId) {
                                  return { ...item, children: [...(item.children || []), newItem] };
                                }
                                if (item.children) return { ...item, children: addToMenu(item.children) };
                                return item;
                              });
                            return addToMenu(prev);
                          });
                          showToast('success', `已将命令 "${cmd.commandName}" 添加到 "${firstMenu.label}" 下`);
                        }}
                        className="btn btn-sm"
                      >
                        添加菜单
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 引用检查视图 */}
        {tab === 'refs' && (
          <div className="menu-reference-view">
            {refIssues.length === 0 ? (
              <div className="menu-reference-empty">
                <CheckCircle2 aria-hidden="true" />
                <strong>未发现菜单引用问题</strong>
                <span>当前菜单命令均能在已扫描的命令索引中找到。</span>
              </div>
            ) : (
              <div>
                <div className="menu-reference-summary">
                  发现 {refIssues.length} 个问题
                  （{refIssues.filter(i => i.severity === 'error').length} 个错误，
                  {refIssues.filter(i => i.severity === 'warning').length} 个警告，
                  {refIssues.filter(i => i.severity === 'info').length} 个信息）
                </div>
                {refIssues.map(issue => {
                  const IssueIcon = issue.severity === 'error'
                    ? AlertCircle
                    : issue.severity === 'warning'
                    ? AlertTriangle
                    : Info;
                  return (
                    <div
                      key={issue.id}
                      className={`menu-reference-issue menu-reference-issue--${issue.severity}`}
                    >
                      <div className="menu-reference-issue-title">
                        <IssueIcon aria-hidden="true" />
                        <span>{issue.title}</span>
                      </div>
                      <div className="menu-reference-issue-description">
                        {issue.description}
                      </div>
                      {issue.suggestedAction && (
                        <div className="menu-reference-issue-action">
                          建议：{issue.suggestedAction}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════ */}
      {/* Apply Plan 结果 */}
      {/* ════════════════════════════════════════ */}
      {applyResult && (
        <div className="menu-operation-toast menu-operation-toast--success" role="status">
          <CheckCircle2 aria-hidden="true" />
          {applyResult}
        </div>
      )}
      {applyError && (
        <div className="menu-operation-toast menu-operation-toast--error" role="alert">
          <AlertCircle aria-hidden="true" />
          {applyError}
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* 弹窗 */}
      {/* ════════════════════════════════════════ */}

      {/* 命令选择器 */}
      <CommandSelector
        open={showCommandSelector}
        onClose={() => setShowCommandSelector(false)}
        onSelect={handleCommandSelected}
        commands={commands}
      />

      {/* 预览弹窗 */}
      <MenuPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        ilContent={previewContent}
        profileJson={previewJson}
        itemCount={previewCounts}
        onApplyPlan={handleGeneratePlan}
        items={items}
      />

      <MenuProfileImportDialog
        preview={importPreview}
        busy={importBusy}
        onClose={() => setImportPreview(null)}
        onConfirm={handleConfirmImportProfile}
      />

      {/* Apply Plan 确认弹窗 */}
      <MenuApplyPlanDialog
        open={!!pendingPlan}
        plan={pendingPlan}
        applying={applying}
        onConfirm={handleExecutePlan}
        onCancel={clearPlan}
      />
    </WorkspacePage>
  );
};

// ═══════════════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════════════

/** 引导卡片 */
const GuideCard: React.FC<{ icon: LucideIcon; title: string; desc: string; onClick: () => void }> = ({
  icon: Icon, title, desc, onClick,
}) => (
  <button
    type="button"
    className="menu-guide-card"
    onClick={onClick}
  >
    <Icon aria-hidden="true" />
    <div className="menu-guide-card-copy">
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  </button>
);

export default MenuPage;
