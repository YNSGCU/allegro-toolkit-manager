/**
 * ATM - 电源树构建单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  buildPowerTree,
  detectConverterTopology,
} from '../core/schematic/powerTreeBuilder';
import type {
  NormalizedNet,
  NormalizedPart,
  NormalizedSchematic,
  PowerTree,
} from '../src/types/schematic';

type PinSpec = [string, string, string, string]; // number, name, type, netName

function part(
  reference: string,
  name: string,
  pins: PinSpec[],
  value?: string,
  properties?: Record<string, string>,
): NormalizedPart {
  return {
    reference,
    name,
    value,
    properties,
    pins: pins.map(([number, pinName, type, netName]) => ({
      number,
      name: pinName,
      type,
      netName,
    })),
  };
}

/** 从器件推导网络（保证 net.pins 与 part.pins 一致） */
function buildSchematic(designName: string, parts: NormalizedPart[]): NormalizedSchematic {
  const netMap = new Map<string, NormalizedNet>();
  for (const p of parts) {
    for (const pin of p.pins) {
      if (!pin.netName) continue;
      let net = netMap.get(pin.netName);
      if (!net) {
        net = { name: pin.netName, pins: [] };
        netMap.set(pin.netName, net);
      }
      net.pins.push({
        partRef: p.reference,
        pinNumber: pin.number,
        pinName: pin.name,
        pinType: pin.type,
      });
    }
  }
  return { designName, nets: [...netMap.values()], parts };
}

function railId(tree: PowerTree, name: string): string | undefined {
  return tree.rails.find((r) => r.name === name)?.id;
}

describe('detectConverterTopology - 拓扑关键字', () => {
  it('属性含 Buck 关键字', () => {
    const p = part('U1', 'TPS62085', [], undefined, { Type: 'DC-DC Buck' });
    expect(detectConverterTopology(p)).toBe('BUCK');
  });

  it('型号含 LDO 关键字', () => {
    expect(detectConverterTopology(part('U1', 'LDO_5V', []))).toBe('LDO');
  });

  it('型号含 Boost 关键字', () => {
    expect(detectConverterTopology(part('U1', 'TPS61040_BOOST', []))).toBe('BOOST');
  });

  it('无关键字返回 undefined', () => {
    expect(detectConverterTopology(part('U1', 'LM7805', []))).toBeUndefined();
  });
});

describe('buildPowerTree - LDO（12V → 5V）', () => {
  const tree = buildPowerTree(buildSchematic('ldo', [
    part('J1', 'CONN_2P', [['1', 'PWR', 'Power', 'DC_12V'], ['2', 'GND', 'Power', 'GND']]),
    part('U1', 'LDO_5V', [['1', 'VIN', 'Power', 'DC_12V'], ['2', 'VOUT', 'Power', 'VDD_5V'], ['3', 'GND', 'Power', 'GND']]),
    part('U2', 'MCU_XYZ', [['1', 'VDD', 'Power', 'VDD_5V'], ['2', 'GND', 'Power', 'GND']]),
    part('C1', '0.1uF', [['1', '1', 'Passive', 'VDD_5V'], ['2', '2', 'Passive', 'GND']], '0.1uF'),
  ]));

  it('识别出单个 LDO 转换器', () => {
    expect(tree.converters).toHaveLength(1);
    expect(tree.converters[0].topology).toBe('LDO');
    expect(tree.converters[0].partName).toBe('LDO_5V');
  });

  it('输入/输出轨映射正确', () => {
    const c = tree.converters[0];
    expect(c.inputRailId).toBe(railId(tree, 'DC_12V'));
    expect(c.outputRailIds).toEqual([railId(tree, 'VDD_5V')]);
  });

  it('根轨为输入 12V', () => {
    expect(tree.rootRailId).toBe(railId(tree, 'DC_12V'));
    expect(tree.rails.find((r) => r.name === 'DC_12V')?.isRoot).toBe(true);
    expect(tree.rails.find((r) => r.name === 'DC_12V')?.voltage).toBe(12);
    expect(tree.rails.find((r) => r.name === 'VDD_5V')?.voltage).toBe(5);
  });

  it('负载正确挂载', () => {
    const ic = tree.loads.find((l) => l.refdes === 'U2');
    expect(ic?.railId).toBe(railId(tree, 'VDD_5V'));
    expect(ic?.kind).toBe('ic');
    const cap = tree.loads.find((l) => l.refdes === 'C1');
    expect(cap?.railId).toBe(railId(tree, 'VDD_5V'));
    expect(cap?.kind).toBe('capacitor');
    const conn = tree.loads.find((l) => l.refdes === 'J1');
    expect(conn?.railId).toBe(railId(tree, 'DC_12V'));
    expect(conn?.kind).toBe('connector');
  });

  it('无告警', () => {
    expect(tree.warnings).toHaveLength(0);
  });
});

describe('buildPowerTree - BUCK（12V → 1V2，经电感）', () => {
  const tree = buildPowerTree(buildSchematic('buck', [
    part('J1', 'CONN_2P', [['1', 'PWR', 'Power', 'DC_12V'], ['2', 'GND', 'Power', 'GND']]),
    part('U1', 'TPS62085', [
      ['1', 'VIN', 'Power', 'DC_12V'],
      ['2', 'SW', 'Output', 'SW_U1'],
      ['3', 'GND', 'Power', 'GND'],
    ], undefined, { Type: 'DC-DC Buck' }),
    part('L1', '10uH', [['1', '1', 'Passive', 'SW_U1'], ['2', '2', 'Passive', 'VDD_1V2']]),
    part('C1', '22uF', [['1', '1', 'Passive', 'VDD_1V2'], ['2', '2', 'Passive', 'GND']], '22uF'),
    part('U2', 'CPU_XYZ', [['1', 'VDD', 'Power', 'VDD_1V2'], ['2', 'GND', 'Power', 'GND']]),
  ]));

  it('识别 BUCK，输出轨经开关节点→电感解析', () => {
    expect(tree.converters).toHaveLength(1);
    const c = tree.converters[0];
    expect(c.topology).toBe('BUCK');
    expect(c.inputRailId).toBe(railId(tree, 'DC_12V'));
    expect(c.outputRailIds).toEqual([railId(tree, 'VDD_1V2')]);
  });

  it('开关节点网络不作为电源轨', () => {
    expect(tree.rails.find((r) => r.name === 'SW_U1')).toBeUndefined();
  });

  it('电感不计入负载，电容/CPU 计入', () => {
    expect(tree.loads.find((l) => l.refdes === 'L1')).toBeUndefined();
    expect(tree.loads.find((l) => l.refdes === 'C1')?.railId).toBe(railId(tree, 'VDD_1V2'));
    expect(tree.loads.find((l) => l.refdes === 'U2')?.kind).toBe('ic');
  });

  it('输出轨电压 1.2V，根轨 12V', () => {
    expect(tree.rails.find((r) => r.name === 'VDD_1V2')?.voltage).toBe(1.2);
    expect(tree.rootRailId).toBe(railId(tree, 'DC_12V'));
  });
});

describe('buildPowerTree - PMIC 多路输出', () => {
  const tree = buildPowerTree(buildSchematic('pmic', [
    part('J1', 'CONN_2P', [['1', 'PWR', 'Power', 'DC_12V'], ['2', 'GND', 'Power', 'GND']]),
    part('U1', 'PMIC_XYZ', [
      ['1', 'VIN', 'Power', 'DC_12V'],
      ['2', 'VOUT1', 'Power', 'VDD_3V3'],
      ['3', 'VOUT2', 'Power', 'VDD_1V8'],
      ['4', 'VOUT3', 'Power', 'VDD_1V2'],
      ['5', 'GND', 'Power', 'GND'],
    ], undefined, { Type: 'PMIC' }),
    part('U2', 'IC_A', [['1', 'VDD', 'Power', 'VDD_3V3'], ['2', 'GND', 'Power', 'GND']]),
    part('U3', 'IC_B', [['1', 'VDD', 'Power', 'VDD_1V8'], ['2', 'GND', 'Power', 'GND']]),
    part('U4', 'IC_C', [['1', 'VDD', 'Power', 'VDD_1V2'], ['2', 'GND', 'Power', 'GND']]),
  ]));

  it('单输入、三路输出', () => {
    expect(tree.converters).toHaveLength(1);
    const c = tree.converters[0];
    expect(c.topology).toBe('PMIC');
    expect(c.inputRailId).toBe(railId(tree, 'DC_12V'));
    expect(c.outputRailIds).toHaveLength(3);
    expect(c.outputRailIds).toEqual(expect.arrayContaining([
      railId(tree, 'VDD_3V3'),
      railId(tree, 'VDD_1V8'),
      railId(tree, 'VDD_1V2'),
    ]));
  });

  it('三路负载各自挂到对应轨', () => {
    expect(tree.loads.find((l) => l.refdes === 'U2')?.railId).toBe(railId(tree, 'VDD_3V3'));
    expect(tree.loads.find((l) => l.refdes === 'U3')?.railId).toBe(railId(tree, 'VDD_1V8'));
    expect(tree.loads.find((l) => l.refdes === 'U4')?.railId).toBe(railId(tree, 'VDD_1V2'));
  });
});

describe('buildPowerTree - 无关键字的结构识别', () => {
  const tree = buildPowerTree(buildSchematic('structural', [
    part('J1', 'CONN_2P', [['1', 'PWR', 'Power', 'DC_12V'], ['2', 'GND', 'Power', 'GND']]),
    part('U1', 'LM7805', [['1', 'VIN', 'Power', 'DC_12V'], ['2', 'VOUT', 'Power', 'VDD_5V'], ['3', 'GND', 'Power', 'GND']]),
    part('U2', 'IC_A', [['1', 'VDD', 'Power', 'VDD_5V'], ['2', 'GND', 'Power', 'GND']]),
  ]));

  it('VIN+VOUT 结构启发式识别为转换器（拓扑未知、低置信度）', () => {
    expect(tree.converters).toHaveLength(1);
    const c = tree.converters[0];
    expect(c.topology).toBe('unknown');
    expect(c.confidence).toBeLessThan(0.6);
    expect(c.inputRailId).toBe(railId(tree, 'DC_12V'));
    expect(c.outputRailIds).toEqual([railId(tree, 'VDD_5V')]);
  });
});

describe('buildPowerTree - CPU 多轨不误判', () => {
  const tree = buildPowerTree(buildSchematic('cpu', [
    part('J1', 'CONN_2P', [['1', 'PWR', 'Power', 'VDD_3V3'], ['2', 'GND', 'Power', 'GND']]),
    part('U1', 'XC7Z020', [
      ['1', 'VDD_CORE', 'Power', 'VDD_1V0'],
      ['2', 'VDDQ', 'Power', 'VDD_1V2'],
      ['3', 'VDD', 'Power', 'VDD_3V3'],
      ['4', 'GND', 'Power', 'GND'],
    ]),
  ]));

  it('多电源引脚但无 VOUT/SW，不应识别为转换器', () => {
    expect(tree.converters).toHaveLength(0);
  });

  it('CPU 作为负载挂到三条轨', () => {
    const cpuLoads = tree.loads.filter((l) => l.refdes === 'U1');
    expect(cpuLoads).toHaveLength(3);
    expect(cpuLoads.map((l) => l.railId)).toEqual(expect.arrayContaining([
      railId(tree, 'VDD_1V0'),
      railId(tree, 'VDD_1V2'),
      railId(tree, 'VDD_3V3'),
    ]));
  });

  it('最高电压轨为根', () => {
    expect(tree.rootRailId).toBe(railId(tree, 'VDD_3V3'));
  });
});
