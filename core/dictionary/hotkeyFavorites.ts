/**
 * ATM - 快捷键收藏管理模块
 *
 * 管理用户收藏的快捷键绑定，存储位置：
 * {pcbenvPath}/atm_generated/settings/user_hotkey_favorites.json
 */
import path from 'path';
import fs from 'fs';
import type { HotkeyBinding } from '../../src/types/hotkey';

const FAVORITES_DIR = 'atm_generated/settings';
const FAVORITES_FILE = 'user_hotkey_favorites.json';

export interface HotkeyFavorites {
  version: number;
  favoriteBindingIds: string[];
  updatedAt: string;
}

/**
 * 获取收藏文件路径
 */
export function getFavoritesPath(pcbenvPath: string): string {
  return path.join(pcbenvPath, FAVORITES_DIR, FAVORITES_FILE);
}

/**
 * 获取收藏目录路径
 */
function getFavoritesDir(pcbenvPath: string): string {
  return path.join(pcbenvPath, FAVORITES_DIR);
}

/**
 * 确保收藏目录存在
 */
function ensureFavoritesDir(pcbenvPath: string): void {
  const dir = getFavoritesDir(pcbenvPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取默认收藏数据
 */
function getDefaultFavorites(): HotkeyFavorites {
  return {
    version: 1,
    favoriteBindingIds: [],
    updatedAt: '',
  };
}

/**
 * 加载收藏列表
 * @param pcbenvPath pcbenv 目录路径
 * @returns HotkeyFavorites（文件不存在时返回默认值）
 */
export function loadFavorites(pcbenvPath: string): HotkeyFavorites {
  try {
    const filePath = getFavoritesPath(pcbenvPath);
    if (!fs.existsSync(filePath)) {
      return getDefaultFavorites();
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? 1,
      favoriteBindingIds: Array.isArray(parsed.favoriteBindingIds) ? parsed.favoriteBindingIds : [],
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch {
    return getDefaultFavorites();
  }
}

/**
 * 保存收藏列表（原子写入）
 * @param pcbenvPath pcbenv 目录路径
 * @param favorites 要保存的收藏数据
 */
export function saveFavorites(pcbenvPath: string, favorites: HotkeyFavorites): void {
  ensureFavoritesDir(pcbenvPath);
  const filePath = getFavoritesPath(pcbenvPath);

  const data: HotkeyFavorites = {
    version: favorites.version ?? 1,
    favoriteBindingIds: favorites.favoriteBindingIds ?? [],
    updatedAt: new Date().toISOString(),
  };

  // 原子写入：先写 .tmp，再 rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * 检查某个 binding 是否在收藏列表中
 * @param favorites 收藏数据
 * @param bindingId 绑定 ID
 * @returns 是否已收藏
 */
export function isFavorite(favorites: HotkeyFavorites, bindingId: string): boolean {
  return favorites.favoriteBindingIds.includes(bindingId);
}

/**
 * 切换收藏状态
 * @param pcbenvPath pcbenv 目录路径
 * @param bindingId 绑定 ID
 * @returns 切换后的状态和收藏数据
 */
export function toggleFavorite(
  pcbenvPath: string,
  bindingId: string,
): { isFavorite: boolean; favorites: HotkeyFavorites } {
  const favorites = loadFavorites(pcbenvPath);
  const exists = favorites.favoriteBindingIds.indexOf(bindingId);

  if (exists >= 0) {
    favorites.favoriteBindingIds.splice(exists, 1);
  } else {
    favorites.favoriteBindingIds.push(bindingId);
  }

  saveFavorites(pcbenvPath, favorites);

  return {
    isFavorite: exists < 0,
    favorites,
  };
}

/**
 * 添加收藏
 * @param pcbenvPath pcbenv 目录路径
 * @param bindingId 绑定 ID
 * @returns 更新后的收藏数据
 */
export function addFavorite(pcbenvPath: string, bindingId: string): HotkeyFavorites {
  const favorites = loadFavorites(pcbenvPath);
  if (!favorites.favoriteBindingIds.includes(bindingId)) {
    favorites.favoriteBindingIds.push(bindingId);
  }
  saveFavorites(pcbenvPath, favorites);
  return favorites;
}

/**
 * 移除收藏
 * @param pcbenvPath pcbenv 目录路径
 * @param bindingId 绑定 ID
 * @returns 更新后的收藏数据
 */
export function removeFavorite(pcbenvPath: string, bindingId: string): HotkeyFavorites {
  const favorites = loadFavorites(pcbenvPath);
  const idx = favorites.favoriteBindingIds.indexOf(bindingId);
  if (idx >= 0) {
    favorites.favoriteBindingIds.splice(idx, 1);
  }
  saveFavorites(pcbenvPath, favorites);
  return favorites;
}

/**
 * 从绑定列表中筛选出收藏的绑定
 * @param pcbenvPath pcbenv 目录路径
 * @param allBindings 所有绑定的列表
 * @returns 仅包含收藏的绑定
 */
export function getFavoriteBindings(
  pcbenvPath: string,
  allBindings: HotkeyBinding[],
): HotkeyBinding[] {
  const favorites = loadFavorites(pcbenvPath);
  if (favorites.favoriteBindingIds.length === 0) {
    return [];
  }
  return allBindings.filter((b) => favorites.favoriteBindingIds.includes(b.id));
}

/**
 * 快速获取收藏数量（不加载所有绑定）
 * @param pcbenvPath pcbenv 目录路径
 * @returns 收藏数量
 */
export function getFavoriteCount(pcbenvPath: string): number {
  const favorites = loadFavorites(pcbenvPath);
  return favorites.favoriteBindingIds.length;
}
