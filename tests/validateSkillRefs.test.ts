/**
 * ATM - Skill 引用校验测试
 */
import { describe, it, expect } from 'vitest';
import { hasUnresolvedErrors, formatRefCheckSummary } from '../core/validator/validateSkillRefs';
import type { SkillRefValidationResult } from '../src/types/skill';

describe('hasUnresolvedErrors', () => {
  it('有 error 级别检查时返回 true', () => {
    const result: SkillRefValidationResult = {
      checks: [
        {
          command: 'test',
          type: 'unresolved',
          matches: [],
          severity: 'error',
          message: '未找到对应函数',
        },
      ],
      stats: { resolved: 0, unresolved: 1, disabledSkill: 0, companySkill: 0, ambiguous: 0 },
    };
    expect(hasUnresolvedErrors(result)).toBe(true);
  });

  it('只有 info/warning 时返回 false', () => {
    const result: SkillRefValidationResult = {
      checks: [
        {
          command: 'test',
          type: 'resolved',
          matches: [],
          severity: 'info',
          message: '已匹配',
        },
        {
          command: 'test2',
          type: 'company_skill',
          matches: [],
          severity: 'warning',
          message: '公司引用',
        },
      ],
      stats: { resolved: 1, unresolved: 0, disabledSkill: 0, companySkill: 1, ambiguous: 0 },
    };
    expect(hasUnresolvedErrors(result)).toBe(false);
  });

  it('空结果返回 false', () => {
    const result: SkillRefValidationResult = {
      checks: [],
      stats: { resolved: 0, unresolved: 0, disabledSkill: 0, companySkill: 0, ambiguous: 0 },
    };
    expect(hasUnresolvedErrors(result)).toBe(false);
  });
});

describe('formatRefCheckSummary', () => {
  it('应该生成可读摘要', () => {
    const result: SkillRefValidationResult = {
      checks: [],
      stats: { resolved: 5, unresolved: 2, disabledSkill: 1, companySkill: 1, ambiguous: 0 },
    };
    const summary = formatRefCheckSummary(result);
    expect(summary).toContain('5 个已匹配');
    expect(summary).toContain('2 个未解析');
    expect(summary).toContain('1 个指向已禁用 Skill');
    expect(summary).toContain('1 个指向公司只读 Skill');
  });

  it('全部通过时返回"无引用问题"', () => {
    const result: SkillRefValidationResult = {
      checks: [],
      stats: { resolved: 0, unresolved: 0, disabledSkill: 0, companySkill: 0, ambiguous: 0 },
    };
    expect(formatRefCheckSummary(result)).toBe('无引用问题');
  });
});
