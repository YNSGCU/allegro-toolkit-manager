/**
 * 同步规则记忆测试（V6.4，M4）
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  clearRules,
  createEmptySyncRuleStore,
  findRule,
  loadSyncRuleStore,
  removeRule,
  saveSyncRuleStore,
  setRule,
} from '../core/sync/syncRules';

let configHome: string;
let oldConfigHome: string | undefined;

beforeEach(() => {
  configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-sync-rules-'));
  oldConfigHome = process.env.ATM_CONFIG_HOME;
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  fs.rmSync(configHome, { recursive: true, force: true });
  if (oldConfigHome === undefined) delete process.env.ATM_CONFIG_HOME;
  else process.env.ATM_CONFIG_HOME = oldConfigHome;
});

describe('syncRules', () => {
  it('空存储可读写并保持格式', () => {
    const store = createEmptySyncRuleStore();
    saveSyncRuleStore(store);
    const loaded = loadSyncRuleStore();
    expect(loaded.version).toBe('1.0');
    expect(loaded.rules).toHaveLength(0);
  });

  it('setRule 新增与更新，findRule 忽略大小写', () => {
    const store = createEmptySyncRuleStore();
    setRule(store, ' High_Only ', '17.2', 'always_skip', '高版本命令');
    expect(findRule(store, 'high_only', '17.2')?.decision).toBe('always_skip');

    setRule(store, 'high_only', '17.2', 'ask');
    expect(findRule(store, 'HIGH_ONLY', '17.2')?.decision).toBe('ask');
    expect(findRule(store, 'high_only', '17.4')).toBeUndefined();
  });

  it('removeRule 删除单条，clearRules 清空全部', () => {
    const store = createEmptySyncRuleStore();
    setRule(store, 'a', '17.2', 'always_skip');
    setRule(store, 'b', '17.2', 'always_sync');
    removeRule(store, 'a', '17.2');
    expect(store.rules).toHaveLength(1);
    clearRules(store);
    expect(store.rules).toHaveLength(0);
  });

  it('损坏文件回退为空存储', () => {
    const filePath = path.join(configHome, 'sync_rules.json');
    fs.writeFileSync(filePath, 'not json', 'utf-8');
    expect(loadSyncRuleStore().rules).toHaveLength(0);
  });
});
