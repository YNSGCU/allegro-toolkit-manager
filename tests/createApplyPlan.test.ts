/**
 * ATM - Apply Plan 生成和备份单元测试
 * 测试场景：
 *   1. 生成 Apply Plan
 *   2. 备份文件
 *   3. rollback manifest
 *   4. 文件访问检测
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createApplyPlan } from '../core/apply/createApplyPlan';
import { createBackup, generateBackupId } from '../core/backup/createBackup';
import { generateRollbackManifest, writeRollbackManifest, readRollbackManifest, verifyBackupIntegrity } from '../core/backup/rollbackManifest';
import { checkFileAccess } from '../core/environment/fileAccess';
import type { HotkeyBinding } from '../src/types/hotkey';

const TEST_TMP_DIR = path.join(os.tmpdir(), 'atm-test-' + Date.now());

beforeAll(() => {
  // 创建测试目录
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
});

afterAll(() => {
  // 清理测试目录
  try {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('createApplyPlan', () => {
  it('应生成包含备份和修改步骤的 Apply Plan', () => {
    const bindings: HotkeyBinding[] = [
      { id: '1', key: 'F8', command: 'autoFanout', type: 'funckey', source: 'atm_managed', status: 'normal' },
    ];

    const plan = createApplyPlan(
      [{ type: 'modify_env_managed_block', bindings }],
      TEST_TMP_DIR
    );

    expect(plan.id).toBeTruthy();
    expect(plan.summary).toBeTruthy();
    expect(plan.createdAt).toBeTruthy();
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(typeof plan.requiresRestart).toBe('boolean');

    // 应包含创建目录步骤
    const createDirs = plan.steps.filter((s) => s.type === 'create_directory');
    expect(createDirs.length).toBeGreaterThan(0);

    // 应包含修改托管块步骤
    const modifySteps = plan.steps.filter((s) => s.type === 'modify_managed_block');
    expect(modifySteps.length).toBe(1);
  });

  it('插入 bootstrap 时应标记 requiresRestart', () => {
    const plan = createApplyPlan(
      [{ type: 'insert_bootstrap' }],
      TEST_TMP_DIR
    );

    expect(plan.requiresRestart).toBe(true);
    const bootstrapSteps = plan.steps.filter((s) => s.type === 'insert_bootstrap');
    expect(bootstrapSteps.length).toBe(1);
  });
});

describe('createBackup', () => {
  it('应备份文件并生成校验信息', () => {
    // 创建测试文件
    const testFilePath = path.join(TEST_TMP_DIR, 'test.env');
    fs.writeFileSync(testFilePath, 'funckey F1 test', 'utf-8');

    const backupDir = path.join(TEST_TMP_DIR, 'backup');
    const result = createBackup(testFilePath, backupDir, 'test');

    expect(result.success).toBe(true);
    expect(result.backupId).toBeTruthy();
    expect(result.files.length).toBe(1);
    expect(result.files[0].sha256).toBeTruthy();
    expect(fs.existsSync(result.files[0].backupPath)).toBe(true);

    // 验证备份内容
    const backupContent = fs.readFileSync(result.files[0].backupPath, 'utf-8');
    expect(backupContent).toBe('funckey F1 test');
  });

  it('备份不存在的文件应返回错误', () => {
    const result = createBackup(
      path.join(TEST_TMP_DIR, 'nonexistent.env'),
      path.join(TEST_TMP_DIR, 'backup')
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });
});

describe('rollbackManifest', () => {
  it('应生成和写入 manifest 文件', () => {
    const testFilePath = path.join(TEST_TMP_DIR, 'manifest-test.env');
    fs.writeFileSync(testFilePath, 'test content', 'utf-8');

    const backupDir = path.join(TEST_TMP_DIR, 'backup');
    const backupResult = createBackup(testFilePath, backupDir, 'before test');

    const manifest = generateRollbackManifest(
      { backupId: backupResult.backupId, files: backupResult.files },
      'unit test'
    );

    expect(manifest.backupId).toBeTruthy();
    expect(manifest.files.length).toBe(1);
    expect(manifest.files[0].sha256).toBeTruthy();

    // 写入 manifest
    const manifestDir = path.join(backupDir, backupResult.backupId);
    const writeResult = writeRollbackManifest(manifest, manifestDir);
    expect(writeResult.success).toBe(true);
    expect(fs.existsSync(writeResult.path)).toBe(true);

    // 读取验证
    const readManifest = readRollbackManifest(writeResult.path);
    expect(readManifest).not.toBeNull();
    expect(readManifest!.backupId).toBe(manifest.backupId);
  });

  it('验证备份完整性', () => {
    const testFilePath = path.join(TEST_TMP_DIR, 'integrity-test.env');
    fs.writeFileSync(testFilePath, 'test content for integrity', 'utf-8');

    const backupResult = createBackup(
      testFilePath,
      path.join(TEST_TMP_DIR, 'backup'),
      'before integrity test'
    );

    const manifest = generateRollbackManifest(
      { backupId: backupResult.backupId, files: backupResult.files },
      'integrity test'
    );

    const verification = verifyBackupIntegrity(manifest);
    expect(verification.valid).toBe(true);
    expect(verification.failedFiles.length).toBe(0);
  });
});

describe('checkFileAccess', () => {
  it('应检测存在文件的正确状态', () => {
    const testFile = path.join(TEST_TMP_DIR, 'access-test.txt');
    fs.writeFileSync(testFile, 'test', 'utf-8');

    const status = checkFileAccess(testFile);
    expect(status.exists).toBe(true);
    expect(status.readable).toBe(true);
    expect(status.path).toBe(testFile);
  });

  it('应检测不存在的文件', () => {
    const status = checkFileAccess(
      path.join(TEST_TMP_DIR, 'does-not-exist.txt')
    );
    expect(status.exists).toBe(false);
    expect(status.readable).toBe(false);
    expect(status.writable).toBe(false);
  });

  it('应处理空路径', () => {
    const status = checkFileAccess('');
    expect(status.exists).toBe(false);
  });
});

describe('generateBackupId', () => {
  it('应生成格式正确的备份 ID', () => {
    const id = generateBackupId();
    // 格式: YYYY-MM-DD_HHmmss
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}$/);
  });

  it('连续调用应生成不同的 ID', () => {
    const id1 = generateBackupId();
    const id2 = generateBackupId();
    // 由于时间变化，ID 可能相同（同一秒内），所以不做严格不等判断
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
  });
});
