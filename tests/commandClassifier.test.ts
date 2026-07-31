import { describe, expect, it } from 'vitest';
import { classifyCommand } from '../core/validator/commandClassifier';
import type { CommandRegistry } from '../src/types/skill';

describe('classifyCommand', () => {
  const registry: CommandRegistry = {
    entries: {
      snp: [
        {
          commandName: 'snp',
          type: 'procedure',
          skillFilePath: '/skill/smart-snap.il',
          skillName: 'smart-snap',
          tier: 'user',
          skillEnabled: true,
        },
      ],
      cvn: [
        {
          commandName: 'cvn',
          type: 'procedure',
          skillFilePath: '/skill/ChangeViaNet.il',
          skillName: 'ChangeViaNet',
          tier: 'user',
          skillEnabled: true,
        },
      ],
    },
    stats: {
      totalCommands: 2,
      companyCommands: 0,
      userCommands: 2,
      atmCommands: 0,
    },
  };

  it('prefers the skill registry for snp and cvn instead of treating them as built-ins', () => {
    const snapResult = classifyCommand('snp', [], registry);
    const viaResult = classifyCommand('cvn', [], registry);

    expect(snapResult.source).toBe('user_skill');
    expect(snapResult.skillName).toBe('smart-snap');

    expect(viaResult.source).toBe('user_skill');
    expect(viaResult.skillName).toBe('ChangeViaNet');
  });

  it('still keeps real built-in commands as allegro built-ins', () => {
    const result = classifyCommand('save', [], registry);

    expect(result.source).toBe('allegro_builtin');
    expect(result.skillName).toBeNull();
  });
});
