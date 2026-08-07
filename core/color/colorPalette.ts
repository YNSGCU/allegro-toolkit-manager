/**
 * ATM - 调色板数据模型与 .col 文件解析/生成
 *
 * Allegro 的 .col 文件格式（官方 axlColorLoad 文档）：
 *   #Number
 *   24
 *   #Background Color
 *   0 <red> <green> <blue> [<name>]
 *   #I
 *   <color number> <pen number> <red> <green> <blue> [<name>]
 *
 * 颜色行出现顺序决定初始颜色优先级（越靠前优先级越高）。
 */
import type { ColorLayerEntry, ColorPaletteEntry, ColorRgb } from '../../src/types/color';

/** Allegro 支持的调色板颜色数量 */
export const COLOR_PALETTE_SIZE = 24;

/** 将 0-255 分量裁剪为合法范围 */
export function clampRgbValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** 规范化 RGB */
export function normalizeRgb(rgb: Partial<ColorRgb> | undefined | null): ColorRgb {
  return {
    r: clampRgbValue(rgb?.r ?? 0),
    g: clampRgbValue(rgb?.g ?? 0),
    b: clampRgbValue(rgb?.b ?? 0),
  };
}

/** RGB 转十六进制色值，例如 (255 0 0) -> "#FF0000" */
export function rgbToHex(rgb: ColorRgb): string {
  const toHex = (v: number) => clampRgbValue(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/** 十六进制色值转 RGB，无法解析时返回 null */
export function hexToRgb(hex: string): ColorRgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

/** 创建默认 24 色调色板（近似 Allegro lallegro.col） */
export function createDefaultPalette(): ColorPaletteEntry[] {
  const defaults: Array<[string, [number, number, number]]> = [
    ['White', [255, 255, 255]],
    ['LtBlue', [14, 210, 255]],
    ['Rose', [255, 121, 203]],
    ['Green', [0, 255, 106]],
    ['Purple', [166, 16, 255]],
    ['Teal', [121, 153, 196]],
    ['Red', [255, 0, 0]],
    ['Yellow', [255, 255, 0]],
    ['Blue', [0, 0, 255]],
    ['Aqua', [55, 247, 215]],
    ['Gray', [179, 179, 185]],
    ['Olive', [116, 150, 113]],
    ['Orange', [252, 199, 46]],
    ['Red2', [255, 40, 40]],
    ['Beige', [172, 138, 138]],
    ['Navy', [2, 168, 213]],
    ['Violet', [176, 0, 206]],
    ['Gold', [234, 190, 0]],
    ['Silver', [141, 73, 102]],
    ['Pink', [255, 40, 140]],
    ['Lime', [14, 249, 182]],
    ['Brown', [161, 4, 4]],
    ['Green2', [100, 255, 80]],
    ['White2', [255, 255, 255]],
  ];

  return defaults.map(([name, rgb], index) => ({
    index: index + 1,
    name,
    rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
  }));
}

/** 默认背景色（黑色） */
export function createDefaultBackground(): ColorRgb {
  return { r: 0, g: 0, b: 0 };
}

/**
 * 按颜色索引反向索引图层：返回「颜色索引 -> 使用该颜色的图层列表」
 *
 * 用于回答"软件里的某个颜色在 Allegro 中对应哪些图层/区域"。
 */
export function groupLayersByColor(
  layers: ColorLayerEntry[],
): Map<number, ColorLayerEntry[]> {
  const result = new Map<number, ColorLayerEntry[]>();
  for (const layer of layers) {
    const list = result.get(layer.colorIndex) ?? [];
    list.push(layer);
    result.set(layer.colorIndex, list);
  }
  return result;
}

/**
 * 解析 .col 文件内容
 * @returns 调色板（1-24）+ 背景色；解析失败时抛出错误
 */
export function parseColorColFile(content: string): {
  palette: ColorPaletteEntry[];
  background: ColorRgb;
} {
  const lines = content.split(/\r?\n/);
  const palette: ColorPaletteEntry[] = [];
  let background: ColorRgb | null = null;
  let section: 'number' | 'background' | 'colors' | null = null;
  let colorCount = COLOR_PALETTE_SIZE;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith('#')) {
      const header = line.slice(1).trim().toLowerCase();
      // 表头行（#Number Red Green Blue Name 等）仅作注释，不切换段落
      if (header.includes('red')) continue;
      if (/^number(\s|$)/.test(header)) section = 'number';
      else if (header.includes('background')) section = 'background';
      else if (
        /^i(\s|$)/.test(header) ||
        header.startsWith('independent') ||
        header.startsWith('mixed') ||
        header.startsWith('color ')
      ) {
        section = 'colors';
      }
      continue;
    }

    const tokens = line.split(/\s+/);

    if (section === 'number') {
      const count = Number(tokens[0]);
      if (Number.isFinite(count) && count > 0) {
        colorCount = Math.min(count, COLOR_PALETTE_SIZE);
      }
      continue;
    }

    if (section === 'background') {
      const values = tokens.slice(0, 4).map(Number);
      if (values.length >= 4 && values.every(Number.isFinite)) {
        background = { r: clampRgbValue(values[1]), g: clampRgbValue(values[2]), b: clampRgbValue(values[3]) };
      }
      continue;
    }

    if (section === 'colors') {
      const colorNumber = Number(tokens[0]);
      if (!Number.isFinite(colorNumber) || colorNumber < 1 || colorNumber > colorCount) {
        continue;
      }
      const rgb = {
        r: clampRgbValue(Number(tokens[2])),
        g: clampRgbValue(Number(tokens[3])),
        b: clampRgbValue(Number(tokens[4])),
      };
      // 名称可能是剩余字段（可能含空格）
      const name = tokens.length > 5 ? tokens.slice(5).join(' ') : undefined;
      palette.push({ index: colorNumber, name, rgb });
    }
  }

  if (palette.length === 0) {
    throw new Error('无法解析 .col 文件：未找到颜色数据');
  }

  return {
    palette: palette.slice(0, COLOR_PALETTE_SIZE),
    background: background ?? createDefaultBackground(),
  };
}

/**
 * 生成 .col 文件内容（与 Allegro axlColorSave 兼容）
 */
export function generateColorColFile(
  palette: ColorPaletteEntry[],
  background: ColorRgb,
): string {
  const bg = normalizeRgb(background);
  const defaults = createDefaultPalette();
  const byIndex = new Map(
    palette
      .filter((entry) => entry && entry.index >= 1 && entry.index <= COLOR_PALETTE_SIZE)
      .map((entry) => [entry.index, entry] as const),
  );

  const lines: string[] = [];
  lines.push('#Allegro Colormap', '#', '#Number of Colors Used', String(COLOR_PALETTE_SIZE), '#');
  lines.push('#Background Color', '#Number\tRed\tGreen\tBlue\tName', '#');
  lines.push(`0\t${bg.r}\t${bg.g}\t${bg.b}\tBackground`);
  lines.push('#', '#Independent and Mixed Colors', '#');
  lines.push('#Color\tPen\t\tColor Data', '#Number\tNumber\tRed\tGreen\tBlue\tName');

  for (let i = 1; i <= COLOR_PALETTE_SIZE; i++) {
    const entry = byIndex.get(i);
    const rgb = normalizeRgb(entry?.rgb ?? defaults[i - 1].rgb);
    const name = entry?.name && entry.name.trim() !== '' ? entry.name.trim() : (defaults[i - 1].name ?? `Color ${i}`);
    lines.push(`${i}\t${i}\t${rgb.r}\t${rgb.g}\t${rgb.b}\t${name}`);
  }

  return lines.join('\r\n');
}

