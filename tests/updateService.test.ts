import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppUpdater } from 'electron-updater';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidFeedUrl, OFFICIAL_UPDATE_FEED_URL, UpdateService } from '../electron/services/updateService';

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  feedUrl = '';
  quitAndInstall = vi.fn();
  proxyModes: string[] = [];
  netSession: {
    setProxy: (options: { mode: string }) => Promise<void>;
    closeAllConnections: () => Promise<void>;
  };

  constructor() {
    super();
    this.netSession = {
      setProxy: async ({ mode }: { mode: string }) => { this.proxyModes.push(mode); },
      closeAllConnections: async () => undefined,
    };
  }

  setFeedURL(options: { url: string }) { this.feedUrl = options.url; }
  async checkForUpdates(): Promise<unknown> { this.emit('checking-for-update'); this.emit('update-available', { version: '0.2.0', releaseNotes: '改进菜单管理' }); return {}; }
  async downloadUpdate() { this.emit('download-progress', { percent: 45 }); this.emit('update-downloaded', { version: '0.2.0', releaseNotes: '改进菜单管理' }); return ['installer.exe']; }
}

class HangingUpdater extends FakeUpdater {
  async checkForUpdates(): Promise<unknown> {
    this.emit('checking-for-update');
    return new Promise(() => {});
  }
}

const temporaryPaths: string[] = [];
const createService = (packaged = true) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-update-test-'));
  temporaryPaths.push(directory);
  const updater = new FakeUpdater();
  const service = new UpdateService(updater as unknown as AppUpdater, '0.1.0', packaged, directory, () => undefined);
  return { updater, service };
};

afterEach(() => {
  vi.useRealTimers();
  delete process.env.ATM_UPDATE_URL;
  for (const directory of temporaryPaths.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('应用内更新服务', () => {
  it('只接受无敏感参数的 HTTPS 更新源', () => {
    expect(isValidFeedUrl('https://updates.example.com/latest')).toBe(true);
    expect(isValidFeedUrl('http://updates.example.com/latest')).toBe(false);
    expect(isValidFeedUrl('https://user:pass@updates.example.com/latest')).toBe(false);
    expect(isValidFeedUrl('https://updates.example.com/latest?token=secret')).toBe(false);
  });

  it('完成检查、下载和静默重启安装状态链', async () => {
    const { updater, service } = createService();
    await service.saveSettings({ feedUrl: 'https://updates.example.com/latest/', connectionMode: 'system' });
    expect((await service.check()).status).toBe('available');
    expect((await service.download()).status).toBe('downloaded');
    expect(service.state()).toMatchObject({ availableVersion: '0.2.0', progress: 100 });
    service.install();
    expect(updater.feedUrl).toBe('https://updates.example.com/latest');
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(updater.proxyModes).toEqual(['system', 'system', 'system']);
  });

  it('旧安装包没有内置元数据时仍使用官方 GitHub 更新源', async () => {
    const { updater, service } = createService();

    expect(service.settings()).toMatchObject({
      source: 'default',
      settings: { feedUrl: OFFICIAL_UPDATE_FEED_URL },
    });
    expect((await service.check()).status).toBe('available');
    expect(updater.feedUrl).toBe(OFFICIAL_UPDATE_FEED_URL);
  });

  it('更新服务器长期无响应时返回可重试的网络错误', async () => {
    vi.useFakeTimers();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-update-timeout-test-'));
    temporaryPaths.push(directory);
    const updater = new HangingUpdater();
    const service = new UpdateService(
      updater as unknown as AppUpdater,
      '0.3.0',
      true,
      directory,
      () => undefined,
    );

    const checking = service.check();
    await vi.advanceTimersByTimeAsync(30_001);

    await expect(checking).resolves.toMatchObject({
      status: 'error',
      failure: { code: 'network', recoverable: true },
    });
  });

  it('开发模式不联网且未下载时拒绝安装', async () => {
    const { service } = createService(false);
    expect((await service.check()).status).toBe('unsupported');
    expect(() => service.install()).toThrow('更新尚未下载完成');
  });
});
