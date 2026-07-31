import { describe, expect, it } from 'vitest';
import { generateSkillProfileLoader } from '../core/skill/skillProfileManager';
import type { SkillProfile } from '../src/types/skillProfile';

describe('generateSkillProfileLoader', () => {
  it('writes enabled items in the explicit profile order with normalized paths', () => {
    const profile: SkillProfile = {
      id: 'profile-1',
      name: '布线方案',
      enabled: true,
      skillStates: [
        { skillId: 'b', skillName: 'B', sourceFile: 'C:\\skill\\b.il', enabled: true, loadEnabled: true, order: 0 },
        { skillId: 'a', skillName: 'A', sourceFile: 'C:\\skill\\a.il', enabled: true, loadEnabled: true, order: 1 },
        { skillId: 'off', skillName: 'Off', sourceFile: 'C:\\skill\\off.il', enabled: false, loadEnabled: true, order: 2 },
      ],
      loadOrder: ['a', 'b', 'off'],
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
    };

    const loader = generateSkillProfileLoader(profile);

    expect(loader).toContain('; Profile: 布线方案');
    expect(loader).toContain('load("C:/skill/a.il")');
    expect(loader).toContain('load("C:/skill/b.il")');
    expect(loader).not.toContain('off.il');
    expect(loader.indexOf('a.il')).toBeLessThan(loader.indexOf('b.il'));
  });
});
