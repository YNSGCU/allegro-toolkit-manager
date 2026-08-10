import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearEnvironmentSwitchGuardsForTest,
  registerEnvironmentSwitchGuard,
  runEnvironmentSwitchGuards,
} from '../src/services/environmentSwitchGuard';

afterEach(() => clearEnvironmentSwitchGuardsForTest());

describe('Allegro 环境切换保护', () => {
  it('等待页面保存成功后才允许切换', async () => {
    const save = vi.fn().mockResolvedValue(true);
    registerEnvironmentSwitchGuard('menu', save);

    await expect(runEnvironmentSwitchGuards()).resolves.toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it('任一页面保存失败时阻止切换', async () => {
    const after = vi.fn().mockResolvedValue(true);
    registerEnvironmentSwitchGuard('menu', async () => false);
    registerEnvironmentSwitchGuard('after', after);

    await expect(runEnvironmentSwitchGuards()).resolves.toBe(false);
    expect(after).not.toHaveBeenCalled();
  });

  it('页面卸载后不再执行旧保护', async () => {
    const guard = vi.fn().mockResolvedValue(false);
    const unregister = registerEnvironmentSwitchGuard('menu', guard);
    unregister();

    await expect(runEnvironmentSwitchGuards()).resolves.toBe(true);
    expect(guard).not.toHaveBeenCalled();
  });
});
