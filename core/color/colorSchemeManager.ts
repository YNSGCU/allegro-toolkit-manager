/**
 * ATM - 配色方案（Color Scheme）持久化管理
 *
 * 配色方案是跨板子的全局资源（从板子 A 捕获、在板子 B 应用），
 * 因此存储于应用配置目录 %APPDATA%/AllegroToolkitManager/color_schemes.json，
 * 而不是某个 pcbenv 的 atm_generated 目录下。
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  ColorLayerEntry,
  ColorPaletteEntry,
  ColorScheme,
  ColorSchemeSnapshot,
  ColorSchemeStore,
} from '../../src/types/color';
import { createEmptyColorSchemeStore, generateColorSchemeId } from '../../src/types/color';

const SCHEMES_FILE = 'color_schemes.json';

/** 应用配置根目录（与 environmentRegistry 保持一致） */
export function configRoot(): string {
  const override = process.env.ATM_CONFIG_HOME;
  if (override) return path.normalize(override);
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'AllegroToolkitManager');
}

/** 方案存储文件路径 */
export function getColorSchemeStorePath(): string {
  return path.join(configRoot(), SCHEMES_FILE);
}

/** 加载方案存储（不存在或损坏时返回空存储） */
export function loadColorSchemeStore(): ColorSchemeStore {
  try {
    const storePath = getColorSchemeStorePath();
    if (!fs.existsSync(storePath)) {
      return createEmptyColorSchemeStore();
    }
    const raw = fs.readFileSync(storePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.schemes)) {
      return {
        version: parsed.version ?? '1.0',
        activeSchemeId: parsed.activeSchemeId ?? null,
        schemes: parsed.schemes,
        updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      };
    }
  } catch {
    // 首次运行或文件损坏时回退到空存储
  }
  return createEmptyColorSchemeStore();
}

/** 保存方案存储 */
export function saveColorSchemeStore(store: ColorSchemeStore): boolean {
  try {
    const storePath = getColorSchemeStorePath();
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    store.updatedAt = new Date().toISOString();
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

/** 列出所有方案（按创建时间排序） */
export function listColorSchemes(): ColorScheme[] {
  const store = loadColorSchemeStore();
  return [...store.schemes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 获取当前激活方案 */
export function getActiveColorScheme(): ColorScheme | null {
  const store = loadColorSchemeStore();
  if (store.activeSchemeId) {
    const active = store.schemes.find((scheme) => scheme.id === store.activeSchemeId);
    if (active) return active;
  }
  return store.schemes[0] ?? null;
}

/** 将捕获快照保存为命名方案 */
export function createColorScheme(
  snapshot: ColorSchemeSnapshot,
  name: string,
  description?: string,
): ColorScheme {
  const now = new Date().toISOString();
  const scheme: ColorScheme = {
    id: generateColorSchemeId(),
    name: name.trim() || '未命名配色方案',
    description: description?.trim() || undefined,
    palette: snapshot.palette,
    background: snapshot.background,
    layers: snapshot.layers,
    source: snapshot.source,
    createdAt: now,
    updatedAt: now,
  };

  const store = loadColorSchemeStore();
  store.schemes.push(scheme);
  if (!store.activeSchemeId) {
    store.activeSchemeId = scheme.id;
  }
  saveColorSchemeStore(store);
  return scheme;
}

/** 复制方案 */
export function copyColorScheme(schemeId: string, newName?: string): ColorScheme | null {
  const store = loadColorSchemeStore();
  const source = store.schemes.find((scheme) => scheme.id === schemeId);
  if (!source) return null;

  const now = new Date().toISOString();
  const copy: ColorScheme = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateColorSchemeId(),
    name: newName?.trim() || `${source.name}（副本）`,
    createdAt: now,
    updatedAt: now,
  };
  store.schemes.push(copy);
  saveColorSchemeStore(store);
  return copy;
}

/** 重命名方案 */
export function renameColorScheme(schemeId: string, newName: string): ColorScheme | null {
  const store = loadColorSchemeStore();
  const scheme = store.schemes.find((item) => item.id === schemeId);
  if (!scheme || newName.trim() === '') return null;
  scheme.name = newName.trim();
  scheme.updatedAt = new Date().toISOString();
  saveColorSchemeStore(store);
  return scheme;
}

/** 删除方案：允许删除激活方案和最后一个方案，删光后回到空状态 */
export function deleteColorScheme(schemeId: string): { success: boolean; error?: string } {
  const store = loadColorSchemeStore();
  const target = store.schemes.find((scheme) => scheme.id === schemeId);
  if (!target) {
    return { success: false, error: '配色方案不存在' };
  }
  store.schemes = store.schemes.filter((scheme) => scheme.id !== schemeId);
  // 删除的是激活方案时，自动激活剩余的第一个方案；删光后回到空状态
  if (store.activeSchemeId === schemeId) {
    store.activeSchemeId = store.schemes[0]?.id ?? null;
  }
  saveColorSchemeStore(store);
  return { success: true };
}

/** 设置激活方案 */
export function setActiveColorScheme(schemeId: string): ColorScheme | null {
  const store = loadColorSchemeStore();
  const target = store.schemes.find((scheme) => scheme.id === schemeId);
  if (!target) return null;
  store.activeSchemeId = schemeId;
  saveColorSchemeStore(store);
  return target;
}

/** 从存储中按 ID 获取方案 */
export function getColorScheme(schemeId: string): ColorScheme | null {
  const store = loadColorSchemeStore();
  return store.schemes.find((scheme) => scheme.id === schemeId) ?? null;
}

/** 从 .col 导入创建方案（仅调色板，无图层分配） */
export function createColorSchemeFromCol(
  name: string,
  palette: ColorSchemeSnapshot['palette'],
  background: ColorSchemeSnapshot['background'],
  description?: string,
): ColorScheme {
  return createColorScheme(
    { palette, background, layers: [], source: { capturedAt: new Date().toISOString() } },
    name,
    description,
  );
}

/**
 * 更新方案的调色板与图层数据
 *
 * - palette: 按 index 合并（传入的覆盖同 index 条目，新 index 追加）
 * - layers: 按 class/subclass 合并（传入的覆盖同名字图层）
 */
export function updateColorScheme(
  schemeId: string,
  updates: {
    palette?: ColorPaletteEntry[];
    layers?: ColorLayerEntry[];
  },
): ColorScheme | null {
  const store = loadColorSchemeStore();
  const scheme = store.schemes.find((item) => item.id === schemeId);
  if (!scheme) return null;

  if (updates.palette && updates.palette.length > 0) {
    const byIndex = new Map(updates.palette.map((entry) => [entry.index, entry]));
    scheme.palette = scheme.palette.map((entry) => {
      const patch = byIndex.get(entry.index);
      return patch ? { ...entry, ...patch, index: entry.index } : entry;
    });
    for (const entry of updates.palette) {
      if (!scheme.palette.some((item) => item.index === entry.index)) {
        scheme.palette.push(entry);
      }
    }
    scheme.palette.sort((a, b) => a.index - b.index);
  }

  if (updates.layers && updates.layers.length > 0) {
    const key = (layer: ColorLayerEntry) => `${layer.className}/${layer.subclassName}`;
    const byKey = new Map(updates.layers.map((layer) => [key(layer), layer]));
    scheme.layers = scheme.layers.map((layer) => {
      const patch = byKey.get(key(layer));
      return patch
        ? {
            ...layer,
            ...patch,
            className: layer.className,
            subclassName: layer.subclassName,
          }
        : layer;
    });
    // 新图层追加（与 palette 合并逻辑一致）
    for (const layer of updates.layers) {
      if (!scheme.layers.some((item) => key(item) === key(layer))) {
        scheme.layers.push(layer);
      }
    }
  }

  scheme.updatedAt = new Date().toISOString();
  saveColorSchemeStore(store);
  return scheme;
}

