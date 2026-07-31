/**
 * ATM - Skill Apply Plan 管理 Hook（V5.4）
 * 从 SkillPage.tsx 提取，统一启用/禁用/删除/Apply Plan 操作
 */
import { useState, useCallback } from 'react';
import type { SkillFileItem, SkillApplyPlan, ImpactAnalysis } from '../types/skill';

interface UseSkillApplyPlanReturn {
  /** 待应用的 Plan */
  pendingPlan: SkillApplyPlan | null;
  /** Apply 结果消息 */
  applyResult: string | null;
  /** 是否正在应用 */
  applying: boolean;
  /** 待应用操作跟踪（用于卡片视觉状态） */
  pendingSkills: Record<string, 'pending_disable' | 'pending_enable'>;
  /** 影响分析相关 */
  deleteImpact: ImpactAnalysis | null;
  deleteTarget: SkillFileItem | null;
  impactLoading: boolean;
  /** 切换启用/禁用 → 生成 Apply Plan */
  toggleSkill: (skillPath: string, enabled: boolean, allSkills: SkillFileItem[]) => Promise<void>;
  /** 执行 Apply Plan */
  executeApplyPlan: () => Promise<boolean>;
  /** 删除 Skill（先做影响分析） */
  analyzeDeleteImpact: (skill: SkillFileItem, bindingsJson: string) => Promise<ImpactAnalysis | null>;
  /** 执行删除计划 */
  executeDeletePlan: (skillPath: string, option: string) => Promise<boolean>;
  /** 清除待应用状态 */
  clearPending: () => void;
  /** 设置影响分析弹窗 */
  setDeleteImpact: (impact: ImpactAnalysis | null) => void;
  setDeleteTarget: (target: SkillFileItem | null) => void;
}

export function useSkillApplyPlan(): UseSkillApplyPlanReturn {
  const [pendingPlan, setPendingPlan] = useState<SkillApplyPlan | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [pendingSkills, setPendingSkills] = useState<Record<string, 'pending_disable' | 'pending_enable'>>({});
  const [deleteImpact, setDeleteImpact] = useState<ImpactAnalysis | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SkillFileItem | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  /** 切换启用/禁用 → 生成 Apply Plan */
  const toggleSkill = useCallback(async (skillPath: string, enabled: boolean, allSkills: SkillFileItem[]) => {
    setApplyResult(null);
    setPendingPlan(null);

    const skill = allSkills.find(s => s.path === skillPath);
    if (skill) {
      setPendingSkills(prev => ({ ...prev, [skill.id]: enabled ? 'pending_enable' : 'pending_disable' }));
    }

    try {
      const result = await window.atm.toggleSkill(skillPath, enabled);
      if (result.success && result.data) {
        setPendingPlan(result.data);
      } else {
        setApplyResult(result.error || '切换失败');
        if (skill) {
          setPendingSkills(prev => {
            const n = { ...prev };
            delete n[skill.id];
            return n;
          });
        }
      }
    } catch (err) {
      setApplyResult(err instanceof Error ? err.message : String(err));
      if (skill) {
        setPendingSkills(prev => {
          const n = { ...prev };
          delete n[skill.id];
          return n;
        });
      }
    }
  }, []);

  /** 执行 Apply Plan */
  const executeApplyPlan = useCallback(async (): Promise<boolean> => {
    if (!pendingPlan) return false;
    setApplying(true);
    try {
      const result = await window.atm.applySkillChanges(JSON.stringify(pendingPlan));
      if (result.success) {
        setApplyResult('Apply Plan 已成功执行');
        setPendingPlan(null);
        setPendingSkills({});
        return true;
      } else {
        setApplyResult(`执行失败：${result.error || '未知错误'}`);
        return false;
      }
    } catch (err) {
      setApplyResult(`执行异常：${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setApplying(false);
    }
  }, [pendingPlan]);

  /** 分析删除影响 */
  const analyzeDeleteImpact = useCallback(async (
    skill: SkillFileItem,
    bindingsJson: string,
  ): Promise<ImpactAnalysis | null> => {
    setImpactLoading(true);
    setDeleteTarget(skill);
    try {
      const result = await window.atm.analyzeSkillImpact(skill.path, bindingsJson);
      if (result.success && result.data) {
        setDeleteImpact(result.data);
        return result.data;
      } else {
        setDeleteImpact(null);
        return null;
      }
    } catch (err) {
      console.error('影响分析失败:', err);
      setDeleteImpact(null);
      return null;
    } finally {
      setImpactLoading(false);
    }
  }, []);

  /** 执行删除计划 */
  const executeDeletePlan = useCallback(async (skillPath: string, option: string): Promise<boolean> => {
    try {
      const result = await window.atm.createDeletePlan(skillPath, option);
      if (result.success && result.data) {
        setPendingPlan(result.data);
        setApplyResult(null);
        return true;
      } else {
        setApplyResult(result.error || '创建删除计划失败');
        return false;
      }
    } catch (err) {
      setApplyResult(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  /** 清除待应用状态 */
  const clearPending = useCallback(() => {
    setPendingPlan(null);
    setApplyResult(null);
    setPendingSkills({});
  }, []);

  return {
    pendingPlan,
    applyResult,
    applying,
    pendingSkills,
    deleteImpact,
    deleteTarget,
    impactLoading,
    toggleSkill,
    executeApplyPlan,
    analyzeDeleteImpact,
    executeDeletePlan,
    clearPending,
    setDeleteImpact,
    setDeleteTarget,
  };
}
