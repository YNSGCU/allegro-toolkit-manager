import { describe, expect, it } from 'vitest';
import { filterHotkeysByKeyboardLayer } from '../src/utils/hotkeyItem';
import type { HotkeyBinding } from '../src/types/hotkey';

function createBinding(key: string): HotkeyBinding {
  return {
    id: key,
    key,
    command: `cmd_${key}`,
    type: 'funckey',
    bindingSource: 'user_env_original',
    status: 'normal',
  };
}

function createAliasBinding(key: string): HotkeyBinding {
  return {
    ...createBinding(key),
    type: 'alias',
  };
}

describe('filterHotkeysByKeyboardLayer', () => {
  it('在缺少预计算字段时仍能识别大写单字母为大写层', () => {
    const bindings = [
      createBinding('a'),
      createBinding('A'),
      createBinding('Shift+A'),
    ];

    const uppercaseBindings = filterHotkeysByKeyboardLayer(bindings, 'uppercase');

    expect(uppercaseBindings.map((binding) => binding.key)).toEqual(['A']);
  });

  it('在缺少预计算字段时仍能识别 Shift 组合键为特殊层', () => {
    const bindings = [
      createBinding('a'),
      createBinding('A'),
      createBinding('Shift+A'),
    ];

    const specialBindings = filterHotkeysByKeyboardLayer(bindings, 'special');

    expect(specialBindings.map((binding) => binding.key)).toEqual(['Shift+A']);
  });
  it('maps keyboard-like aliases into the matching modifier layer', () => {
    const bindings = [
      createAliasBinding('~C'),
      createAliasBinding('~W'),
      createAliasBinding('CSUp'),
      createAliasBinding('zs'),
    ];

    const ctrlBindings = filterHotkeysByKeyboardLayer(bindings, 'ctrl');
    const normalBindings = filterHotkeysByKeyboardLayer(bindings, 'normal');

    expect(ctrlBindings.map((binding) => binding.key)).toEqual(['~C', '~W', 'CSUp']);
    expect(normalBindings.map((binding) => binding.key)).toContain('zs');
    expect(normalBindings.map((binding) => binding.key)).not.toContain('~C');
    expect(normalBindings.map((binding) => binding.key)).not.toContain('~W');
  });
});
