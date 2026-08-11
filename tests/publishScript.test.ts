import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('GitHub 发布脚本', () => {
  it('先禁用 electron-builder 发布，再由 gh 串行上传三项资产', () => {
    const source = readFileSync(resolve('scripts/publish-github.mjs'), 'utf8');

    expect(source).toMatch(/electron-builder[\s\S]*'--publish', 'never'/);
    expect(source).not.toContain("'--publish', 'always'");
    expect(source).toContain("['release', 'create'");
    expect(source).toContain("['release', 'upload'");
    expect(source).toContain("'--clobber', ...assetPaths");
  });
});
