/**
 * ATM - Skill 筛选/排序/分组 Hook（V5.4）
 * 从 SkillPage.tsx 提取，统一筛选排序逻辑
 */
import { useState, useMemo, useCallback } from 'react';
import type { SkillFileItem, SkillMeta, SkillUsageInfo } from '../types/skill';

/** 筛选选项 */
export interface SkillFilters {
  search: string;
  sourceFilter: string;
  loadStatusFilter: string;
  referenceFilter: string;
  errorFilter: string;
}

/** 排序字段 */
export type SortField =
  | 'name'
  | 'lastModified'
  | 'entryCommandCount'
  | 'internalFunctionCount'
  | 'totalFunctionCount'
  | 'referenceCount'
  | 'loadStatus'
  | 'sourceType'
  | 'issueCount';
export type SortDir = 'asc' | 'desc';

export type DisplayMode = 'original' | 'chinese' | 'bilingual';

/** 分组后的 Skill */
export interface SkillGroup {
  label: string;
  icon: string;
  skills: SkillFileItem[];
}

interface UseSkillFiltersParams {
  allSkills: SkillFileItem[];
  skillMetaMap: Record<string, SkillMeta>;
  usageStatuses: Record<string, SkillUsageInfo>;
  healthScores: Record<string, { score: number; deductions: any[] }>;
}

interface UseSkillFiltersReturn {
  filters: SkillFilters;
  updateFilter: (key: keyof SkillFilters, value: string) => void;
  clearFilters: () => void;
  sortField: SortField;
  sortDir: SortDir;
  setSortField: (f: SortField) => void;
  toggleSortDir: () => void;
  displayMode: DisplayMode;
  setDisplayMode: (m: DisplayMode) => void;
  visibleSkills: SkillFileItem[];
  groupedSkills: SkillGroup[];
  filterSummary: string;
  hasActiveFilters: boolean;
}

/** 排序标签 */
export const SORT_LABELS: Record<SortField, string> = {
  name: '名称',
  lastModified: '修改时间',
  entryCommandCount: '入口命令数',
  internalFunctionCount: '内部函数数',
  totalFunctionCount: '总函数数',
  referenceCount: '引用数',
  loadStatus: '加载状态',
  sourceType: '来源',
  issueCount: '问题数',
};

const DEFAULT_FILTERS: SkillFilters = {
  search: '',
  sourceFilter: 'all',
  loadStatusFilter: 'all',
  referenceFilter: 'all',
  errorFilter: 'all',
};

export function useSkillFilters({
  allSkills,
  skillMetaMap,
  usageStatuses,
  healthScores,
}: UseSkillFiltersParams): UseSkillFiltersReturn {
  const [filters, setFilters] = useState<SkillFilters>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('bilingual');

  const updateFilter = useCallback((key: keyof SkillFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const toggleSortDir = useCallback(() => {
    setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  /** 可见 Skill 列表（筛选 + 排序） */
  const visibleSkills = useMemo(() => {
    let list = allSkills.filter((s) => {
      // 文本搜索
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const meta = skillMetaMap[s.id];
        const searchFields = [
          s.name,
          s.path,
          meta?.originalName || '',
          meta?.autoName || '',
          meta?.userName || '',
          meta?.displayName || '',
          meta?.userNote || '',
          meta?.autoSummary || '',
          ...s.entryCommands.map((c) => c.name),
        ];
        const match = searchFields.some((f) => f.toLowerCase().includes(q));
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
          case 'referenced_but_not_loaded': {
            const status = usageStatuses[s.id]?.status;
            if (status !== 'referenced_but_not_loaded') return false;
            break;
          }
          case 'available_unreferenced': {
            const status = usageStatuses[s.id]?.status;
            if (status !== 'available_unreferenced') return false;
            break;
          }
        }
      }

      // 错误状态筛选
      if (filters.errorFilter !== 'all') {
        switch (filters.errorFilter) {
          case 'has_error':
            if (s.parseStatus !== 'error') return false;
            break;
          case 'command_conflict': {
            const status = usageStatuses[s.id]?.status;
            if (status !== 'command_conflict') return false;
            break;
          }
          case 'missing_file': {
            const status = usageStatuses[s.id]?.status;
            if (status !== 'missing_file') return false;
            break;
          }
          case 'no_error':
            if (s.parseStatus === 'error') return false;
            break;
        }
      }

      return true;
    });

    // 排序
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'lastModified':
          cmp = (a.lastModified || '').localeCompare(b.lastModified || '');
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
          cmp = a.hotkeyRefs.length - b.hotkeyRefs.length;
          break;
        case 'loadStatus':
          cmp = a.loadStatus.localeCompare(b.loadStatus);
          break;
        case 'sourceType':
          cmp = a.sourceType.localeCompare(b.sourceType);
          break;
        case 'issueCount':
          cmp = (usageStatuses[a.id]?.healthScore ?? 100) - (usageStatuses[b.id]?.healthScore ?? 100);
          cmp = -cmp; // 问题越多优先级越高
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [allSkills, filters, sortField, sortDir, skillMetaMap, usageStatuses]);

  /** 分组后的 Skill */
  const groupedSkills = useMemo(() => {
    const groups: SkillGroup[] = [];

    const company = visibleSkills.filter((s) => s.sourceType === 'company_skill');
    if (company.length > 0) {
      groups.push({ label: '公司 Skill', icon: '', skills: company });
    }

    const user = visibleSkills.filter((s) => s.sourceType === 'user_skill');
    if (user.length > 0) {
      groups.push({ label: '用户 Skill', icon: '', skills: user });
    }

    const atm = visibleSkills.filter((s) => s.sourceType === 'atm_managed_skill');
    if (atm.length > 0) {
      groups.push({ label: 'ATM 托管', icon: '', skills: atm });
    }

    return groups;
  }, [visibleSkills]);

  /** 筛选摘要 */
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    const labels: Record<string, string> = {
      company_skill: '公司',
      user_skill: '用户',
      atm_managed_skill: 'ATM',
      readonly_skill: '只读',
      enabled: '已启用',
      disabled: '已禁用',
      loaded_configured: '已加载',
      enabled_but_not_loaded: '未加载',
      has_hotkey_ref: '有引用',
      no_hotkey_ref: '无引用',
      has_menu_ref: '有菜单',
      referenced_but_not_loaded: '有引用未加载',
      available_unreferenced: '可用无引用',
      has_error: '有错误',
      no_error: '无错误',
      command_conflict: '命令冲突',
      missing_file: '文件缺失',
    };

    if (filters.sourceFilter !== 'all') {
      parts.push(`来源: ${labels[filters.sourceFilter] || filters.sourceFilter}`);
    }
    if (filters.loadStatusFilter !== 'all') {
      parts.push(`加载: ${labels[filters.loadStatusFilter] || filters.loadStatusFilter}`);
    }
    if (filters.referenceFilter !== 'all') {
      parts.push(`引用: ${labels[filters.referenceFilter] || filters.referenceFilter}`);
    }
    if (filters.errorFilter !== 'all') {
      parts.push(`错误: ${labels[filters.errorFilter] || filters.errorFilter}`);
    }
    if (filters.search.trim()) {
      parts.push(`搜索: "${filters.search.trim()}"`);
    }
    return parts.join(' | ');
  }, [filters]);

  const hasActiveFilters =
    filters.sourceFilter !== 'all' ||
    filters.loadStatusFilter !== 'all' ||
    filters.referenceFilter !== 'all' ||
    filters.errorFilter !== 'all' ||
    filters.search.trim() !== '';

  return {
    filters,
    updateFilter,
    clearFilters,
    sortField,
    sortDir,
    setSortField,
    toggleSortDir,
    displayMode,
    setDisplayMode,
    visibleSkills,
    groupedSkills,
    filterSummary,
    hasActiveFilters,
  };
}
