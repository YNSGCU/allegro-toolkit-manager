/**
 * ATM - Symphony 兼容体检测试
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractAxlFunctionCalls,
  checkSymphonyCompatibility,
} from '../core/symphony/symphonyCompatibility';
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

describe('extractAxlFunctionCalls', () => {
  it('应提取 AXL 调用并跳过注释与定义行', () => {
    const content = [
      '; axlDBOpen 注释中的调用不算',
      'procedure(axlMyHelper(x)',
      '  axlVisibleGet()',
      '  axlCNSDelete(db) ; 行尾注释',
      ')',
      'defun(myMain()',
      '  axlVisibleGet()',
      '  axlEnterPoint(nil)',
      ')',
    ].join('\n');

    const calls = extractAxlFunctionCalls(content, '/tmp/test.il');
    const names = calls.map((c) => c.functionName);
    expect(names).toContain('axlVisibleGet');
    expect(names).toContain('axlCNSDelete');
    expect(names).toContain('axlEnterPoint');
    // 定义行名称不算调用
    expect(names).not.toContain('axlMyHelper');
    // 同文件同函数去重按行保留（axlVisibleGet 两行都保留）
    expect(names.filter((n) => n === 'axlVisibleGet')).toHaveLength(2);
  });

  it('应为 U 类函数标记 category=U', () => {
    const calls = extractAxlFunctionCalls('axlCNSDelete(x)\naxlVisibleGet()', '/tmp/a.il');
    const byName = new Map(calls.map((c) => [c.functionName, c]));
    expect(byName.get('axlCNSDelete')?.category).toBe('U');
    expect(byName.get('axlVisibleGet')?.category).toBe('R');
  });
});

describe('checkSymphonyCompatibility', () => {
  it('应报告未登记命令与 U 类函数问题', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-check-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });

    const skillFile = path.join(pcbenv, 'my_tool.il');
    fs.writeFileSync(
      skillFile,
      'axlCmdRegister("my_tool" \'myToolRun)\nprocedure(myToolRun()\n  axlCNSDelete(nil)\n  axlVisibleGet()\n)\n',
      'utf-8',
    );
    const skill = makeSkill('s1', 'my_tool', skillFile, ['my_tool']);
    // 提供已登记命令表：my_tool 未登记
    const env = makeEnv(pcbenv, atmDir);

    const result = checkSymphonyCompatibility([skill], env);

    expect(result.stats.totalCommands).toBe(1);
    expect(result.stats.registeredCommands).toBe(0);
    expect(result.stats.unregisteredCommands).toBe(1);
    expect(result.stats.unsupportedAxCalls).toBe(1);
    expect(result.unsupportedCalls[0].functionName).toBe('axlCNSDelete');
    expect(result.unsupportedCalls[0].skillName).toBe('my_tool');
    expect(result.issues.some((i) => i.type === 'command_not_registered')).toBe(true);
    expect(result.issues.some((i) => i.type === 'unsupported_axl')).toBe(true);
  });

  it('应识别已登记命令（含 rw）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-check-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });
    const symphonyFile = path.join(pcbenv, 'symphony_skill.txt');
    fs.writeFileSync(symphonyFile, 'snp rw\nmy_tool\n', 'utf-8');

    const skillFile = path.join(pcbenv, 'my_tool.il');
    fs.writeFileSync(skillFile, 'axlCmdRegister("my_tool" \'myToolRun)\nprocedure(myToolRun()\n  t\n)\n', 'utf-8');
    const skill = makeSkill('s1', 'my_tool', skillFile, ['my_tool', 'snp']);
    const env = makeEnv(pcbenv, atmDir);

    const result = checkSymphonyCompatibility([skill], env);
    expect(result.symphonyFile.exists).toBe(true);
    expect(result.stats.registeredCommands).toBe(2);
    expect(result.stats.unregisteredCommands).toBe(0);
    const snpStatus = result.commandStatuses.find((c) => c.commandName === 'snp');
    expect(snpStatus?.rw).toBe(true);
    expect(result.issues.some((i) => i.type === 'command_not_registered')).toBe(false);
  });

  it('应提示菜单触发器缺失（bootstrap 未加载 generated_menu.il）', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-menu-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });
    fs.writeFileSync(path.join(atmDir, 'generated_menu.il'), 'axlUIMenuInsert(...)\n', 'utf-8');
    // bootstrap 存在但不加载菜单
    fs.writeFileSync(path.join(atmDir, 'bootstrap.il'), 'load("loader.il")\n', 'utf-8');

    const env = makeEnv(pcbenv, atmDir);
    const result = checkSymphonyCompatibility([], env);
    expect(result.issues.some((i) => i.type === 'menu_trigger_missing')).toBe(true);
    expect(result.issues.some((i) => i.type === 'menu_load_missing')).toBe(true);
  });

  it('菜单触发器齐全时不报菜单问题', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-menu-ok-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    const atmDir = path.join(root, 'atm_generated');
    fs.mkdirSync(pcbenv, { recursive: true });
    fs.mkdirSync(atmDir, { recursive: true });
    fs.writeFileSync(
      path.join(atmDir, 'generated_menu.il'),
      "axlTriggerSet('menu 'atmMenuOnLoad)\n",
      'utf-8',
    );
    fs.writeFileSync(
      path.join(atmDir, 'bootstrap.il'),
      'load("generated_menu.il")\n',
      'utf-8',
    );

    const env = makeEnv(pcbenv, atmDir);
    const result = checkSymphonyCompatibility([], env);
    expect(result.issues.some((i) => i.type === 'menu_trigger_missing')).toBe(false);
    expect(result.issues.some((i) => i.type === 'menu_load_missing')).toBe(false);
  });

  it('symphony 文件缺失时应给出提示', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-symphony-missing-'));
    tempDirs.push(root);
    const pcbenv = path.join(root, 'pcbenv');
    fs.mkdirSync(pcbenv, { recursive: true });
    const env = makeEnv(pcbenv, path.join(root, 'atm_generated'));
    const result = checkSymphonyCompatibility([], env);
    expect(result.symphonyFile.exists).toBe(false);
    expect(result.issues.some((i) => i.type === 'info')).toBe(true);
  });
});
