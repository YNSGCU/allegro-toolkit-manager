import { describe, expect, it } from 'vitest';
import { buildMenuCommandCatalog } from '../core/menu/menuCommandCatalog';

describe('buildMenuCommandCatalog', () => {
  it('即使没有扫描到 Skill，也提供 Allegro 内置命令', () => {
    const commands = buildMenuCommandCatalog([]);

    expect(commands.length).toBeGreaterThan(50);
    expect(commands).toContainEqual(expect.objectContaining({
      commandName: 'move',
      sourceType: 'allegro_builtin',
    }));
  });

  it('把 Skill 入口命令转换为菜单选择器可用字段', () => {
    const commands = buildMenuCommandCatalog([{
      id: 'skill-1',
      name: '测试 Skill',
      path: 'D:/skills/test.il',
      sourceType: 'user_skill',
      tier: 'user',
      entryCommands: [{
        id: 'cmd-1',
        name: 'testCommand',
        zhName: '测试命令',
        sourceSkillId: 'skill-1',
        sourceFile: 'D:/skills/test.il',
        sourceSkillName: '测试 Skill',
        commandKind: 'axl_registered',
        isEntry: true,
        confidence: 'high',
        hotkeys: ['F8'],
        menuPaths: [],
        loadStatus: 'loaded_configured',
        conflictStatus: 'normal',
        tier: 'user',
        skillEnabled: true,
      }],
    } as any]);

    expect(commands).toContainEqual(expect.objectContaining({
      commandName: 'testCommand',
      chineseName: '测试命令',
      sourceType: 'user_skill',
      sourceSkillFile: 'D:/skills/test.il',
      entryType: 'axlCmdRegister',
      hotkeys: ['F8'],
    }));
  });
});
