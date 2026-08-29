/**
 * 跨版本同步合并测试（V6.4，M3）
 */
import { describe, expect, it } from 'vitest';
import { mergeSyncProfiles } from '../core/sync/mergeSyncProfiles';
import type { CrossVersionSyncItem, CrossVersionSyncPlan } from '../src/types/sync';
import type { HotkeyProfile } from '../src/types/hotkey';
import type { SkillProfile } from '../src/types/skillProfile';
import type { MenuProfile } from '../src/types/menu';

const plan: CrossVersionSyncPlan = {
  source: { environmentId: 'a', version: '17.4', pcbenvPath: 'A' },
  target: { environmentId: 'b', version: '17.2', pcbenvPath: 'B' },
  blocked: false,
  items: [],
  stats: { sync: 0, skip_ver: 0, skip_unknown: 0, keep_target: 0, user_force: 0 },
};

function item(partial: Partial<CrossVersionSyncItem> & { kind: CrossVersionSyncItem['kind']; ref: string; decision: CrossVersionSyncItem['decision'] }): CrossVersionSyncItem {
  return {
    command: '',
    sourceValue: {},
    ...partial,
  };
}

const sourceHotkey: HotkeyProfile = {
  id: 'hk_src',
  name: '主快捷键',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  bindings: [
    { id: 'b1', key: 'F2', command: 'save', type: 'funckey', enabled: true },
    { id: 'b2', key: 'F3', command: 'high_only', type: 'funckey', enabled: true },
  ],
};

const sourceSkill: SkillProfile = {
  id: 'sk_src',
  name: '我的 Skill',
  enabled: true,
  skillStates: [
    { skillId: 'src_drc', skillName: 'drc.il', sourceFile: 'drc.il', enabled: true, loadEnabled: true, order: 1 },
  ],
  loadOrder: ['src_drc'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sourceMenu: MenuProfile = {
  id: 'mn_src',
  name: '我的菜单',
  enabled: true,
  items: [
    {
      id: 'm1', label: '工具', type: 'menu', path: ['工具'], order: 0,
      menuSource: 'atm', enabled: true, visible: true, status: 'normal',
      children: [
        {
          id: 'm2', label: '常用', type: 'command', path: ['工具', '常用'], order: 0,
          command: 'save', menuSource: 'atm', enabled: true, visible: true, status: 'normal',
        },
        {
          id: 'm3', label: '高级', type: 'command', path: ['工具', '高级'], order: 1,
          command: 'high_only', menuSource: 'atm', enabled: true, visible: true, status: 'normal',
        },
      ],
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('mergeSyncProfiles', () => {
  it('快捷键：只保留 sync/user_force/keep_target，跳过项不写入，新方案独立命名', () => {
    const merged = mergeSyncProfiles({
      plan: {
        ...plan,
        items: [
          item({ kind: 'hotkey', ref: 'funckey:F2', command: 'save', decision: 'sync', sourceValue: sourceHotkey.bindings[0] }),
          item({ kind: 'hotkey', ref: 'funckey:F3', command: 'high_only', decision: 'skip_ver', sourceValue: sourceHotkey.bindings[1] }),
          item({
            kind: 'hotkey', ref: 'funckey:F9', command: 'extra', decision: 'keep_target',
            sourceValue: {}, targetValue: { id: 'tb', key: 'F9', command: 'extra', type: 'funckey', enabled: true },
          }),
        ],
      },
      source: { hotkey: sourceHotkey },
      target: { hotkey: { ...sourceHotkey, id: 'hk_tgt' } },
    });

    expect(merged.hotkey).toBeDefined();
    expect(merged.hotkey!.id).not.toBe(sourceHotkey.id);
    expect(merged.hotkey!.name).toBe('主快捷键（同步）');
    expect(merged.hotkey!.bindings).toHaveLength(2);
    expect(merged.hotkey!.bindings.map((binding) => binding.key)).toEqual(['F2', 'F9']);
    expect(merged.hotkey!.bindings.every((binding) => binding.enabled)).toBe(true);
  });

  it('Skill：同步项使用目标 skillId，loadOrder 保留源顺序并追加目标独有', () => {
    const merged = mergeSyncProfiles({
      plan: {
        ...plan,
        items: [
          item({
            kind: 'skill', ref: 'tgt_drc', command: 'drc.il', decision: 'sync',
            sourceValue: sourceSkill.skillStates[0],
            targetValue: { skillId: 'tgt_drc', skillName: 'drc.il', sourceFile: 'drc.il', enabled: false, loadEnabled: false, order: 3 },
          }),
          item({
            kind: 'skill', ref: 'tgt_extra', command: 'extra.il', decision: 'keep_target',
            sourceValue: {}, targetValue: { skillId: 'tgt_extra', skillName: 'extra.il', sourceFile: 'extra.il', enabled: true, loadEnabled: true, order: 9 },
          }),
          item({ kind: 'skill', ref: 'only_src', command: 'only.il', decision: 'skip_ver', sourceValue: {} }),
        ],
      },
      source: { skill: sourceSkill },
      target: { skill: { ...sourceSkill, id: 'sk_tgt', skillStates: [] } },
    });

    expect(merged.skill).toBeDefined();
    expect(merged.skill!.skillStates.map((state) => state.skillId)).toEqual(['tgt_drc', 'tgt_extra']);
    const drc = merged.skill!.skillStates[0];
    expect(drc.enabled).toBe(true); // 使用源 enabled
    expect(drc.order).toBe(1);       // 使用源 order
    expect(merged.skill!.loadOrder).toEqual(['tgt_drc', 'tgt_extra']);
  });

  it('菜单：跳过命令项整项剔除，布局/通用命令保留，id 重新生成', () => {
    const merged = mergeSyncProfiles({
      plan: {
        ...plan,
        items: [
          item({ kind: 'menu', ref: '工具', command: '', decision: 'sync', sourceValue: {} }),
          item({ kind: 'menu', ref: '工具 > 常用', command: 'save', decision: 'sync', sourceValue: {} }),
          item({ kind: 'menu', ref: '工具 > 高级', command: 'high_only', decision: 'skip_ver', sourceValue: {} }),
        ],
      },
      source: { menu: sourceMenu },
    });

    expect(merged.menu).toBeDefined();
    expect(merged.menu!.items).toHaveLength(1);
    const tool = merged.menu!.items[0];
    expect(tool.children?.map((child) => child.label)).toEqual(['常用']);
    expect(tool.id).not.toBe('m1');
  });
});
