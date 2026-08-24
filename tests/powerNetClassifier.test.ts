/**
 * ATM - 电源网络识别单元测试
 */
import { describe, it, expect } from 'vitest';
import {
  parseVoltageFromNetName,
  isGroundName,
  isSupplyKeywordName,
  classifyNetName,
  classifyNet,
  classifyNets,
  isPowerPinType,
} from '../core/schematic/powerNetClassifier';
import type { NormalizedNet, NormalizedSchematic } from '../src/types/schematic';

function makeNet(name: string, pinTypes: Array<string | undefined> = []): NormalizedNet {
  return {
    name,
    pins: pinTypes.map((t, i) => ({
      partRef: `P${i}`,
      pinNumber: `${i + 1}`,
      pinType: t,
    })),
  };
}

describe('parseVoltageFromNetName - 电压解析', () => {
  it('X V Y 形式', () => {
    expect(parseVoltageFromNetName('3V3')).toEqual({ voltage: 3.3, label: '3V3' });
    expect(parseVoltageFromNetName('1V2')).toEqual({ voltage: 1.2, label: '1V2' });
    expect(parseVoltageFromNetName('0V9')).toEqual({ voltage: 0.9, label: '0V9' });
  });

  it('X.Y V 形式', () => {
    expect(parseVoltageFromNetName('3.3V')?.voltage).toBe(3.3);
    expect(parseVoltageFromNetName('1.8V')?.voltage).toBe(1.8);
    expect(parseVoltageFromNetName('12V')?.voltage).toBe(12);
  });

  it('X P Y 形式', () => {
    expect(parseVoltageFromNetName('1P2')?.voltage).toBe(1.2);
    expect(parseVoltageFromNetName('3P3')?.voltage).toBe(3.3);
  });

  it('嵌入在电源网络名中', () => {
    expect(parseVoltageFromNetName('VDD_1V2')?.voltage).toBe(1.2);
    expect(parseVoltageFromNetName('AVDD_1V8')?.voltage).toBe(1.8);
    expect(parseVoltageFromNetName('+3V3')?.voltage).toBe(3.3);
  });

  it('无法识别时返回 undefined', () => {
    expect(parseVoltageFromNetName('VCORE')).toBeUndefined();
    expect(parseVoltageFromNetName('GND')).toBeUndefined();
    expect(parseVoltageFromNetName('CLK')).toBeUndefined();
  });
});

describe('isGroundName - 接地识别', () => {
  it('标准接地名', () => {
    for (const n of ['GND', 'DGND', 'AGND', 'PGND', 'SGND', 'VSS', 'VSSA', 'VEE']) {
      expect(isGroundName(n), n).toBe(true);
    }
  });

  it('复合接地名', () => {
    expect(isGroundName('GND_DIGITAL')).toBe(true);
    expect(isGroundName('AGND_TOP')).toBe(true);
  });

  it('非接地', () => {
    expect(isGroundName('VDD')).toBe(false);
    expect(isGroundName('SIGNAL')).toBe(false);
  });
});

describe('isSupplyKeywordName - 电源关键字', () => {
  it('关键字前缀', () => {
    for (const n of ['VCC', 'VDD', 'VDDQ', 'VTT', 'VREF', 'VBAT', 'VIN', 'VSYS', 'AVDD']) {
      expect(isSupplyKeywordName(n), n).toBe(true);
    }
  });

  it('带电压后缀', () => {
    expect(isSupplyKeywordName('VDD_1V2')).toBe(true);
    expect(isSupplyKeywordName('VDD1V2')).toBe(true);
  });

  it('非关键字', () => {
    expect(isSupplyKeywordName('CLK')).toBe(false);
    expect(isSupplyKeywordName('DATA')).toBe(false);
  });
});

describe('classifyNetName - 网络名分类', () => {
  it('电源关键字 + 电压', () => {
    const r = classifyNetName('VDD_1V2');
    expect(r.isPower).toBe(true);
    expect(r.voltage).toBe(1.2);
  });

  it('纯电压样式', () => {
    expect(classifyNetName('3V3').isPower).toBe(true);
    expect(classifyNetName('3V3').voltage).toBe(3.3);
  });

  it('输入源电压样式（DC_12V）', () => {
    const r = classifyNetName('DC_12V');
    expect(r.isPower).toBe(true);
    expect(r.voltage).toBe(12);
  });

  it('信号网络含电压不应误判', () => {
    const r = classifyNetName('CLK_3V3');
    expect(r.isPower).toBe(false);
  });

  it('接地', () => {
    const r = classifyNetName('GND');
    expect(r.isGround).toBe(true);
    expect(r.voltage).toBe(0);
  });
});

describe('isPowerPinType - 引脚类型判定', () => {
  it('大小写与变体宽容', () => {
    expect(isPowerPinType('Power')).toBe(true);
    expect(isPowerPinType('power')).toBe(true);
    expect(isPowerPinType('PW')).toBe(true);
    expect(isPowerPinType('PWR')).toBe(true);
    expect(isPowerPinType('Input')).toBe(false);
    expect(isPowerPinType(undefined)).toBe(false);
  });
});

describe('classifyNet / classifyNets - 综合分类', () => {
  it('仅引脚类型 Power', () => {
    const r = classifyNet(makeNet('MAIN_PWR', ['Power']));
    expect(r.isPower).toBe(true);
    expect(r.confidence).toBeCloseTo(0.8);
    expect(r.evidence).toContain('pin-type-power');
  });

  it('引脚类型 + 网络名双证据，置信度最高', () => {
    const r = classifyNet(makeNet('VDD_1V2', ['Power']));
    expect(r.isPower).toBe(true);
    expect(r.confidence).toBeCloseTo(0.95);
  });

  it('非电源', () => {
    const r = classifyNet(makeNet('SIGNAL', ['Input']));
    expect(r.isPower).toBe(false);
    expect(r.confidence).toBe(0);
  });

  it('classifyNets 返回全部网络分类', () => {
    const schematic: NormalizedSchematic = {
      designName: 't',
      nets: [makeNet('VDD_1V2', ['Power']), makeNet('GND', [])],
      parts: [],
    };
    const all = classifyNets(schematic);
    expect(all).toHaveLength(2);
    expect(all.find((n) => n.name === 'VDD_1V2')?.isPower).toBe(true);
    expect(all.find((n) => n.name === 'GND')?.isGround).toBe(true);
  });
});
