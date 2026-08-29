/**
 * 跨版本同步计划分类测试（V6.4，M1）
 */
import { describe, expect, it } from 'vitest';
import { buildCommandAvailability } from '../core/sync/commandAvailability';
import { planCrossVersionSync, classifyCommand } from '../core/sync/planCrossVersionSync';
import { createEmptySyncRuleStore } from '../core/sync/syncRules';
import type { CommandAvailabilityProvider, CrossVersionSyncInput } from '../src/types/sync';
import type { HotkeyProfile, HotkeyProfileBinding } from '../src/types/hotkey';
import type { SkillProfile, SkillProfileItem } from '../src/types/skillProfile';
import type { MenuItemConfig, MenuProfile } from '../src/types/menu';

const nothing = new Map<string, CommandAvailabilityProvider[]>();

function hotkey(bindings: Array<Partial<HotkeyProfileBinding> & { id: string; key: string; command: string }>): HotkeyProfile {
  return {
    id: 'hk_src',
    name: '源快捷键',
    createdAt: '',
    updatedAt: '',
    bindings: bindings.map((binding) => ({
      id: binding.id,
      key: binding.key,
      command: binding.command,
      type: binding.type ?? ('funckey' as const),
      enabled: binding.enabled ?? true,
    })),
  };
}

function skill(states: Array<Partial<SkillProfileItem> & { skillId: string; skillName: string }>): SkillProfile {
  return {
    id: 'sk_src',
    name: '源 Skill',
    enabled: true,
    skillStates: states.map((state) => ({
      skillId: state.skillId,
      skillName: state.skillName,
      sourceFile: state.sourceFile ?? '',
      enabled: state.enabled ?? true,
      loadEnabled: state.loadEnabled ?? true,
      order: state.order ?? 0,
    })),
    loadOrder: [],
    createdAt: '',
    updatedAt: '',
  };
}

function menu(items: MenuItemConfig[]): MenuProfile {
  return { id: 'mn_src', name: '源菜单', enabled: true, items, createdAt: '', updatedAt: '' };
}

function baseInput(overrides: Partial<CrossVersionSyncInput> = {}): CrossVersionSyncInput {
  return {
    source: { environmentId: 'env_src', version: '17.4', pcbenvPath: 'D:/a/pcbenv' },
    target: { environmentId: 'env_tgt', version: '17.2', pcbenvPath: 'D:/b/pcbenv' },
    targetCommands: nothing,
    rules: createEmptySyncRuleStore(),
    ...overrides,
  };
}

describe('classifyCommand', () => {
  it('目标环境有提供者（内置命令 / Skill）→ sync', () => {
    const index = buildCommandAvailability([{ skillId: 's1', name: 'drc.il', commands: ['drc_run'] }]);
    expect(classifyCommand('save', index, undefined, createEmptySyncRuleStore(), '17.2').decision).toBe('sync');
    expect(classifyCommand('drc_run', index, undefined, createEmptySyncRuleStore(), '17.2').decision).toBe('sync');
  });

  it('目标无提供者但源有 → skip_ver 并给出原因', () => {
    const target = buildCommandAvailability([]);
    const source = buildCommandAvailability([{ skillId: 's_hi', name: 'hi.il', commands: ['high_only'] }]);
    const verdict = classifyCommand('high_only', target, source, createEmptySyncRuleStore(), '17.2');
    expect(verdict.decision).toBe('skip_ver');
    expect(verdict.reason).toContain('hi.il');
  });

  it('两边都不认识 → skip_unknown', () => {
    const target = buildCommandAvailability([]);
    const source = buildCommandAvailability([]);
    const verdict = classifyCommand('mystery_cmd', target, source, createEmptySyncRuleStore(), '17.2');
    expect(verdict.decision).toBe('skip_unknown');
  });

  it('规则记忆：always_skip 跳过目标可用命令；always_sync 强制同步目标无提供者命令', () => {
    const store = createEmptySyncRuleStore();
    store.rules.push(
      { command: 'save', targetVersion: '17.2', decision: 'always_skip', updatedAt: '' },
      { command: 'high_only', targetVersion: '17.2', decision: 'always_sync', updatedAt: '' },
    );
    const target = buildCommandAvailability([]);
    const source = buildCommandAvailability([{ skillId: 's_hi', name: 'hi.il', commands: ['high_only'] }]);

    expect(classifyCommand('save', buildCommandAvailability([]), source, store, '17.2').decision).toBe('skip_ver');
    expect(classifyCommand('high_only', target, source, store, '17.2').decision).toBe('user_force');
  });

  it('规则记忆：ask 标记 askConfirm', () => {
    const store = createEmptySyncRuleStore();
    store.rules.push({ command: 'save', targetVersion: '17.2', decision: 'ask', updatedAt: '' });
    const index = buildCommandAvailability([{ skillId: 's1', name: 's.il', commands: ['save'] }]);
    const verdict = classifyCommand('save', index, undefined, store, '17.2');
    expect(verdict.decision).toBe('sync');
    expect(verdict.askConfirm).toBe(true);
  });
});

describe('planCrossVersionSync', () => {
  it('快捷键：通用命令同步、高版本 Skill 命令默认跳过、目标独有保留', () => {
    const sourceBindings = [
      { id: 'b1', key: 'F2', command: 'save' },
      { id: 'b2', key: 'F3', command: 'high_only' },
    ];
    const targetBindings = [
      { id: 'tb1', key: 'F2', command: 'save' },
      { id: 'tb2', key: 'F9', command: 'target_extra' },
    ];
    const targetCommands = buildCommandAvailability([{ skillId: 'ts', name: 'target.il', commands: ['target_extra'] }]);
    const sourceCommands = buildCommandAvailability([{ skillId: 'ss', name: 'source.il', commands: ['high_only'] }]);
    const plan = planCrossVersionSync(baseInput({
      targetCommands,
      sourceCommands,
      sourceHotkey: hotkey(sourceBindings),
      targetHotkey: hotkey(targetBindings),
    }));

    const decisions = plan.items
      .filter((item) => item.kind === 'hotkey')
      .map((item) => ({ ref: item.ref, decision: item.decision }));
    expect(decisions).toContainEqual({ ref: 'funckey:F2', decision: 'sync' });
    expect(decisions).toContainEqual({ ref: 'funckey:F3', decision: 'skip_ver' });
    expect(decisions).toContainEqual({ ref: 'funckey:F9', decision: 'keep_target' });
    expect(plan.stats.sync).toBeGreaterThanOrEqual(1);
    expect(plan.stats.skip_ver).toBeGreaterThanOrEqual(1);
    expect(plan.stats.keep_target).toBeGreaterThanOrEqual(1);
  });

  it('Skill：目标有同名 Skill（名称匹配）→ 同步；仅源版本存在 → 跳过', () => {
    const sourceCommands = buildCommandAvailability([]);
    const plan = planCrossVersionSync(baseInput({
      sourceCommands,
      sourceSkill: skill([
        { skillId: 'src_drc', skillName: 'drc_helper.il' },
        { skillId: 'src_only', skillName: '17.4_only.il' },
      ]),
      targetSkill: skill([
        { skillId: 'tgt_drc', skillName: 'drc_helper.il' },
        { skillId: 'tgt_extra', skillName: 'target_extra.il' },
      ]),
    }));

    const skillItems = plan.items.filter((item) => item.kind === 'skill');
    const drc = skillItems.find((item) => item.ref === 'tgt_drc')!;
    expect(drc.decision).toBe('sync');
    expect(drc.sourceValue).toMatchObject({ skillId: 'src_drc' });

    const only = skillItems.find((item) => item.command === '17.4_only.il')!;
    expect(only.decision).toBe('skip_ver');

    const extra = skillItems.find((item) => item.command === 'target_extra.il')!;
    expect(extra.decision).toBe('keep_target');
  });

  it('菜单：子菜单无条件同步，命令项按可用性分类，目标独有保留', () => {
    const targetCommands = buildCommandAvailability([{ skillId: 'ts', name: 't.il', commands: ['common_cmd'] }]);
    const sourceCommands = buildCommandAvailability([{ skillId: 'ss', name: 's.il', commands: ['hi_only'] }]);
    const plan = planCrossVersionSync(baseInput({
      targetCommands,
      sourceCommands,
      sourceMenu: menu([
        { id: 'm1', label: '工具', type: 'menu', path: ['工具'], order: 1, enabled: true, visible: true, menuSource: 'atm' as const, status: 'normal' },
        { id: 'm2', label: '常用', type: 'command', path: ['工具', '常用'], order: 2, command: 'common_cmd', enabled: true, visible: true, menuSource: 'atm' as const, status: 'normal' },
        { id: 'm3', label: '高级', type: 'command', path: ['工具', '高级'], order: 3, command: 'hi_only', enabled: true, visible: true, menuSource: 'atm' as const, status: 'normal' },
      ]),
      targetMenu: menu([
        { id: 't1', label: '工具', type: 'menu', path: ['工具'], order: 1, enabled: true, visible: true, menuSource: 'atm' as const, status: 'normal' },
        { id: 't2', label: '旧命令', type: 'command', path: ['工具', '旧命令'], order: 2, command: 'legacy', enabled: true, visible: true, menuSource: 'atm' as const, status: 'normal' },
      ]),
    }));

    const menuItems = plan.items.filter((item) => item.kind === 'menu');
    expect(menuItems.find((item) => item.ref === '工具')!.decision).toBe('sync');
    expect(menuItems.find((item) => item.ref === '工具 > 常用')!.decision).toBe('sync');
    expect(menuItems.find((item) => item.ref === '工具 > 高级')!.decision).toBe('skip_ver');
    expect(menuItems.find((item) => item.ref === '工具 > 旧命令')!.decision).toBe('keep_target');
  });

  it('源没有方案内容时 blocked', () => {
    const plan = planCrossVersionSync(baseInput({}));
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toContain('源环境');
  });

  it('源方案对象存在但内容为空时 blocked 并提示先保存方案', () => {
    const plan = planCrossVersionSync(baseInput({
      sourceHotkey: hotkey([]),
      sourceSkill: skill([]),
      sourceMenu: menu([]),
    }));
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toContain('内容为空');
  });
});
