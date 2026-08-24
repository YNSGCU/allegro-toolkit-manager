/**
 * ATM - 原理图 / 电源树 / 硬件框图 共享类型
 *
 * 设计原则：
 * 1. NormalizedSchematic 是「COM/PDF 抽取层 → 算法层」的中介表示（IR），
 *    由抽取器产出（OrCAD COM / PDF 解析），算法层只消费该 IR，不感知 COM 细节。
 * 2. PowerTree 是电源树算法的输出，供 UI 画布渲染与导出使用。
 */

/** 归一化后的引脚类型（OrCAD pin.Type 的常用取值；抽取层负责把 COM 枚举映射为字符串） */
export type SchematicPinType =
  | 'Power'
  | 'Input'
  | 'Output'
  | 'Bidirectional'
  | 'Passive'
  | 'OpenCollector'
  | 'OpenEmitter'
  | 'ThreeState'
  | 'HighImpedance'
  | 'NotConfigured'
  | (string & {});

/** 归一化网表中的引脚引用（网络 → 引脚 的映射一侧） */
export interface NetPinRef {
  /** 器件位号，如 U1 */
  partRef: string;
  /** 引脚号，如 "1" 或 "VIN" */
  pinNumber: string;
  /** 引脚名，如 "VIN" */
  pinName?: string;
  /** 引脚类型（归一化后） */
  pinType?: SchematicPinType;
}

/** 归一化网络 */
export interface NormalizedNet {
  name: string;
  pins: NetPinRef[];
}

/** 归一化器件引脚 */
export interface NormalizedPin {
  number: string;
  name?: string;
  type?: SchematicPinType;
  /** 引脚所在网络名（冗余存储，便于按器件遍历） */
  netName?: string;
}

/** 归一化器件 */
export interface NormalizedPart {
  /** 位号，如 U1 */
  reference: string;
  /** 器件型号 / 库名，如 "TPS62130" */
  name: string;
  /** 阻容值等，如 "10uF" */
  value?: string;
  /** 附加属性（电压、封装等自定义字段） */
  properties?: Record<string, string>;
  pins: NormalizedPin[];
}

/** 原理图页（二期用于层次块/框图） */
export interface SchematicPageRef {
  name: string;
  parentPage?: string;
}

/** 归一化原理图（IR） */
export interface NormalizedSchematic {
  designName: string;
  pages?: SchematicPageRef[];
  nets: NormalizedNet[];
  parts: NormalizedPart[];
}

/* ============================ 电源树模型 ============================ */

/** 电源转换器拓扑 */
export type PowerConverterTopology = 'LDO' | 'BUCK' | 'BOOST' | 'PMIC' | 'unknown';

/** 电压轨 */
export interface PowerRail {
  id: string;
  /** 网络名，如 "VDD_1V2" */
  name: string;
  /** 电压（V），无法识别时缺省，由用户校正 */
  voltage?: number;
  /** 电压原始标签，如 "1V2" */
  voltageLabel?: string;
  /** 是否接地（接地不进入树，仅作为返回路径标记） */
  isGround: boolean;
  /** 是否电源输入根轨 */
  isRoot: boolean;
  /** 识别来源 */
  source: 'pinType' | 'name' | 'user';
}

/** 电源转换器（电源 IC） */
export interface PowerConverter {
  id: string;
  refdes: string;
  partName: string;
  topology: PowerConverterTopology;
  /** 上游输入轨 id */
  inputRailId: string;
  /** 下游输出轨 id（PMIC 可多路） */
  outputRailIds: string[];
  /** 使能网络（如有） */
  enableNet?: string;
  /** 识别置信度 0..1，低置信度在 UI 高亮待确认 */
  confidence: number;
  /** 识别依据说明 */
  evidence: string[];
}

/** 负载器件（挂在某条电压轨上、非电源 IC 的器件） */
export interface PowerLoad {
  id: string;
  refdes: string;
  partName: string;
  railId: string;
  kind: 'ic' | 'capacitor' | 'resistor' | 'connector' | 'module' | 'other';
}

/** 电源树警告 */
export interface PowerTreeWarning {
  code:
    | 'NO_ROOT'
    | 'MISSING_VOLTAGE'
    | 'ORPHAN_RAIL'
    | 'UNCONFIRMED_DIRECTION'
    | 'GROUND_ONLY';
  message: string;
  severity: 'info' | 'warning' | 'error';
  refdes?: string;
  netName?: string;
}

/** 电源树 */
export interface PowerTree {
  designName: string;
  rails: PowerRail[];
  converters: PowerConverter[];
  loads: PowerLoad[];
  /** 根轨 id（电源输入） */
  rootRailId?: string;
  warnings: PowerTreeWarning[];
  meta: {
    generatedAt: string;
    netCount: number;
    partCount: number;
  };
}

/* ============================ 硬件框图模型（二期） ============================ */

/** 框图功能块 */
export interface DiagramBlock {
  id: string;
  label: string;
  kind: 'power' | 'cpu' | 'memory' | 'interface' | 'clock' | 'other';
  childBlockIds: string[];
}

/** 框图连线 */
export interface DiagramEdge {
  from: string;
  to: string;
  nets: string[];
  bus?: string;
}

/** 硬件框图（二期产出） */
export interface HardwareBlockDiagram {
  designName: string;
  blocks: DiagramBlock[];
  edges: DiagramEdge[];
}

/* ============================ 导出 ============================ */

export type SchematicExportFormat = 'svg' | 'png' | 'pdf';

export interface SchematicExportInput {
  tree: PowerTree;
  format: SchematicExportFormat;
}

export interface SchematicExportResult {
  filePath: string;
  format: SchematicExportFormat;
}
