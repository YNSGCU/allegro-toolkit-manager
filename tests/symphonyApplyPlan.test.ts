/**
 * ATM - Symphony 登记 Apply Plan 生成测试
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectSymphonyCommands,
  createSymphonyApplyPlan,
  getSymphonyFilePath,
} from '../core/symphony/symphonyApplyPlan';
import type { SkillFileItem } from '../src/types/skill';
import type { EnvironmentInfo } from '../src/types/environment';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeEnv(pcbenvPath: string, atmGeneratedPath: string): EnvironmentInfo {
  return {
    environmentId: 'env-test',
    homePath: pcbenvPath,
    pcbenvPath,
    envFilePath: path.join(pcbenvPath, 'env'),
    ilinitFilePath: path.join(pcbenvPath, 'allegro.ilinit'),
    atmGeneratedPath,
    envExists: true,
    envReadable: true,
    envWritable: true,
    ilinitExists: false,
    ilinitReadable: false,
    ilinitWritable: true,
    pcbenvExists: true,
    pcbenvWritable: true,
    detectedMode: 'local',
    warnings: [],
  };
}

function makeSkill(
  id: string,
  name: string,
  filePath: string,
  entryCommandNames: string[],
  enabled = true,
): SkillFileItem {
  return {
    id,
    name,
    path: filePath,
    dirPath: path.dirname(filePath),
    sourceType: 'user_skill',
    tier: 'user',
    readonly: false,
    writable: true,
    enabled,
    loadStatus: enabled ? 'loaded_configured' : 'disabled',
    parseStatus: 'ok',
    packageType: 'single_file',
    hasPackageJson: false,
    dependencies: [],
    totalFunctionCount: 1,
    entryCommands: entryCommandNames.map((cmdName, idx) => ({
      id: `${id}-cmd-${idx}`,
      name: cmdName,
      sourceSkillId: id,
      sourceFile: filePath,
      sourceSkillName: name,
      commandKind: 'axl_registered',
      isEntry: true,
      confidence: 'high',
      hotkeys: [],
      menuPaths: [],
      loadStatus: 'loaded_configured',
      conflictStatus: 'normal',
      tier: 'user',
      skillEnabled: enabled,
    })),
    internalFunctions: [],
    hotkeyRefs: [],
    menuRefs: [],
    functions: [],
  };
}

describe('collectSymphonyCommands', () => {
  it('应仅收集已启用 Skill 的入口命令并去重', () => {
    const enabled = makeSkill('s1', 'a', '/a.il', ['cmd_a', 'shared']);
    const disabled = makeSkill('s2', 'b', '/b.il', ['cmd_b'], false);
    const other = makeSkill('s3', 'c', '/c.il', ['shared']);
    const commands = collectSymphonyCommands([enabled, disabled, other]);
    const names = commands.map((c) => c.name);
    expect(names).toEqual(['cmd_a', 'shared']);
    expect(commands.every((c) => c.source === 'atm')).toBe(true);
  });

  it('rw 标记应作用于指定命令', () => {
    const skill = makeSkill('s1', 'a', '/a.il', ['cmd_a', 'cmd_b']);
    const commands = collectSymphonyCommands([skill], ['cmd_b']);
    expect(commands.find((c) => c.name === 'cmd_a')?.rw).toBe(false);
    expect(commands.find((c) => c.name === 'cmd_b')?.rw).toBe(true);
  });
});

describe('createSymphonyApplyPlan', () => {
  it('应生成备份 + 写入步骤', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-plan-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });
    const symphonyPath = path.join(pcbenv, 'symphony_skill.txt');
    fs.writeFileSync(symphonyPath, 'old_cmd\n', 'utf-8');

    const env = makeEnv(pcbenv, atmDir);
    const skill = makeSkill('s1', 'tool', path.join(pcbenv, 'tool.il'), ['tool_cmd']);
    const plan = createSymphonyApplyPlan(env, {
      skills: [skill],
      rwCommandNames: [],
      now: new Date('2026-01-01T00:00:00Z'),
    });

    expect(plan.operation).toBe('sync-symphony-file');
    expect(plan.requiresRestart).toBe(false);
    expect(plan.targetFiles).toContain(getSymphonyFilePath(env));
    // 备份步骤
    expect(plan.steps.some((s) => s.type === 'backup' && s.target === symphonyPath)).toBe(true);
    // 写入步骤
    const writeStep = plan.steps.find((s) => s.type === 'write_file' && s.target === symphonyPath);
    expect(writeStep).toBeDefined();
    expect(writeStep!.after).toContain('tool_cmd');
    expect(writeStep!.after).toContain('old_cmd'); // 保留既有条目
  });

  it('文件不存在时跳过备份并提示', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-plan-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });

    const env = makeEnv(pcbenv, atmDir);
    const plan = createSymphonyApplyPlan(env, {
      skills: [],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(plan.steps.some((s) => s.type === 'backup')).toBe(false);
    expect(plan.warnings.some((w) => w.message.includes('不存在'))).toBe(true);
  });

  it('syncSite 时增加站点级写入步骤', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-plan-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    const siteDir = path.join(root, 'site', 'PCB');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });

    const env = makeEnv(pcbenv, atmDir);
    const plan = createSymphonyApplyPlan(env, {
      skills: [],
      syncSite: true,
      sitePath: path.join(root, 'site'),
      now: new Date('2026-01-01T00:00:00Z'),
    });
    expect(plan.targetFiles).toContain(path.join(siteDir, 'symphony_skill.txt'));
    expect(
      plan.steps.some((s) => s.type === 'write_file' && s.target === path.join(siteDir, 'symphony_skill.txt')),
    ).toBe(true);
  });
});
