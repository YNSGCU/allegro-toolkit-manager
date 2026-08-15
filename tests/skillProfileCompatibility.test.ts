import { describe, expect, it } from 'vitest';
import { checkSkillProfileCompatibility } from '../core/environment/compatibility';
import type { SkillProfile } from '../src/types/skillProfile';

function base(partial: Partial<SkillProfile> = {}): Pick<SkillProfile, 'skillStates' | 'sourceAllegroVersion' | 'sourceEnvironmentId'> {
  return { skillStates: [], ...partial };
}

function item(sourceFile: string) {
  return { skillId: 's1', skillName: 'S', sourceFile, enabled: true, loadEnabled: true, order: 0 };
}

const target = { id: 'env-174', allegroVersion: '17.4', pcbenvPath: 'C:/pcbenv', sharedWithIds: [] };

describe('checkSkillProfileCompatibility', () => {
  it('无风险时 verdict 为 portable', () => {
    const r = checkSkillProfileCompatibility(base({ skillStates: [item('pcbenv/skills/s.il')] }), target);
    expect(r.verdict).toBe('portable');
  });

  it('绝对路径 Skill 文件 → blocked', () => {
    const r = checkSkillProfileCompatibility(base({ skillStates: [item('C:/abs/s.il')] }), target);
    expect(r.verdict).toBe('blocked');
    expect(r.findings.some((f) => f.code === 'absolute-path')).toBe(true);
  });

  it('版本不同 → warning', () => {
    const r = checkSkillProfileCompatibility(base({ sourceAllegroVersion: '17.2' }), target);
    expect(r.verdict).toBe('warning');
    expect(r.findings.some((f) => f.code === 'version-diff')).toBe(true);
  });

  it('目标就是来源环境 → info 提示', () => {
    const r = checkSkillProfileCompatibility(base({ sourceEnvironmentId: 'env-174' }), target);
    expect(r.findings.some((f) => f.code === 'same-environment')).toBe(true);
  });
});
