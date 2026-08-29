/**
 * 环境对前置校验测试（V6.4，M0）
 */
import { describe, expect, it } from 'vitest';
import { checkEnvironmentPair, isSamePcbenvDirectory } from '../core/sync/environmentPairCheck';

const src = { environmentId: 'a', version: '17.4', pcbenvPath: 'D:\\Cadence17\\SPB_Data\\pcbenv', homePath: 'D:\\Cadence17\\SPB_Data' };
const tgt = { environmentId: 'b', version: '17.2', pcbenvPath: 'D:\\Cadence17_2\\SPB_Data\\pcbenv', homePath: 'D:\\Cadence17_2\\SPB_Data' };

describe('isSamePcbenvDirectory', () => {
  it('大小写与尾斜杠不敏感', () => {
    expect(isSamePcbenvDirectory(src, { ...tgt, pcbenvPath: 'd:\\cadence17\\spb_data\\pcbenv\\' })).toBe(true);
  });

  it('pcbenvPath 不同则不同目录', () => {
    expect(isSamePcbenvDirectory(src, tgt)).toBe(false);
  });
});

describe('checkEnvironmentPair', () => {
  it('独立目录 + 不同版本 + 都存在 → 通过', () => {
    const result = checkEnvironmentPair({ source: src, target: tgt, sourceExists: true, targetExists: true });
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('同一目录直接阻塞', () => {
    const same = { ...tgt, pcbenvPath: src.pcbenvPath };
    const result = checkEnvironmentPair({ source: src, target: same, sourceExists: true, targetExists: true });
    expect(result.ok).toBe(false);
    expect(result.sameDirectory).toBe(true);
    expect(result.issues.join('')).toContain('同一 pcbenv');
  });

  it('同版本阻塞', () => {
    const sameVersion = { ...tgt, version: '17.4' };
    const result = checkEnvironmentPair({ source: src, target: sameVersion, sourceExists: true, targetExists: true });
    expect(result.ok).toBe(false);
    expect(result.sameVersion).toBe(true);
    expect(result.issues.join('')).toContain('同一 Allegro 版本');
  });

  it('目标目录缺失给出原因', () => {
    const result = checkEnvironmentPair({ source: src, target: tgt, sourceExists: true, targetExists: false });
    expect(result.ok).toBe(false);
    expect(result.issues.join('')).toContain('目标环境目录不存在');
  });

  it('缺少 pcbenv 路径给出原因', () => {
    const result = checkEnvironmentPair({
      source: src,
      target: { environmentId: 'b', version: '17.2' },
      sourceExists: true,
      targetExists: true,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.join('')).toContain('目标环境缺少 pcbenv');
  });
});
