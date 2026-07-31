/**
 * ATM - 快捷键冲突检测单元测试
 * 测试场景：
 *   1. funckey 完全重复 → error
 *   2. alias 完全重复 → error
 *   3. alias 前缀关系 → warning
 *   4. 跨类型同名 → warning
 *   5. 空命令 → error
 *   6. 正常绑定 → normal
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseEnv } from '../core/parser/parseEnv';
import { validateHotkeys } from '../core/validator/validateHotkeys';

const FIXTURES_DIR = path.join(__dirname, '..', 'test-fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('validateHotkeys - funckey 重复检测', () => {
  it('应检测 funckey 完全相同按键重复为 error', () => {
    const content = readFixture('env.duplicate-funckey');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    // 应检测到 funckey 重复冲突
    const funckeyDuplicates = result.conflicts.filter(
      (c) => c.type === 'funckey_duplicate'
    );
    expect(funckeyDuplicates.length).toBeGreaterThanOrEqual(1);

    // 验证冲突包含 F8 和 F2
    const f8Conflict = funckeyDuplicates.find((c) =>
      c.message.includes('F8')
    );
    expect(f8Conflict).toBeDefined();
    expect(f8Conflict!.severity).toBe('error');

    const f2Conflict = funckeyDuplicates.find((c) =>
      c.message.includes('F2')
    );
    expect(f2Conflict).toBeDefined();
    expect(f2Conflict!.severity).toBe('error');

    // 验证相关绑定被标记
    const duplicateBindings = result.bindings.filter(
      (b) => b.status === 'duplicate'
    );
    expect(duplicateBindings.length).toBeGreaterThanOrEqual(2);
  });

  it('应不将正常 funckey 标记为冲突', () => {
    const content = readFixture('env.basic');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    const funckeyDuplicates = result.conflicts.filter(
      (c) => c.type === 'funckey_duplicate'
    );
    expect(funckeyDuplicates.length).toBe(0);

    // alias s/sa 会产生前缀警告（prefix_conflict），但不应该有 error 级别冲突
    const errorConflicts = result.conflicts.filter((c) => c.severity === 'error');
    expect(errorConflicts.length).toBe(0);
  });

  it('不做 funckey 前缀遮挡检测（s 和 sa 不冲突）', () => {
    // 手动构造：funckey s 和 funckey sa 不视为冲突
    const content = [
      'funckey s save',
      'funckey sa save_as',
    ].join('\n');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    // 不应有 funckey 冲突
    const funckeyDuplicates = result.conflicts.filter(
      (c) => c.type === 'funckey_duplicate'
    );
    expect(funckeyDuplicates.length).toBe(0);
  });
});

describe('validateHotkeys - alias 重复检测', () => {
  it('应检测 alias 完全相同别名重复为 error', () => {
    const content = readFixture('env.duplicate-alias');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    const aliasDuplicates = result.conflicts.filter(
      (c) => c.type === 'alias_duplicate'
    );
    expect(aliasDuplicates.length).toBeGreaterThanOrEqual(1);

    // 验证 zs 重复
    const zsConflict = aliasDuplicates.find((c) =>
      c.message.includes('zs')
    );
    expect(zsConflict).toBeDefined();
    expect(zsConflict!.severity).toBe('error');
  });

  it('alias 前缀关系应只产生低风险提示', () => {
    const content = readFixture('env.duplicate-alias');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    const prefixConflicts = result.conflicts.filter(
      (c) => c.type === 'alias_prefix'
    );
    // 可能检测到 ss/sss 前缀关系
    expect(prefixConflicts.length).toBeGreaterThanOrEqual(1);

    // 验证前缀冲突级别为 warning 而非 error
    for (const conflict of prefixConflicts) {
      expect(conflict.severity).toBe('warning');
    }

    // 验证前缀冲突绑定状态
    const prefixBindings = result.bindings.filter(
      (b) => b.status === 'prefix_conflict'
    );
    expect(prefixBindings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validateHotkeys - 跨类型相同名称', () => {
  it('应检测 funckey 和 alias 同名定义为 warning', () => {
    const content = [
      'funckey s save',
      'alias s save',
    ].join('\n');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    const crossConflicts = result.conflicts.filter(
      (c) => c.type === 'cross_type_same_name'
    );
    expect(crossConflicts.length).toBe(1);
    expect(crossConflicts[0].severity).toBe('warning');
    expect(crossConflicts[0].message).toContain('s');
  });
});

describe('validateHotkeys - 空命令', () => {
  it('应检测空命令为 error', () => {
    const content = [
      'funckey F8',
      'alias x',
    ].join('\n');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    const missingCommands = result.bindings.filter(
      (b) => b.status === 'missing_command'
    );
    expect(missingCommands.length).toBe(2);

    // 验证 F8 空命令
    const f8Missing = missingCommands.find((b) => b.key === 'F8');
    expect(f8Missing).toBeDefined();
    expect(f8Missing!.notes).toContain('命令为空');
  });
});

describe('validateHotkeys - 综合测试', () => {
  it('基础 env 文件应无冲突', () => {
    const content = readFixture('env.basic');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    // 应无 error 级别冲突
    const errors = result.conflicts.filter(
      (c) => c.severity === 'error'
    );
    expect(errors.length).toBe(0);

    // alias s/sa 会产生 prefix warning，这是预期的低风险提示
    const prefixWarnings = result.conflicts.filter(
      (c) => c.type === 'alias_prefix'
    );
    expect(prefixWarnings.length).toBeGreaterThanOrEqual(1);

    // 统计应正确
    expect(result.stats.total).toBe(13); // 7 funckey + 6 alias
    expect(result.stats.funckeyCount).toBe(7);
    expect(result.stats.aliasCount).toBe(6);
    expect(result.stats.errorCount).toBe(0);
    expect(result.stats.warningCount).toBe(prefixWarnings.length);
  });

  it('重复冲突时统计应正确', () => {
    const content = readFixture('env.duplicate-funckey');
    const parseResult = parseEnv(content);
    const result = validateHotkeys(parseResult.entries);

    expect(result.stats.errorCount).toBeGreaterThan(0);
  });

  it('空 entries 应返回空结果', () => {
    const result = validateHotkeys([]);
    expect(result.conflicts.length).toBe(0);
    expect(result.bindings.length).toBe(0);
    expect(result.stats.total).toBe(0);
  });
});
