/**
 * ATM - 备份与恢复模块单元测试（V5.7）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AtmBackupFile } from '../src/types/backup';
import {
  collectAppSection,
  collectPcbenvSection,
  createBackupFile,
  parseBackupFile,
  restoreBackupFile,
  serializeBackupFile,
  summarizeBackup,
} from '../core/backup/backupManager';
import { getFavoritesPath } from '../core/dictionary/hotkeyFavorites';
import { getOverrideFilePath } from '../core/dictionary/userCommandOverrides';
import { getColorSchemeStorePath } from '../core/color/colorSchemeManager';
import { getEnvironmentRegistryPath } from '../core/environment/environmentRegistry';
import { getWindowStatePath, saveWindowState } from '../core/settings/windowState';
import { createWorkspace, getWorkspaceStorePath } from '../core/workspace/workspaceManager';
import { loadMenuProfileStore } from '../core/menu/menuManager';
import { loadSkillProfileStore } from '../core/skill/skillProfileManager';
import { loadAllProfiles } from '../core/profile/hotkeyProfile';
import { loadSettings } from '../core/settings/atmSettings';
import { loadChangeHistory } from '../core/changeHistory/changeHistory';

let root = '';
let pcbenv = '';
let configHome = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-backup-test-'));
  pcbenv = path.join(root, 'pcbenv');
  fs.mkdirSync(path.join(pcbenv, 'atm_generated', 'settings'), { recursive: true });
  fs.mkdirSync(path.join(pcbenv, 'atm_generated', 'profiles'), { recursive: true });
  fs.mkdirSync(path.join(pcbenv, 'atm_data'), { recursive: true });
  configHome = path.join(root, 'config');
  process.env.ATM_CONFIG_HOME = configHome;
});

afterEach(() => {
  delete process.env.ATM_CONFIG_HOME;
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

function seedPcbenvData(): void {
  fs.writeFileSync(
    path.join(pcbenv, 'atm_generated', 'settings', 'atm_settings.json'),
    JSON.stringify({
      version: 1,
      activeUserEnvPath: 'C:/user',
      referenceEnvPaths: ['C:/ref'],
      lastScanTime: '2026-01-01T00:00:00.000Z',
    }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pcbenv, 'atm_generated', 'settings', 'applied_profile.json'),
    JSON.stringify({ profileId: 'p1', appliedAt: '2026-01-01T00:00:00.000Z' }),
    'utf-8',
  );
  fs.writeFileSync(
    getFavoritesPath(pcbenv),
    JSON.stringify({ version: 1, favoriteBindingIds: ['b1', 'b2'], updatedAt: '2026-01-01T00:00:00.000Z' }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pcbenv, 'atm_generated', 'profiles', 'p1.profile.json'),
    JSON.stringify({
      id: 'p1',
      name: '方案一',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      bindings: [{ id: 'b1', key: 'F1', command: 'cmd1', type: 'alias' }],
    }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pcbenv, 'atm_generated', 'menu_profile.json'),
    JSON.stringify({
      version: '2.0',
      activeProfileId: 'default',
      appliedProfileId: 'default',
      profiles: [{ id: 'default', name: '默认菜单方案', enabled: true, items: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pcbenv, 'atm_generated', 'skill_profiles.json'),
    JSON.stringify({
      version: '1.0',
      activeProfileId: 'default',
      profiles: [{ id: 'default', name: '默认 Skill 方案', enabled: true, skillStates: [], loadOrder: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    'utf-8',
  );
  fs.writeFileSync(
    getOverrideFilePath(pcbenv),
    JSON.stringify({ version: '1.0', overrides: { cmd1: { commandName: 'cmd1', source: 'skill', confidence: 'high', updatedAt: '2026-01-01T00:00:00.000Z' } } }),
    'utf-8',
  );
  fs.writeFileSync(
    path.join(pcbenv, 'atm_data', 'skill_metadata.json'),
    JSON.stringify({ skill1: { userName: '测试 Skill' } }),
    'utf-8',
  );
}

describe('collectPcbenvSection', () => {
  it('收集所有存在的 pcbenv 级配置', () => {
    seedPcbenvData();
    const section = collectPcbenvSection(pcbenv);

    expect(section.atmSettings?.referenceEnvPaths).toEqual(['C:/ref']);
    expect(section.appliedProfiles?.hotkeyProfileId).toBe('p1');
    expect(section.hotkeyFavorites?.favoriteBindingIds).toEqual(['b1', 'b2']);
    expect(section.hotkeyProfiles).toHaveLength(1);
    expect(section.menuProfileStore?.activeProfileId).toBe('default');
    expect(section.skillProfileStore?.activeProfileId).toBe('default');
    expect(section.userCommandOverrides?.overrides).toHaveProperty('cmd1');
    expect(section.skillMetadata).toHaveProperty('skill1');
  });

  it('pcbenv 不存在时返回空分区', () => {
    expect(collectPcbenvSection(path.join(root, 'missing'))).toEqual({});
  });
});

describe('createBackupFile / 序列化 / 解析', () => {
  it('组装备份并支持序列化往返', () => {
    seedPcbenvData();
    const backup = createBackupFile(pcbenv, {
      appVersion: '5.7.0',
      uiPreferences: { atm_conflict_ignore: '["k1"]' },
      updateSettings: { feedUrl: 'https://example.com', connectionMode: 'system' },
    });

    expect(backup.format).toBe('atm-backup');
    expect(backup.version).toBe(1);
    expect(backup.source.appVersion).toBe('5.7.0');
    expect(backup.sections.pcbenv?.hotkeyProfiles).toHaveLength(1);
    expect(backup.sections.ui?.preferences).toEqual({ atm_conflict_ignore: '["k1"]' });
    expect(backup.sections.app?.updateSettings?.feedUrl).toBe('https://example.com');

    const parsed = parseBackupFile(serializeBackupFile(backup));
    expect(parsed.sections.pcbenv?.appliedProfiles?.hotkeyProfileId).toBe('p1');
  });

  it('解析无效内容时抛出中文错误', () => {
    expect(() => parseBackupFile('not json')).toThrow('不是有效的 JSON');
    expect(() => parseBackupFile(JSON.stringify({ format: 'other' }))).toThrow('不是 ATM 备份文件');
    expect(() => parseBackupFile(JSON.stringify({ format: 'atm-backup', version: 99 }))).toThrow('版本');
  });
});

describe('summarizeBackup', () => {
  it('统计各分区条目数量', () => {
    seedPcbenvData();
    const backup = createBackupFile(pcbenv, { uiPreferences: { atm_x: '1' } });
    const summary = summarizeBackup(backup);

    const pcbenvSummary = summary.sections.find((s) => s.id === 'pcbenv');
    expect(pcbenvSummary?.details.find((d) => d.key === 'hotkeyProfiles')?.count).toBe(1);
    expect(pcbenvSummary?.details.find((d) => d.key === 'hotkeyFavorites')?.count).toBe(2);
    expect(summary.sections.find((s) => s.id === 'ui')?.details[0].count).toBe(1);
    expect(summary.totalItems).toBeGreaterThan(0);
  });
});

describe('窗口状态纳入备份', () => {
  it('收集并恢复窗口状态', () => {
    saveWindowState({ version: 1, bounds: { x: 10, y: 20, width: 1360, height: 920 }, isMaximized: true, updatedAt: '2026-01-01T00:00:00.000Z' });
    const backup = createBackupFile(pcbenv);

    expect(backup.sections.app?.windowState?.bounds).toEqual({ x: 10, y: 20, width: 1360, height: 920 });
    expect(backup.sections.app?.windowState?.isMaximized).toBe(true);

    // 清空配置目录模拟新电脑
    fs.rmSync(configHome, { recursive: true, force: true });
    fs.mkdirSync(configHome, { recursive: true });

    restoreBackupFile(pcbenv, backup, { sections: ['app'] });
    expect(fs.existsSync(getWindowStatePath())).toBe(true);
    expect(JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf-8')).isMaximized).toBe(true);
  });
});

describe('摘要健壮性', () => {
  it('备份缺少 source/createdAt 时给出兜底值而不是崩溃', () => {
    const backup = createBackupFile(pcbenv);
    delete (backup as Partial<AtmBackupFile>).source;
    delete (backup as Partial<AtmBackupFile>).createdAt;

    const summary = summarizeBackup(backup);
    expect(summary.source.machineName).toBe('未知电脑');
    expect(summary.createdAt).toBe('');
  });
});

describe('restoreBackupFile', () => {
  it('恢复 pcbenv 级配置并保留现场备份', () => {
    seedPcbenvData();
    const backup = createBackupFile(pcbenv, { uiPreferences: { atm_conflict_ignore: '["k9"]' } });

    // 模拟目标电脑已有不同配置
    const targetPcbenv = path.join(root, 'target');
    fs.mkdirSync(path.join(targetPcbenv, 'atm_generated', 'settings'), { recursive: true });
    fs.writeFileSync(
      path.join(targetPcbenv, 'atm_generated', 'settings', 'atm_settings.json'),
      JSON.stringify({ version: 1, activeUserEnvPath: null, referenceEnvPaths: [], lastScanTime: '2025-01-01T00:00:00.000Z' }),
      'utf-8',
    );

    const result = restoreBackupFile(targetPcbenv, backup, { sections: ['pcbenv', 'app', 'ui'] });

    expect(result.restoredFiles.length).toBeGreaterThan(0);
    expect(result.uiPreferences?.atm_conflict_ignore).toBe('["k9"]');
    expect(result.preRestoreBackupDir).toBeTruthy();
    expect(fs.existsSync(result.preRestoreBackupDir!)).toBe(true);

    // 目标文件已写入
    expect(loadSettings(targetPcbenv).referenceEnvPaths).toEqual(['C:/ref']);
    expect(loadAllProfiles(targetPcbenv)).toHaveLength(1);
    expect(loadMenuProfileStore(path.join(targetPcbenv, 'atm_generated')).activeProfileId).toBe('default');
    expect(loadSkillProfileStore(path.join(targetPcbenv, 'atm_generated')).activeProfileId).toBe('default');

    // 变更历史记录
    const history = loadChangeHistory(targetPcbenv);
    expect(history.records[0].operation).toBe('restore');
  });

  it('默认不恢复环境注册表，includeEnvironments 开启后才恢复', () => {
    fs.mkdirSync(path.dirname(getEnvironmentRegistryPath()), { recursive: true });
    fs.writeFileSync(
      getEnvironmentRegistryPath(),
      JSON.stringify({ version: 1, activeEnvironmentId: 'e1', environments: [{ id: 'e1', name: 'env', pcbenvPath: 'C:/x', envFilePath: '', ilinitFilePath: '', writable: true, exists: true, sharedWithIds: [], source: 'manual' }], updatedAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );
    const backup = createBackupFile(pcbenv);
    expect(backup.sections.app?.environments).toBeTruthy();

    // 目标配置目录清空
    fs.rmSync(configHome, { recursive: true, force: true });
    fs.mkdirSync(configHome, { recursive: true });

    restoreBackupFile(pcbenv, backup, { sections: ['app'] });
    expect(fs.existsSync(getEnvironmentRegistryPath())).toBe(false);

    restoreBackupFile(pcbenv, backup, { sections: ['app'], includeEnvironments: true });
    expect(fs.existsSync(getEnvironmentRegistryPath())).toBe(true);
  });

  it('恢复配色方案到应用配置目录', () => {
    fs.mkdirSync(path.dirname(getColorSchemeStorePath()), { recursive: true });
    fs.writeFileSync(
      getColorSchemeStorePath(),
      JSON.stringify({ version: '1.0', activeSchemeId: 's1', schemes: [{ id: 's1', name: '板A配色', palette: [], layers: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], updatedAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );
    const backup = createBackupFile(pcbenv);

    fs.rmSync(configHome, { recursive: true, force: true });
    fs.mkdirSync(configHome, { recursive: true });

    restoreBackupFile(pcbenv, backup, { sections: ['app'] });
    expect(fs.existsSync(getColorSchemeStorePath())).toBe(true);
  });

  it('部分文件写入失败时抛出含成功数与回退目录的错误', () => {
    seedPcbenvData();
    const backup = createBackupFile(pcbenv);

    // 记录恢复前 settings 文件内容，用于验证自动回滚
    const settingsPath = path.join(pcbenv, 'atm_generated', 'settings', 'atm_settings.json');
    const beforeContent = fs.readFileSync(settingsPath, 'utf-8');

    // 将目标 profile 文件位置预先占为目录，使 rename 阶段失败
    const blockedDir = path.join(pcbenv, 'atm_generated', 'profiles', 'p1.profile.json');
    fs.rmSync(blockedDir, { force: true });
    fs.mkdirSync(blockedDir, { recursive: true });

    expect(() => restoreBackupFile(pcbenv, backup, { sections: ['pcbenv'] })).toThrow(/已自动回滚/);

    // 自动回滚后，已成功写入的 settings 文件恢复到恢复前内容
    expect(fs.readFileSync(settingsPath, 'utf-8')).toBe(beforeContent);
  });
  it('空备份返回空结果', () => {
    const backup = createBackupFile(pcbenv);
    const result = restoreBackupFile(pcbenv, backup, { sections: ['pcbenv', 'app', 'ui'] });
    expect(result.restoredFiles).toEqual([]);
  });

  it('只恢复配色分区时不触碰 pcbenv 现有配置', () => {
    seedPcbenvData();
    // 预置应用级配色数据，让备份包含 app 分区
    fs.mkdirSync(path.dirname(getColorSchemeStorePath()), { recursive: true });
    fs.writeFileSync(
      getColorSchemeStorePath(),
      JSON.stringify({ version: '1.0', activeSchemeId: 's1', schemes: [{ id: 's1', name: '板A配色', palette: [], layers: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], updatedAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );
    const backup = createBackupFile(pcbenv);

    // 目标 pcbenv 已有用户自己的快捷键方案，恢复前记录现状
    const userProfilePath = path.join(pcbenv, 'atm_generated', 'profiles', 'user.profile.json');
    fs.writeFileSync(
      userProfilePath,
      JSON.stringify({ id: 'user', name: '用户自己的方案', bindings: [], createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' }),
      'utf-8',
    );

    const result = restoreBackupFile(pcbenv, backup, { sections: ['app'] });

    // 只恢复应用级（配色/窗口状态），pcbenv 的 profile 文件保持用户原有内容
    expect(result.restoredSections).toEqual(['app']);
    expect(fs.existsSync(userProfilePath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(userProfilePath, 'utf-8')).id).toBe('user');
    // 配色方案已恢复到应用配置目录
    expect(fs.existsSync(getColorSchemeStorePath())).toBe(true);
    expect(JSON.parse(fs.readFileSync(getColorSchemeStorePath(), 'utf-8')).activeSchemeId).toBe('s1');
  });
});

describe('collectAppSection', () => {
  it('仅包含有实际内容的全局配置', () => {
    const section = collectAppSection({ updateSettings: { feedUrl: 'x' } });
    expect(section.updateSettings?.feedUrl).toBe('x');
    // 空配置时不携带空 store
    expect(section.colorSchemes).toBeUndefined();
  });

  it('用户创建的工作区随备份收集与恢复', () => {
    createWorkspace('项目A', { hotkeyProfileId: 'hk_1', colorSchemeId: 'color_1' });
    const backup = createBackupFile(pcbenv);

    expect(backup.sections.app?.workspaces?.workspaces.some((w) => w.name === '项目A')).toBe(true);

    // 清空配置目录模拟新电脑
    fs.rmSync(configHome, { recursive: true, force: true });
    fs.mkdirSync(configHome, { recursive: true });

    restoreBackupFile(pcbenv, backup, { sections: ['app'] });
    expect(fs.existsSync(getWorkspaceStorePath())).toBe(true);
    const restored = JSON.parse(fs.readFileSync(getWorkspaceStorePath(), 'utf-8'));
    expect(restored.workspaces.some((w: { name: string }) => w.name === '项目A')).toBe(true);
  });
});
