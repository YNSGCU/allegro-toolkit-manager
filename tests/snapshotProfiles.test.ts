/**
 * 当前环境实时快照测试（V6.4：空方案自动快照）
 */
import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import {
  buildEnvironmentSnapshotProfiles,
  isEmptyHotkeyProfile,
  isEmptySkillProfile,
} from '../core/sync/snapshotProfiles';
import { createEmptySyncRuleStore } from '../core/sync/syncRules';
import { planCrossVersionSync } from '../core/sync/planCrossVersionSync';

const FIXTURE_ENV = path.join('test-fixtures', 'env.basic');

describe('buildEnvironmentSnapshotProfiles', () => {
  it('从 env 文件与 Skill 扫描构建实时快照（不落盘）', () => {
    const snapshot = buildEnvironmentSnapshotProfiles({
      pcbenvPath: os.tmpdir(),
      envFilePath: FIXTURE_ENV,
      scannedSkills: [
        { id: 'snp_dir', name: 'snp.il', path: 'D:/snp.il', enabled: true, loadStatus: 'loaded' },
        { id: 'drc_dir', name: 'drc.il', path: 'D:/drc.il', enabled: true, loadStatus: 'loaded' },
      ],
      label: '17.4（源）',
    });

    expect(snapshot.hotkey).toBeDefined();
    expect(snapshot.hotkey!.bindings.length).toBeGreaterThan(0);
    expect(snapshot.hotkey!.bindings.some((binding) => binding.type === 'funckey')).toBe(true);
    expect(snapshot.hotkey!.name).toContain('17.4');

    expect(snapshot.skill).toBeDefined();
    expect(snapshot.skill!.skillStates.map((state) => state.skillId)).toEqual(['snp_dir', 'drc_dir']);
    expect(snapshot.skill!.loadOrder).toEqual(['snp_dir', 'drc_dir']);
  });

  it('env 文件缺失时仅构建 Skill 快照', () => {
    const snapshot = buildEnvironmentSnapshotProfiles({
      pcbenvPath: os.tmpdir(),
      envFilePath: undefined,
      scannedSkills: [{ id: 's1', name: 'a.il', path: 'D:/a.il', enabled: true, loadStatus: 'loaded' }],
      label: '测试',
    });
    expect(snapshot.hotkey).toBeUndefined();
    expect(snapshot.skill).toBeDefined();
  });

  it('没有 Skill 时仅构建快捷键快照', () => {
    const snapshot = buildEnvironmentSnapshotProfiles({
      pcbenvPath: os.tmpdir(),
      envFilePath: FIXTURE_ENV,
      scannedSkills: [],
      label: '测试',
    });
    expect(snapshot.hotkey).toBeDefined();
    expect(snapshot.skill).toBeUndefined();
  });

  it('空方案判定函数', () => {
    expect(isEmptyHotkeyProfile(null)).toBe(true);
    expect(isEmptyHotkeyProfile({ bindings: [] })).toBe(true);
    expect(isEmptyHotkeyProfile({ bindings: [{ id: 'a', key: 'F1', command: 'x', type: 'funckey', enabled: true }] })).toBe(false);
    expect(isEmptySkillProfile(undefined)).toBe(true);
    expect(isEmptySkillProfile({ skillStates: [] })).toBe(true);
    expect(isEmptySkillProfile({ skillStates: [{ skillId: 'a', skillName: 'a', sourceFile: '', enabled: true, loadEnabled: true, order: 0 }] })).toBe(false);
  });
});

describe('planCrossVersionSync notes 透传', () => {
  it('notes 原样写入计划', () => {
    const plan = planCrossVersionSync({
      source: { environmentId: 'a', version: '17.4' },
      target: { environmentId: 'b', version: '17.2' },
      targetCommands: new Map(),
      rules: createEmptySyncRuleStore(),
      notes: ['17.4（源）快捷键：使用当前 env 实时快照（未保存为方案）'],
    });
    expect(plan.notes).toEqual(['17.4（源）快捷键：使用当前 env 实时快照（未保存为方案）']);
    expect(plan.blocked).toBe(true); // 无任何源内容
  });
});
