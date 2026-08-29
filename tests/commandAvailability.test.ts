/**
 * 命令可用性构建与查询测试（V6.4，真实数据校准）
 */
import { describe, expect, it } from 'vitest';
import {
  baseCommandOf,
  buildCommandAvailability,
  defaultKnownCommands,
  loadKnownCommandSet,
  normalizeWholeCommand,
  queryCommandAvailability,
} from '../core/sync/commandAvailability';

describe('baseCommandOf / normalizeWholeCommand', () => {
  it('分号分隔的多命令串取第一个词为基础命令', () => {
    expect(baseCommandOf('prepopup;pop singletrace')).toBe('prepopup');
    expect(baseCommandOf('angle 90;pop viapattern next')).toBe('angle');
    expect(baseCommandOf('snp')).toBe('snp');
  });

  it('整串归一化去除引号分号和多余空白', () => {
    expect(normalizeWholeCommand(' shape edit boundary;pop ')).toBe('shape edit boundary pop');
  });
});

describe('loadKnownCommandSet / defaultKnownCommands', () => {
  it('命令字典包含常见命令（cvn / snp）与多词命令（shape edit）', () => {
    const known = loadKnownCommandSet();
    expect(known.has('cvn')).toBe(true);
    expect(known.has('snp')).toBe(true);
    expect(known.has('shape edit')).toBe(true);
  });

  it('默认集为内置表与字典的并集', () => {
    const known = defaultKnownCommands();
    expect(known.has('save')).toBe(true);
    expect(known.has('cvn')).toBe(true);
  });
});

describe('buildCommandAvailability / queryCommandAvailability', () => {
  it('Skill 文件名主干（snp.il → snp）作为命令入口', () => {
    const index = buildCommandAvailability(
      [{ skillId: 'snp_dir', name: 'snp.il', commands: [] }],
      new Set() as ReadonlySet<string>,
    );
    expect(queryCommandAvailability(index, 'snp').available).toBe(true);
    expect(queryCommandAvailability(index, 'snp').providers[0]).toMatchObject({
      scope: 'skill',
      skillId: 'snp_dir',
    });
  });

  it('多词内置命令按 1 词/2 词前缀命中（shape edit boundary → shape edit）', () => {
    const index = buildCommandAvailability([], new Set(['shape edit']) as ReadonlySet<string>);
    expect(queryCommandAvailability(index, 'shape edit boundary').available).toBe(true);
    // 单独 shape 未收录时，shape select 不应因 shape edit 的前缀而伪命中
    expect(queryCommandAvailability(index, 'shape select').available).toBe(false);
  });

  it('多命令串以第一个命令为准（angle 90;pop … → angle）', () => {
    const index = buildCommandAvailability([], new Set(['angle']) as ReadonlySet<string>);
    expect(queryCommandAvailability(index, 'angle 90;pop viapattern next').available).toBe(true);
  });
});
