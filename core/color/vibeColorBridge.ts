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
import { COLOR_PALETTE_SIZE, createDefaultPalette, normalizeRgb } from './colorPalette';
import { parseSkillLisp, type LispValue } from './parseSkillLisp';

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

/** 向 Allegro 发送 SKILL 代码并等待结果（Vibe Bridge 协议） */
export async function executeSkillViaBridge(
  workspace: string,
  code: string,
  timeoutMs = 10000,
): Promise<ExecuteResult> {
  const inputPath = path.join(workspace, 'vibe_in.il');
  const outputPath = path.join(workspace, 'vibe_out.log');

  try {
    if (!fs.existsSync(workspace)) {
      return { success: false, error: 'Vibe Bridge workspace 不存在' };
    }
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
    fs.writeFileSync(inputPath, code, 'utf-8');

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (fs.existsSync(outputPath)) {
        await sleep(100);
        const raw = fs.readFileSync(outputPath, 'utf-8').trim();
        if (raw.startsWith('SUCCESS')) {
          return { success: true, output: raw.replace(/^SUCCESS\s*/, '').trim() };
        }
        if (raw.startsWith('ERROR')) {
          return { success: false, error: raw.replace(/^ERROR\s*/, '').trim() || 'Allegro 执行出错' };
        }
        // 文件刚创建可能尚未写完，继续轮询
      }
      await sleep(150);
    }
    return { success: false, error: 'Vibe Bridge 超时无响应，请在 Allegro 中加载 vibe_server.il' };
  } catch (err) {
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
    'layerData = cons(list(nth(2 classEntry) subp lp->color lp->visibility car(errset(axlDBGetLayerType(strcat(nth(2 classEntry) "/" subp)) t))) layerData)',
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
  const result = await executeSkillViaBridge(workspace, buildCaptureSkill(), options.timeoutMs ?? 15000);
  if (!result.success) {
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

// ============================================================================
// ??????????????
// ============================================================================

/** ????????????? Bridge ??? */
/** 调色板颜色上限（Allegro 17.4 支持 192 色，留余量取 512） */
const MAX_COLOR_INDEX = 512;

export interface TargetLayerInfo {
  topLayerName: string | null;
  bottomLayerName: string | null;
  /** 调色板颜色数量（axlColorGet('count)） */
  colorCount: number;
  /** ETCH class ??????????? */
  layers: Array<{ name: string; layerType: string | null }>;
}

/** ???????????? */
export interface ColorRoleMapping {
  topColor: number;
  bottomColor: number;
  /** 平面层颜色序列（按源板平面层叠顺序，应用时按序循环） */
  planeColors: number[];
  /** 内部信号层颜色序列 */
  innerColors: number[];
}

/** ????????layerType ????????? */
const PLANE_NAME_PATTERN = /^(gnd|vcc|vss|vdd|power|pwr|plane|agnd|dgnd|avcc|dvdd|vssa|vssd)([0-9]*)$/i;

/** ?????????? layerType??????? */
export function isPlaneLayer(layerType: string | null | undefined, subclassName: string): boolean {
  if (layerType) return layerType.toUpperCase() === 'PLANE';
  return PLANE_NAME_PATTERN.test(subclassName);
}

/** ???????????? SKILL ?? */
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
    throw new Error('??????????????');
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

/** ???????????? */
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

/** ????? */
type TargetRole = 'top' | 'bottom' | 'plane' | 'inner';

/** ???? ETCH ????????????? */
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
 * ??????????????
 *
 * ? ETCH ????/??/?????????????????????
 * ????????????????????? ETCH ???????????
 * ?????????????
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
  const queryResult = await executeSkillViaBridge(workspace, buildTargetLayerQuerySkill(), options.timeoutMs ?? 15000);
  if (!queryResult.success) {
    throw new Error(queryResult.error || '查询目标板层叠失败');
  }
  const target = parseTargetLayersOutput(queryResult.output || '');

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

