/**
 * ATM - 电源网络识别模块
 * 纯 TS，可脱离 Electron / OrCAD 测试。
 *
 * 识别策略（由强到弱）：
 * 1. 引脚类型为 Power —— 强信号（来自 OrCAD pin.Type）
 * 2. 网络名匹配电源关键字（VCC/VDD/VBAT...）—— 中信号
 * 3. 网络名携带电压样式（3V3 / 1V2 / 1.8V...）—— 弱信号
 *
 * 接地（GND/VSS/VEE）单独标记，不进入电源树主体。
 */
import type {
  NormalizedNet,
  NormalizedSchematic,
  SchematicPinType,
} from '../../src/types/schematic';

/** 归一化后的 Power 引脚类型（抽取层负责把 COM 枚举映射到此） */
export const PIN_TYPE_POWER: SchematicPinType = 'Power';

/** 证据类型 */
export type NetEvidence = 'pin-type-power' | 'name-keyword' | 'name-voltage';

/** 单条网络的分类结果 */
export interface ClassifiedNet {
  name: string;
  isPower: boolean;
  isGround: boolean;
  voltage?: number;
  voltageLabel?: string;
  /** 0..1 置信度 */
  confidence: number;
  evidence: NetEvidence[];
}

/** 电压解析结果 */
export interface VoltageMatch {
  voltage: number;
  /** 命中的原始标签，如 "1V2" */
  label: string;
}

const GROUND_NAMES = new Set([
  'GND', 'DGND', 'AGND', 'PGND', 'SGND', 'EGND', 'VSS', 'VSSA', 'VSSD', 'VEE',
]);

const SUPPLY_KEYWORDS = new Set([
  'VCC', 'VDD', 'VDDQ', 'VTT', 'VREF', 'VCORE', 'VIO', 'VPP', 'VLED',
  'VBAT', 'VIN', 'VOUT', 'VSYS', 'VUSB', 'VBUS', 'PVCC', 'PVIN',
  'AVDD', 'DVDD', 'AVCC', 'VDDA', 'VDDI', 'VDDP', 'VDDD', 'VCCA', 'VCCD',
  'VCCINT', 'VCCAUX', 'VCCP', 'VCC3V3', 'VCC5V',
]);

/**
 * 电压样式匹配，按优先级排列（先匹配更具体的 X V Y 形式）。
 * - "3V3" / "1V2" / "0V9"  → 3.3 / 1.2 / 0.9
 * - "1.8V" / "3.3V" / "12V" → 1.8 / 3.3 / 12
 * - "1P2" / "3P3"          → 1.2 / 3.3
 */
const VOLTAGE_PATTERNS: Array<{
  re: RegExp;
  build: (m: RegExpMatchArray) => number | undefined;
}> = [
  { re: /(\d+)[vV](\d{1,2})/, build: (m) => toVoltage(m[1], m[2]) },
  { re: /(\d+(?:\.\d+)?)[vV]/, build: (m) => safeNumber(m[1]) },
  { re: /(\d+)[pP](\d{1,2})/, build: (m) => toVoltage(m[1], m[2]) },
];

function safeNumber(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function toVoltage(major: string, minor: string): number | undefined {
  return safeNumber(`${major}.${minor}`);
}

/** 从网络名解析电压；无法识别返回 undefined */
export function parseVoltageFromNetName(name: string): VoltageMatch | undefined {
  const upper = name.trim().toUpperCase().replace(/^[+]/, '');
  if (!upper) return undefined;
  for (const p of VOLTAGE_PATTERNS) {
    const m = upper.match(p.re);
    if (m) {
      const v = p.build(m);
      if (v !== undefined && Number.isFinite(v)) {
        return { voltage: v, label: m[0] };
      }
    }
  }
  return undefined;
}

/** 判断是否为接地网络名 */
export function isGroundName(name: string): boolean {
  const upper = name.trim().toUpperCase();
  if (!upper) return false;
  const base = upper.split(/[_\-\s.:+]/)[0];
  if (GROUND_NAMES.has(base)) return true;
  // PGND1 / GND_DIGITAL / LGND 等复合接地名
  return /GND|VSS|VEE/.test(base);
}

/** 判断是否为电源关键字网络名（VCC/VDD/VBAT...，含电压后缀） */
export function isSupplyKeywordName(name: string): boolean {
  const upper = name.trim().toUpperCase().replace(/^[+]/, '');
  if (!upper) return false;
  const base = upper.split(/[_\-\s.:]/)[0];
  if (SUPPLY_KEYWORDS.has(base)) return true;
  // 去掉电压后缀：VDD1V2 -> VDD, VBUS5V -> VBUS
  const stripped = base.replace(/[\dPpVv.]+$/, '');
  return SUPPLY_KEYWORDS.has(stripped);
}

/** 仅凭网络名分类（不含引脚类型信息） */
export function classifyNetName(name: string): {
  isPower: boolean;
  isGround: boolean;
  voltage?: number;
  voltageLabel?: string;
  evidence: Extract<NetEvidence, 'name-keyword' | 'name-voltage'>[];
} {
  const volt = parseVoltageFromNetName(name);

  if (isGroundName(name)) {
    return {
      isPower: true,
      isGround: true,
      voltage: 0,
      voltageLabel: '0V',
      evidence: ['name-keyword'],
    };
  }

  if (isSupplyKeywordName(name)) {
    return {
      isPower: true,
      isGround: false,
      voltage: volt?.voltage,
      voltageLabel: volt?.label,
      evidence: volt ? ['name-keyword', 'name-voltage'] : ['name-keyword'],
    };
  }

  if (volt) {
    // 电压样式但无电源关键字：仅当名字整体像电压轨（以数字 / V+数字 / 输入源前缀开头）
    // 才视为电源轨，避免 "CLK_3V3" 这类信号网络被误判。
    const upper = name.trim().toUpperCase();
    const looksLikeRail =
      /^[+]?\d/.test(upper)
      || /^V\d/.test(upper)
      || /^(DC|PWR|POWER|BAT|VIN|VBAT|VSYS|VUSB|VBUS|VMAIN|VSUPPLY|INPUT|VEXT)/.test(upper);
    if (looksLikeRail) {
      return {
        isPower: true,
        isGround: false,
        voltage: volt.voltage,
        voltageLabel: volt.label,
        evidence: ['name-voltage'],
      };
    }
  }

  return { isPower: false, isGround: false, evidence: [] };
}

/** 判断引脚类型是否为 Power（大小写/变体宽容） */
export function isPowerPinType(type: SchematicPinType | undefined): boolean {
  if (!type) return false;
  const t = String(type).trim().toLowerCase();
  return t === 'power' || t === 'pw' || t === 'pwr' || t === 'powerpin';
}

/** 综合网络名 + 引脚类型，分类单条网络 */
export function classifyNet(net: NormalizedNet): ClassifiedNet {
  const byName = classifyNetName(net.name);
  const hasPowerPin = net.pins.some((p) => isPowerPinType(p.pinType));

  const evidence: NetEvidence[] = [...byName.evidence];
  if (hasPowerPin) evidence.push('pin-type-power');

  let confidence = 0;
  if (hasPowerPin) confidence = 0.8;
  if (byName.evidence.includes('name-keyword')) confidence = Math.max(confidence, 0.7);
  if (byName.evidence.includes('name-voltage')) confidence = Math.max(confidence, 0.6);
  if (hasPowerPin && byName.isPower) confidence = 0.95;

  const isPower = hasPowerPin || byName.isPower;

  return {
    name: net.name,
    isPower,
    isGround: byName.isGround,
    voltage: byName.voltage,
    voltageLabel: byName.voltageLabel,
    confidence: isPower ? confidence : 0,
    evidence,
  };
}

/** 分类整张原理图的所有网络 */
export function classifyNets(schematic: NormalizedSchematic): ClassifiedNet[] {
  return schematic.nets.map((net) => classifyNet(net));
}

/** 分类整张原理图的所有网络，返回 Map<网络名, ClassifiedNet> */
export function classifyNetsMap(schematic: NormalizedSchematic): Map<string, ClassifiedNet> {
  const map = new Map<string, ClassifiedNet>();
  for (const net of schematic.nets) {
    map.set(net.name, classifyNet(net));
  }
  return map;
}
