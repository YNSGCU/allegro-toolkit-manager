/**
 * ATM - 配色方案（Color Scheme）类型定义
 *
 * Allegro 配色系统由两部分组成：
 * 1. 调色板（Palette）：24 个颜色索引 + 背景色，每个颜色为 RGB(0-255)
 * 2. 图层分配：每个 class/subclass 图层对应一个颜色索引 + 可见性
 */

/** RGB 颜色，各分量 0-255 */
export interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

/** 调色板中的单个颜色 */
export interface ColorPaletteEntry {
  /** 颜色索引 1-24 */
  index: number;
  /** 颜色名称（可选，.col 文件中的 name 字段） */
  name?: string;
  rgb: ColorRgb;
}

/** 单个图层的颜色分配 */
export interface ColorLayerEntry {
  /** 层类别，例如 ETCH */
  className: string;
  /** 子层名称，例如 TOP / BOTTOM */
  subclassName: string;
  /** 颜色索引 1-24 */
  colorIndex: number;
  /** 是否可见 */
  visible: boolean;
  /** 层叠类型（CONDUCTOR / PLANE / DIELECTRIC 等，由 axlDBGetLayerType 提供） */
  layerType?: string | null;
}

/** 捕获来源元数据 */
export interface ColorSchemeSourceInfo {
  /** 捕获时的 Allegro 版本，例如 17.2 */
  allegroVersion?: string | null;
  /** 当前打开的板子名称（无扩展名） */
  boardName?: string | null;
  /** 顶层导体层名（axlConductorTopLayer） */
  topLayerName?: string | null;
  /** 底层导体层名（axlConductorBottomLayer） */
  bottomLayerName?: string | null;
  /** 捕获时间 */
  capturedAt?: string;
  /** 是否通过 Vibe Bridge 捕获 */
  viaBridge?: boolean;
}

/** 一次捕获得到的完整配色快照（未命名） */
export interface ColorSchemeSnapshot {
  palette: ColorPaletteEntry[];
  background: ColorRgb;
  layers: ColorLayerEntry[];
  source?: ColorSchemeSourceInfo;
}

/** 已保存的命名配色方案 */
export interface ColorScheme extends ColorSchemeSnapshot {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 配色方案存储（JSON 文件） */
export interface ColorSchemeStore {
  version: string;
  activeSchemeId: string | null;
  schemes: ColorScheme[];
  updatedAt: string;
}

/** 应用结果 */
export interface ColorApplyResult {
  success: boolean;
  /** 实际设置成功的图层数 */
  appliedLayerCount: number;
  /** 目标板子中不存在的图层数（自动跳过） */
  skippedLayerCount: number;
  /** 跳过的层名清单（目标板不存在的层） */
  skippedLayers?: string[];
  /** 按角色分配的图层数统计 */
  roleSummary?: {
    top: number;
    bottom: number;
    plane: number;
    inner: number;
  };
  /** 已设置调色板 */
  paletteApplied: boolean;
  /** 已设置背景色 */
  backgroundApplied: boolean;
  /** Bridge 返回的原始输出（调试用） */
  rawOutput?: string;
}

/** Vibe Bridge 可用性检查结果 */
export interface ColorBridgeStatus {
  connected: boolean;
  bridgeWorkspace: string | null;
  allegroVersion?: string | null;
  programName?: string | null;
  message: string;
}

/** 生成唯一方案 ID */
export function generateColorSchemeId(): string {
  return `color_scheme_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 创建空的配色方案存储 */
export function createEmptyColorSchemeStore(): ColorSchemeStore {
  return {
    version: '1.0',
    activeSchemeId: null,
    schemes: [],
    updatedAt: new Date().toISOString(),
  };
}
