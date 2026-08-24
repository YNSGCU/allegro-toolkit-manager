/**
 * ATM - 电源树导出单元测试
 */
import { describe, it, expect } from 'vitest';
import { buildPowerTree } from '../core/schematic/powerTreeBuilder';
import {
  powerTreeDimensions,
  powerTreeExportFileName,
  renderPowerTreeSvg,
} from '../core/schematic/powerTreeExport';
import type {
  NormalizedNet,
  NormalizedPart,
  NormalizedSchematic,
  PowerTree,
} from '../src/types/schematic';

type PinSpec = [string, string, string, string];

function part(reference: string, name: string, pins: PinSpec[], properties?: Record<string, string>): NormalizedPart {
  return {
    reference,
    name,
    properties,
    pins: pins.map(([number, pinName, type, netName]) => ({ number, name: pinName, type, netName })),
  };
}

function build(parts: NormalizedPart[]): NormalizedSchematic {
  const netMap = new Map<string, NormalizedNet>();
  for (const p of parts) {
    for (const pin of p.pins) {
      if (!pin.netName) continue;
      let net = netMap.get(pin.netName);
      if (!net) {
        net = { name: pin.netName, pins: [] };
        netMap.set(pin.netName, net);
      }
      net.pins.push({ partRef: p.reference, pinNumber: pin.number, pinName: pin.name, pinType: pin.type });
    }
  }
  return { designName: 'demo', nets: [...netMap.values()], parts };
}

const tree = buildPowerTree(build([
  part('J1', 'CONN', [['1', 'PWR', 'Power', 'DC_12V'], ['2', 'GND', 'Power', 'GND']]),
  part('U1', 'TPS62085', [
    ['1', 'VIN', 'Power', 'DC_12V'],
    ['2', 'SW', 'Output', 'SW_U1'],
    ['3', 'GND', 'Power', 'GND'],
  ], { Type: 'DC-DC Buck' }),
  part('L1', '10uH', [['1', '1', 'Passive', 'SW_U1'], ['2', '2', 'Passive', 'VDD_1V2']]),
  part('U2', 'MCU', [['1', 'VDD', 'Power', 'VDD_1V2'], ['2', 'GND', 'Power', 'GND']]),
]));

describe('renderPowerTreeSvg - SVG 生成', () => {
  it('输出自包含 SVG（含命名空间与闭合标签）', () => {
    const svg = renderPowerTreeSvg(tree);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('包含电压轨名与转换器位号', () => {
    const svg = renderPowerTreeSvg(tree);
    expect(svg).toContain('DC_12V');
    expect(svg).toContain('VDD_1V2');
    expect(svg).toContain('U1');
  });

  it('XML 转义特殊字符', () => {
    const t: PowerTree = {
      designName: 'a&b<c>',
      rails: [{ id: 'r1', name: 'VDD&X', voltage: 1.2, isGround: false, isRoot: true, source: 'name' }],
      converters: [],
      loads: [],
      warnings: [],
      meta: { generatedAt: '', netCount: 1, partCount: 0 },
    };
    const svg = renderPowerTreeSvg(t);
    expect(svg).toContain('VDD&amp;X');
    expect(svg).not.toContain('VDD&X</text>');
  });
});

describe('powerTreeDimensions - 画布尺寸', () => {
  it('返回正整数尺寸', () => {
    const { width, height } = powerTreeDimensions(tree);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });
});

describe('powerTreeExportFileName - 文件名', () => {
  it('拼接设计名与格式', () => {
    expect(powerTreeExportFileName(tree, 'svg')).toBe('demo-power-tree.svg');
    expect(powerTreeExportFileName(tree, 'png')).toBe('demo-power-tree.png');
  });

  it('清理非法文件名字符', () => {
    const t: PowerTree = { ...tree, designName: 'a/b:c*?' };
    expect(powerTreeExportFileName(t, 'svg')).toBe('a_b_c__-power-tree.svg');
  });
});
