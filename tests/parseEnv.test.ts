/**
 * ATM - env 解析单元测试
 * 测试场景：
 *   1. 基础 funckey/alias 解析
 *   2. 中文注释和非 ASCII 字符兼容
 *   3. 已有 ATM 托管块识别
 *   4. 空格路径兼容
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseEnv } from '../core/parser/parseEnv';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures');

/** 读取测试样本文件 */
function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('parseEnv - 基础解析', () => {
  it('应正确解析基础 env 文件中的 funckey 和 alias', () => {
    const content = readFixture('env.basic');
    const result = parseEnv(content);

    // 验证行数
    expect(result.entries.length).toBeGreaterThan(0);

    // 验证 funckey 数量
    const funckeyEntries = result.entries.filter((e) => e.type === 'funckey');
    expect(funckeyEntries.length).toBe(7); // F1-F5, F8-F9

    // 验证特定 funckey
    const f8Entry = funckeyEntries.find((e) => e.key === 'F8');
    expect(f8Entry).toBeDefined();
    expect(f8Entry!.command).toBe('autoFanout');
    expect(f8Entry!.source).toBe('user_original');

    // 验证 alias 数量
    const aliasEntries = result.entries.filter((e) => e.type === 'alias');
    expect(aliasEntries.length).toBe(6); // zs, zc, zf, s, sa, rp

    // 验证特定 alias
    const zsEntry = aliasEntries.find((e) => e.key === 'zs');
    expect(zsEntry).toBeDefined();
    expect(zsEntry!.command).toBe('zoom selection');

    // 验证其他类型（注释、设置等）
    const commentEntries = result.entries.filter((e) => e.type === 'comment');
    expect(commentEntries.length).toBeGreaterThan(0);

    const rawEntries = result.entries.filter((e) => e.type === 'raw');
    expect(rawEntries.length).toBeGreaterThan(0); // set 指令

    // 验证没有警告
    expect(result.warnings.length).toBe(0);
  });

  it('应正确解析中文注释和非 ASCII 字符', () => {
    const content = readFixture('env.chinese');
    const result = parseEnv(content);

    // 验证中文注释被保留
    const chineseComments = result.entries.filter(
      (e) => e.type === 'comment' && /[一-鿿]/.test(e.raw)
    );
    expect(chineseComments.length).toBeGreaterThan(0);

    // 验证中文注释内容保留
    const nameComment = chineseComments.find((c) => c.raw.includes('张三'));
    expect(nameComment).toBeDefined();

    // 验证 funckey 和 alias 解析不受影响
    const funckeyEntries = result.entries.filter((e) => e.type === 'funckey');
    expect(funckeyEntries.length).toBe(5); // F1, F2, F3, F8, F9

    const aliasEntries = result.entries.filter((e) => e.type === 'alias');
    expect(aliasEntries.length).toBe(4); // zs, zc, s, sa

    // 验证中文路径被保留
    const pathEntry = result.entries.find((e) => e.type === 'raw' && e.raw.includes('用户目录'));
    expect(pathEntry).toBeDefined();

    // 验证没有解析错误
    expect(result.warnings.length).toBe(0);
  });

  it('应正确识别 ATM 托管块', () => {
    const content = readFixture('env.with-anchor');
    const result = parseEnv(content);

    // 验证检测到托管块
    expect(result.hasManagedBlock).toBe(true);
    expect(result.managedBlockRange).toBeDefined();
    expect(result.managedBlockRange!.startLine).toBeGreaterThan(0);
    expect(result.managedBlockRange!.endLine).toBeGreaterThan(
      result.managedBlockRange!.startLine
    );

    // 验证块内的条目标记为 atm_managed
    const managedEntries = result.entries.filter((e) => e.source === 'atm_managed');
    expect(managedEntries.length).toBeGreaterThan(0);

    // 验证块外的条目标记为 user_original
    const originalEntries = result.entries.filter((e) => e.source === 'user_original');
    expect(originalEntries.length).toBeGreaterThan(0);

    // 验证块内的 funckey
    const managedFunckey = managedEntries.find(
      (e) => e.type === 'funckey' && e.key === 'F8'
    );
    expect(managedFunckey).toBeDefined();
    expect(managedFunckey!.source).toBe('atm_managed');
  });

  it('应正确解析含空格路径的 env 文件', () => {
    const content = readFixture('env.spaces');
    const result = parseEnv(content);

    // 验证解析不报错
    expect(result.warnings.length).toBe(0);

    // 验证 funckey 解析正常
    const funckeyEntries = result.entries.filter((e) => e.type === 'funckey');
    expect(funckeyEntries.length).toBe(3);

    // 验证 alias 解析正常
    const aliasEntries = result.entries.filter((e) => e.type === 'alias');
    expect(aliasEntries.length).toBe(3);

    // 验证含空格路径的 raw 行被保留
    const spacePathLine = result.entries.find(
      (e) => e.type === 'raw' && e.raw.includes('PCB User')
    );
    expect(spacePathLine).toBeDefined();
  });
});

describe('parseEnv - 空内容', () => {
  it('应正确处理空字符串', () => {
    const result = parseEnv('');
    expect(result.entries.length).toBe(0);
    expect(result.warnings.length).toBe(0);
    expect(result.hasManagedBlock).toBe(false);
  });

  it('应正确处理只有换行的内容', () => {
    const result = parseEnv('\n\n\n');
    const blankEntries = result.entries.filter((e) => e.type === 'blank');
    expect(blankEntries.length).toBe(3);
  });

  it('应正确处理只有注释的内容', () => {
    const content = '# just a comment\n; also a comment';
    const result = parseEnv(content);
    const commentEntries = result.entries.filter((e) => e.type === 'comment');
    expect(commentEntries.length).toBe(2);
  });
});

describe('parseEnv - 异常处理', () => {
  it('应处理未闭合的 ATM 托管块', () => {
    const content = [
      'funckey F1 add connect',
      '# ===== ATM Managed Hotkeys Start =====',
      'funckey F8 autoFanout',
      // 没有结束标记
    ].join('\n');

    const result = parseEnv(content);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('未正确闭合');
    expect(result.hasManagedBlock).toBe(true);
  });

  it('应处理无法解析的行但不崩溃', () => {
    const content = [
      'funckey F1 add connect',
      'some random text that is not a valid command',
      '!!! invalid line !!!',
      'alias s save',
    ].join('\n');

    const result = parseEnv(content);
    const rawEntries = result.entries.filter((e) => e.type === 'raw');
    expect(rawEntries.length).toBe(2);
    expect(result.warnings.length).toBe(0); // 无法解析的行不报 warning
  });
});
