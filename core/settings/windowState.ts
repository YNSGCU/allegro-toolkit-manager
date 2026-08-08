/**
 * ATM - 窗口状态持久化模块（V5.7）
 *
 * 保存并恢复主窗口的大小、位置与最大化状态，随设置备份一起迁移：
 *   - 存储位置：{ATM_CONFIG_HOME}/window_state.json
 *   - 关闭时保存 getNormalBounds()（最大化时也能得到恢复后的边界）
 *   - 恢复时校验窗口与显示器可见区域，避免窗口被恢复到屏幕外
 *
 * 纯 TypeScript 模块，仅依赖 Node.js 内置模块，可通过 Vitest 测试。
 */
import fs from 'fs';
import path from 'path';
import { configRoot } from '../color/colorSchemeManager';

export const WINDOW_STATE_VERSION = 1;

/** 与 electron/windowConfig.ts 保持一致的最小窗口尺寸 */
export const DEFAULT_WINDOW_BOUNDS = {
  width: 1360,
  height: 920,
  minWidth: 1220,
  minHeight: 820,
} as const;

/** 窗口边界（x/y 可选，缺省由系统摆放） */
export interface WindowStateBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface WindowState {
  version: number;
  bounds: WindowStateBounds;
  isMaximized: boolean;
  updatedAt: string;
}

/** 显示器工作区边界（供可见性校验） */
export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 窗口状态文件路径（与应用配置同目录） */
export function getWindowStatePath(): string {
  return path.join(configRoot(), 'window_state.json');
}

/** 加载窗口状态；文件不存在或结构无效时返回 null */
export function loadWindowState(): WindowState | null {
  try {
    const filePath = getWindowStatePath();
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<WindowState>;
    if (raw.version !== WINDOW_STATE_VERSION) return null;
    if (!raw.bounds || typeof raw.bounds.width !== 'number' || typeof raw.bounds.height !== 'number') {
      return null;
    }
    return {
      version: WINDOW_STATE_VERSION,
      bounds: {
        x: typeof raw.bounds.x === 'number' ? raw.bounds.x : undefined,
        y: typeof raw.bounds.y === 'number' ? raw.bounds.y : undefined,
        width: raw.bounds.width,
        height: raw.bounds.height,
      },
      isMaximized: raw.isMaximized === true,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** 保存窗口状态（原子写入） */
export function saveWindowState(state: WindowState): void {
  try {
    const filePath = getWindowStatePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch {
    // 窗口状态保存失败不影响应用运行
  }
}

/** 校验窗口尺寸不低于最小限制（兼容旧版本/异常数据） */
export function normalizeWindowState(state: WindowState): WindowState {
  return {
    ...state,
    bounds: {
      ...state.bounds,
      width: Math.max(Math.round(state.bounds.width), DEFAULT_WINDOW_BOUNDS.minWidth),
      height: Math.max(Math.round(state.bounds.height), DEFAULT_WINDOW_BOUNDS.minHeight),
    },
  };
}

/**
 * 校验窗口状态是否可见：窗口必须与至少一个显示器有足够交集，
 * 避免上次使用的显示器（如外接屏）拔掉后窗口被恢复到屏幕外。
 */
export function isWindowStateVisible(state: WindowState, displays: DisplayBounds[]): boolean {
  const bounds = normalizeWindowState(state).bounds;
  const x = bounds.x ?? 0;
  const y = bounds.y ?? 0;
  const MIN_VISIBLE_WIDTH = 100;
  const MIN_VISIBLE_HEIGHT = 50;

  if (bounds.width < MIN_VISIBLE_WIDTH || bounds.height < MIN_VISIBLE_HEIGHT) return false;

  return displays.some((display) => {
    const overlapX = Math.min(x + bounds.width, display.x + display.width) - Math.max(x, display.x);
    const overlapY = Math.min(y + bounds.height, display.y + display.height) - Math.max(y, display.y);
    return overlapX >= MIN_VISIBLE_WIDTH && overlapY >= MIN_VISIBLE_HEIGHT;
  });
}
