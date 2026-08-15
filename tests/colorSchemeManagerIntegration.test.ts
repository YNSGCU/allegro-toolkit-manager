/**
 * ATM - 配色方案持久化集成测试
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  copyColorScheme,
  createColorScheme,
  deleteColorScheme,
  getColorScheme,
  listColorSchemes,
  loadColorSchemeStore,
  renameColorScheme,
  setActiveColorScheme,
} from '../core/color/colorSchemeManager';
import { createDefaultPalette } from '../core/color/colorPalette';

let configHome: string;
let oldConfigHome: string | undefined;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-color-int-'));
  oldConfigHome = process.env.ATM_CONFIG_HOME;
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  if (oldConfigHome === undefined) delete process.env.ATM_CONFIG_HOME;
  else process.env.ATM_CONFIG_HOME = oldConfigHome;
  fs.rmSync(configHome, { recursive: true, force: true });
});

function snapshot() {
  return { palette: createDefaultPalette(), background: { r: 0, g: 0, b: 0 }, layers: [] };
}

describe('配色方案持久化 round-trip', () => {
  it('创建→加载→复制→重命名→激活→删除，全程落盘', () => {
    const a = createColorScheme(snapshot(), '方案 A');
    expect(fs.existsSync(path.join(configHome, 'color_schemes.json'))).toBe(true);

    // 重新加载（模拟重启）
    expect(loadColorSchemeStore().schemes.map((s) => s.name)).toContain('方案 A');

    // 复制
    const copy = copyColorScheme(a.id, '方案 A 副本');
    expect(copy?.name).toBe('方案 A 副本');
    expect(listColorSchemes().map((s) => s.name)).toEqual(expect.arrayContaining(['方案 A', '方案 A 副本']));

    // 重命名
    expect(renameColorScheme(a.id, '方案 A2')?.name).toBe('方案 A2');
    expect(getColorScheme(a.id)?.name).toBe('方案 A2');

    // 激活
    expect(setActiveColorScheme(copy!.id)?.id).toBe(copy!.id);
    expect(loadColorSchemeStore().activeSchemeId).toBe(copy!.id);

    // 删除激活方案 → 自动激活剩余
    expect(deleteColorScheme(copy!.id).success).toBe(true);
    const after = loadColorSchemeStore();
    expect(after.schemes.map((s) => s.id)).toEqual([a.id]);
    expect(after.activeSchemeId).toBe(a.id);
  });

  it('首次加载返回空存储', () => {
    const empty = loadColorSchemeStore();
    expect(empty.schemes).toEqual([]);
    expect(empty.activeSchemeId).toBeNull();
  });
});
