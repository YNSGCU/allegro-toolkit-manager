/**
 * ATM - Env 编辑器 Apply Plan 集成测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseEnvDocument, applyPatch } from '../core/env/envDocument';
import { applyEnvEditor } from '../core/env/envApply';

let tempRoot: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-env-editor-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function setupEnv(content: string): { pcbenvPath: string; envFilePath: string } {
  const pcbenvPath = path.join(tempRoot, 'pcbenv');
  fs.mkdirSync(pcbenvPath, { recursive: true });
  const envFilePath = path.join(pcbenvPath, 'env');
  fs.writeFileSync(envFilePath, content, 'utf-8');
  return { pcbenvPath, envFilePath };
}

describe('applyEnvEditor - 写入链路', () => {
  it('应通过 Apply Plan 写入编辑后的 env，并创建备份与历史', async () => {
    const original = [
      'funckey F1 zoom fit',
      'alias zc zoom center',
      'set path = . lib',
    ].join('\n');
    const { pcbenvPath, envFilePath } = setupEnv(original);

    const doc = parseEnvDocument(original);
    const alias = doc.entries.find((e) => e.type === 'alias')!;
    const entries = applyPatch(doc.entries, { id: alias.id, key: 'zs', value: 'zoom selection' });

    const result = await applyEnvEditor({
      filePath: envFilePath,
      entries,
      encoding: 'utf8',
      pcbenvPath,
    });

    expect(result.success).toBe(true);
    expect(result.appliedSteps).toBe(result.totalSteps);

    const updated = fs.readFileSync(envFilePath, 'utf-8');
    expect(updated).toContain('alias zs "zoom selection"');
    expect(updated).toContain('funckey F1 zoom fit');

    const backupDir = path.join(pcbenvPath, 'atm_generated', 'backup');
    expect(fs.existsSync(backupDir)).toBe(true);
    const backupFiles = fs.readdirSync(backupDir, { recursive: true });
    expect(backupFiles.length).toBeGreaterThan(0);

    const historyFile = path.join(pcbenvPath, 'atm_generated', 'history', 'apply_plan_history.json');
    expect(fs.existsSync(historyFile)).toBe(true);
    const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    expect(history).toHaveLength(1);
    expect(history[0].module).toBe('environment');
  });

  it('应记录目标文件且保持 UTF-8 编码', async () => {
    const original = '# 中文注释\nfunckey F1 zoom fit\n';
    const { pcbenvPath, envFilePath } = setupEnv(original);
    const doc = parseEnvDocument(original);
    const funckey = doc.entries.find((e) => e.type === 'funckey')!;
    const entries = applyPatch(doc.entries, { id: funckey.id, key: 'F2', value: 'move' });

    const result = await applyEnvEditor({
      filePath: envFilePath,
      entries,
      encoding: 'utf8',
      pcbenvPath,
    });

    expect(result.success).toBe(true);
    const updated = fs.readFileSync(envFilePath, 'utf-8');
    expect(updated).toContain('# 中文注释');
    expect(updated).toContain('funckey F2 move');
  });
});
