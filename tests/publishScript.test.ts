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

  it('仓库名可自动从 git remote origin 推断，GH_TOKEN 缺省时使用 gh 登录凭据', () => {
    const source = readFileSync(resolve('scripts/publish-github.mjs'), 'utf8');

    expect(source).toMatch(/const resolvedRepo = repo \|\| inferRepoFromGit\(\)/);
    expect(source).toMatch(/git.*remote.*get-url.*origin/);
    expect(source).toContain('ghEnv = token ? { GH_TOKEN: token } : {}');
    expect(source).toContain("'--draft=false'");
    expect(source).toContain("'--latest'");
  });
});
