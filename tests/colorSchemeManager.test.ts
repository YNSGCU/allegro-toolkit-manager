/**
 * ATM - 配色方案持久化 CRUD 单元测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createColorScheme,
  createColorSchemeFromCol,
  copyColorScheme,
  deleteColorScheme,
  getActiveColorScheme,
  getColorScheme,
  getColorSchemeStorePath,
  listColorSchemes,
  loadColorSchemeStore,
  renameColorScheme,
  setActiveColorScheme,
  updateColorScheme,
} from '../core/color/colorSchemeManager';
import type { ColorSchemeSnapshot } from '../src/types/color';

let testConfigHome = '';

beforeEach(() => {
  testConfigHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-color-schemes-'));
  process.env.ATM_CONFIG_HOME = testConfigHome;
});

afterEach(() => {
  delete process.env.ATM_CONFIG_HOME;
  try {
    fs.rmSync(testConfigHome, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

function makeSnapshot(overrides?: Partial<ColorSchemeSnapshot>): ColorSchemeSnapshot {
  return {
    palette: [
      { index: 1, rgb: { r: 255, g: 255, b: 255 } },
      { index: 2, rgb: { r: 0, g: 0, b: 255 } },
    ],
    background: { r: 0, g: 0, b: 0 },
    layers: [
      { className: 'ETCH', subclassName: 'TOP', colorIndex: 2, visible: true },
      { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 1, visible: false },
    ],
    ...overrides,
  };
}

describe('colorSchemeManager', () => {
  it('空存储返回空列表', () => {
    expect(listColorSchemes()).toEqual([]);
    expect(getActiveColorScheme()).toBeNull();
  });

  it('创建方案并持久化', () => {
    const scheme = createColorScheme(makeSnapshot(), '板A配色', '测试');
    expect(scheme.name).toBe('板A配色');
    expect(scheme.layers).toHaveLength(2);

    const store = loadColorSchemeStore();
    expect(store.schemes).toHaveLength(1);
    expect(store.activeSchemeId).toBe(scheme.id);
    expect(fs.existsSync(getColorSchemeStorePath())).toBe(true);
  });

  it('复制方案生成新 ID 与名称', () => {
    const source = createColorScheme(makeSnapshot(), '原方案');
    const copy = copyColorScheme(source.id, '复制方案');
    expect(copy).not.toBeNull();
    expect(copy!.id).not.toBe(source.id);
    expect(copy!.name).toBe('复制方案');
    expect(copy!.layers).toEqual(source.layers);
    expect(listColorSchemes()).toHaveLength(2);
  });

  it('重命名与切换激活方案', () => {
    const first = createColorScheme(makeSnapshot(), '方案一');
    const second = createColorScheme(makeSnapshot(), '方案二');

    const renamed = renameColorScheme(first.id, '方案一改名');
    expect(renamed!.name).toBe('方案一改名');

    setActiveColorScheme(second.id);
    expect(getActiveColorScheme()!.id).toBe(second.id);
  });

  it('允许删除激活方案与最后一个方案', () => {
    const first = createColorScheme(makeSnapshot(), '方案一');
    const second = createColorScheme(makeSnapshot(), '方案二');

    // 删除激活的方案二，自动激活方案一
    setActiveColorScheme(second.id);
    const deleteActive = deleteColorScheme(second.id);
    expect(deleteActive.success).toBe(true);
    expect(listColorSchemes()).toHaveLength(1);
    expect(getActiveColorScheme()!.id).toBe(first.id);

    // 删除最后一个方案，回到空状态
    const deleteLast = deleteColorScheme(first.id);
    expect(deleteLast.success).toBe(true);
    expect(listColorSchemes()).toHaveLength(0);
    expect(getActiveColorScheme()).toBeNull();
  });

  it('从 .col 导入创建仅调色板方案', () => {
    const scheme = createColorSchemeFromCol(
      '导入配色',
      [{ index: 1, rgb: { r: 10, g: 20, b: 30 } }],
      { r: 0, g: 0, b: 0 },
    );
    expect(scheme.layers).toEqual([]);
    expect(scheme.palette).toHaveLength(1);
    expect(getColorScheme(scheme.id)?.name).toBe('导入配色');
  });
});

describe('updateColorScheme', () => {
  it('updates palette entry by index and layer color by name', () => {
    const scheme = createColorScheme(makeSnapshot(), '编辑测试');
    const updated = updateColorScheme(scheme.id, {
      palette: [{ index: 1, rgb: { r: 10, g: 20, b: 30 } }],
      layers: [
        { className: 'ETCH', subclassName: 'TOP', colorIndex: 9, visible: true },
      ],
    });
    expect(updated).not.toBeNull();
    expect(updated!.palette.find((e) => e.index === 1)?.rgb).toEqual({ r: 10, g: 20, b: 30 });
    expect(updated!.layers.find((l) => l.subclassName === 'TOP')?.colorIndex).toBe(9);
    // 其他层不受影响
    expect(updated!.layers.find((l) => l.subclassName === 'BOTTOM')?.colorIndex).toBe(1);
  });

  it('returns null for missing scheme', () => {
    expect(updateColorScheme('nope', { palette: [] })).toBeNull();
  });
});
