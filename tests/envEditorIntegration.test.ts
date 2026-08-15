/**
 * ATM - Env 编辑器端到端集成测试
 *
 * 用临时 pcbenv 验证：解析 → 编辑 → applyEnvEditor 写入 → 统一历史记录 → 撤销还原。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyEnvEditor } from '../core/env/envApply';
import { applyPatch, parseEnvDocument } from '../core/env/envDocument';
import { loadApplyPlanHistory, undoLastChange } from '../core/apply/applyPlanEngine';

const tempDirs: string[] = [];

function createPcbenv(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function historyDir(pcbenv: string): string {
  return path.join(pcbenv, 'atm_generated', 'history');
}
function backupDir(pcbenv: string): string {
  return path.join(pcbenv, 'atm_generated', 'backups');
}

describe('Env 编辑器端到端', () => {
  it('修改 funckey 条目：写入后记录历史，可撤销还原', async () => {
    const pcbenv = createPcbenv('atm-env-editor-modify-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom fit\nalias zc zoom center\n';
    fs.writeFileSync(envPath, original, 'utf8');

    const doc = parseEnvDocument(original);
    const f2 = doc.entries.find((e) => e.key === 'F2');
    expect(f2).toBeDefined();
    const entries = applyPatch(doc.entries, { id: f2!.id, key: 'F3', value: 'zoom out' });

    const result = await applyEnvEditor({ filePath: envPath, entries, encoding: 'utf8', pcbenvPath: pcbenv });
    expect(result.success).toBe(true);

    const written = fs.readFileSync(envPath, 'utf8');
    expect(written).toContain('funckey F3 "zoom out"');
    expect(written).not.toContain('funckey F2');

    expect(loadApplyPlanHistory(historyDir(pcbenv))).toHaveLength(1);

    const undo = await undoLastChange(historyDir(pcbenv), backupDir(pcbenv));
    expect(undo.success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toBe(original);
  });

  it('新增 variable 条目：写入后撤销可移除新行', async () => {
    const pcbenv = createPcbenv('atm-env-editor-add-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom fit\n';
    fs.writeFileSync(envPath, original, 'utf8');

    const doc = parseEnvDocument(original);
    const entries = applyPatch(doc.entries, { id: 'new_1', type: 'variable', key: 'CDS_SITE', value: '/site' });

    const result = await applyEnvEditor({ filePath: envPath, entries, encoding: 'utf8', pcbenvPath: pcbenv });
    expect(result.success).toBe(true);

    const written = fs.readFileSync(envPath, 'utf8');
    expect(written).toContain('set CDS_SITE = /site');

    const undo = await undoLastChange(historyDir(pcbenv), backupDir(pcbenv));
    expect(undo.success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toBe(original);
  });

  it('注释删除条目：写入后撤销可还原原行', async () => {
    const pcbenv = createPcbenv('atm-env-editor-delete-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom fit\nalias zc zoom center\n';
    fs.writeFileSync(envPath, original, 'utf8');

    const doc = parseEnvDocument(original);
    const zc = doc.entries.find((e) => e.key === 'zc');
    expect(zc).toBeDefined();
    const entries = applyPatch(doc.entries, { id: zc!.id, deleted: true });

    const result = await applyEnvEditor({ filePath: envPath, entries, encoding: 'utf8', pcbenvPath: pcbenv });
    expect(result.success).toBe(true);

    const written = fs.readFileSync(envPath, 'utf8');
    expect(written).toContain('# alias zc zoom center');

    const undo = await undoLastChange(historyDir(pcbenv), backupDir(pcbenv));
    expect(undo.success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toBe(original);
  });

  it('连续两次编辑后，撤销只能回退最近一次', async () => {
    const pcbenv = createPcbenv('atm-env-editor-twice-');
    const envPath = path.join(pcbenv, 'env');
    const original = 'funckey F2 zoom fit\n';
    fs.writeFileSync(envPath, original, 'utf8');

    // 第一次：改为 F3
    let doc = parseEnvDocument(original);
    let f2 = doc.entries.find((e) => e.key === 'F2');
    let entries = applyPatch(doc.entries, { id: f2!.id, key: 'F3', value: 'zoom out' });
    expect((await applyEnvEditor({ filePath: envPath, entries, encoding: 'utf8', pcbenvPath: pcbenv })).success).toBe(true);

    // 第二次：再改为 F4
    doc = parseEnvDocument(fs.readFileSync(envPath, 'utf8'));
    const f3 = doc.entries.find((e) => e.key === 'F3');
    entries = applyPatch(doc.entries, { id: f3!.id, key: 'F4', value: 'zoom in' });
    expect((await applyEnvEditor({ filePath: envPath, entries, encoding: 'utf8', pcbenvPath: pcbenv })).success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toContain('funckey F4 "zoom in"');

    // 撤销最近一次 → 回到 F3
    expect((await undoLastChange(historyDir(pcbenv), backupDir(pcbenv))).success).toBe(true);
    expect(fs.readFileSync(envPath, 'utf8')).toContain('funckey F3 "zoom out"');
    expect(fs.readFileSync(envPath, 'utf8')).not.toContain('funckey F4');
  });
});
