/**
 * ATM - 电源树构建模块
 * 纯 TS，可脱离 Electron / OrCAD 测试。
 *
 * 输入：NormalizedSchematic（归一化网表 IR）
 * 输出：PowerTree（电源输入 → 电源 IC → 电压轨 → 负载 的树）
 *
 * 识别策略：
 * - 转换器（电源 IC）识别：优先拓扑关键字（LDO/BUCK/BOOST/PMIC/REG）；
 *   否则结构启发式——线性型（VIN+VOUT 两条独立轨）或开关型（VIN+SW/LX/PHASE）。
 * - 输出轨解析：LDO 的 VOUT 直连输出轨；BUCK/BOOST 经开关节点 → 电感 → 输出轨。
 * - 输入/输出方向：以电压高低为主（BUCK/LDO 降压、BOOST 升压），
 *   引脚名（VIN/VOUT）为辅；无法确定时降置信度并告警。
 * - 根轨：未被任何转换器生产、且电压最高（或含输入关键字）的电源轨。
 */
import type {
  NormalizedNet,
  NormalizedPart,
  NormalizedPin,
  NormalizedSchematic,
  PowerConverter,
  PowerConverterTopology,
  PowerLoad,
  PowerRail,
  PowerTree,
  PowerTreeWarning,
} from '../../src/types/schematic';
import {
  classifyNetsMap,
  isPowerPinType,
  type ClassifiedNet,
} from './powerNetClassifier';

/* ============================ 关键字 / 名称判定 ============================ */

const TOPOLOGY_KEYWORDS: Array<{ re: RegExp; topo: PowerConverterTopology }> = [
  { re: /ldo|linear[\s-]?reg/i, topo: 'LDO' },
  { re: /buck|step[\s-]?down|synch?[\s-]?reg/i, topo: 'BUCK' },
  { re: /boost|step[\s-]?up/i, topo: 'BOOST' },
  { re: /pmic|pmu|power[\s-]?management|multi[\s-]?channel|multi[\s-]?rail/i, topo: 'PMIC' },
  { re: /(^|[^a-z])(reg|regulator|switcher|dc[\s-]?dc|vreg|vr)/i, topo: 'unknown' },
];

/** 功率相关引脚名前缀（用于结构启发式与转换器轨解析） */
const POWER_PIN_NAME_PREFIX =
  /^(VCC|VDD|VSS|VIN|VOUT|VBAT|VSYS|PVIN|PVCC|SW|LX|PHASE|AVDD|DVDD|VPP|VREF|VBUS|VUSB|VCORE|VTT|VDDQ|VO|GND)/i;

/** 输入源风格网络名（用于根轨判定） */
const INPUT_SOURCE_PREFIX =
  /^(VBAT|VIN|PVIN|VSYS|VUSB|VBUS|BAT|DC|PWR|POWER|VMAIN|VSUPPLY|ADAPTER|INPUT|VEXT)/i;

function isInputPinName(name: string | undefined): boolean {
  if (!name) return false;
  return /^(VIN|PVIN|IN|VBAT|VSYS)([0-9_].*)?$/i.test(name.trim());
}

function isOutputPinName(name: string | undefined): boolean {
  if (!name) return false;
  return /^(VOUT|OUT|VO)([0-9_].*)?$/i.test(name.trim());
}

function isSwitchPinName(name: string | undefined): boolean {
  if (!name) return false;
  return /^(SW|LX|PHASE)([0-9_].*)?$/i.test(name.trim());
}

function isPowerRelevantPin(pin: NormalizedPin): boolean {
  return isPowerPinType(pin.type) || POWER_PIN_NAME_PREFIX.test(pin.name ?? '');
}

/** 稳定 id（djb2 哈希） */
function hashId(prefix: string, key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  }
  return `${prefix}${h.toString(16)}`;
}

/** 按器件型号 / 值 / 属性识别转换器拓扑 */
export function detectConverterTopology(
  part: NormalizedPart,
): PowerConverterTopology | undefined {
  const haystack = [
    part.name,
    part.value ?? '',
    ...Object.values(part.properties ?? {}),
  ].join(' ');
  for (const k of TOPOLOGY_KEYWORDS) {
    if (k.re.test(haystack)) return k.topo;
  }
  return undefined;
}

/** 器件在某条电源轨上的功率引脚分组 */
interface PartSupplyNet {
  netName: string;
  voltage?: number;
  pinNames: string[];
  hasInputPin: boolean;
  hasOutputPin: boolean;
  hasSwitchPin: boolean;
}

function collectPartSupplyNets(
  part: NormalizedPart,
  netMap: Map<string, ClassifiedNet>,
): PartSupplyNet[] {
  const grouped = new Map<string, PartSupplyNet>();
  for (const pin of part.pins) {
    if (!pin.netName) continue;
    if (!isPowerRelevantPin(pin)) continue;
    const pinName = (pin.name ?? '').trim();
    const isSwitch = isSwitchPinName(pinName);
    const cls = netMap.get(pin.netName);
    const isSupply = cls ? cls.isPower && !cls.isGround : false;
    // 开关引脚（SW/LX/PHASE）即使其网络不是电源轨也要记录，
    // 用于结构识别与「开关节点 → 电感 → 输出轨」的展开。
    if (!isSupply && !isSwitch) continue;

    let g = grouped.get(pin.netName);
    if (!g) {
      g = {
        netName: pin.netName,
        voltage: cls?.voltage,
        pinNames: [],
        hasInputPin: false,
        hasOutputPin: false,
        hasSwitchPin: false,
      };
      grouped.set(pin.netName, g);
    }
    g.pinNames.push(pinName);
    if (isInputPinName(pinName)) g.hasInputPin = true;
    if (isOutputPinName(pinName)) g.hasOutputPin = true;
    if (isSwitch) g.hasSwitchPin = true;
  }
  return [...grouped.values()];
}

/** 结构启发式 + 关键字：判断器件是否为电源转换器 */
export function detectConverter(
  part: NormalizedPart,
  netMap: Map<string, ClassifiedNet>,
): { isConverter: boolean; topology: PowerConverterTopology; confidence: number; evidence: string[] } {
  const topo = detectConverterTopology(part);
  const supplyNets = collectPartSupplyNets(part, netMap);
  const distinctRails = supplyNets.filter((g) => !g.hasSwitchPin).length;
  const hasInput = supplyNets.some((g) => g.hasInputPin);
  const hasOutput = supplyNets.some((g) => g.hasOutputPin);
  const hasSwitch = supplyNets.some((g) => g.hasSwitchPin);

  if (topo) {
    return {
      isConverter: true,
      topology: topo,
      confidence: 0.9,
      evidence: [`name-topology:${topo}`],
    };
  }

  // 结构启发式：
  // 线性型（LDO/稳压器）：VIN + VOUT 触及两条独立电源轨
  const structuralLinear = distinctRails >= 2 && hasOutput;
  // 开关型（BUCK/BOOST）：VIN + SW/LX/PHASE（CPU/SoC 不会有开关引脚）
  const structuralSwitch = hasInput && hasSwitch;

  if (structuralLinear || structuralSwitch) {
    return {
      isConverter: true,
      topology: 'unknown',
      confidence: 0.55,
      evidence: [
        structuralLinear ? 'structural:linear' : 'structural:switch',
        `rails:${distinctRails}`,
      ],
    };
  }

  return { isConverter: false, topology: 'unknown', confidence: 0, evidence: [] };
}

/** 推断转换器的输入/输出轨（基于电压与引脚名，不含开关节点展开） */
interface ConverterRails {
  inputRailName?: string;
  outputRailNames: string[];
  switchRailNames: string[];
  confidence: number;
  evidence: string[];
}

function inferConverterRails(
  part: NormalizedPart,
  topology: PowerConverterTopology,
  supplyNets: PartSupplyNet[],
): ConverterRails {
  const switchRailNames = supplyNets.filter((g) => g.hasSwitchPin).map((g) => g.netName);
  const candidates = supplyNets.filter((g) => !g.hasSwitchPin);

  const evidence: string[] = [];
  const inputNamed = candidates.filter((g) => g.hasInputPin).map((g) => g.netName);
  const outputNamed = candidates.filter((g) => g.hasOutputPin).map((g) => g.netName);

  const withVoltage = candidates.filter((g) => g.voltage !== undefined);
  const sortedDesc = [...withVoltage].sort((a, b) => (b.voltage ?? 0) - (a.voltage ?? 0));

  let inputRailName: string | undefined;
  let outputRailNames: string[] = [];
  let confidence = 0.6;

  if (topology === 'BOOST') {
    inputRailName = sortedDesc.length ? sortedDesc[sortedDesc.length - 1].netName : inputNamed[0];
    outputRailNames = sortedDesc
      .filter((g) => g.netName !== inputRailName)
      .map((g) => g.netName);
    evidence.push('topology:BOOST', 'input=lowest-voltage');
  } else if (topology === 'PMIC') {
    inputRailName = inputNamed[0] ?? (sortedDesc.length ? sortedDesc[0].netName : candidates[0]?.netName);
    outputRailNames = candidates
      .filter((g) => g.netName !== inputRailName)
      .map((g) => g.netName);
    evidence.push('topology:PMIC', 'input=highest-or-vin');
  } else {
    // BUCK / LDO / unknown：默认输入取最高电压
    if (sortedDesc.length) {
      inputRailName = sortedDesc[0].netName;
      outputRailNames = sortedDesc
        .filter((g) => g.netName !== inputRailName)
        .map((g) => g.netName);
      evidence.push('input=highest-voltage');
    } else {
      inputRailName = inputNamed[0];
      outputRailNames = outputNamed.filter((n) => n !== inputRailName);
      evidence.push('input=input-pin-name');
      confidence = 0.4;
    }
    if (topology === 'unknown') {
      confidence = Math.min(confidence, 0.45);
      evidence.push('topology:unknown');
    }
  }

  // 兜底：确无输出时，把剩余候选作为输出
  if (outputRailNames.length === 0 && inputRailName) {
    outputRailNames = candidates
      .filter((g) => g.netName !== inputRailName)
      .map((g) => g.netName);
  }

  outputRailNames = [...new Set(outputRailNames)].filter((n) => n !== inputRailName);

  return {
    inputRailName,
    outputRailNames,
    switchRailNames,
    confidence,
    evidence,
  };
}

/** 通过开关节点（SW → 电感 → 输出轨）解析降压/升压输出轨 */
function findOutputRailViaSwitch(
  switchNetName: string,
  selfRef: string,
  netIndex: Map<string, NormalizedNet>,
  partIndex: Map<string, NormalizedPart>,
  netMap: Map<string, ClassifiedNet>,
): string | undefined {
  const net = netIndex.get(switchNetName);
  if (!net) return undefined;
  for (const pinRef of net.pins) {
    if (pinRef.partRef === selfRef) continue;
    const other = partIndex.get(pinRef.partRef);
    if (!other) continue;
    // 桥接器件（电感/磁珠）的其它引脚若落在某条电源轨上，即为输出轨
    for (const p of other.pins) {
      if (!p.netName || p.netName === switchNetName) continue;
      const cls = netMap.get(p.netName);
      if (cls && cls.isPower && !cls.isGround) return p.netName;
    }
  }
  return undefined;
}

/** 负载器件类别 */
function classifyLoadKind(part: NormalizedPart): PowerLoad['kind'] {
  const ref = part.reference.trim().toUpperCase();
  const name = (part.name ?? '').toUpperCase();
  const value = (part.value ?? '').toUpperCase();
  if (/^[C]/.test(ref) || /CAP|FUSE|FERRITE/.test(name) || /F$/.test(value)) return 'capacitor';
  if (/^[R]/.test(ref) || /RES/.test(name)) return 'resistor';
  if (/^[JP]/.test(ref) || /CONN|HEADER|SOCKET/.test(name)) return 'connector';
  if (/^[MX]/.test(ref) || /MODULE|BGA/.test(name)) return 'module';
  if (/^[U]/.test(ref) || /IC|FPGA|CPU|SOC|MCU/.test(name)) return 'ic';
  return 'other';
}

/** 输入源风格网络名（用于根轨判定） */
function isInputSourceName(name: string): boolean {
  const base = name.trim().toUpperCase().replace(/^[+]/, '').split(/[_\-\s.:]/)[0];
  return INPUT_SOURCE_PREFIX.test(base);
}

/* ============================ 主入口 ============================ */

export function buildPowerTree(schematic: NormalizedSchematic): PowerTree {
  const netMap = classifyNetsMap(schematic);
  const netIndex = new Map(schematic.nets.map((n) => [n.name, n]));
  const partIndex = new Map(schematic.parts.map((p) => [p.reference, p]));
  const warnings: PowerTreeWarning[] = [];

  // 1. 电源轨（排除接地）
  const supplyNets = [...netMap.values()].filter((n) => n.isPower && !n.isGround);

  const rails: PowerRail[] = supplyNets.map((n) => ({
    id: hashId('rail_', n.name),
    name: n.name,
    voltage: n.voltage,
    voltageLabel: n.voltageLabel,
    isGround: false,
    isRoot: false,
    source: n.evidence.includes('pin-type-power') ? 'pinType' : 'name',
  }));
  const railByName = new Map(rails.map((r) => [r.name, r]));

  // 2. 识别转换器 vs 负载
  const converters: PowerConverter[] = [];
  const producedRails = new Set<string>();
  const loadParts: NormalizedPart[] = [];

  for (const part of schematic.parts) {
    const det = detectConverter(part, netMap);
    if (!det.isConverter) {
      loadParts.push(part);
      continue;
    }

    const supplyNetsOfPart = collectPartSupplyNets(part, netMap);
    const railsInferred = inferConverterRails(part, det.topology, supplyNetsOfPart);

    // 开关节点展开：BUCK/BOOST 输出轨经电感桥接
    const outputRailNames = new Set(railsInferred.outputRailNames);
    for (const sw of railsInferred.switchRailNames) {
      const found = findOutputRailViaSwitch(sw, part.reference, netIndex, partIndex, netMap);
      if (found) outputRailNames.add(found);
    }

    const inputRailId = railsInferred.inputRailName
      ? railByName.get(railsInferred.inputRailName)?.id
      : undefined;
    const outputRailIds = [...outputRailNames]
      .map((n) => railByName.get(n)?.id)
      .filter((id): id is string => id !== undefined);

    for (const n of outputRailNames) producedRails.add(n);

    if (!inputRailId) {
      warnings.push({
        code: 'UNCONFIRMED_DIRECTION',
        message: `转换器 ${part.reference} 无法确定输入轨`,
        severity: 'warning',
        refdes: part.reference,
      });
    }

    converters.push({
      id: hashId('conv_', part.reference),
      refdes: part.reference,
      partName: part.name,
      topology: det.topology,
      inputRailId: inputRailId ?? '',
      outputRailIds,
      confidence: Math.min(det.confidence, railsInferred.confidence),
      evidence: [...det.evidence, ...railsInferred.evidence],
    });
  }

  // 3. 根轨：未被生产的电源轨中电压最高（优先输入源命名）
  const rootRail = determineRoot(rails, producedRails, warnings);
  if (rootRail) rootRail.isRoot = true;

  // 4. 负载挂载：负载器件触及的每条电源轨（电感/磁珠不计入负载）
  const loads: PowerLoad[] = [];
  for (const part of loadParts) {
    if (/^(L|FB)[0-9_]*$/i.test(part.reference.trim())) continue;
    const kind = classifyLoadKind(part);
    const seen = new Set<string>();
    for (const pin of part.pins) {
      if (!pin.netName) continue;
      const rail = railByName.get(pin.netName);
      if (!rail || seen.has(rail.id)) continue;
      seen.add(rail.id);
      loads.push({
        id: hashId('load_', `${part.reference}@${pin.netName}`),
        refdes: part.reference,
        partName: part.name,
        railId: rail.id,
        kind,
      });
    }
  }

  // 5. 缺电压告警
  for (const rail of rails) {
    if (rail.voltage === undefined && !rail.isRoot) {
      warnings.push({
        code: 'MISSING_VOLTAGE',
        message: `电源轨 ${rail.name} 未识别到电压`,
        severity: 'info',
        netName: rail.name,
      });
    }
  }

  const groundCount = [...netMap.values()].filter((n) => n.isGround).length;
  if (rails.length === 0 && groundCount > 0) {
    warnings.push({
      code: 'GROUND_ONLY',
      message: '仅识别到接地网络，未发现供电轨',
      severity: 'warning',
    });
  }

  return {
    designName: schematic.designName,
    rails,
    converters,
    loads,
    rootRailId: rootRail?.id,
    warnings,
    meta: {
      generatedAt: new Date().toISOString(),
      netCount: schematic.nets.length,
      partCount: schematic.parts.length,
    },
  };
}

function determineRoot(
  rails: PowerRail[],
  producedRails: Set<string>,
  warnings: PowerTreeWarning[],
): PowerRail | undefined {
  const candidates = rails.filter((r) => !producedRails.has(r.name));
  const inputNamed = candidates.filter((r) => isInputSourceName(r.name));
  const pool = inputNamed.length > 0 ? inputNamed : candidates;

  const withVoltage = pool.filter((r) => r.voltage !== undefined);
  const chosen = withVoltage.length > 0
    ? withVoltage.sort((a, b) => (b.voltage ?? 0) - (a.voltage ?? 0))[0]
    : pool[0];

  if (!chosen) {
    warnings.push({
      code: 'NO_ROOT',
      message: '未找到电源输入根轨',
      severity: 'error',
    });
    return undefined;
  }
  return chosen;
}
