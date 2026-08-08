/**
 * ATM - Vibe Bridge color read/write unit tests
 *
 * Covers: capture/apply SKILL generation, capture output parsing,
 * target stackup query (string layer names + dynamic color count),
 * role-based color mapping, apply output parsing, palette normalization,
 * SKILL string escaping.
 */
import { describe, it, expect } from 'vitest';
import {
  buildApplySkill,
  buildCaptureSkill,
  buildSmartApplySkill,
  buildTargetLayerQuerySkill,
  classifyTargetLayers,
  computeColorRoleMapping,
  isPlaneLayer,
  normalizePalette,
  parseApplyOutput,
  parseCaptureOutput,
  parseTargetLayersOutput,
} from '../core/color/vibeColorBridge';
import type { ColorSchemeSnapshot } from '../src/types/color';

const CAPTURE_OUTPUT = `(palette ((255 255 255) (0 0 255) (255 0 0)) background (0 0 0) layers (("ETCH" "TOP" 2 t "CONDUCTOR") ("ETCH" "BOTTOM" 3 nil "CONDUCTOR") ("ETCH" "GND" 4 t "PLANE") ("BOARD GEOMETRY" "OUTLINE" 1 t nil)) board "DEMO_BOARD" top "TOP" bottom "BOTTOM")`;

describe('buildCaptureSkill', () => {
  it('generates capture script with string layer names and axlLayerGet', () => {
    const skill = buildCaptureSkill();
    expect(skill).toContain('axlVisibleGet()');
    expect(skill).toContain('axlGetParam(strcat("paramLayerGroup:"');
    expect(skill).toContain("axlColorGet('all)");
    expect(skill).toContain("axlColorGet('background)");
    expect(skill).toContain('axlCurrentDesign()');
    expect(skill).toContain('axlConductorTopLayer()');
    expect(skill).toContain('axlConductorBottomLayer()');
    expect(skill).toContain('lp = errset(axlLayerGet(strcat(nth(2 classEntry) "/" subp)) t)');
    expect(skill).toContain('lp->color');
    expect(skill).toContain('axlIsVisibleLayer(strcat(nth(2 classEntry) "/" subp))');
    expect(skill).not.toContain('lp->visibility');
    expect(skill).toContain('axlDBGetLayerType(strcat(nth(2 classEntry) "/" subp))');
    expect(skill).toContain('layerData = reverse(layerData)');
    expect(skill).not.toContain('axlCurrentDesign()->name');
    expect(skill).not.toContain(';');
    expect(balanceParens(skill)).toBe(true);
  });
});

describe('parseCaptureOutput', () => {
  it('parses complete capture result with layer types and anchors', () => {
    const snapshot = parseCaptureOutput(CAPTURE_OUTPUT);
    expect(snapshot.palette).toHaveLength(3);
    expect(snapshot.palette[0].rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(snapshot.background).toEqual({ r: 0, g: 0, b: 0 });
    expect(snapshot.layers).toEqual([
      { className: 'ETCH', subclassName: 'TOP', colorIndex: 2, visible: true, layerType: 'CONDUCTOR' },
      { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 3, visible: false, layerType: 'CONDUCTOR' },
      { className: 'ETCH', subclassName: 'GND', colorIndex: 4, visible: true, layerType: 'PLANE' },
      { className: 'BOARD GEOMETRY', subclassName: 'OUTLINE', colorIndex: 1, visible: true, layerType: null },
    ]);
    expect(snapshot.source?.boardName).toBe('DEMO_BOARD');
    expect(snapshot.source?.topLayerName).toBe('TOP');
    expect(snapshot.source?.bottomLayerName).toBe('BOTTOM');
    expect(snapshot.source?.viaBridge).toBe(true);
  });

  it('clamps invalid color indexes', () => {
    const output = `(palette ((255 255 255)) background (0 0 0) layers (("ETCH" "TOP" 99 t) ("ETCH" "BOTTOM" -3 nil)))`;
    const snapshot = parseCaptureOutput(output);
    expect(snapshot.layers[0].colorIndex).toBe(99);
    expect(snapshot.layers[1].colorIndex).toBe(1);
  });

  it('filters empty layer names', () => {
    const output = `(palette ((1 2 3)) background (0 0 0) layers (("ETCH" "" 1 t) ("" "TOP" 1 t)))`;
    const snapshot = parseCaptureOutput(output);
    expect(snapshot.layers).toHaveLength(0);
  });

  it('throws when palette data is missing', () => {
    expect(() => parseCaptureOutput('(palette () background (0 0 0) layers ())')).toThrow();
  });
});

describe('buildApplySkill (legacy name matching)', () => {
  it('generates apply script with quoted lists and stats', () => {
    const snapshot: ColorSchemeSnapshot = {
      palette: [
        { index: 1, rgb: { r: 255, g: 255, b: 255 } },
        { index: 2, rgb: { r: 0, g: 0, b: 255 } },
      ],
      background: { r: 10, g: 20, b: 30 },
      layers: [
        { className: 'ETCH', subclassName: 'TOP', colorIndex: 2, visible: true },
        { className: 'BOARD GEOMETRY', subclassName: 'OUTLINE', colorIndex: 1, visible: false },
      ],
    };
    const skill = buildApplySkill(snapshot);
    expect(skill).toContain("axlColorSet('all '(");
    expect(skill).toContain('(255 255 255)');
    expect(skill).toContain('(0 0 255)');
    expect(skill).toContain("axlColorSet('background '(10 20 30))");
    expect(skill).toContain('("ETCH" "TOP" 2 t)');
    expect(skill).toContain('("BOARD GEOMETRY" "OUTLINE" 1 nil)');
    expect(skill).toContain('axlVisibleUpdate(t)');
    expect(skill).toContain('list(applied skipped)');
    expect(balanceParens(skill)).toBe(true);
  });

  it('extends palette to target color count', () => {
    const snapshot: ColorSchemeSnapshot = {
      palette: [{ index: 1, rgb: { r: 255, g: 255, b: 255 } }],
      background: { r: 0, g: 0, b: 0 },
      layers: [],
    };
    const skill = buildApplySkill(snapshot, 192);
    // 192 个颜色全部写入 axlColorSet('all ...) 调用
    const allLine = skill.split('\n').find((line) => line.includes("axlColorSet('all"));
    const rgbCount = (allLine?.match(/\(\d+ \d+ \d+\)/g) || []).length;
    expect(rgbCount).toBe(192);
    expect(skill).toContain('(128 128 128)');
  });
});

describe('buildTargetLayerQuerySkill / parseTargetLayersOutput', () => {
  it('generates stackup query script for string layer names', () => {
    const skill = buildTargetLayerQuerySkill();
    expect(skill).toContain('axlConductorTopLayer()');
    expect(skill).toContain('axlConductorBottomLayer()');
    expect(skill).toContain('axlGetParam("paramLayerGroup:ETCH")');
    expect(skill).toContain("axlColorGet('count)");
    expect(skill).toContain('axlDBGetLayerType(strcat("ETCH/" subp))');
    expect(skill).toContain('layers = reverse(layers)');
    expect(balanceParens(skill)).toBe(true);
  });

  it('parses target stackup output', () => {
    const output = `("TOP" "BOTTOM" (("TOP" "CONDUCTOR") ("L2" "CONDUCTOR") ("GND" "PLANE") ("L3" "CONDUCTOR") ("BOTTOM" "CONDUCTOR")))`;
    const target = parseTargetLayersOutput(output);
    expect(target.topLayerName).toBe('TOP');
    expect(target.bottomLayerName).toBe('BOTTOM');
    expect(target.layers).toHaveLength(5);
    expect(target.layers[2]).toEqual({ name: 'GND', layerType: 'PLANE' });
    expect(target.colorCount).toBe(24);
  });

  it('parses colorCount from 4-element output', () => {
    const output = `("TOP" "BOTTOM" (("TOP" "CONDUCTOR")) 192)`;
    const target = parseTargetLayersOutput(output);
    expect(target.colorCount).toBe(192);
  });
});

describe('isPlaneLayer', () => {
  it('uses layerType first, falls back to name pattern', () => {
    expect(isPlaneLayer('PLANE', 'GND')).toBe(true);
    expect(isPlaneLayer('CONDUCTOR', 'GND')).toBe(false);
    expect(isPlaneLayer(null, 'GND')).toBe(true);
    expect(isPlaneLayer(null, 'PWR1')).toBe(true);
    expect(isPlaneLayer(null, 'VCC')).toBe(true);
    expect(isPlaneLayer(null, 'L2')).toBe(false);
    expect(isPlaneLayer(undefined, 'SIG1')).toBe(false);
  });
});

describe('computeColorRoleMapping', () => {
  it('excludes ALL plane layers from inner sequence (mode color for planes)', () => {
    // 源板 6 个平面层：颜色 66 出现 4 次、86 出现 2 次，共 6 个平面层
    const snapshot: ColorSchemeSnapshot = {
      palette: [],
      background: { r: 0, g: 0, b: 0 },
      layers: [
        { className: 'ETCH', subclassName: 'TOP', colorIndex: 7, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L2_GND1', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L3_SIG1', colorIndex: 14, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L4_GND2', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L5_SIG2', colorIndex: 16, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L6_GND3', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L7_SIG3', colorIndex: 38, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L8_GND4', colorIndex: 86, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L9_PWR1', colorIndex: 86, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 125, visible: true, layerType: 'CONDUCTOR' },
      ],
      source: { topLayerName: 'TOP', bottomLayerName: 'BOTTOM' },
    };
    const mapping = computeColorRoleMapping(snapshot);
    expect(mapping.topColor).toBe(7);
    expect(mapping.bottomColor).toBe(125);
    expect(mapping.planeColors).toEqual([66, 66, 66, 86, 86]); // 平面层按叠顺序保持颜色序列
    // 内部信号层不包含平面层颜色
    expect(mapping.innerColors).toEqual([14, 16, 38]);
    expect(mapping.innerColors).not.toContain(66);
    expect(mapping.innerColors).not.toContain(86);
  });

  it('extracts top/bottom/plane colors and inner sequence', () => {
    const snapshot: ColorSchemeSnapshot = {
      palette: [],
      background: { r: 0, g: 0, b: 0 },
      layers: [
        { className: 'ETCH', subclassName: 'TOP', colorIndex: 7, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L2', colorIndex: 8, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'GND', colorIndex: 4, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L3', colorIndex: 9, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 5, visible: true, layerType: 'CONDUCTOR' },
      ],
      source: { topLayerName: 'TOP', bottomLayerName: 'BOTTOM' },
    };
    const mapping = computeColorRoleMapping(snapshot);
    expect(mapping.topColor).toBe(7);
    expect(mapping.bottomColor).toBe(5);
    expect(mapping.planeColors).toEqual([4]);
    expect(mapping.innerColors).toEqual([8, 9]);
  });
});

describe('classifyTargetLayers', () => {
  it('classifies top, bottom, plane and inner layers in stackup order', () => {
    const target = {
      topLayerName: 'TOP',
      bottomLayerName: 'BOTTOM',
      colorCount: 24,
      layers: [
        { name: 'TOP', layerType: 'CONDUCTOR' },
        { name: 'L2', layerType: 'CONDUCTOR' },
        { name: 'GND', layerType: 'PLANE' },
        { name: 'L3', layerType: 'CONDUCTOR' },
        { name: 'BOTTOM', layerType: 'CONDUCTOR' },
      ],
    };
    expect(classifyTargetLayers(target)).toEqual([
      { name: 'TOP', role: 'top' },
      { name: 'L2', role: 'inner' },
      { name: 'GND', role: 'plane' },
      { name: 'L3', role: 'inner' },
      { name: 'BOTTOM', role: 'bottom' },
    ]);
  });
});

describe('buildSmartApplySkill', () => {
  const snapshot: ColorSchemeSnapshot = {
    palette: [],
    background: { r: 0, g: 0, b: 0 },
    layers: [
      { className: 'ETCH', subclassName: 'TOP', colorIndex: 7, visible: true, layerType: 'CONDUCTOR' },
      { className: 'ETCH', subclassName: 'L2', colorIndex: 8, visible: true, layerType: 'CONDUCTOR' },
      { className: 'ETCH', subclassName: 'GND', colorIndex: 4, visible: true, layerType: 'PLANE' },
      { className: 'ETCH', subclassName: 'L3', colorIndex: 9, visible: true, layerType: 'CONDUCTOR' },
      { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 5, visible: true, layerType: 'CONDUCTOR' },
      { className: 'BOARD GEOMETRY', subclassName: 'OUTLINE', colorIndex: 1, visible: false },
    ],
    source: { topLayerName: 'TOP', bottomLayerName: 'BOTTOM' },
  };

  it('maps target stackup by role with quoted lists', () => {
    const target = {
      topLayerName: 'TOP',
      bottomLayerName: 'BOTTOM',
      colorCount: 192,
      layers: [
        { name: 'TOP', layerType: 'CONDUCTOR' },
        { name: 'L2', layerType: 'CONDUCTOR' },
        { name: 'PWR', layerType: 'PLANE' },
        { name: 'L3', layerType: 'CONDUCTOR' },
        { name: 'L4', layerType: 'CONDUCTOR' },
        { name: 'L5', layerType: 'CONDUCTOR' },
        { name: 'BOTTOM', layerType: 'CONDUCTOR' },
      ],
    };
    const skill = buildSmartApplySkill(snapshot, target);
    expect(skill).toContain("axlColorSet('all '(");
    expect(skill).toContain("layers = '(");
    expect(skill).toContain('("ETCH/TOP" 7 t)');
    expect(skill).toContain('("ETCH/BOTTOM" 5 t)');
    expect(skill).toContain('("ETCH/PWR" 4 t)');
    expect(skill).toContain('("ETCH/L2" 8 t)');
    expect(skill).toContain('("ETCH/L3" 9 t)');
    expect(skill).toContain('("ETCH/L4" 8 t)');
    expect(skill).toContain('("ETCH/L5" 9 t)');
    expect(skill).toContain('("BOARD GEOMETRY/OUTLINE" 1 nil)');
    expect(skill).toContain('list(applied skipped reverse(skippedNames))');
    expect(skill).toContain('skippedNames = cons(car(entry) skippedNames)');
    expect(skill).toContain('when(doVis');
    expect(balanceParens(skill)).toBe(true);
  });
});

describe('buildSmartApplySkill plane sequence', () => {
  it('cycles plane colors in source plane order without polluting signal layers', () => {
    // 源板 18 层：平面层两种颜色交替 (66/86)
    const snapshot: ColorSchemeSnapshot = {
      palette: [],
      background: { r: 0, g: 0, b: 0 },
      layers: [
        { className: 'ETCH', subclassName: 'TOP', colorIndex: 7, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L2_GND1', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L3_SIG1', colorIndex: 14, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L4_GND2', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L5_SIG2', colorIndex: 16, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L6_GND3', colorIndex: 66, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L7_SIG3', colorIndex: 38, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'L8_GND4', colorIndex: 86, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L9_PWR1', colorIndex: 86, visible: true, layerType: 'PLANE' },
        { className: 'ETCH', subclassName: 'L10_SIG4', colorIndex: 144, visible: true, layerType: 'CONDUCTOR' },
        { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 125, visible: true, layerType: 'CONDUCTOR' },
      ],
      source: { topLayerName: 'TOP', bottomLayerName: 'BOTTOM' },
    };

    // 目标板 14 层：8 个平面 + 4 个信号
    const target = {
      topLayerName: 'TOP',
      bottomLayerName: 'BOTTOM',
      colorCount: 192,
      layers: [
        { name: 'TOP', layerType: 'CONDUCTOR' },
        { name: 'L2_GND1', layerType: 'PLANE' },
        { name: 'L3_SIG1', layerType: 'CONDUCTOR' },
        { name: 'L4_GND2', layerType: 'PLANE' },
        { name: 'L5_SIG2', layerType: 'CONDUCTOR' },
        { name: 'L6_GND3', layerType: 'PLANE' },
        { name: 'L7_VCC1', layerType: 'PLANE' },
        { name: 'L8_VCC2', layerType: 'PLANE' },
        { name: 'L9_GND4', layerType: 'PLANE' },
        { name: 'L10_SIG3', layerType: 'CONDUCTOR' },
        { name: 'L11_GND5', layerType: 'PLANE' },
        { name: 'L12_SIG4', layerType: 'CONDUCTOR' },
        { name: 'L13_GND6', layerType: 'PLANE' },
        { name: 'BOTTOM', layerType: 'CONDUCTOR' },
      ],
    };

    const skill = buildSmartApplySkill(snapshot, target);
    // 平面层按源平面序列循环：66,66,66,86,86,66,66,66
    expect(skill).toContain('("ETCH/L2_GND1" 66 t)');
    expect(skill).toContain('("ETCH/L4_GND2" 66 t)');
    expect(skill).toContain('("ETCH/L6_GND3" 66 t)');
    expect(skill).toContain('("ETCH/L7_VCC1" 86 t)');
    expect(skill).toContain('("ETCH/L8_VCC2" 86 t)');
    expect(skill).toContain('("ETCH/L9_GND4" 66 t)');
    expect(skill).toContain('("ETCH/L11_GND5" 66 t)');
    expect(skill).toContain('("ETCH/L13_GND6" 66 t)');
    // 信号层不受平面影响，按序取色
    expect(skill).toContain('("ETCH/L3_SIG1" 14 t)');
    expect(skill).toContain('("ETCH/L5_SIG2" 16 t)');
    expect(skill).toContain('("ETCH/L10_SIG3" 38 t)');
    expect(skill).toContain('("ETCH/L12_SIG4" 144 t)');
  });
});

describe('normalizePalette', () => {
  it('extends palette to requested color count', () => {
    const result = normalizePalette([{ index: 5, rgb: { r: 1, g: 2, b: 3 } }], 192);
    expect(result).toHaveLength(192);
    expect(result[4].rgb).toEqual({ r: 1, g: 2, b: 3 });
    expect(result[0].index).toBe(1);
    expect(result[191].index).toBe(192);
  });
});

describe('parseApplyOutput', () => {
  it('parses apply stats', () => {
    expect(parseApplyOutput('(10 3)')).toEqual({ appliedLayerCount: 10, skippedLayerCount: 3 });
    expect(parseApplyOutput('(0 0)')).toEqual({ appliedLayerCount: 0, skippedLayerCount: 0 });
    expect(parseApplyOutput('bad output')).toEqual({ appliedLayerCount: 0, skippedLayerCount: 0 });
  });
});

function balanceParens(code: string): boolean {
  let depth = 0;
  for (const ch of code) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}
