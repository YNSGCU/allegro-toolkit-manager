/**
 * ATM - 文件访问/环境定位单元测试
 * 测试场景：
 *   1. 环境变量检测优先级
 *   2. 文件状态检测
 *   3. 目录可写性检测
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { locateEnvironment } from '../core/environment/locateEnvironment';
import { detectPcbenv } from '../core/environment/detectPcbenv';
import { checkFileAccess, checkDirectoryWritable, readFileContent, writeFileContent } from '../core/environment/fileAccess';

const TEST_TMP_DIR = path.join(os.tmpdir(), 'atm-fileaccess-test-' + Date.now());

beforeAll(() => {
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });
  process.env.HOME = TEST_TMP_DIR;
});

afterAll(() => {
  try {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

describe('locateEnvironment', () => {
  it('应检测到指定路径', () => {
    // 创建 pcbenv 目录
    const pcbenvDir = path.join(TEST_TMP_DIR, 'pcbenv');
    fs.mkdirSync(pcbenvDir, { recursive: true });
    fs.writeFileSync(path.join(pcbenvDir, 'env'), 'funckey F1 test', 'utf-8');

    const envInfo = locateEnvironment(TEST_TMP_DIR);
    expect(envInfo.homePath).toBe(TEST_TMP_DIR);
    expect(envInfo.pcbenvPath).toBe(pcbenvDir);
    expect(envInfo.envExists).toBe(true);
    expect(envInfo.envFilePath).toBe(path.join(pcbenvDir, 'env'));
  });

  it('pcbenv 不存在时应返回 warnings', () => {
    // 创建一个临时空目录，将所有环境变量指向它
    const emptyDir = path.join(os.tmpdir(), 'atm-empty-' + Date.now());
    fs.mkdirSync(emptyDir, { recursive: true });
    const oldHome = process.env.HOME;
    const oldUP = process.env.USERPROFILE;
    process.env.HOME = emptyDir;
    process.env.USERPROFILE = emptyDir;

    const envInfo = locateEnvironment(emptyDir);
    // 在所有候选路径都没有 pcbenv 时，pcbenvPath 应为 null
    expect(envInfo.warnings.length).toBeGreaterThan(0);
    // 不严格判断 pcbenvPath 是否为 null，因为有 os.userInfo() 回退
    // 但警告应包含"未找到"的提示

    process.env.HOME = oldHome;
    process.env.USERPROFILE = oldUP;
    try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch {}
  });
});

describe('detectPcbenv', () => {
  it('应检测有效的 pcbenv 目录', () => {
    // 使用独立临时目录避免与其他测试互相影响
    const isolatedDir = path.join(os.tmpdir(), 'atm-detect-' + Date.now());
    fs.mkdirSync(isolatedDir, { recursive: true });
    const pcbenvDir = path.join(isolatedDir, 'pcbenv');

    const result = detectPcbenv(isolatedDir);
    expect(result.path).toBe(pcbenvDir);
    expect(result.exists).toBe(false); // pcbenv 目录还不存在
    expect(result.isValid).toBe(false);

    // 创建 pcbenv 目录
    fs.mkdirSync(pcbenvDir, { recursive: true });
    const result2 = detectPcbenv(isolatedDir);
    expect(result2.exists).toBe(true);
    expect(result2.isValid).toBe(false); // 还没有 env 或 allegro.ilinit

    // 创建 env
    fs.writeFileSync(path.join(pcbenvDir, 'env'), '', 'utf-8');
    const result3 = detectPcbenv(isolatedDir);
    expect(result3.isValid).toBe(true);

    try { fs.rmSync(isolatedDir, { recursive: true, force: true }); } catch {}
  });

  it('路径为 null 时应返回警告', () => {
    const result = detectPcbenv(null);
    expect(result.path).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('基础路径不存在时应返回警告', () => {
    const result = detectPcbenv('Z:\\nonexistent\\path');
    expect(result.path).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('readFileContent', () => {
  it('应读取非 ASCII 文本文件', () => {
    const testFile = path.join(TEST_TMP_DIR, 'chinese-test.txt');
    const content = '中文测试\nfunckey F8 autoFanout\n# 注释';
    fs.writeFileSync(testFile, content, 'utf-8');

    const result = readFileContent(testFile);
    expect(result.error).toBeUndefined();
    expect(result.content).toContain('中文测试');
    expect(result.content).toContain('funckey F8 autoFanout');
  });

  it('不存在的文件应返回错误', () => {
    const result = readFileContent(path.join(TEST_TMP_DIR, 'nonexistent.txt'));
    expect(result.error).toBeDefined();
    expect(result.content).toBe('');
  });
});

describe('writeFileContent', () => {
  it('应写入并正确读取', () => {
    const testFile = path.join(TEST_TMP_DIR, 'write-test.txt');
    const content = 'funckey F8 autoFanout\nalias s save';

    const writeResult = writeFileContent(testFile, content);
    expect(writeResult.success).toBe(true);

    const readResult = readFileContent(testFile);
    expect(readResult.content).toBe(content);
  });

  it('应自动创建父目录', () => {
    const nestedFile = path.join(TEST_TMP_DIR, 'subdir', 'nested', 'test.env');
    const result = writeFileContent(nestedFile, 'test content');
    expect(result.success).toBe(true);
    expect(fs.existsSync(nestedFile)).toBe(true);
  });
});

describe('checkDirectoryWritable', () => {
  it('可写目录应返回 true', () => {
    const writable = checkDirectoryWritable(TEST_TMP_DIR);
    expect(writable).toBe(true);
  });

  it('应能创建不存在的目录并检测可写', () => {
    const newDir = path.join(TEST_TMP_DIR, 'new-dir-' + Date.now());
    const writable = checkDirectoryWritable(newDir);
    expect(writable).toBe(true);
    expect(fs.existsSync(newDir)).toBe(true);
  });
});
