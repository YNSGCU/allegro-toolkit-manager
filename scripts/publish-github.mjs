/**
 * ATM - 一键发布到 GitHub Releases 并生成软件内更新
 *
 * 用法：
 *   $env:ATM_GH_REPO="owner/repo"   # GitHub 仓库，如 myorg/allegro-toolkit
 *   $env:GH_TOKEN="ghp_xxx"          # 有 repo 写权限的 Personal Access Token
 *   npm run publish:github
 *
 * 流程：
 *   1. 完整构建（Electron + 前端）
 *   2. electron-builder 只负责打包 NSIS 安装包和更新元数据
 *   3. gh 串行创建/更新 GitHub Release，上传 latest.yml + exe + blockmap
 *   4. 安装包内置 atmUpdateFeedUrl，装完软件即自动配好更新源
 *
 * 软件端更新源指向：
 *   https://github.com/{owner}/{repo}/releases/latest/download
 * （electron-updater generic provider 会请求该目录下的 latest.yml）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)),
);

const repo = process.env.ATM_GH_REPO?.trim() || '';
const token = process.env.GH_TOKEN?.trim() || '';

/** 从 git remote origin 推断 owner/repo（支持 https 与 ssh 两种格式） */
function inferRepoFromGit() {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: projectRoot,
    encoding: 'utf-8',
    windowsHide: true,
  });
  if (result.status !== 0 || !result.stdout) return '';
  const url = result.stdout.trim();
  const match = url.match(/github\.com[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1].replace(/\/$/, '') : '';
}

const resolvedRepo = repo || inferRepoFromGit();

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(resolvedRepo)) {
  process.stderr.write(
    '请设置 ATM_GH_REPO=owner/repo（例如 YNSGCU/allegro-toolkit-manager），' +
      '或确认 git remote origin 指向 GitHub 仓库。\n',
  );
  process.exit(1);
}
if (!token) {
  process.stdout.write('未设置 GH_TOKEN，将使用 gh CLI 已登录凭据（需 repo 写权限）。\n');
}
const ghEnv = token ? { GH_TOKEN: token } : {};

const feedUrl = `https://github.com/${resolvedRepo}/releases/latest/download`;

const run = (command, args, extraEnv = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.stderr.write(
      `\n命令执行失败: ${command} ${args.join(' ')}，退出码 ${result.status ?? 'unknown'}\n`,
    );
    process.exit(result.status ?? 1);
  }
};

// 检查 gh CLI 可用，发布流程依赖它创建 GitHub Release
{
  const check = spawnSync('gh', ['--version'], { encoding: 'utf-8', windowsHide: true });
  if (check.status !== 0) {
    process.stderr.write(
      '未找到 GitHub CLI (gh)。请先安装：winget install GitHub.cli 或访问 https://cli.github.com/\n',
    );
    process.exit(1);
  }
  process.stdout.write(`使用 ${check.stdout.trim().split('\n')[0]}\n`);
}

run('npm', ['run', 'build']);

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'atm-gh-publish-'));
const configPath = join(temporaryDirectory, 'electron-builder.json');
writeFileSync(
  configPath,
  JSON.stringify(
    {
      appId: 'com.allegrotoolkitmanager.atm',
      productName: 'ATM - Allegro Toolkit Manager',
      asar: true,
      directories: { output: join(projectRoot, 'release') },
      files: ['dist/**/*', 'dist-electron/**/*', 'data/**/*', 'package.json'],
      extraMetadata: { atmUpdateFeedUrl: feedUrl },
      publish: [{ provider: 'github', owner: resolvedRepo.split('/')[0], repo: resolvedRepo.split('/')[1] }],
      win: {
        icon: 'build/icon.svg',
        executableName: 'ATM',
        target: [{ target: 'nsis', arch: ['x64'] }],
        artifactName: 'ATM-Setup-${version}-${arch}.${ext}',
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'ATM - Allegro Toolkit Manager',
      },
    },
    null,
    2,
  ),
);

const fsPromises = (await import('node:fs')).promises;
let version = '0.0.0';
try {
  try {
    const pkg = JSON.parse(await fsPromises.readFile(join(projectRoot, 'package.json'), 'utf-8'));
    version = pkg.version;
  } catch {
    // 读不到时保持默认
  }

  // electron-builder 的 GitHub publisher 会并发上传 exe / blockmap；两个 publisher
  // 可能同时判断 release 不存在并创建重复 draft。这里明确禁止它发布，只保留打包和 latest.yml 生成。
  run('npx', ['electron-builder', '--config', configPath, '--win', 'nsis', '--publish', 'never']);

  const tag = `v${version}`;
  const expectAssets = [
    `ATM-Setup-${version}-x64.exe`,
    `ATM-Setup-${version}-x64.exe.blockmap`,
    'latest.yml',
  ];
  const assetPaths = expectAssets.map((name) => join(projectRoot, 'release', name));
  const missingAssets = assetPaths.filter((assetPath) => !existsSync(assetPath));
  if (missingAssets.length > 0) {
    process.stderr.write(`打包完成但缺少发布资产：${missingAssets.join(', ')}\n`);
    process.exit(1);
  }

  const existingRelease = spawnSync(
    'gh',
    ['release', 'view', tag, '--repo', resolvedRepo, '--json', 'tagName'],
    {
      cwd: projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    },
  );
  if (existingRelease.status !== 0) {
    run(
      'gh',
      ['release', 'create', tag, '--repo', resolvedRepo, '--draft', '--title', version, '--verify-tag'],
      ghEnv,
    );
  }

  // gh 对同一个 release 串行上传全部资产，避免 electron-builder 并发创建重复草稿。
  // 刚创建的 release 可能在 uploads 端点短暂不可见（HTTP 404），带重试自愈。
  const uploadAssets = () =>
    spawnSync('gh', ['release', 'upload', tag, '--repo', resolvedRepo, '--clobber', ...assetPaths], {
      cwd: projectRoot,
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32',
      env: { ...process.env, ...ghEnv },
    });
  let uploadResult = uploadAssets();
  for (let attempt = 1; uploadResult.status !== 0 && attempt < 5; attempt += 1) {
    process.stdout.write(`Release 资产上传失败（第 ${attempt} 次），3 秒后重试…\n`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
    uploadResult = uploadAssets();
  }
  if (uploadResult.status !== 0) {
    process.stderr.write(
      `\n命令执行失败: gh release upload ${tag}，退出码 ${uploadResult.status ?? 'unknown'}\n`,
    );
    process.exit(uploadResult.status ?? 1);
  }

  // 显式等待 GitHub API 返回完整资产，再公开为 latest。
  let ready = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const view = spawnSync(
      'gh',
      ['release', 'view', tag, '--repo', resolvedRepo, '--json', 'assets,isDraft'],
      {
        cwd: projectRoot,
        encoding: 'utf-8',
        windowsHide: true,
      },
    );
    if (view.status === 0 && view.stdout) {
      let parsed;
      try {
        parsed = JSON.parse(view.stdout);
      } catch {
        parsed = null;
      }
      if (parsed?.assets) {
        const names = new Set(parsed.assets.map((asset) => asset.name));
        ready = expectAssets.every((name) => names.has(name));
        if (ready) {
          process.stdout.write(`Release 资产齐全：${expectAssets.join(', ')}。\n`);
          break;
        }
      }
      if (parsed?.isDraft === false) {
        process.stdout.write('Release 已公开。\n');
        ready = true;
        break;
      }
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
  if (!ready) {
    process.stderr.write('等待 Release 资产上传超时，请检查 GitHub Actions 日志或手动补充资产。\n');
    process.exit(1);
  }

  // 公开为 latest
  run('gh', ['release', 'edit', tag, '--repo', resolvedRepo, '--draft=false', '--latest'], ghEnv);
  process.stdout.write(`\n已发布到 GitHub Releases：${feedUrl}\n`);
  process.stdout.write('软件内更新源已内置为上述地址，安装新版后即可在「系统状态 → 应用内更新」检查更新。\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
