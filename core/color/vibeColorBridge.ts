/**
 * ATM - Vibe Bridge 配色读写模块
 *
 * 通过 Vibe Bridge（workspace/vibe_in.il + vibe_out.log）在 Allegro 中
 * 执行 SKILL，实现：
 *   1. 捕获当前板子的调色板（24 色 + 背景）与全图层颜色/可见性
 *   2. 将保存的配色方案应用到当前打开的板子（图层不存在的自动跳过）
 *
 * 写操作（应用）属于修改 Allegro 会话状态的写入，UI 层必须通过
 * Apply Plan 确认后才调用。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  ColorApplyResult,
  ColorBridgeStatus,
  ColorLayerEntry,
  ColorPaletteEntry,
  ColorRgb,
  ColorSchemeSnapshot,
} from '../../src/types/color';
import { COLOR_PALETTE_SIZE, createDefaultPalette, normalizeRgb, rgbToHex } from './colorPalette';
import { parseSkillLisp, type LispValue } from './parseSkillLisp';
import { checkAllegroRunning } from '../environment/fileAccess';

/** 探测候选 Vibe Bridge workspace */
export function candidateBridgeWorkspaces(): string[] {
  const candidates = [
    process.env.ATM_VIBE_WORKSPACE,
    path.join(os.homedir(), '.codex', 'skills', 'allegro-vibe-bridge', 'workspace'),
    path.join(os.homedir(), 'allegro_vibe_bridge', 'workspace'),
  ].filter(Boolean) as string[];
  return [...new Set(candidates.map((item) => path.normalize(item)))];
}

/** 定位可用的 Bridge workspace */
export function findBridgeWorkspace(): string | null {
  return candidateBridgeWorkspaces().find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** 检查 Bridge 可用性（workspace 存在 + 能连通） */
export async function checkColorBridge(
  workspace?: string,
  timeoutMs = 5000,
): Promise<ColorBridgeStatus> {
  const bridgeWorkspace = workspace || findBridgeWorkspace();
  if (!bridgeWorkspace) {
    return {
      connected: false,
      bridgeWorkspace: null,
      message: '未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE',
    };
  }

  const query = "list(axlVersion('fullVersion) axlVersion('programName))";
  try {
    const result = await executeSkillViaBridge(bridgeWorkspace, query, timeoutMs);
    if (!result.success) {
      // 超时/未响应时，进一步区分「Allegro 未启动」和「vibe_server.il 未加载」
      if (result.error?.includes('超时')) {
        const proc = checkAllegroRunning();
        if (!proc.running) {
          return {
            connected: false,
            bridgeWorkspace,
            message: 'Allegro 未运行：请先启动 Allegro（左下角「按此环境启动」或手动打开），再重试。',
          };
        }
        return {
          connected: false,
          bridgeWorkspace,
          message: 'Allegro 已运行，但 Vibe Bridge 未响应：vibe_server.il 可能未加载。请在 Allegro 命令窗执行 skill load，或重启 Allegro 使其自动加载。',
        };
      }
      return {
        connected: false,
        bridgeWorkspace,
        message: result.error || 'Vibe Bridge 未响应，请在 Allegro 中加载 vibe_server.il',
      };
    }
    const parsed = parseSkillLisp(result.output || '');
    const version = Array.isArray(parsed) ? parsed[0] : null;
    const programName = Array.isArray(parsed) ? parsed[1] : null;
    return {
      connected: true,
      bridgeWorkspace,
      allegroVersion: typeof version === 'string' ? version : version === null ? null : String(version),
      programName: typeof programName === 'string' ? programName : null,
      message: `已连接 Allegro${programName ? `（${programName}）` : ''}${version ? `，版本 ${version}` : ''}`,
    };
  } catch (err) {
    return {
      connected: false,
      bridgeWorkspace,
      message: `Vibe Bridge 检查失败: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

interface ExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
}

// ============================================================================
// 串行化（Vibe Bridge 共享 vibe_in.il / vibe_out.log，并发会互相覆盖输入/输出）
// ============================================================================
let bridgeLock: Promise<unknown> = Promise.resolve();

function withBridgeLock<T>(task: () => Promise<T>): Promise<T> {
  const run = bridgeLock.then(task, task);
  bridgeLock = run.then(() => undefined, () => undefined);
  return run;
}

/** 向 Allegro 发送 SKILL 代码并等待结果（Vibe Bridge 协议，串行执行） */
export function executeSkillViaBridge(
  workspace: string,
  code: string,
  timeoutMs = 10000,
): Promise<ExecuteResult> {
  return withBridgeLock(() => executeSkillViaBridgeLocked(workspace, code, timeoutMs));
}

async function executeSkillViaBridgeLocked(
  workspace: string,
  code: string,
  timeoutMs: number,
): Promise<ExecuteResult> {
  const inputPath = path.join(workspace, 'vibe_in.il');
  const outputPath = path.join(workspace, 'vibe_out.log');

  const clearOutput = (): void => {
    try {
      if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
    } catch {
      // 清理失败不阻塞主流程
    }
  };

  try {
    if (!fs.existsSync(workspace)) {
      return { success: false, error: 'Vibe Bridge workspace 不存在' };
    }

    // 先清空旧输出，避免读到上一次请求的残留结果
    clearOutput();
    fs.writeFileSync(inputPath, code, 'utf-8');

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (fs.existsSync(outputPath)) {
        await sleep(100); // 等文件写完，避免读到半截
        const raw = fs.readFileSync(outputPath, 'utf-8').trim();
        if (raw.startsWith('SUCCESS')) {
          clearOutput();
          return { success: true, output: raw.replace(/^SUCCESS\s*/, '').trim() };
        }
        if (raw.startsWith('ERROR')) {
          clearOutput();
          return { success: false, error: raw.replace(/^ERROR\s*/, '').trim() || 'Allegro 执行出错' };
        }
        // 输出内容不完整或格式未知，继续轮询
      }
      await sleep(150);
    }
    clearOutput();
    return { success: false, error: 'Vibe Bridge 处理超时：Allegro 未在限定时间内完成请求（板子可能较大，或 Allegro 仍在初始化/卡顿）。请等待 Allegro 完全加载并空闲后重试。' };
  } catch (err) {
    clearOutput();
    return { success: false, error: `Vibe Bridge 通信失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 生成捕获当前板子配色的 SKILL 代码。
 *
 * 注意：Vibe Bridge 文件模式不支持 `;` 注释，生成代码不带注释。
 */
export function buildCaptureSkill(): string {
  return [
    'let((vis layerData g subs boardName topName bottomName lp)',
    'boardName = car(errset(axlCurrentDesign() t))',
    'topName = car(errset(axlConductorTopLayer() t))',
    'bottomName = car(errset(axlConductorBottomLayer() t))',
    'vis = axlVisibleGet()',
    'layerData = nil',
    'foreach(classEntry vis',
    'g = axlGetParam(strcat("paramLayerGroup:" (nth 2 classEntry)))',
    'when(g',
    'subs = g->groupMembers',
    'when(subs',
    'foreach(subp subs',
    'lp = errset(axlLayerGet(strcat(nth(2 classEntry) "/" subp)) t)',
    'when(lp',
    'lp = car(lp)',
    'when(lp',
    'layerData = cons(list(nth(2 classEntry) subp lp->color lp->visibility nil) layerData)',
    ')',
    ')',
    ')',
    ')',
    ')',
    ')',
    'layerData = reverse(layerData)',
    "list('palette axlColorGet('all) 'background axlColorGet('background) 'layers layerData 'board boardName 'top topName 'bottom bottomName)",
    ')',
  ].join('\n');
}

export function parseCaptureOutput(raw: string): ColorSchemeSnapshot {
  let value: LispValue;
  try {
    value = parseSkillLisp(raw);
  } catch (err) {
    throw new Error(`配色捕获结果解析失败: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    throw new Error('配色捕获结果格式不正确');
  }

  const paletteRaw = Array.isArray(value[1]) ? value[1] : [];
  const backgroundRaw = Array.isArray(value[3]) ? value[3] : [];
  const layersRaw = Array.isArray(value[5]) ? value[5] : [];
  const boardName = Array.isArray(value) && typeof value[7] === 'string' ? value[7] : undefined;
  const topLayerName = Array.isArray(value) && typeof value[9] === 'string' ? value[9] : undefined;
  const bottomLayerName = Array.isArray(value) && typeof value[11] === 'string' ? value[11] : undefined;

  const palette: ColorPaletteEntry[] = paletteRaw
    .map((entry, index) => {
      if (!Array.isArray(entry)) return null;
      const rgb = normalizeRgb({
        r: toNumber(entry[0]),
        g: toNumber(entry[1]),
        b: toNumber(entry[2]),
      });
      return { index: index + 1, rgb };
    })
    .filter((entry): entry is ColorPaletteEntry => entry !== null);

  const background: ColorRgb = normalizeRgb({
    r: toNumber(backgroundRaw[0]),
    g: toNumber(backgroundRaw[1]),
    b: toNumber(backgroundRaw[2]),
  });

  const layers: ColorLayerEntry[] = layersRaw
    .map((entry): ColorLayerEntry | null => {
      if (!Array.isArray(entry) || entry.length < 4) return null;
      const className = String(entry[0] ?? '');
      const subclassName = String(entry[1] ?? '');
      if (className === '' || subclassName === '') return null;
      const layerType = entry.length > 4 ? (entry[4] === null ? null : String(entry[4])) : undefined;
      return {
        className,
        subclassName,
        colorIndex: clampColorIndex(toNumber(entry[2])),
        visible: entry[3] !== null,
        layerType,
      };
    })
    .filter((entry): entry is ColorLayerEntry => entry !== null);

  if (palette.length === 0) {
    throw new Error('捕获结果中未找到调色板数据');
  }

  return {
    palette,
    background,
    layers,
    source: {
      capturedAt: new Date().toISOString(),
      viaBridge: true,
      boardName,
      topLayerName,
      bottomLayerName,
    },
  };
}

function toNumber(value: LispValue | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clampColorIndex(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(MAX_COLOR_INDEX, Math.round(value)));
}

/** SKILL 字符串字面量转义 */
function escapeSkillString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** 生成应用方案的 SKILL 代码（返回已应用/跳过的图层数） */
export function buildApplySkill(snapshot: ColorSchemeSnapshot, colorCount?: number): string {
  const palette = normalizePalette(snapshot.palette, colorCount);
  const background = normalizeRgb(snapshot.background);

  const paletteLiteral = palette
    .map((entry) => `(${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b})`)
    .join(' ');

  const layerLines = snapshot.layers.map((layer) => {
    const className = escapeSkillString(layer.className);
    const subclassName = escapeSkillString(layer.subclassName);
    const colorIndex = clampColorIndex(layer.colorIndex);
    const visibility = layer.visible ? 't' : 'nil';
    return `("${className}" "${subclassName}" ${colorIndex} ${visibility})`;
  });

  return [
    'let((layers applied skipped l)',
    `axlColorSet('all '(${paletteLiteral}))`,
    `axlColorSet('background '(${background.r} ${background.g} ${background.b}))`,
    `layers = '(${layerLines.join(' ')})`,
    'applied = 0',
    'skipped = 0',
    'foreach(entry layers',
    'l = axlLayerGet(strcat(car(entry) "/" cadr(entry)))',
    'when(l',
    'l->color = caddr(entry)',
    'l->visibility = cadddr(entry)',
    'axlLayerSet(l)',
    'applied = applied + 1',
    ')',
    'when(!l',
    'skipped = skipped + 1',
    ')',
    ')',
    'axlVisibleUpdate(t)',
    'list(applied skipped)',
    ')',
  ].join('\n');
}

/** 按索引 1-24 规范化调色板（缺失项用默认色板补齐，避免 axlColorSet 错位） */
export function normalizePalette(
  palette: ColorPaletteEntry[],
  colorCount: number = COLOR_PALETTE_SIZE,
): ColorPaletteEntry[] {
  const defaults = createDefaultPalette();
  const byIndex = new Map(palette.map((entry) => [entry.index, entry]));
  const result: ColorPaletteEntry[] = [];
  const count = Math.max(1, Math.min(MAX_COLOR_INDEX, Math.round(colorCount) || COLOR_PALETTE_SIZE));
  for (let i = 1; i <= count; i++) {
    const entry = byIndex.get(i);
    if (entry) {
      result.push({ index: i, name: entry.name, rgb: normalizeRgb(entry.rgb) });
    } else {
      const fallback = i <= defaults.length ? defaults[i - 1].rgb : { r: 128, g: 128, b: 128 };
      result.push({ index: i, name: defaults[i - 1]?.name ?? `Color ${i}`, rgb: normalizeRgb(fallback) });
    }
  }
  return result;
}

/** 解析应用结果输出（(applied skipped)） */
export function parseApplyOutput(raw: string): Pick<
  ColorApplyResult,
  'appliedLayerCount' | 'skippedLayerCount' | 'skippedLayers'
> {
  try {
    const value = parseSkillLisp(raw);
    if (Array.isArray(value)) {
      const skippedLayers = Array.isArray(value[2])
        ? value[2].filter((item): item is string => typeof item === 'string')
        : undefined;
      return {
        appliedLayerCount: toNumber(value[0]),
        skippedLayerCount: toNumber(value[1]),
        skippedLayers: skippedLayers && skippedLayers.length > 0 ? skippedLayers : undefined,
      };
    }
  } catch {
    // 解析失败按空统计返回
  }
  return { appliedLayerCount: 0, skippedLayerCount: 0 };
}

/** 从当前打开的 Allegro 板子捕获配色 */
export async function captureColorScheme(
  options: { workspace?: string; timeoutMs?: number },
): Promise<ColorSchemeSnapshot> {
  const workspace = options.workspace || findBridgeWorkspace();
  if (!workspace) {
    throw new Error('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE');
  }
  const result = await executeSkillViaBridge(workspace, buildCaptureSkill(), options.timeoutMs ?? 30000);
  if (!result.success) {
    if (result.error?.includes('超时')) {
      throw new Error('捕获配色超时：Allegro 已连接，但读取板子配色耗时过长。请确认板子已完全加载、Allegro 已空闲后重试；若仍超时，可关闭并重新打开 Allegro。');
    }
    throw new Error(result.error || '捕获配色失败');
  }
  return parseCaptureOutput(result.output || '');
}

/** 将配色方案应用到当前打开的板子 */
export async function applyColorScheme(
  snapshot: ColorSchemeSnapshot,
  options: { workspace?: string; timeoutMs?: number },
): Promise<ColorApplyResult> {
  const workspace = options.workspace || findBridgeWorkspace();
  if (!workspace) {
    throw new Error('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE');
  }
  const result = await executeSkillViaBridge(workspace, buildApplySkill(snapshot), options.timeoutMs ?? 20000);
  if (!result.success) {
    throw new Error(result.error || '应用配色失败');
  }
  const counts = parseApplyOutput(result.output || '');
  return {
    success: true,
    paletteApplied: true,
    backgroundApplied: true,
    ...counts,
    rawOutput: result.output,
  };
}

/**
 * 生成「实时预览」的 SKILL 代码：仅设置调色板与背景色，
 * 不修改任何图层的颜色索引/可见性，用于编辑配色时即时查看效果。
 */
export function buildLivePaletteSkill(
  palette: ColorPaletteEntry[],
  colorCount?: number,
  background?: ColorRgb,
): string {
  const normalized = normalizePalette(palette, colorCount);
  const paletteLiteral = normalized
    .map((entry) => `(${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b})`)
    .join(' ');
  const lines = [
    'let((applied)',
    `applied = axlColorSet('all '(${paletteLiteral}))`,
  ];
  if (background) {
    const bg = normalizeRgb(background);
    lines.push(`axlColorSet('background '(${bg.r} ${bg.g} ${bg.b}))`);
  }
  lines.push('axlVisibleUpdate(t)', 'applied', ')');
  return lines.join('\n');
}

/**
 * 实时预览：仅将调色板与背景色推送到当前打开的板子（不修改图层分配）。
 */
export async function applyLivePalette(
  palette: ColorPaletteEntry[],
  options: { workspace?: string; timeoutMs?: number; colorCount?: number; background?: ColorRgb } = {},
): Promise<{ paletteApplied: boolean; backgroundApplied: boolean }> {
  const workspace = options.workspace || findBridgeWorkspace();
  if (!workspace) {
    throw new Error('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE');
  }
  const result = await executeSkillViaBridge(
    workspace,
    buildLivePaletteSkill(palette, options.colorCount, options.background),
    options.timeoutMs ?? 10000,
  );
  if (!result.success) {
    throw new Error(result.error || '实时预览配色失败');
  }
  return {
    paletteApplied: true,
    backgroundApplied: options.background != null,
  };
}

// ============================================================================
// 目标板叠层查询与按角色智能配色
// ============================================================================

/** 目标板层叠信息（通过 Vibe Bridge 查询） */
/** 调色板颜色上限（Allegro 17.4 支持 192 色，留余量取 512） */
const MAX_COLOR_INDEX = 512;

export interface TargetLayerInfo {
  topLayerName: string | null;
  bottomLayerName: string | null;
  /** 调色板颜色数量（axlColorGet('count)） */
  colorCount: number;
  /** ETCH class 的叠层清单（按叠层顺序） */
  layers: Array<{ name: string; layerType: string | null }>;
}

/** 颜色角色映射结果 */
export interface ColorRoleMapping {
  topColor: number;
  bottomColor: number;
  /** 平面层颜色序列（按源板平面层叠顺序，应用时按序循环） */
  planeColors: number[];
  /** 内部信号层颜色序列 */
  innerColors: number[];
}

/** 平面层名称兜底模式（layerType 缺失时使用） */
const PLANE_NAME_PATTERN = /^(gnd|vcc|vss|vdd|power|pwr|plane|agnd|dgnd|avcc|dvdd|vssa|vssd)([0-9]*)$/i;

/** 判断是否为平面层：优先 layerType，缺失时按名称兜底 */
export function isPlaneLayer(layerType: string | null | undefined, subclassName: string): boolean {
  if (layerType) return layerType.toUpperCase() === 'PLANE';
  return PLANE_NAME_PATTERN.test(subclassName);
}

/** 查询目标板层叠结构的 SKILL 代码 */
export function buildTargetLayerQuerySkill(): string {
  return [
    'let((topName bottomName layers g colorCount lt)',
    'topName = car(errset(axlConductorTopLayer() t))',
    'bottomName = car(errset(axlConductorBottomLayer() t))',
    "colorCount = axlColorGet('count)",
    'layers = nil',
    'g = axlGetParam("paramLayerGroup:ETCH")',
    'when(g',
    'foreach(subp g->groupMembers',
    'lt = car(errset(axlDBGetLayerType(strcat("ETCH/" subp)) t))',
    'layers = cons(list(subp lt) layers)',
    ')',
    ')',
    'layers = reverse(layers)',
    'list(topName bottomName layers colorCount)',
    ')',
  ].join('\n');
}

export function parseTargetLayersOutput(raw: string): TargetLayerInfo {
  const value = parseSkillLisp(raw);
  if (!Array.isArray(value)) {
    throw new Error('目标板层叠查询结果格式不正确');
  }
  const topLayerName = value[0] === null ? null : String(value[0]);
  const bottomLayerName = value[1] === null ? null : String(value[1]);
  const layersRaw = Array.isArray(value[2]) ? value[2] : [];
  const colorCountRaw = typeof value[3] === 'number' ? value[3] : null;
  const layers = layersRaw
    .map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const name = String(entry[0] ?? '');
      if (name === '') return null;
      const layerType = entry[1] === null ? null : String(entry[1]);
      return { name, layerType };
    })
    .filter((entry): entry is TargetLayerInfo['layers'][number] => entry !== null);
  return {
    topLayerName,
    bottomLayerName,
    layers,
    colorCount: colorCountRaw !== null && colorCountRaw > 0 ? colorCountRaw : COLOR_PALETTE_SIZE,
  };
}

/** 提取源板按角色区分的颜色序列 */
export function computeColorRoleMapping(snapshot: ColorSchemeSnapshot): ColorRoleMapping {
  const etchLayers = snapshot.layers.filter((layer) => layer.className === 'ETCH');
  const topName = snapshot.source?.topLayerName || 'TOP';
  const bottomName = snapshot.source?.bottomLayerName || 'BOTTOM';

  const topEntry = etchLayers.find((layer) => layer.subclassName === topName)
    ?? etchLayers.find((layer) => layer.subclassName === 'TOP');
  const bottomEntry = etchLayers.find((layer) => layer.subclassName === bottomName)
    ?? etchLayers.find((layer) => layer.subclassName === 'BOTTOM');

  // 所有平面层（按叠顺序）：颜色序列保持源板顺序
  const planeEntries = etchLayers.filter(
    (layer) => isPlaneLayer(layer.layerType, layer.subclassName),
  );
  const planeColors = planeEntries.map((layer) => layer.colorIndex);

  // 内部信号层 = 排除 TOP/BOTTOM 与全部平面层
  const innerEntries = etchLayers.filter((layer) => {
    if (layer === topEntry || layer === bottomEntry) return false;
    if (isPlaneLayer(layer.layerType, layer.subclassName)) return false;
    return true;
  });

  const innerColors = innerEntries.length > 0
    ? innerEntries.map((layer) => layer.colorIndex)
    : etchLayers.filter((layer) => layer !== topEntry && layer !== bottomEntry)
        .map((layer) => layer.colorIndex);

  return {
    topColor: topEntry?.colorIndex ?? (innerColors[0] ?? 1),
    bottomColor: bottomEntry?.colorIndex ?? (innerColors[0] ?? 2),
    planeColors,
    innerColors,
  };
}

/** 目标层角色 */
type TargetRole = 'top' | 'bottom' | 'plane' | 'inner';

/** 将目标板 ETCH 叠层按角色分类 */
export function classifyTargetLayers(target: TargetLayerInfo): Array<{ name: string; role: TargetRole }> {
  const topName = target.topLayerName || 'TOP';
  const bottomName = target.bottomLayerName || 'BOTTOM';
  const classified: Array<{ name: string; role: TargetRole }> = [];
  for (const layer of target.layers) {
    if (layer.name === topName) {
      classified.push({ name: layer.name, role: 'top' });
    } else if (layer.name === bottomName) {
      classified.push({ name: layer.name, role: 'bottom' });
    } else if (isPlaneLayer(layer.layerType, layer.name)) {
      classified.push({ name: layer.name, role: 'plane' });
    } else {
      classified.push({ name: layer.name, role: 'inner' });
    }
  }
  return classified;
}

/**
 * 生成按角色智能应用配色的 SKILL 代码
 *
 * 将 ETCH 层分为顶层/底层/平面层/内部信号层，分别取色：
 * 顶层、底层使用各自颜色；平面层按源板平面序列循环；
 * 内部信号层按叠层顺序依次取色（超出循环）。
 */
export function buildSmartApplySkill(
  snapshot: ColorSchemeSnapshot,
  target: TargetLayerInfo,
  options: { applyVisibility?: boolean } = {},
): string {
  const applyVisibility = options.applyVisibility ?? true;
  const mapping = computeColorRoleMapping(snapshot);
  const classified = classifyTargetLayers(target);

  const entries: string[] = [];
  const roleCount = { top: 0, bottom: 0, plane: 0, inner: 0 };
  let innerIndex = 0;
  let planeIndex = 0;

  for (const item of classified) {
    let colorIndex: number;
    switch (item.role) {
      case 'top':
        colorIndex = mapping.topColor;
        roleCount.top += 1;
        break;
      case 'bottom':
        colorIndex = mapping.bottomColor;
        roleCount.bottom += 1;
        break;
      case 'plane':
        // 平面层按源板平面层序列循环取色；源板无平面层时回退到信号层序列
        colorIndex = mapping.planeColors.length > 0
          ? mapping.planeColors[planeIndex % mapping.planeColors.length]
          : mapping.innerColors[innerIndex % mapping.innerColors.length];
        roleCount.plane += 1;
        planeIndex += 1;
        if (mapping.planeColors.length === 0) innerIndex += 1;
        break;
      default:
        colorIndex = mapping.innerColors[innerIndex % mapping.innerColors.length];
        roleCount.inner += 1;
        innerIndex += 1;
        break;
    }
    const sourceEntry = snapshot.layers.find(
      (layer) => layer.className === 'ETCH' && layer.subclassName === item.name,
    );
    const visibility = sourceEntry ? sourceEntry.visible : true;
    entries.push(`("ETCH/${escapeSkillString(item.name)}" ${clampColorIndex(colorIndex)} ${visibility ? 't' : 'nil'})`);
  }

  // 非 ETCH 层：按层名精确匹配，不存在的自动跳过
  const otherEntries = snapshot.layers
    .filter((layer) => layer.className !== 'ETCH')
    .map((layer) => {
      const layerName = `${escapeSkillString(layer.className)}/${escapeSkillString(layer.subclassName)}`;
      return `("${layerName}" ${clampColorIndex(layer.colorIndex)} ${layer.visible ? 't' : 'nil'})`;
    });

  const allEntries = [...entries, ...otherEntries];
  const palette = normalizePalette(snapshot.palette, target.colorCount);
  const background = normalizeRgb(snapshot.background);
  const paletteLiteral = palette
    .map((entry) => `(${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b})`)
    .join(' ');

  return [
    `let((layers applied skipped l doVis skippedNames)`,
    `doVis = ${applyVisibility ? 't' : 'nil'}`,
    `axlColorSet('all '(${paletteLiteral}))`,
    `axlColorSet('background '(${background.r} ${background.g} ${background.b}))`,
    `layers = '(${allEntries.join(' ')})`,
    'applied = 0',
    'skipped = 0',
    'skippedNames = nil',
    'foreach(entry layers',
    'l = axlLayerGet(car(entry))',
    'when(l',
    'l->color = cadr(entry)',
    'when(doVis',
    'l->visibility = caddr(entry)',
    ')',
    'axlLayerSet(l)',
    'applied = applied + 1',
    ')',
    'when(!l',
    'skipped = skipped + 1',
    'skippedNames = cons(car(entry) skippedNames)',
    ')',
    ')',
    'axlVisibleUpdate(t)',
    'list(applied skipped reverse(skippedNames))',
    ')',
  ].join('\n');
}


export async function applyColorSchemeSmart(
  snapshot: ColorSchemeSnapshot,
  options: { workspace?: string; timeoutMs?: number; applyVisibility?: boolean } = {},
): Promise<ColorApplyResult> {
  const workspace = options.workspace || findBridgeWorkspace();
  if (!workspace) {
    throw new Error('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE');
  }

  // 第一步：查询目标板层叠结构
  const target = await queryTargetLayerInfo({ workspace, timeoutMs: options.timeoutMs });

  // 第二步：按角色映射生成应用脚本并执行
  const skill = buildSmartApplySkill(snapshot, target, {
    applyVisibility: options.applyVisibility ?? false,
  });
  const applyResult = await executeSkillViaBridge(workspace, skill, options.timeoutMs ?? 20000);
  if (!applyResult.success) {
    throw new Error(applyResult.error || '应用配色失败');
  }
  const counts = parseApplyOutput(applyResult.output || '');

  // 角色分配统计（用于 UI 提示）
  const roleSummary = { top: 0, bottom: 0, plane: 0, inner: 0 };
  for (const item of classifyTargetLayers(target)) {
    roleSummary[item.role] += 1;
  }

  return {
    success: true,
    paletteApplied: true,
    backgroundApplied: true,
    ...counts,
    roleSummary,
    rawOutput: applyResult.output,
  };
}

/**
 * 查询当前打开板子的叠层结构（独立于应用，供预览使用）。
 */
export async function queryTargetLayerInfo(
  options: { workspace?: string; timeoutMs?: number } = {},
): Promise<TargetLayerInfo> {
  const workspace = options.workspace || findBridgeWorkspace();
  if (!workspace) {
    throw new Error('未找到 Vibe Bridge workspace，请先安装并配置 ATM_VIBE_WORKSPACE');
  }
  const queryResult = await executeSkillViaBridge(
    workspace,
    buildTargetLayerQuerySkill(),
    options.timeoutMs ?? 15000,
  );
  if (!queryResult.success) {
    throw new Error(queryResult.error || '查询目标板层叠失败');
  }
  return parseTargetLayersOutput(queryResult.output || '');
}

/** 预览中的单个 ETCH 叠层条目 */
export interface ColorApplyPreviewLayer {
  name: string;
  role: 'top' | 'bottom' | 'plane' | 'inner';
  colorIndex: number;
  colorName: string | null;
  hex: string | null;
  /** 是否复制源方案中该层的可见性 */
  visible: boolean;
}

/** 预览中的非 ETCH 层（按层名精确匹配） */
export interface ColorApplyPreviewOtherLayer {
  name: string;
  colorIndex: number;
  colorName: string | null;
  hex: string | null;
  visible: boolean;
}

/** 配色应用预览结果 */
export interface ColorApplyPreview {
  targetTop: string | null;
  targetBottom: string | null;
  colorCount: number;
  applyVisibility: boolean;
  /** 目标板 ETCH 叠层最终颜色映射（按叠层顺序） */
  etchLayers: ColorApplyPreviewLayer[];
  /** 非 ETCH 层按名称匹配列表 */
  otherLayers: ColorApplyPreviewOtherLayer[];
  /** 将写入目标板的调色板（规范化后 1..colorCount） */
  paletteChanges: Array<{ index: number; name: string; hex: string }>;
  /** 角色统计 */
  roleSummary: { top: number; bottom: number; plane: number; inner: number };
}

/**
 * 生成配色应用预览（纯函数，可测试）。
 *
 * 与 buildSmartApplySkill 使用相同的角色映射规则，保证预览与实际应用一致：
 * 顶层/底层用各自颜色；平面层按源板平面序列循环；内部信号层按叠层顺序取色。
 */
export function buildColorApplyPreview(
  snapshot: ColorSchemeSnapshot,
  target: TargetLayerInfo,
  options: { applyVisibility?: boolean } = {},
): ColorApplyPreview {
  const applyVisibility = options.applyVisibility ?? false;
  const mapping = computeColorRoleMapping(snapshot);
  const classified = classifyTargetLayers(target);
  const palette = normalizePalette(snapshot.palette, target.colorCount);
  const paletteByIndex = new Map(palette.map((entry) => [entry.index, entry]));

  const roleSummary = { top: 0, bottom: 0, plane: 0, inner: 0 };
  let innerIndex = 0;
  let planeIndex = 0;

  const etchLayers: ColorApplyPreviewLayer[] = classified.map((item) => {
    let colorIndex: number;
    switch (item.role) {
      case 'top':
        colorIndex = mapping.topColor;
        break;
      case 'bottom':
        colorIndex = mapping.bottomColor;
        break;
      case 'plane':
        colorIndex = mapping.planeColors.length > 0
          ? mapping.planeColors[planeIndex % mapping.planeColors.length]
          : mapping.innerColors[innerIndex % mapping.innerColors.length];
        planeIndex += 1;
        if (mapping.planeColors.length === 0) innerIndex += 1;
        break;
      default:
        colorIndex = mapping.innerColors[innerIndex % mapping.innerColors.length];
        innerIndex += 1;
        break;
    }
    roleSummary[item.role] += 1;

    const sourceEntry = snapshot.layers.find(
      (layer) => layer.className === 'ETCH' && layer.subclassName === item.name,
    );
    const entry = paletteByIndex.get(colorIndex);
    return {
      name: item.name,
      role: item.role,
      colorIndex,
      colorName: entry?.name ?? null,
      hex: entry ? rgbToHex(entry.rgb) : null,
      visible: applyVisibility ? (sourceEntry?.visible ?? true) : false,
    };
  });

  const otherLayers: ColorApplyPreviewOtherLayer[] = snapshot.layers
    .filter((layer) => layer.className !== 'ETCH')
    .map((layer) => {
      const entry = paletteByIndex.get(layer.colorIndex);
      return {
        name: `${layer.className}/${layer.subclassName}`,
        colorIndex: layer.colorIndex,
        colorName: entry?.name ?? null,
        hex: entry ? rgbToHex(entry.rgb) : null,
        visible: applyVisibility ? layer.visible : false,
      };
    });

  return {
    targetTop: target.topLayerName,
    targetBottom: target.bottomLayerName,
    colorCount: target.colorCount,
    applyVisibility,
    etchLayers,
    otherLayers,
    paletteChanges: palette.map((entry) => ({
      index: entry.index,
      name: entry.name ?? '',
      hex: rgbToHex(entry.rgb),
    })),
    roleSummary,
  };
}
