import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  executeEditPlan,
  generateAddPlan,
  generateEditPlan,
} from '../core/apply/hotkeyEditPlan';
import { undoLastChange } from '../core/changeHistory/changeHistory';
import type { EnvEntry, HotkeyBinding, HotkeyProfile } from '../src/types/hotkey';

const tempDirs: string[] = [];

function createPcbenv(): { pcbenv: string; envPath: string } {
  const pcbenv = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-hotkey-edit-'));
  tempDirs.push(pcbenv);
  const envPath = path.join(pcbenv, 'env');
  fs.writeFileSync(envPath, 'funckey F8 "zoom fit"\r\n', 'utf8');
  return { pcbenv, envPath };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('快捷键编辑计划', () => {
  it('修改 env 原始行时保留 CRLF，并拒绝覆盖外部变化', () => {
    const { envPath } = createPcbenv();
    const binding = {
      id: 'env-1',
      type: 'funckey',
      key: 'F8',
      command: 'zoom fit',
      bindingSource: 'user_env_original',
      status: 'normal',
      lineNumber: 1,
    } satisfies HotkeyBinding;
    const entries: EnvEntry[] = [{
      type: 'funckey',
      key: 'F8',
      command: 'zoom fit',
      raw: 'funckey F8 "zoom fit"',
      lineNumber: 1,
      source: 'user_original',
    }];
    const plan = generateEditPlan({
      bindingId: binding.id,
      key: 'F9',
      command: 'move',
      type: 'funckey',
    }, binding, envPath, entries);

    expect(executeEditPlan(plan, envPath, entries).success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toBe('funckey F9 move\r\n');

    const stalePlan = generateEditPlan({
      bindingId: binding.id,
      key: 'F10',
      command: 'copy',
      type: 'funckey',
    }, binding, envPath, [{ ...entries[0], raw: 'funckey F9 move' }]);
    fs.writeFileSync(envPath, 'funckey F9 delete\r\n', 'utf8');
    const staleResult = executeEditPlan(stalePlan, envPath, entries);
    expect(staleResult.success).toBe(false);
    expect(staleResult.error).toContain('已被外部修改');
    expect(fs.readFileSync(envPath, 'utf8')).toBe('funckey F9 delete\r\n');
  });

  it('真实更新方案绑定的键位、命令、状态和备注，并支持撤销', () => {
    const { pcbenv, envPath } = createPcbenv();
    const profileDir = path.join(pcbenv, 'atm_generated', 'profiles');
    const profilePath = path.join(profileDir, 'profile-a.profile.json');
    fs.mkdirSync(profileDir, { recursive: true });
    const profile: HotkeyProfile = {
      id: 'profile-a',
      name: '方案 A',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      bindings: [{
        id: 'binding-a',
        key: 'm',
        command: 'move',
        type: 'funckey',
        enabled: true,
        note: '旧备注',
      }],
    };
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    const materialized = {
      id: 'profile:profile-a:binding-a',
      key: 'm',
      command: 'move',
      type: 'funckey',
      bindingSource: 'active_profile',
      status: 'normal',
      profileId: 'profile-a',
      enabled: true,
    } satisfies HotkeyBinding;

    const plan = generateEditPlan({
      bindingId: materialized.id,
      key: 'M',
      command: 'mirror',
      type: 'funckey',
      enabled: false,
      note: '镜像操作',
      profileId: 'profile-a',
    }, materialized, envPath, [], profilePath);
    const result = executeEditPlan(plan, envPath, []);

    expect(result.success).toBe(true);
    expect(JSON.parse(fs.readFileSync(profilePath, 'utf8')).bindings[0]).toMatchObject({
      key: 'M',
      command: 'mirror',
      enabled: false,
      note: '镜像操作',
    });
    expect(undoLastChange(pcbenv).success).toBe(true);
    expect(JSON.parse(fs.readFileSync(profilePath, 'utf8')).bindings[0].command).toBe('move');
  });

  it('只读来源不会生成空计划或假成功', () => {
    const { envPath } = createPcbenv();
    const readonlyBinding = {
      id: 'skill-1',
      key: 'F8',
      command: 'skillCommand',
      type: 'funckey',
      bindingSource: 'skill_direct',
      status: 'reserved',
      editable: false,
    } satisfies HotkeyBinding;

    expect(() => generateEditPlan({
      bindingId: readonlyBinding.id,
      key: 'F9',
      command: 'skillCommand',
    }, readonlyBinding, envPath, [])).toThrow('只读');
  });

  it('新增和编辑都拒绝覆盖同类型的已有键位', () => {
    const { envPath } = createPcbenv();
    const entries: EnvEntry[] = [{
      type: 'funckey',
      key: 'F8',
      command: 'zoom fit',
      raw: 'funckey F8 "zoom fit"',
      lineNumber: 1,
      source: 'user_original',
    }];
    expect(() => generateAddPlan('f8', 'move', 'funckey', envPath, entries)).toThrow('已在 env');
  });
});
