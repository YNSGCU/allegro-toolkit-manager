import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(
  new URL('..', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1)),
);
const feedUrl = process.env.ATM_UPDATE_FEED_URL?.trim().replace(/\/+$/, '') || '';

try {
  const parsed = new URL(feedUrl);
  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error();
} catch {
  process.stderr.write('ATM_UPDATE_FEED_URL 必须是无凭据、查询参数和片段的 HTTPS 更新目录。\n');
  process.exit(1);
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npm', ['run', 'build']);

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'atm-update-build-'));
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
      publish: [{ provider: 'generic', url: feedUrl }],
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

try {
  run('npx', ['electron-builder', '--config', configPath, '--win', 'nsis', '--publish', 'never']);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
