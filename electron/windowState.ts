/**
 * ATM - Electron 窗口状态管理（V5.7）
 *
 * 职责：
 *  - 创建窗口前读取保存的状态（尺寸/位置/最大化）
 *  - 跟踪 resize/move/maximize/close 并节流持久化
 *  - 恢复设置备份后，将备份中的窗口状态应用到当前窗口
 *
 * 依赖 Electron screen/BrowserWindow，仅由主进程使用，不直接参与单元测试。
 */
import { BrowserWindow, screen } from 'electron';
import {
  DEFAULT_WINDOW_BOUNDS,
  isWindowStateVisible,
  loadWindowState,
  normalizeWindowState,
  saveWindowState,
  type WindowState,
} from '../core/settings/windowState';

/** 节流间隔（ms） */
const PERSIST_DEBOUNCE_MS = 300;

/** 读取初始窗口选项；无保存状态或状态不可见时返回 null（使用默认尺寸） */
export function getWindowInitialState(): {
  bounds: { x?: number; y?: number; width: number; height: number };
  isMaximized: boolean;
} | null {
  const saved = loadWindowState();
  if (!saved) return null;

  const displays = screen.getAllDisplays().map((display) => display.workArea);
  if (!isWindowStateVisible(saved, displays)) return null;

  const normalized = normalizeWindowState(saved);
  return {
    bounds: {
      x: normalized.bounds.x,
      y: normalized.bounds.y,
      width: normalized.bounds.width,
      height: normalized.bounds.height,
    },
    isMaximized: normalized.isMaximized,
  };
}

/** 立即持久化当前窗口状态 */
export function persistWindowState(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;
  try {
    // getNormalBounds：窗口最大化时也返回恢复后的边界，避免保存全屏尺寸
    const bounds = window.getNormalBounds();
    const state: WindowState = {
      version: 1,
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      },
      isMaximized: window.isMaximized(),
      updatedAt: new Date().toISOString(),
    };
    saveWindowState(state);
  } catch {
    // 保存失败不影响应用
  }
}

/** 跟踪窗口几何变化并节流保存；close 时立即保存最终状态 */
export function trackWindowState(window: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedulePersist = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      persistWindowState(window);
    }, PERSIST_DEBOUNCE_MS);
  };

  window.on('resize', schedulePersist);
  window.on('move', schedulePersist);
  window.on('maximize', schedulePersist);
  window.on('unmaximize', schedulePersist);
  window.on('close', () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    persistWindowState(window);
  });
}

/** 将已保存（或备份恢复后写入的）窗口状态应用到指定窗口 */
export function applySavedWindowState(window: BrowserWindow): void {
  if (!window || window.isDestroyed()) return;
  const saved = loadWindowState();
  if (!saved) return;

  const displays = screen.getAllDisplays().map((display) => display.workArea);
  if (!isWindowStateVisible(saved, displays)) return;

  const normalized = normalizeWindowState(saved);
  const b = normalized.bounds;
  const bounds: Electron.Rectangle = {
    width: b.width,
    height: b.height,
    x: typeof b.x === 'number' ? b.x : 0,
    y: typeof b.y === 'number' ? b.y : 0,
  };
  window.setBounds(bounds);
  if (normalized.isMaximized && !window.isMaximized()) {
    window.maximize();
  }
}

/** 供其他模块获取默认窗口尺寸（构造 BrowserWindow 时兜底） */
export function defaultWindowBounds(): typeof DEFAULT_WINDOW_BOUNDS {
  return DEFAULT_WINDOW_BOUNDS;
}
