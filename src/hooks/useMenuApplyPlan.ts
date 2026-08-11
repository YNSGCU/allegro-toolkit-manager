/**
 * ATM - 菜单 Apply Plan Hook（V5.5）
 *
 * 管理菜单 Apply Plan 的状态：生成计划、确认执行、撤销
 */
import { useState, useCallback } from 'react';
import type { ApplyPlan } from '../types/applyPlan';

interface UseMenuApplyPlanReturn {
  pendingPlan: ApplyPlan | null;
  applyResult: string | null;
  applyError: string | null;
  applying: boolean;
  generatePlan: (profileJson: string, storeJson?: string) => Promise<void>;
  generateRecoveryPlan: () => Promise<void>;
  generateEnvironmentCopyPlan: (sourceEnvironmentId: string) => Promise<void>;
  executePlan: () => Promise<boolean>;
  clearPlan: () => void;
  clearResult: () => void;
}

export function useMenuApplyPlan(): UseMenuApplyPlanReturn {
  const [pendingPlan, setPendingPlan] = useState<ApplyPlan | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const generatePlan = useCallback(async (profileJson: string, storeJson?: string) => {
    try {
      setApplyResult(null);
      setApplyError(null);
      const res = await window.atm.menuCreateApplyPlan(profileJson, storeJson);
      if (res.success && res.data) {
        setPendingPlan(res.data);
      } else {
        setApplyError(res.error || '生成 Apply Plan 失败');
        setPendingPlan(null);
      }
    } catch (err) {
      setApplyError(`生成 Apply Plan 异常: ${(err as Error).message}`);
      setPendingPlan(null);
    }
  }, []);

  const generateRecoveryPlan = useCallback(async () => {
    try {
      setApplyResult(null);
      setApplyError(null);
      const res = await window.atm.menuCreateRecoveryPlan();
      if (res.success && res.data) {
        setPendingPlan(res.data);
      } else {
        setApplyError(res.error || '生成菜单恢复计划失败');
        setPendingPlan(null);
      }
    } catch (err) {
      setApplyError(`生成菜单恢复计划异常: ${(err as Error).message}`);
      setPendingPlan(null);
    }
  }, []);

  const generateEnvironmentCopyPlan = useCallback(async (sourceEnvironmentId: string) => {
    try {
      setApplyResult(null);
      setApplyError(null);
      const res = await window.atm.menuCreateEnvironmentCopyPlan(sourceEnvironmentId);
      if (res.success && res.data) {
        setPendingPlan(res.data);
      } else {
        setApplyError(res.error || '生成跨环境菜单复制计划失败');
        setPendingPlan(null);
      }
    } catch (err) {
      setApplyError(`生成跨环境菜单复制计划异常: ${(err as Error).message}`);
      setPendingPlan(null);
    }
  }, []);

  const executePlan = useCallback(async (): Promise<boolean> => {
    if (!pendingPlan) return false;
    setApplying(true);
    try {
      const res = await window.atm.menuExecuteApplyPlan(JSON.stringify(pendingPlan));
      if (res.success) {
        setApplyResult(`执行成功：已应用 ${res.appliedSteps}/${res.totalSteps} 步。请关闭旧 Allegro 窗口并从左下角按当前环境启动，或在同环境会话中重新加载菜单。`);
        setPendingPlan(null);
        setApplying(false);
        return true;
      } else {
        setApplyError(res.error || '执行 Apply Plan 失败');
        setApplying(false);
        return false;
      }
    } catch (err) {
      setApplyError(`执行 Apply Plan 异常: ${(err as Error).message}`);
      setApplying(false);
      return false;
    }
  }, [pendingPlan]);

  const clearPlan = useCallback(() => {
    setPendingPlan(null);
  }, []);

  const clearResult = useCallback(() => {
    setApplyResult(null);
    setApplyError(null);
  }, []);

  return {
    pendingPlan,
    applyResult,
    applyError,
    applying,
    generatePlan,
    generateRecoveryPlan,
    generateEnvironmentCopyPlan,
    executePlan,
    clearPlan,
    clearResult,
  };
}
