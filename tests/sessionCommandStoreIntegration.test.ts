/**
 * ATM - 会话命令存储持久化集成测试
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyStore,
  getSessionStorePath,
  loadSessionCommands,
  recordSessionCommand,
  saveSessionCommands,
  toggleSessionFavorite,
} from '../core/session/sessionCommandStore';

let configHome: string;
let oldConfigHome: string | undefined;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-session-int-'));
  oldConfigHome = process.env.ATM_CONFIG_HOME;
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  if (oldConfigHome === undefined) delete process.env.ATM_CONFIG_HOME;
  else process.env.ATM_CONFIG_HOME = oldConfigHome;
  fs.rmSync(configHome, { recursive: true, force: true });
});

describe('会话命令存储 round-trip', () => {
  it('记录→保存→加载→收藏，全程落盘', () => {
    let store = createEmptyStore();
    store = recordSessionCommand(store, 'axlVersion()', 'readonly', true);
    store = recordSessionCommand(store, 'axlCurrentDesign()', 'readonly', false);
    store = toggleSessionFavorite(store, 'axlVersion()');
    saveSessionCommands(store);

    expect(fs.existsSync(getSessionStorePath())).toBe(true);

    const loaded = loadSessionCommands();
    expect(loaded.items).toHaveLength(2);
    expect(loaded.items[0].code).toBe('axlCurrentDesign()');
    expect(loaded.items.find((i) => i.code === 'axlVersion()')?.favorite).toBe(true);
  });

  it('首次加载返回空存储', () => {
    expect(loadSessionCommands().items).toEqual([]);
  });
});
