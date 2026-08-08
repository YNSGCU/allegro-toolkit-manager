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
 *   2. electron-builder 用 GitHub provider 打包 NSIS 安装包
 *   3. 自动创建/更新 GitHub Release，上传 latest.yml + exe + blockmap
 *   4. 安装包内置 atmUpdateFeedUrl，装完软件即自动配好更新源
 *
 * 软件端更新源指向：
 *   https://github.com/{owner}/{repo}/releases/latest/download
 * （electron-updater generic provider 会请求该目录下的 latest.yml）
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)),
);

const repo = process.env.ATM_GH_REPO?.trim() || '';
const token = process.env.GH_TOKEN?.trim() || '';

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
  process.stderr.write('请设置 ATM_GH_REPO=owner/repo，例如 myorg/allegro-toolkit。\n');
  process.exit(1);
}
if (!token) {
  process.stderr.write('请设置 GH_TOKEN（GitHub Personal Access Token，需 repo 写权限）。\n');
  process.exit(1);
}

const feedUrl = `https://github.com/${repo}/releases/latest/download`;

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
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
      publish: [{ provider: 'github', owner: repo.split('/')[0], repo: repo.split('/')[1] }],
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

let version = '0.0.0';
const fsPromises = (await import('node:fs')).promises;
try {
  try {
    const pkg = JSON.parse(await fsPromises.readFile(join(projectRoot, 'package.json'), 'utf-8'));
    version = pkg.version;
  } catch {
    // 读不到时保持默认
  }

  // --publish always：electron-builder 自动创建 GitHub Release（draft）并上传资产
  run('npx', ['electron-builder', '--config', configPath, '--win', 'nsis', '--publish', 'always']);

  // electron-builder 创建的 release 默认是 draft，且大文件上传可能在 job 结束前被中断。
  // 这里显式等待资产齐全，再把 release 公开为 latest（与 PiAgent 发布流程一致）。
  const tag = `v${version}`;
  const expectAssets = [
    `ATM-Setup-${version}-x64.exe`,
    `ATM-Setup-${version}-x64.exe.blockmap`,
    'latest.yml',
  ];
  let ready = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const view = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'assets,isDraft'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      windowsHide: true,
    });
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
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5000));
  }
  if (!ready) {
    process.stderr.write('等待 Release 资产上传超时，请检查 GitHub Actions 日志或手动补充资产。\n');
    process.exit(1);
  }

  // 公开为 latest
  run('gh', ['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);
  process.stdout.write(`\n已发布到 GitHub Releases：${feedUrl}\n`);
  process.stdout.write('软件内更新源已内置为上述地址，安装新版后即可在「系统状态 → 应用内更新」检查更新。\n');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
