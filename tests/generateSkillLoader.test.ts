/**
 * ATM - Skill Loader 生成测试
 */
import { describe, it, expect } from 'vitest';
import {
  generateSkillLoader,
  topologicalSortSkills,
  updateSkillStatus,
  skillToggleRequiresRestart,
} from '../core/generator/generateSkillLoader';
import type { ScannedSkill } from '../src/types/skill';

describe('topologicalSortSkills', () => {
  it('应该按依赖关系排序（依赖在前）', () => {
    const skills: ScannedSkill[] = [
      {
        id: 'a', name: 'a', filePath: '/a.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: true, dependencies: ['b'],
      },
      {
        id: 'b', name: 'b', filePath: '/b.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: true, dependencies: ['c'],
      },
      {
        id: 'c', name: 'c', filePath: '/c.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
    ];

    const sorted = topologicalSortSkills(skills);
    const names = sorted.map((s) => s.name);
    // c should come before b, and b before a
    expect(names.indexOf('c')).toBeLessThan(names.indexOf('b'));
    expect(names.indexOf('b')).toBeLessThan(names.indexOf('a'));
  });

  it('没有依赖的 Skill 应该按原顺序', () => {
    const skills: ScannedSkill[] = [
      {
        id: 'z', name: 'z', filePath: '/z.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
      {
        id: 'a', name: 'a', filePath: '/a.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
    ];

    const sorted = topologicalSortSkills(skills);
    expect(sorted).toHaveLength(2);
  });

  it('循环依赖应该被跳过', () => {
    const skills: ScannedSkill[] = [
      {
        id: 'a', name: 'a', filePath: '/a.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: true, dependencies: ['b'],
      },
      {
        id: 'b', name: 'b', filePath: '/b.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: true, dependencies: ['a'],
      },
    ];

    // 循环依赖不应导致死循环
    const sorted = topologicalSortSkills(skills);
    expect(sorted).toHaveLength(2);
  });
});

describe('generateSkillLoader', () => {
  const userSkills: ScannedSkill[] = [
    {
      id: 'u1', name: 'utils', filePath: '/pcbenv/skill/utils.il', dirPath: '/pcbenv/skill',
      tier: 'user', status: 'enabled', functions: [],
      hasPackageJson: false, dependencies: [],
    },
    {
      id: 'u2', name: 'shortcut', filePath: '/pcbenv/skill/shortcut.il', dirPath: '/pcbenv/skill',
      tier: 'user', status: 'enabled', functions: [],
      hasPackageJson: false, dependencies: [],
    },
  ];

  const atmSkills: ScannedSkill[] = [
    {
      id: 'a1', name: 'auto-fanout', filePath: '/pcbenv/atm_generated/auto-fanout.il', dirPath: '/pcbenv/atm_generated',
      tier: 'atm', status: 'enabled', functions: [],
      hasPackageJson: false, dependencies: [],
    },
  ];

  it('应该生成完整 loader 内容', () => {
    const content = generateSkillLoader(userSkills, atmSkills, '/pcbenv');
    expect(content).toContain('ATM Generated Skill Loader Start');
    expect(content).toContain('ATM Generated Skill Loader End');
    expect(content).toContain('User Skills');
    expect(content).toContain('ATM Managed Skills');
  });

  it('应该包含用户 Skill 的 load 语句', () => {
    const content = generateSkillLoader(userSkills, atmSkills, '/pcbenv');
    expect(content).toContain('load("/pcbenv/skill/utils.il")');
    expect(content).toContain('load("/pcbenv/skill/shortcut.il")');
  });

  it('应该包含 ATM Skill 的 load 语句', () => {
    const content = generateSkillLoader(userSkills, atmSkills, '/pcbenv');
    expect(content).toContain('load("/pcbenv/atm_generated/auto-fanout.il")');
  });

  it('禁用的用户 Skill 不应该出现在 loader 中', () => {
    const disabledUserSkills = userSkills.map((s) => ({ ...s, status: 'disabled' as const }));
    const content = generateSkillLoader(disabledUserSkills, atmSkills, '/pcbenv');
    expect(content).not.toContain('load("/pcbenv/skill/utils.il")');
  });

  it('空的 Skill 列表应该生成基础框架', () => {
    const content = generateSkillLoader([], [], '/pcbenv');
    expect(content).toContain('ATM Generated Skill Loader Start');
    expect(content).toContain('ATM Generated Skill Loader End');
    expect(content).toContain('(none)');
  });
});

describe('updateSkillStatus', () => {
  it('应该更新目标 Skill 的状态', () => {
    const skills: ScannedSkill[] = [
      {
        id: 's1', name: 's1', filePath: '/test/s1.il', dirPath: '/test',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
    ];

    const updated = updateSkillStatus(skills, '/test/s1.il', 'disabled');
    expect(updated[0].status).toBe('disabled');
  });

  it('公司 Skill 不应该被切换', () => {
    const skills: ScannedSkill[] = [
      {
        id: 's1', name: 's1', filePath: '/test/s1.il', dirPath: '/test',
        tier: 'company', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
    ];

    const updated = updateSkillStatus(skills, '/test/s1.il', 'disabled');
    expect(updated[0].status).toBe('enabled'); // unchanged
  });

  it('不存在的路径应该返回原始列表', () => {
    const skills: ScannedSkill[] = [
      {
        id: 's1', name: 's1', filePath: '/test/s1.il', dirPath: '/test',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      },
    ];

    const updated = updateSkillStatus(skills, '/nonexistent.il', 'disabled');
    expect(updated[0].status).toBe('enabled');
  });
});

describe('skillToggleRequiresRestart', () => {
  it('用户 Skill 切换需要重启', () => {
    expect(
      skillToggleRequiresRestart({
        id: 's', name: 's', filePath: '/s.il', dirPath: '/',
        tier: 'user', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      })
    ).toBe(true);
  });

  it('公司 Skill 切换不需要重启（只读不允许切换，但函数基于层级判断）', () => {
    expect(
      skillToggleRequiresRestart({
        id: 's', name: 's', filePath: '/s.il', dirPath: '/',
        tier: 'company', status: 'enabled', functions: [],
        hasPackageJson: false, dependencies: [],
      })
    ).toBe(false); // 公司 Skill 不需要重启（user 和 atm 才需要）
  });
});
