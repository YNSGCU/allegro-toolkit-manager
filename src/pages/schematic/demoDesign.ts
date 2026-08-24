/**
 * ATM - 电源树演示数据（P3a 占位，待 OrCAD COM 抽取层就绪后替换为真实导入）
 */
import type {
  NormalizedNet,
  NormalizedPart,
  NormalizedSchematic,
} from '../../types/schematic';

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

function build(designName: string, parts: NormalizedPart[]): NormalizedSchematic {
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

/** 演示设计：12V → 5V(BUCK) → 3V3(BUCK) → 1V8/1V2(LDO) 多级电源树 */
export function demoSchematic(): NormalizedSchematic {
  return build('demo_board', [
    // 输入
    part('J1', 'DC_IN_2P', [
      ['1', 'PWR', 'Power', 'DC_12V'],
      ['2', 'GND', 'Power', 'GND'],
    ]),
    // 12V → 5V BUCK
    part('U1', 'TPS62085', [
      ['1', 'VIN', 'Power', 'DC_12V'],
      ['2', 'SW', 'Output', 'SW_U1'],
      ['3', 'GND', 'Power', 'GND'],
    ], undefined, { Type: 'DC-DC Buck' }),
    part('L1', '10uH', [['1', '1', 'Passive', 'SW_U1'], ['2', '2', 'Passive', 'VDD_5V']]),
    part('C1', '22uF', [['1', '1', 'Passive', 'VDD_5V'], ['2', '2', 'Passive', 'GND']], '22uF'),
    // 5V → 3V3 BUCK
    part('U2', 'MP2143', [
      ['1', 'VIN', 'Power', 'VDD_5V'],
      ['2', 'SW', 'Output', 'SW_U2'],
      ['3', 'GND', 'Power', 'GND'],
    ], undefined, { Type: 'DC-DC Buck' }),
    part('L2', '4.7uH', [['1', '1', 'Passive', 'SW_U2'], ['2', '2', 'Passive', 'VDD_3V3']]),
    part('C2', '10uF', [['1', '1', 'Passive', 'VDD_3V3'], ['2', '2', 'Passive', 'GND']], '10uF'),
    // 3V3 → 1V8 LDO
    part('U3', 'LDO_1V8', [
      ['1', 'VIN', 'Power', 'VDD_3V3'],
      ['2', 'VOUT', 'Power', 'VDD_1V8'],
      ['3', 'GND', 'Power', 'GND'],
    ]),
    // 3V3 → 1V2 LDO
    part('U4', 'LDO_1V2', [
      ['1', 'VIN', 'Power', 'VDD_3V3'],
      ['2', 'VOUT', 'Power', 'VDD_1V2'],
      ['3', 'GND', 'Power', 'GND'],
    ]),
    // 负载
    part('U10', 'MCU_STM32', [['1', 'VDD', 'Power', 'VDD_3V3'], ['2', 'GND', 'Power', 'GND']]),
    part('U13', 'PHY_RTL8211', [['1', 'VDD', 'Power', 'VDD_3V3'], ['2', 'GND', 'Power', 'GND']]),
    part('U11', 'DDR4_8Gb', [['1', 'VDD', 'Power', 'VDD_1V8'], ['2', 'GND', 'Power', 'GND']]),
    part('U12', 'CPU_SOC', [['1', 'VDD', 'Power', 'VDD_1V2'], ['2', 'GND', 'Power', 'GND']]),
    part('C3', '0.1uF', [['1', '1', 'Passive', 'VDD_3V3'], ['2', '2', 'Passive', 'GND']], '0.1uF'),
  ]);
}
