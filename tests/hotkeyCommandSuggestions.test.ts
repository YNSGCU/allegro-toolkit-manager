import { describe, expect, it } from 'vitest';
import {
  findExactHotkeyCommand,
  suggestHotkeyCommands,
} from '../src/utils/hotkeyCommandSuggestions';

describe('快捷键命令建议', () => {
  it('输入 m 时优先推荐 move，并支持中文检索', () => {
    expect(suggestHotkeyCommands('m')[0]).toMatchObject({
      command: 'move',
      chineseName: '移动',
    });
    expect(suggestHotkeyCommands('移动')[0]?.command).toBe('move');
  });

  it('可从当前工作区补充用户命令，并识别精确匹配', () => {
    const bindings = [{
      id: 'custom-1',
      type: 'funckey',
      key: 'F8',
      command: 'myRouteTool',
      chineseName: '我的布线工具',
      bindingSource: 'atm_managed_block',
      status: 'normal',
      commandSource: 'user_skill',
    }] as const;

    expect(suggestHotkeyCommands('我的', [...bindings])[0]).toMatchObject({
      command: 'myRouteTool',
      source: 'current_workspace',
    });
    expect(findExactHotkeyCommand('MYROUTETOOL', [...bindings])?.commandSource).toBe('user_skill');
  });
});
