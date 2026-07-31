/**
 * ATM - Skill 元数据管理 Hook（V5.4）
 * 从 SkillPage.tsx 提取，统一中文备注/自动分析操作
 */
import { useState, useCallback } from 'react';
import type { SkillFileItem, SkillMeta } from '../types/skill';

interface UseSkillMetaReturn {
  metaDialogSkill: SkillFileItem | null;
  setMetaDialogSkill: (skill: SkillFileItem | null) => void;
  analyzingAll: boolean;
  saveMeta: (skillId: string, meta: Partial<SkillMeta>) => Promise<boolean>;
  reAnalyze: (skill: SkillFileItem) => Promise<SkillMeta | null>;
  reAnalyzeAll: (allSkills: SkillFileItem[], onProgress?: (done: number, total: number) => void) => Promise<boolean>;
  clearAuto: (skillId: string) => Promise<boolean>;
}

export function useSkillMeta(
  onMetaUpdated?: () => void,
): UseSkillMetaReturn {
  const [metaDialogSkill, setMetaDialogSkill] = useState<SkillFileItem | null>(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  /** 保存单个元数据 */
  const saveMeta = useCallback(async (skillId: string, meta: Partial<SkillMeta>): Promise<boolean> => {
    try {
      const result = await window.atm.skillMetaSave(skillId, meta);
      if (result.success) {
        onMetaUpdated?.();
        return true;
      } else {
        console.error('保存元数据失败:', result.error);
        return false;
      }
    } catch (err) {
      console.error('保存元数据异常:', err);
      return false;
    }
  }, [onMetaUpdated]);

  /** 重新分析单个 Skill */
  const reAnalyze = useCallback(async (skill: SkillFileItem): Promise<SkillMeta | null> => {
    try {
      const result = await window.atm.skillMetaAnalyze(JSON.stringify(skill));
      if (result.success && result.data) {
        onMetaUpdated?.();
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('分析失败:', err);
      return null;
    }
  }, [onMetaUpdated]);

  /** 全部重新分析 */
  const reAnalyzeAll = useCallback(async (
    allSkills: SkillFileItem[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<boolean> => {
    setAnalyzingAll(true);
    try {
      const total = allSkills.length;
      let success = true;

      // 分批处理，每次最多 5 个
      const batchSize = 5;
      for (let i = 0; i < total; i += batchSize) {
        const batch = allSkills.slice(i, i + batchSize);
        const batchJson = JSON.stringify(batch);
        const result = await window.atm.skillMetaAnalyzeAll(batchJson);
        if (!result.success) {
          console.error(`批量分析失败 (${i}-${i + batch.length}):`, result.error);
          success = false;
        }
        onProgress?.(Math.min(i + batchSize, total), total);
      }

      onMetaUpdated?.();
      return success;
    } catch (err) {
      console.error('全部重新分析失败:', err);
      return false;
    } finally {
      setAnalyzingAll(false);
    }
  }, [onMetaUpdated]);

  /** 清除自动分析结果 */
  const clearAuto = useCallback(async (skillId: string): Promise<boolean> => {
    try {
      const result = await window.atm.skillMetaClearAuto(skillId);
      if (result.success) {
        onMetaUpdated?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error('清除自动分析失败:', err);
      return false;
    }
  }, [onMetaUpdated]);

  return {
    metaDialogSkill,
    setMetaDialogSkill,
    analyzingAll,
    saveMeta,
    reAnalyze,
    reAnalyzeAll,
    clearAuto,
  };
}
