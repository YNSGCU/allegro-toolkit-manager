/**
 * 工作区跨模块引用一致性校验测试（V6.3）
 */
import { describe, expect, it } from 'vitest';
import { checkWorkspaceReferences } from '../core/workspace/workspaceReferenceCheck';

const scannedSkills = [
  {
    skillId: 'skill_smart_snap',
    name: 'smart_snap.il',
    commands: ['snp', 'snp_cmd'],
  },
  {
    skillId: 'skill_drc_helper',
    name: 'drc_helper.il',
    commands: ['drc_helper', 'drc_run'],
  },
];

describe('checkWorkspaceReferences', () => {
  it('内置命令与已启用 Skill 提供的命令不产生问题', () => {
    const result = checkWorkspaceReferences({
      hotkeyBindings: [
        { key: 'F2', command: 'save' },
        { key: 'F3', command: 'snp' },
      ],
      menuItems: [
        { path: '工具 > 吸附', command: 'snp_cmd' },
      ],
      enabledSkillIds: ['skill_smart_snap'],
      scannedSkills,
    });

    expect(result.issues).toHaveLength(0);
    expect(result.summary).toEqual({
      checked: 3,
      resolved: 2,
      builtin: 1,
      disabledProvider: 0,
      unresolved: 0,
    });
    expect(result.blocked).toBe(false);
  });

  it('命令仅由未启用的 Skill 提供时给出警告并标注提供者', () => {
    const result = checkWorkspaceReferences({
      hotkeyBindings: [
        { key: 'F4', command: 'drc_run' },
      ],
      enabledSkillIds: ['skill_smart_snap'],
      scannedSkills,
    });

    expect(result.issues).toHaveLength(1);
    const issue = result.issues[0];
    expect(issue.severity).toBe('warning');
    expect(issue.scope).toBe('hotkey');
    expect(issue.source).toBe('快捷键 F4');
    expect(issue.detail).toContain('drc_helper.il');
    expect(result.summary.disabledProvider).toBe(1);
  });

  it('多个 Skill 提供同一命令时只提示一次', () => {
    const result = checkWorkspaceReferences({
      menuItems: [{ path: '工具 > 运行', command: 'drc_run' }],
      enabledSkillIds: [],
      scannedSkills: [
        ...scannedSkills,
        { skillId: 'skill_b', name: 'b.il', commands: ['drc_run'] },
      ],
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].detail).toContain('drc_helper.il');
    expect(result.issues[0].detail).toContain('b.il');
    expect(result.summary.disabledProvider).toBe(1);
  });

  it('找不到提供者且非内置命令时给出警告', () => {
    const result = checkWorkspaceReferences({
      hotkeyBindings: [{ key: 'F5', command: 'no_such_cmd' }],
      enabledSkillIds: ['skill_smart_snap'],
      scannedSkills,
    });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('warning');
    expect(result.issues[0].detail).toContain('no_such_cmd');
    expect(result.summary.unresolved).toBe(1);
  });

  it('空命令（子菜单）与空绑定不参与校验', () => {
    const result = checkWorkspaceReferences({
      hotkeyBindings: [
        { key: '', command: '' },
        { key: 'F6', command: '   ' },
      ],
      menuItems: [
        { path: '工具', command: '' },
        { path: '文件', command: undefined },
      ],
      enabledSkillIds: [],
      scannedSkills,
    });

    expect(result.issues).toHaveLength(0);
    expect(result.summary.checked).toBe(0);
  });

  it('带参数的命令按基础命令匹配', () => {
    const result = checkWorkspaceReferences({
      hotkeyBindings: [{ key: 'F7', command: 'snp "arg1" 2' }],
      enabledSkillIds: ['skill_smart_snap'],
      scannedSkills,
    });

    expect(result.issues).toHaveLength(0);
    expect(result.summary.resolved).toBe(1);
  });
});
