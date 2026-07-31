import { describe, expect, it } from 'vitest';
import { syncHotkeyRefs } from '../core/skill/enhancedScan';

describe('syncHotkeyRefs', () => {
  it('preserves skill_direct hotkey refs while appending env binding refs', () => {
    const skills: any[] = [
      {
        id: 'zsq-layer',
        name: 'zsqLayer',
        hotkeyRefs: [
          {
            key: '1',
            command: 'zsqlayer_etchlayerall',
            type: 'funckey',
            source: 'D:\\application\\Cadence\\Cadence17\\Cadence\\SPB_Data\\pcbenv\\skill\\zsqLayer.il',
            lineNumber: 12,
            sourceType: 'skill_direct',
          },
        ],
        entryCommands: [
          {
            id: 'cmd-1',
            name: 'zsqlayer_etchlayerall',
            hotkeys: [],
          },
        ],
      },
    ];

    const bindings: any[] = [
      {
        id: 'env-1',
        key: '2',
        command: 'zsqlayer_etchlayerall',
        type: 'funckey',
        source: 'user_original',
        lineNumber: 99,
      },
    ];

    const commandIndex = {
      find: () => ({
        bestMatch: {
          sourceSkillId: 'zsq-layer',
          sourceSkillName: 'zsqLayer',
        },
      }),
    } as any;

    syncHotkeyRefs(skills as any, bindings as any, commandIndex);

    expect(skills[0].hotkeyRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: '1',
          command: 'zsqlayer_etchlayerall',
          sourceType: 'skill_direct',
        }),
        expect.objectContaining({
          key: '2',
          command: 'zsqlayer_etchlayerall',
        }),
      ]),
    );
    expect(skills[0].entryCommands[0].hotkeys).toContain('1');
    expect(skills[0].entryCommands[0].hotkeys).toContain('2');
  });
});
