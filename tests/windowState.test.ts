/**
 * ATM - 窗口状态持久化模块单元测试（V5.7）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_WINDOW_BOUNDS,
  getWindowStatePath,
  isWindowStateVisible,
  loadWindowState,
  normalizeWindowState,
  saveWindowState,
  type WindowState,
} from '../core/settings/windowState';

let configHome = '';

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-window-state-'));
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  delete process.env.ATM_CONFIG_HOME;
  try {
    fs.rmSync(configHome, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

function makeState(overrides?: Partial<WindowState>): WindowState {
  return {
    version: 1,
    bounds: { x: 100, y: 100, width: 1360, height: 920 },
    isMaximized: false,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const DISPLAY = { x: 0, y: 0, width: 1920, height: 1080 };

describe('windowState 持久化', () => {
  it('保存后可以完整读回', () => {
    saveWindowState(makeState({ isMaximized: true }));
    const loaded = loadWindowState();
    expect(loaded?.bounds).toEqual({ x: 100, y: 100, width: 1360, height: 920 });
    expect(loaded?.isMaximized).toBe(true);
    expect(fs.existsSync(getWindowStatePath())).toBe(true);
  });

  it('文件不存在或结构无效时返回 null', () => {
    expect(loadWindowState()).toBeNull();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ version: 2 }), 'utf-8');
    expect(loadWindowState()).toBeNull();
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ version: 1, bounds: {} }), 'utf-8');
    expect(loadWindowState()).toBeNull();
  });
});

describe('isWindowStateVisible', () => {
  it('窗口在主显示器内可见', () => {
    expect(isWindowStateVisible(makeState(), [DISPLAY])).toBe(true);
  });

  it('窗口完全在屏幕外时不可见', () => {
    const state = makeState({ bounds: { x: 5000, y: 5000, width: 1360, height: 920 } });
    expect(isWindowStateVisible(state, [DISPLAY])).toBe(false);
  });

  it('跨显示器摆放时只要与任一显示器有交集即可', () => {
    const rightMonitor = { x: 1920, y: 0, width: 1920, height: 1080 };
    const state = makeState({ bounds: { x: 1880, y: 100, width: 1360, height: 920 } });
    expect(isWindowStateVisible(state, [DISPLAY, rightMonitor])).toBe(true);
  });

  it('外接屏拔出后只残留少量边缘时不可见', () => {
    const state = makeState({ bounds: { x: 1919, y: 100, width: 1360, height: 920 } });
    expect(isWindowStateVisible(state, [DISPLAY])).toBe(false);
  });

  it('没有显示器信息时不可见', () => {
    expect(isWindowStateVisible(makeState(), [])).toBe(false);
  });
});

describe('normalizeWindowState', () => {
  it('将过小的尺寸提升到最小限制', () => {
    const normalized = normalizeWindowState(makeState({ bounds: { x: 0, y: 0, width: 400, height: 300 } }));
    expect(normalized.bounds.width).toBe(DEFAULT_WINDOW_BOUNDS.minWidth);
    expect(normalized.bounds.height).toBe(DEFAULT_WINDOW_BOUNDS.minHeight);
  });

  it('保留合法尺寸与位置', () => {
    const state = makeState();
    expect(normalizeWindowState(state).bounds).toEqual(state.bounds);
  });
});
