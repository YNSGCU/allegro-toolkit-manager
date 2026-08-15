/**
 * ATM - IPC 处理器注册冒烟测试
 *
 * 用 mock 的 electron 模块验证 registerIpcHandlers() 能完整注册所有模块的
 * IPC 通道且不抛错，并断言核心通道存在（接线完整性检查）。
 */
import { describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => ({
  ipcHandle: vi.fn((_channel: string) => {}),
}));

vi.mock('electron', () => ({
  ipcMain: { handle: electronMocks.ipcHandle },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
  app: {
    getVersion: vi.fn(() => '0.4.0'),
    getAppPath: vi.fn(() => process.cwd()),
    getPath: vi.fn(() => ''),
  },
  BrowserWindow: { fromWebContents: vi.fn(() => null) },
}));

import { registerIpcHandlers } from '../electron/ipc/index';
import { registeredChannels } from '../electron/ipc/channelRegistry';

describe('IPC 处理器注册', () => {
  it('完整注册所有模块通道且不抛错', () => {
    registeredChannels.clear();
    electronMocks.ipcHandle.mockClear();

    expect(() => registerIpcHandlers()).not.toThrow();

    const channels = [...registeredChannels];
    const expected = [
      'app:getRuntimeInfo',
      'env:locate',
      'env:scan-all',
      'hotkey:parse-env',
      'color:capture',
      'color:bridge-setup-status',
      'drc:list-reports',
      'env:editor-load',
      'session:probe',
      'session:command',
      'workspace:load-all',
      'history:load',
      'history:apply-plan-list',
      'skill-profile:load-all',
      'menu:load-profiles',
    ];
    for (const channel of expected) {
      expect(channels).toContain(channel);
    }
    // 通道总数应足够多（防止某模块被意外移除）
    expect(channels.length).toBeGreaterThan(40);
  });
});
