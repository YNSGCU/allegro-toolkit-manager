/**
 * ATM - Skill 引用校验模块
 * 将快捷键命令与 Skill 函数注册中心交叉比对，发现未解析/已禁用/公司只读引用
 */
import { buildCommandRegistry, findUnresolvedRefs } from '../skill/commandRegistry';
import { scanAllSkills } from '../skill/scanSkill';
import { parseSkillFile } from '../parser/parseSkillMeta';
import type { CommandRegistry, SkillRefValidationResult, ScannedSkill } from '../../src/types/skill';
import type { HotkeyBinding } from '../../src/types/hotkey';
import type { EnvironmentInfo } from '../../src/types/environment';

/**
 * 完整执行技能引用校验
 * 1. 扫描所有 Skill 目录
 * 2. 构建命令注册中心
 * 3. 与快捷键绑定交叉比对
 *
 * @param envInfo 环境信息（用于定位 Skill 目录）
 * @param bindings 快捷键绑定列表
 * @param existingSkills 可选的已有扫描结果（避免重复扫描）
 * @returns 引用校验结果
 */
export function validateSkillReferences(
  envInfo: Pick<EnvironmentInfo, 'pcbenvPath' | 'atmGeneratedPath'> & { companySkillPaths?: string[] },
  bindings: HotkeyBinding[],
  existingSkills?: { all: ScannedSkill[] }
): {
  registry: CommandRegistry;
  refChecks: SkillRefValidationResult;
  allSkills: ScannedSkill[];
} {
  // 1. 扫描 Skill
  const allSkills = existingSkills?.all || scanAllSkills(envInfo).all;

  // 2. 确保每个 Skill 的 functions 已填充
  for (const skill of allSkills) {
    if (skill.functions.length === 0) {
      try {
        const result = parseSkillFile(skill.filePath);
        skill.functions = result.functions;
      } catch {
        // 解析失败，保持空函数列表
      }
    }
  }

  // 3. 构建注册中心
  const registry = buildCommandRegistry(allSkills);

  // 4. 交叉校验
  const refChecks = findUnresolvedRefs(registry, bindings);

  return { registry, refChecks, allSkills };
}

/**
 * 快速检查快捷键绑定是否有未解析引用
 * @param refChecks 引用校验结果
 * @returns 是否有 error 级别的未解析引用
 */
export function hasUnresolvedErrors(refChecks: SkillRefValidationResult): boolean {
  return refChecks.checks.some((c) => c.severity === 'error');
}

/**
 * 获取引用校验统计信息的可读文本
 */
export function formatRefCheckSummary(refChecks: SkillRefValidationResult): string {
  const parts: string[] = [];
  if (refChecks.stats.resolved > 0) parts.push(`${refChecks.stats.resolved} 个已匹配`);
  if (refChecks.stats.unresolved > 0) parts.push(`${refChecks.stats.unresolved} 个未解析`);
  if (refChecks.stats.disabledSkill > 0) parts.push(`${refChecks.stats.disabledSkill} 个指向已禁用 Skill`);
  if (refChecks.stats.companySkill > 0) parts.push(`${refChecks.stats.companySkill} 个指向公司只读 Skill`);
  if (refChecks.stats.ambiguous > 0) parts.push(`${refChecks.stats.ambiguous} 个歧义`);
  return parts.join('，') || '无引用问题';
}
