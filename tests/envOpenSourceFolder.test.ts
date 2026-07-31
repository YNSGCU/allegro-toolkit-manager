import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => any>();

  return {
    handlers,
    ipcHandle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
    showOpenDialog: vi.fn(),
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronMocks.ipcHandle,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
  },
  shell: {
    openPath: electronMocks.openPath,
    showItemInFolder: electronMocks.showItemInFolder,
  },
}));

import { registerEnvIpc } from '../electron/ipc/env.ipc';

describe('env:open-source-folder IPC', () => {
  beforeEach(() => {
    electronMocks.handlers.clear();
    electronMocks.ipcHandle.mockClear();
    electronMocks.showOpenDialog.mockReset();
    electronMocks.openPath.mockReset();
    electronMocks.showItemInFolder.mockReset();
    registerEnvIpc();
  });

  it('reveals an env file in Explorer when opening a source file path', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-open-folder-'));
    const envFilePath = path.join(tempRoot, 'company.env');
    fs.writeFileSync(envFilePath, 'set test=1', 'utf8');

    const handler = electronMocks.handlers.get('env:open-source-folder');

    expect(handler).toBeTypeOf('function');

    const result = await handler?.({}, envFilePath);

    expect(result).toEqual({ success: true });
    expect(electronMocks.showItemInFolder).toHaveBeenCalledWith(path.resolve(envFilePath));
    expect(electronMocks.openPath).not.toHaveBeenCalled();
  });

  it('opens the directory directly when the source itself is a folder', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-open-folder-dir-'));
    electronMocks.openPath.mockResolvedValue('');

    const handler = electronMocks.handlers.get('env:open-source-folder');

    expect(handler).toBeTypeOf('function');

    const result = await handler?.({}, tempRoot);

    expect(result).toEqual({ success: true });
    expect(electronMocks.openPath).toHaveBeenCalledWith(path.resolve(tempRoot));
    expect(electronMocks.showItemInFolder).not.toHaveBeenCalled();
  });
});
