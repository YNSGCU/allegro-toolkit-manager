/**
 * ATM - Skill 元数据 IPC 处理器
 * Skill 中文备注、自动简介生成、CRUD 操作
 */
import { ipcMain } from 'electron';
import { locateEnvironment } from '../../core/environment/locateEnvironment';
import { scanEnhancedSkills } from '../../core/skill/enhancedScan';
import {
  loadAllSkillMeta,
  saveSkillMeta,
  saveAllSkillMeta,
  getSkillMeta,
  analyzeSkillMeta,
  analyzeAllSkills,
} from '../../core/skill/skillMeta';
import type { SkillMeta } from '../../src/types/skill';

function getPcbenvPath(): string | null {
  const envInfo = locateEnvironment();
  return envInfo.pcbenvPath || null;
}

export function registerSkillMetaIpc(): void {
  /**
   * 获取所有 Skill 元数据（含自动分析）
   */
  ipcMain.handle('skillMeta:getAll', async () => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }
      const allMeta = loadAllSkillMeta(pcbenvPath);
      return { success: true, data: allMeta };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `获取元数据失败: ${message}` };
    }
  });

  /**
   * 获取单个 Skill 元数据
   */
  ipcMain.handle('skillMeta:get', async (_event, skillId: string) => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }
      const meta = getSkillMeta(pcbenvPath, skillId);
      return { success: true, data: meta };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `获取元数据失败: ${message}` };
    }
  });

  /**
   * 保存单个 Skill 元数据（用户编辑备注等）
   */
  ipcMain.handle('skillMeta:save', async (_event, skillId: string, meta: Partial<SkillMeta>) => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }
      const result = saveSkillMeta(pcbenvPath, skillId, meta);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `保存元数据失败: ${message}` };
    }
  });

  /**
   * 自动分析单个 Skill 并保存
   */
  ipcMain.handle('skillMeta:analyze', async (_event, skillJson: string) => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }

      const skill = JSON.parse(skillJson);
      const analysis = analyzeSkillMeta(skill);

      const meta: SkillMeta = {
        skillId: skill.id,
        filePath: skill.path,
        ...analysis,
      };

      const result = saveSkillMeta(pcbenvPath, skill.id, meta);
      if (result.success) {
        return { success: true, data: meta };
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `分析 Skill 失败: ${message}` };
    }
  });

  /**
   * 批量自动分析所有 Skill 并保存
   */
  ipcMain.handle('skillMeta:analyzeAll', async (_event, skillsJson: string) => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }

      const skills = JSON.parse(skillsJson);
      const allMeta = analyzeAllSkills(skills, pcbenvPath);
      const result = saveAllSkillMeta(pcbenvPath, allMeta);

      if (result.success) {
        return { success: true, data: allMeta };
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `批量分析失败: ${message}` };
    }
  });

  /**
   * 清除自动分析结果（保留用户备注）
   */
  ipcMain.handle('skillMeta:clearAuto', async (_event, skillId: string) => {
    try {
      const pcbenvPath = getPcbenvPath();
      if (!pcbenvPath) {
        return { success: false, error: '未找到 pcbenv 路径' };
      }

      const existed = getSkillMeta(pcbenvPath, skillId);
      if (existed) {
        const result = saveSkillMeta(pcbenvPath, skillId, {
          autoName: undefined,
          autoSummary: undefined,
          autoCategory: undefined,
          tags: [],
          confidence: undefined,
          generatedAt: undefined,
        });
        return result;
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `清除自动分析失败: ${message}` };
    }
  });
}
