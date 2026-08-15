/**
 * ATM - Vibe Bridge 串行化集成测试
 *
 * 用真实临时 workspace + 假桥接服务验证：
 *   1. 并发请求被串行化，各自返回自己的结果（不串扰）；
 *   2. 进入请求前清空旧输出，避免读到残留结果。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeSkillViaBridge } from '../core/color/vibeColorBridge';

const tempDirs: string[] = [];

function startFakeBridge(workspace: string, respondDelayMs = 15): () => void {
  const inputPath = path.join(workspace, 'vibe_in.il');
  const outputPath = path.join(workspace, 'vibe_out.log');
  let processed = '';
  const timer = setInterval(() => {
    try {
      if (!fs.existsSync(inputPath)) return;
      const code = fs.readFileSync(inputPath, 'utf-8');
      if (code === processed) return;
      processed = code;
      setTimeout(() => {
        try {
          fs.writeFileSync(outputPath, 'SUCCESS ' + code.trim(), 'utf-8');
        } catch {
          // 目录已被清理时忽略
        }
      }, respondDelayMs);
    } catch {
      // 忽略
    }
  }, 5);
  return () => clearInterval(timer);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('executeSkillViaBridge 串行化', () => {
  it('并发请求串行执行，各自返回自己的结果', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-bridge-serial-'));
    tempDirs.push(workspace);
    const stop = startFakeBridge(workspace);

    try {
      const [a, b] = await Promise.all([
        executeSkillViaBridge(workspace, 'alpha', 3000),
        executeSkillViaBridge(workspace, 'beta', 3000),
      ]);
      expect(a.success).toBe(true);
      expect(a.output).toBe('alpha');
      expect(b.success).toBe(true);
      expect(b.output).toBe('beta');
    } finally {
      stop();
    }
  });

  it('进入请求前清空旧输出，不会读到残留结果', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-bridge-stale-'));
    tempDirs.push(workspace);
    // 预置一个残留输出，模拟上一次请求遗留的旧结果
    fs.writeFileSync(path.join(workspace, 'vibe_out.log'), 'SUCCESS stale', 'utf-8');

    const stop = startFakeBridge(workspace);
    try {
      const result = await executeSkillViaBridge(workspace, 'fresh', 3000);
      expect(result.success).toBe(true);
      expect(result.output).toBe('fresh');
      expect(result.output).not.toBe('stale');
    } finally {
      stop();
    }
  });

  it('无桥接服务时超时，并清空输出文件', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-bridge-timeout-'));
    tempDirs.push(workspace);
    const outputPath = path.join(workspace, 'vibe_out.log');
    fs.writeFileSync(outputPath, 'SUCCESS stale', 'utf-8');

    const result = await executeSkillViaBridge(workspace, 'nobody-home', 80);
    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');
    expect(fs.existsSync(outputPath)).toBe(false);
  });
});
