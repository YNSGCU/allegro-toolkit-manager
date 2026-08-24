/**
 * ATM - 电源树布局单元测试
 */
import { describe, it, expect } from 'vitest';
import { buildPowerTree } from '../core/schematic/powerTreeBuilder';
import { layoutPowerTree } from '../core/schematic/powerTreeLayout';
import type {
  NormalizedNet,
  NormalizedPart,
  NormalizedSchematic,
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
  return { designName: 't', nets: [...netMap.values()], parts };
}

describe('layoutPowerTree - 布局', () => {
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
  const layout = layoutPowerTree(tree);

  it('根轨在更左侧（层级更浅）', () => {
    const root = layout.nodes.find((n) => n.isRoot);
    const child = layout.nodes.find((n) => !n.isRoot);
    expect(root).toBeDefined();
    expect(child).toBeDefined();
    expect(root!.x).toBeLessThan(child!.x);
  });

  it('连线连接根轨与输出轨', () => {
    expect(layout.edges).toHaveLength(1);
    const root = layout.nodes.find((n) => n.isRoot)!;
    const child = layout.nodes.find((n) => !n.isRoot)!;
    expect(layout.edges[0].inputRailId).toBe(root.id);
    expect(layout.edges[0].outputRailId).toBe(child.id);
  });

  it('坐标均为有限数值', () => {
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
    for (const e of layout.edges) {
      expect(Number.isFinite(e.x1)).toBe(true);
      expect(Number.isFinite(e.y2)).toBe(true);
    }
  });

  it('画布尺寸为正', () => {
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});
