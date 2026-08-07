/**
 * ATM - 调色板 .col 解析/生成单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  COLOR_PALETTE_SIZE,
  clampRgbValue,
  createDefaultPalette,
  generateColorColFile,
  groupLayersByColor,
  hexToRgb,
  normalizeRgb,
  parseColorColFile,
  rgbToHex,
} from '../core/color/colorPalette';

const SAMPLE_COL = `#Allegro Colormap
#
#Number of Colors Used
24
#
#Background Color
#Number\tRed\tGreen\tBlue\tName
#
 0	0	0	0	Background
#
#Independent and Mixed Colors
#
#Color	Pen		Color Data
#Number	Number	Red	Green	Blue	Name
 1	1	255	255	255	White
 2	2	14	210	255	LtBlue
 3	3	255	121	203	Rose
 4	4	0	255	106	Green
 5	5	166	16	255	Purple
`;

describe('rgb 工具函数', () => {
  it('normalizeRgb 裁剪越界值', () => {
    expect(normalizeRgb({ r: -5, g: 300, b: 128 })).toEqual({ r: 0, g: 255, b: 128 });
    expect(normalizeRgb(null)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('clampRgbValue 处理非数字', () => {
    expect(clampRgbValue(Number.NaN)).toBe(0);
    expect(clampRgbValue(12.4)).toBe(12);
  });

  it('rgbToHex 与 hexToRgb 互转', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#FF0000');
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('invalid')).toBeNull();
  });
});

describe('parseColorColFile', () => {
  it('解析标准 .col 文件', () => {
    const result = parseColorColFile(SAMPLE_COL);
    expect(result.palette).toHaveLength(5);
    expect(result.palette[0]).toEqual({
      index: 1,
      name: 'White',
      rgb: { r: 255, g: 255, b: 255 },
    });
    expect(result.palette[3]).toEqual({
      index: 4,
      name: 'Green',
      rgb: { r: 0, g: 255, b: 106 },
    });
    expect(result.background).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('名称包含空格时保留完整名称', () => {
    const content = `#Number
24
#Background Color
0 0 0 0 Background
#I
1 1 10 20 30 My Custom Name
`;
    const result = parseColorColFile(content);
    expect(result.palette[0].name).toBe('My Custom Name');
  });

  it('无颜色数据时抛出错误', () => {
    expect(() => parseColorColFile('#Number\n24\n')).toThrow();
  });
});

describe('generateColorColFile', () => {
  it('生成的文件可被重新解析且等价', () => {
    const palette = createDefaultPalette();
    const background = { r: 1, g: 2, b: 3 };
    const content = generateColorColFile(palette, background);
    const result = parseColorColFile(content);

    expect(result.palette).toHaveLength(COLOR_PALETTE_SIZE);
    expect(result.background).toEqual({ r: 1, g: 2, b: 3 });
    expect(result.palette[0].rgb).toEqual({ r: 255, g: 255, b: 255 });
    expect(result.palette[23].rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('缺失颜色时按索引补齐', () => {
    const palette = [{ index: 3, rgb: { r: 1, g: 2, b: 3 } }];
    const content = generateColorColFile(palette, { r: 0, g: 0, b: 0 });
    const result = parseColorColFile(content);
    expect(result.palette).toHaveLength(COLOR_PALETTE_SIZE);
    expect(result.palette[2].rgb).toEqual({ r: 1, g: 2, b: 3 });
    expect(result.palette[0].rgb).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('groupLayersByColor', () => {
  it('groups layers by color index', () => {
    const layers = [
      { className: 'ETCH', subclassName: 'TOP', colorIndex: 7, visible: true },
      { className: 'PIN', subclassName: 'TOP', colorIndex: 7, visible: false },
      { className: 'ETCH', subclassName: 'BOTTOM', colorIndex: 125, visible: true },
      { className: 'BOARD GEOMETRY', subclassName: 'OUTLINE', colorIndex: 7, visible: true },
    ];
    const map = groupLayersByColor(layers);
    expect(map.get(7)?.map((l) => l.subclassName)).toEqual(['TOP', 'TOP', 'OUTLINE']);
    expect(map.get(125)?.map((l) => l.subclassName)).toEqual(['BOTTOM']);
    expect(map.get(99)).toBeUndefined();
  });
});
