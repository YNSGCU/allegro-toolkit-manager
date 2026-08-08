/**
 * ATM - 配色应用撤销快照（V6.1）
 *
 * 每次应用配色方案前，通过 Vibe Bridge 捕获当前板子的完整配色快照，
 * 写入 %APPDATA%/AllegroToolkitManager/color_undo/<时间戳>.json。
 * 用户点击"撤销本次配色"时，把该快照重新应用到板子。
 *
 * 纯 TypeScript 模块，仅依赖 Node.js 内置模块，可独立测试。
 */
import fs from 'fs';
import path from 'path';
import { configRoot } from './colorSchemeManager';
import type { ColorSchemeSnapshot } from '../../src/types/color';

export interface ColorUndoSnapshot {
  id: string;
  /** 被应用的方案名称（展示用） */
  schemeName: string;
  /** 应用前的板子配色快照 */
  snapshot: ColorSchemeSnapshot;
  createdAt: string;
}

export const UNDO_SNAPSHOT_VERSION = 1;

/** 撤销快照目录 */
export function getColorUndoDir(): string {
  return path.join(configRoot(), 'color_undo');
}

/** 生成快照 ID（时间戳 + 随机段） */
export function generateUndoId(): string {
  return `color_undo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 快照文件路径 */
export function getColorUndoPath(undoId: string): string {
  return path.join(getColorUndoDir(), `${undoId}.json`);
}

/** 保存撤销快照 */
export function saveColorUndoSnapshot(
  snapshot: ColorSchemeSnapshot,
  schemeName: string,
): ColorUndoSnapshot {
  const undo: ColorUndoSnapshot = {
    id: generateUndoId(),
    schemeName,
    snapshot,
    createdAt: new Date().toISOString(),
  };
  const dir = getColorUndoDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    getColorUndoPath(undo.id),
    JSON.stringify({ version: UNDO_SNAPSHOT_VERSION, ...undo }, null, 2),
    'utf-8',
  );
  return undo;
}

/** 读取撤销快照；不存在或结构无效时返回 null */
export function loadColorUndoSnapshot(undoId: string): ColorUndoSnapshot | null {
  try {
    const filePath = getColorUndoPath(undoId);
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<ColorUndoSnapshot> & {
      version?: number;
    };
    if (raw.version !== UNDO_SNAPSHOT_VERSION || !raw.id || !raw.snapshot) return null;
    return {
      id: raw.id,
      schemeName: typeof raw.schemeName === 'string' ? raw.schemeName : '未知方案',
      snapshot: raw.snapshot,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** 删除撤销快照（撤销成功后清理） */
export function deleteColorUndoSnapshot(undoId: string): void {
  try {
    const filePath = getColorUndoPath(undoId);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  } catch {
    // 清理失败不影响主流程
  }
}

/** 列出最近的撤销快照（按创建时间倒序，默认最多 10 个） */
export function listColorUndoSnapshots(limit = 10): ColorUndoSnapshot[] {
  const dir = getColorUndoDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as Partial<ColorUndoSnapshot> & {
          version?: number;
        };
        if (raw.version !== UNDO_SNAPSHOT_VERSION || !raw.id || !raw.snapshot) return null;
        return {
          id: raw.id,
          schemeName: typeof raw.schemeName === 'string' ? raw.schemeName : '未知方案',
          snapshot: raw.snapshot,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
        } as ColorUndoSnapshot;
      } catch {
        return null;
      }
    })
    .filter((item): item is ColorUndoSnapshot => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
