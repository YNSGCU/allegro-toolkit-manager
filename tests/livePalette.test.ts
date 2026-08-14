import { describe, expect, it } from 'vitest';
import { buildLivePaletteSkill } from '../core/color/vibeColorBridge';
import type { ColorPaletteEntry } from '../src/types/color';

describe('buildLivePaletteSkill', () => {
  const palette: ColorPaletteEntry[] = [
    { index: 1, rgb: { r: 255, g: 0, b: 0 } },
    { index: 2, rgb: { r: 0, g: 255, b: 0 } },
    { index: 3, rgb: { r: 0, g: 0, b: 255 } },
  ];

  it('仅设置调色板，不包含图层分配逻辑', () => {
    const skill = buildLivePaletteSkill(palette, 3);
    expect(skill).toContain("axlColorSet('all");
    expect(skill).not.toContain('axlLayerSet');
    expect(skill).not.toContain('axlLayerGet');
  });

  it('按 colorCount 补齐缺失颜色到 24 个 RGB 三元组', () => {
    const skill = buildLivePaletteSkill(palette, 24);
    const triples = skill.match(/\(\d+ \d+ \d+\)/g) ?? [];
    expect(triples.length).toBe(24);
    // 前三个为用户传入的颜色
    expect(skill).toContain('(255 0 0)');
    expect(skill).toContain('(0 255 0)');
    expect(skill).toContain('(0 0 255)');
  });

  it('未提供 colorCount 时默认使用 24 色', () => {
    const skill = buildLivePaletteSkill(palette);
    const triples = skill.match(/\(\d+ \d+ \d+\)/g) ?? [];
    expect(triples.length).toBe(24);
  });

  it('背景色可选：提供时写入 background，缺省时省略', () => {
    const withBg = buildLivePaletteSkill(palette, 3, { r: 10, g: 20, b: 30 });
    expect(withBg).toContain("axlColorSet('background '(10 20 30))");
    const withoutBg = buildLivePaletteSkill(palette, 3);
    expect(withoutBg).not.toContain("axlColorSet('background");
  });

  it('以 axlVisibleUpdate 刷新并返回 applied 标志', () => {
    const skill = buildLivePaletteSkill(palette, 3);
    expect(skill).toContain('axlVisibleUpdate(t)');
    expect(skill.trimEnd().endsWith(')')).toBe(true);
  });
});
