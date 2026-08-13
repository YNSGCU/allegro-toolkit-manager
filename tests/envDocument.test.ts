/**
 * ATM - Env 可视化编辑器文档模型单元测试
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseEnvDocument,
  parseVariableLine,
  renderEnvDocument,
  applyPatch,
  buildEditSteps,
} from '../core/env/envDocument';

const FIXTURE = fs.readFileSync(
  path.join(__dirname, '..', 'test-fixtures', 'env-editor', 'sample.env'),
  'utf-8',
);

describe('parseEnvDocument - 解析', () => {
  it('应识别 funckey / alias / 变量 / 注释 / 空行 / 原始行', () => {
    const doc = parseEnvDocument(FIXTURE);
    const byType = (type: string) => doc.entries.filter((e) => e.type === type);

    expect(byType('funckey')).toHaveLength(1);
    expect(byType('alias')).toHaveLength(1);
    expect(byType('variable')).toHaveLength(3);
    expect(byType('comment')).toHaveLength(2);
    expect(byType('blank')).toHaveLength(1);
    expect(byType('raw')).toHaveLength(1);
  });

  it('应解析 funckey/alias 的键与命令', () => {
    const doc = parseEnvDocument(FIXTURE);
    const funckey = doc.entries.find((e) => e.type === 'funckey');
    expect(funckey?.key).toBe('F1');
    expect(funckey?.value).toBe('zoom fit');

    const alias = doc.entries.find((e) => e.type === 'alias');
    expect(alias?.key).toBe('zc');
    expect(alias?.value).toBe('zoom center');
  });

  it('应解析 set 变量的键与值，无值变量保留键', () => {
    const doc = parseEnvDocument(FIXTURE);
    const variables = doc.entries.filter((e) => e.type === 'variable');
    const pathVar = variables.find((e) => e.key === 'path');
    expect(pathVar?.value).toBe('. C:/work/lib');
    const emptyVar = variables.find((e) => e.key === 'EMPTY_VAR');
    expect(emptyVar?.value).toBeUndefined();
  });
});

describe('parseVariableLine - set 变量识别', () => {
  it('应识别带值与不带值的 set', () => {
    expect(parseVariableLine('set path = . lib')).toEqual({ key: 'path', value: '. lib' });
    expect(parseVariableLine('set EMPTY')).toEqual({ key: 'EMPTY', value: undefined });
    expect(parseVariableLine('SET Home = C:/x')).toEqual({ key: 'Home', value: 'C:/x' });
  });

  it('非 set 行应返回 null', () => {
    expect(parseVariableLine('funckey F1 move')).toBeNull();
    expect(parseVariableLine('raw command')).toBeNull();
  });
});

describe('renderEnvDocument - 序列化', () => {
  it('未修改文档应原样往返', () => {
    const doc = parseEnvDocument(FIXTURE);
    expect(renderEnvDocument(doc.entries)).toBe(FIXTURE.trimEnd());
  });

  it('编辑后的 funckey/alias 应重新生成，命令含空格自动加引号', () => {
    const doc = parseEnvDocument(FIXTURE);
    const alias = doc.entries.find((e) => e.type === 'alias')!;
    const updated = applyPatch(doc.entries, { id: alias.id, key: 'zs', value: 'zoom selection' });
    expect(renderEnvDocument(updated)).toContain('alias zs "zoom selection"');
  });

  it('删除条目应注释原行', () => {
    const doc = parseEnvDocument(FIXTURE);
    const funckey = doc.entries.find((e) => e.type === 'funckey')!;
    const updated = applyPatch(doc.entries, { id: funckey.id, deleted: true });
    expect(renderEnvDocument(updated)).toContain('# funckey F1 zoom fit  ; ATM: 注释删除');
    expect(renderEnvDocument(updated)).not.toContain('\nfunckey F1 zoom fit');
  });

  it('新增条目应追加到末尾', () => {
    const doc = parseEnvDocument(FIXTURE);
    const updated = applyPatch(doc.entries, { id: 'new_1', type: 'funckey', key: 'F2', value: 'move' });
    const rendered = renderEnvDocument(updated);
    expect(rendered.endsWith('funckey F2 move')).toBe(true);
  });
});

describe('buildEditSteps - 行级 diff', () => {
  it('应生成修改 / 删除 / 新增步骤', () => {
    const doc = parseEnvDocument(FIXTURE);
    const alias = doc.entries.find((e) => e.type === 'alias')!;
    const funckey = doc.entries.find((e) => e.type === 'funckey')!;

    let entries = applyPatch(doc.entries, { id: alias.id, key: 'zs', value: 'zoom selection' });
    entries = applyPatch(entries, { id: funckey.id, deleted: true });
    entries = applyPatch(entries, { id: 'new_1', type: 'variable', key: 'TEST', value: '1' });

    const steps = buildEditSteps(entries);
    expect(steps).toHaveLength(3);
    expect(steps.find((s) => s.opType === 'modify')?.before).toBe('alias zc zoom center');
    expect(steps.find((s) => s.opType === 'modify')?.after).toBe('alias zs "zoom selection"');
    expect(steps.find((s) => s.opType === 'delete')?.after).toContain('ATM: 注释删除');
    expect(steps.find((s) => s.opType === 'add')?.after).toBe('set TEST = 1');
  });

  it('无改动时应返回空步骤', () => {
    const doc = parseEnvDocument(FIXTURE);
    expect(buildEditSteps(doc.entries)).toEqual([]);
  });
});
