/**
 * ATM - 菜单管理页面（V5.5 可视化菜单编辑）
 *
 * 三种视图：
 * 1. 菜单树视图 — 可视化菜单树 + 右侧详情面板
 * 2. 命令视图 — 命令列表，显示哪些命令已有/没有菜单
 * 3. 引用检查 — 问题列表
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItemConfig, MenuProfile, MenuProfileStore, MenuIssue, MenuTreeValidationIssue } from '../types/menu';
import { generateMenuId, validateMenuTree } from '../types/menu';
import { showToast } from '../components/common/Toast';
import ErrorPanel from '../components/common/ErrorPanel';
import ProfileBar from '../components/ProfileBar';
import GlobalStatusBar from '../components/GlobalStatusBar';
import MoreActionsMenu from '../components/MoreActionsMenu';
import CoreWorkspaceHero from '../components/CoreWorkspaceHero';
import MenuTree from '../components/MenuTree';
import MenuItemEditor from '../components/MenuItemEditor';
import CommandSelector from '../components/CommandSelector';
import MenuPreviewDialog from '../components/MenuPreviewDialog';
import MenuApplyPlanDialog from '../components/MenuApplyPlanDialog';
import { useMenuApplyPlan } from '../hooks/useMenuApplyPlan';

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

/** 底部 Toast 样式 */
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  padding: '12px 20px',
  borderRadius: '8px',
  fontSize: '13px',
  zIndex: 2000,
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  maxWidth: '400px',
};

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

  const initialLoadDone = useRef(false);

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 弹窗
  const [showCommandSelector, setShowCommandSelector] = useState(false);
  const [commandSelectorTarget, setCommandSelectorTarget] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewJson, setPreviewJson] = useState('');
  const [previewCounts, setPreviewCounts] = useState<any>(null);

  // Apply Plan
  const {
    pendingPlan,
    applyResult,
    applyError,
    applying,
    generatePlan,
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
        setError(profilesRes.error || '加载菜单方案失败');
        setLoading(false);
        return;
      }
      const data = profilesRes.data;
      setStore(data.store);
      setProfile(data.activeProfile);
      // 标记已有非法数据
      const markedItems = markIllegalItems(data.activeProfile?.items || []);
      setItems(markedItems);

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

      setHasUnsavedChanges(false);
      setLoading(false);
    } catch (err) {
      setError(`加载菜单数据失败: ${(err as Error).message}`);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 初始加载完成后跟踪未保存更改
  useEffect(() => {
    if (initialLoadDone.current === false && !loading) {
      initialLoadDone.current = true;
    }
  }, [loading]);

  useEffect(() => {
    if (initialLoadDone.current) {
      setHasUnsavedChanges(true);
    }
  }, [items]);

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
  // 按钮启用/禁用状态
  // ═══════════════════════════════════════════════════

  /** 是否可以在选中的菜单下添加子项 */
  const canAddChildItems = selectedId !== null && selectedItem?.type === 'menu';

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
    if (!store || !profile) return;
    if (!validateBeforeAction('保存草稿')) return;
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
      showToast('success', '草稿已保存到 menu_profile.json');
    } else {
      showToast('error', `保存失败: ${res.error}`);
    }
  }, [store, profile, items, validateBeforeAction]);

  /** 预览 generated_menu.il */
  const handlePreview = useCallback(async () => {
    if (!profile) return;
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

  /** 生成 Apply Plan（仅预览，不写文件） */
  const handleGeneratePlan = useCallback(async () => {
    if (!profile) return;
    if (!validateBeforeAction('生成 Apply Plan')) return;

    // 检查菜单是否为空
    const allFlat = flattenItems(items);
    if (allFlat.length === 0) {
      showToast('warning', '当前没有菜单项，无法生成有效菜单。请先新建菜单或菜单项。');
      return;
    }

    // 先保存草稿
    await handleSaveDraft();
    // 再生成计划
    const previewProfile = { ...profile, items };
    await generatePlan(JSON.stringify(previewProfile));
  }, [profile, items, handleSaveDraft, generatePlan, validateBeforeAction]);

  /** 执行 Apply Plan（真正写文件） */
  const handleExecutePlan = useCallback(async () => {
    const success = await executePlan();
    if (success) {
      showToast('success', '菜单配置已生成。请重启 Allegro 或重新加载菜单后查看。');
      clearPlan();
      // 重新加载数据
      loadData();
    } else {
      showToast('error', applyError || '应用失败');
    }
  }, [executePlan, clearPlan, loadData, applyError]);

  /** 跳转到 Skill 页 */
  const handleNavigateSkill = useCallback((skillId: string) => {
    navigate(`/skills?skill=${encodeURIComponent(skillId)}`);
  }, [navigate]);

  /** 跳转到快捷键页 */
  const handleNavigateHotkey = useCallback((command: string) => {
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
      <div className="page-container" style={{ padding: '20px' }}>
        <div className="loading" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          ⏳ 加载菜单配置...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container" style={{ padding: '20px' }}>
        <ErrorPanel message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div
      className="workspace-page workspace-page-menu page-container"
      style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <CoreWorkspaceHero
        eyebrow="Menu Workspace"
        title="菜单工作台"
        description="先看草稿状态，再看结构错误和生成结果，让菜单树、命令视图和 Apply Plan 变成一个连续流程。"
        metrics={[
          { label: '草稿节点', value: String(items.length), tone: 'accent' },
          {
            label: '草稿状态',
            value: hasUnsavedChanges ? '待保存' : '已保存',
            tone: hasUnsavedChanges ? 'warning' : 'default',
          },
          { label: 'IL 结果', value: fileStatus?.ilExists ? '已生成' : '未生成' },
          {
            label: '结构校验',
            value: treeValidation.hasError
              ? `${treeValidation.errors.length} 个错误`
              : treeValidation.hasWarning
                ? `${treeValidation.warnings.length} 个警告`
                : '已通过',
          },
        ]}
      />

      {/* ════════════════════════════════════════ */}
      {/* 顶部工具栏 */}
      {/* ════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, fontSize: '15px', marginRight: '8px' }}>
          📋 菜单管理
        </span>

        <button onClick={handleSaveDraft} className="btn btn-sm btn-primary" style={{
          padding: '4px 12px',
          background: 'var(--accent-blue)',
          color: '#fff',
          fontWeight: 600,
          fontSize: '12px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}>
          保存草稿
        </button>
        <button onClick={handleGeneratePlan} className="btn btn-sm" style={{
          padding: '4px 12px',
          background: 'rgba(52, 211, 153, 0.15)',
          color: '#34d399',
          fontWeight: 600,
          fontSize: '12px',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
          title="Apply Plan 是写入前预览，不会立即修改 Allegro 配置。请先预览确认后，再点击执行写入。"
        >
          📋 生成 Apply Plan
        </button>

        <button onClick={handlePreview} className="btn btn-sm" style={{
          padding: '4px 10px',
          background: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}>
          预览 IL
        </button>

        <MoreActionsMenu
          actions={[
            {
              label: '重新扫描',
              icon: '🔄',
              onClick: loadData,
            },
            {
              label: '新建菜单',
              icon: '📁',
              onClick: handleAddRootMenu,
            },
            {
              label: '新建菜单项',
              icon: '⚡',
              onClick: handleAddCommandItem,
              disabled: !canAddChildItems,
            },
            {
              label: '新建分隔线',
              icon: '➖',
              onClick: handleAddSeparator,
              disabled: !canAddChildItems,
            },
          ]}
        />

        {/* 校验状态 */}
        {treeValidation.hasError && (
          <span style={{
            fontSize: '11px',
            color: '#f87171',
            padding: '2px 8px',
            background: 'rgba(248, 113, 113, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(248, 113, 113, 0.3)',
          }}>
            ✕ {treeValidation.errors.length} 个结构错误
          </span>
        )}
        {!treeValidation.hasError && treeValidation.hasWarning && (
          <span style={{
            fontSize: '11px',
            color: '#fbbf24',
            padding: '2px 8px',
            background: 'rgba(251, 191, 36, 0.1)',
            borderRadius: '4px',
            border: '1px solid rgba(251, 191, 36, 0.3)',
          }}>
            ⚠ {treeValidation.warnings.length} 个警告
          </span>
        )}

        {/* 搜索 */}
        <div style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="搜索菜单..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '4px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            width: '180px',
            outline: 'none',
          }}
        />
      </div>

      {/* 菜单方案栏 */}
      {store && (
        <ProfileBar
          title="菜单方案"
          profiles={store.profiles || []}
          activeProfileId={store.activeProfileId}
          onCreate={async (name) => {
            const res = await window.atm.menuProfileCreate(name);
            if (res.success) setStore(res.data.store);
          }}
          onCopy={async (profileId) => {
            const res = await window.atm.menuProfileCopy(profileId);
            if (res.success) setStore(res.data.store);
          }}
          onRename={async (profileId, newName) => {
            const res = await window.atm.menuProfileRename(profileId, newName);
            if (res.success) setStore(res.data.store);
          }}
          onDelete={async (profileId) => {
            const res = await window.atm.menuProfileDelete(profileId);
            if (res.success) setStore(res.data.store);
          }}
          onSwitch={async (profileId) => {
            const res = await window.atm.menuProfileSetActive(profileId);
            if (res.success) {
              setStore(res.data.store);
              setProfile(res.data.activeProfile);
              setItems(res.data.activeProfile?.items || []);
              setSelectedId(null);
            }
          }}
          onApply={() => {
            showToast('info', '请先在菜单编辑器中编辑菜单树，然后使用"生成 Apply Plan"按钮。');
          }}
          applyLabel="编辑菜单"
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
            label: 'menu_profile',
            value: fileStatus?.profileExists ? '已生成' : items.length ? '待生成' : '未生成',
            status: fileStatus?.profileExists ? 'ok' : items.length ? 'warning' : 'muted',
          },
          {
            label: 'generated_menu.il',
            value: fileStatus?.ilExists
              ? (hasUnsavedChanges ? '需要重新生成' : '已生成')
              : items.length ? '待生成' : '未生成',
            status: fileStatus?.ilExists
              ? (hasUnsavedChanges ? 'warning' : 'ok')
              : items.length ? 'warning' : 'muted',
          },
          {
            label: 'bootstrap',
            value: fileStatus?.bootstrapHasMenu ? '已配置' : '未配置',
            status: fileStatus?.bootstrapHasMenu ? 'ok' : 'warning',
          },
        ]}
        needsRestart={(() => {
          if (!hasUnsavedChanges && fileStatus?.ilExists && fileStatus?.bootstrapHasMenu) {
            if (!fileStatus?.ilInitHasBootstrap) return true;
            return true; // has menu items, needs restart
          }
          return undefined;
        })()}
      />

      {/* ════════════════════════════════════════ */}
      {/* Tabs */}
      {/* ════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-color)',
        padding: '0 20px',
        background: 'var(--bg-surface)',
      }}>
        <TabButton
          label={`🌳 菜单树 (${items.length})`}
          active={tab === 'tree'}
          onClick={() => setTab('tree')}
        />
        <TabButton
          label={`🔧 命令视图`}
          active={tab === 'commands'}
          onClick={() => setTab('commands')}
        />
        <TabButton
          label={`引用检查 (${refIssues.length})`}
          active={tab === 'refs'}
          onClick={() => setTab('refs')}
        />
      </div>

      {/* ════════════════════════════════════════ */}
      {/* 内容区域 */}
      {/* ════════════════════════════════════════ */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        {tab === 'tree' && (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* 菜单树 */}
            <div style={{
              width: '380px',
              minWidth: '280px',
              overflow: 'auto',
              borderRight: items.length === 0 ? 'none' : '1px solid var(--border-color)',
              flex: items.length === 0 ? 1 : '0 0 380px',
            }}>
              {items.length === 0 ? (
                /* 空菜单引导 */
                <div style={{ padding: '32px 24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>
                    暂无菜单配置
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    当前没有菜单项。你可以通过以下方式快速开始：
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* 创建默认菜单 */}
                    <GuideCard
                      icon="📁"
                      title="创建默认 ATM Tools 菜单"
                      desc="创建一个名为 ATM Tools 的顶级菜单，后续可添加子菜单和菜单项"
                      onClick={handleCreateDefaultMenu}
                    />
                    {/* 从 Skill 命令生成 */}
                    <GuideCard
                      icon="⚡"
                      title="从 Skill 命令生成推荐菜单"
                      desc={`根据 CommandIndex 中 ${commands.length} 个命令自动分类生成推荐菜单草稿`}
                      onClick={handleRecommendFromCommands}
                    />
                    {/* 导入菜单方案 */}
                    <GuideCard
                      icon="📥"
                      title="导入菜单方案"
                      desc="从已有的 menu_profile.json 或其他格式导入菜单配置"
                      onClick={() => showToast('info', '导入功能将在后续版本中提供')}
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
                  filterText={search}
                />
              )}
            </div>

            {/* 编辑器（仅在有菜单项时显示） */}
            {items.length > 0 && (
              <div style={{ flex: 1, overflow: 'auto' }}>
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
                />
              </div>
            )}
          </div>
        )}

        {/* 命令视图 */}
        {tab === 'commands' && (
          <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
            <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              显示 {commandViewData.filter(c => !c.hasMenu).length} 个尚无菜单的命令
              <button
                onClick={() => setFilterSource(f => f === 'all' ? 'nomenu' : 'all')}
                style={{
                  marginLeft: '8px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                {filterSource === 'nomenu' ? '显示全部' : '仅无菜单'}
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={thStyle}>命令名</th>
                  <th style={thStyle}>来源</th>
                  <th style={thStyle}>快捷键</th>
                  <th style={thStyle}>菜单路径</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {(filterSource === 'nomenu' ? commandViewData.filter(c => !c.hasMenu) : commandViewData).map(cmd => (
                  <tr
                    key={cmd.commandName}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      opacity: cmd.hasMenu ? 0.6 : 1,
                    }}
                  >
                    <td style={tdStyle}>
                      <code style={{ background: 'var(--bg-hover)', padding: '1px 4px', borderRadius: '2px' }}>
                        {cmd.commandName}
                      </code>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {cmd.sourceSkillName || cmd.sourceType || '-'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {cmd.hotkeys?.length ? cmd.hotkeys.join(', ') : '-'}
                    </td>
                    <td style={tdStyle}>
                      {cmd.hasMenu
                        ? <span style={{ color: '#34d399' }}>✅ {cmd.menuPaths?.join(', ')}</span>
                        : <span style={{ color: '#9ca3af' }}>— 无菜单</span>
                      }
                    </td>
                    <td style={tdStyle}>
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
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--accent-blue)',
                          background: 'transparent',
                          color: 'var(--accent-blue)',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        + 添加菜单
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
          <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto' }}>
            {refIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <div>未发现菜单引用问题</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  发现 {refIssues.length} 个问题
                  （{refIssues.filter(i => i.severity === 'error').length} 个错误，
                  {refIssues.filter(i => i.severity === 'warning').length} 个警告，
                  {refIssues.filter(i => i.severity === 'info').length} 个信息）
                </div>
                {refIssues.map(issue => {
                  const sevStyle = issue.severity === 'error'
                    ? { bg: 'rgba(248,113,113,0.1)', color: '#f87171', border: 'rgba(248,113,113,0.3)' }
                    : issue.severity === 'warning'
                    ? { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' }
                    : { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' };
                  return (
                    <div
                      key={issue.id}
                      style={{
                        padding: '10px 14px',
                        marginBottom: '6px',
                        borderRadius: '6px',
                        background: sevStyle.bg,
                        border: `1px solid ${sevStyle.border}`,
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: sevStyle.color, fontWeight: 600 }}>
                        <span>{issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '⚠' : 'ℹ'}</span>
                        <span>{issue.title}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '4px', marginLeft: '18px' }}>
                        {issue.description}
                      </div>
                      {issue.suggestedAction && (
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '18px', fontStyle: 'italic', fontSize: '12px' }}>
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
        <div style={{ ...toastStyle, background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
          ✅ {applyResult}
        </div>
      )}
      {applyError && (
        <div style={{ ...toastStyle, background: 'rgba(248, 113, 113, 0.15)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171' }}>
          ✕ {applyError}
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

      {/* Apply Plan 确认弹窗 */}
      <MenuApplyPlanDialog
        open={!!pendingPlan}
        plan={pendingPlan}
        applying={applying}
        onConfirm={handleExecutePlan}
        onCancel={clearPlan}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════
// 子组件
// ═══════════════════════════════════════════════════

/** Tab 按钮 */
const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label, active, onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      padding: '10px 16px',
      border: 'none',
      borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
      background: 'transparent',
      color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
    }}
  >
    {label}
  </button>
);

/** 引导卡片 */
const GuideCard: React.FC<{ icon: string; title: string; desc: string; onClick: () => void }> = ({
  icon, title, desc, onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '14px 16px',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      cursor: 'pointer',
      transition: 'all 0.15s',
      background: 'var(--bg-surface)',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; }}
  >
    <span style={{ fontSize: '24px', lineHeight: '1' }}>{icon}</span>
    <div>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{desc}</div>
    </div>
  </div>
);

/** 表格头样式 */
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 600,
  fontSize: '12px',
  color: 'var(--text-secondary)',
};

/** 表格单元格样式 */
const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  verticalAlign: 'middle',
};

export default MenuPage;
