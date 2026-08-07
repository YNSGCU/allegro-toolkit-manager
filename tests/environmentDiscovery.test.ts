/**
 * ATM - 环境发现（installRoots 递归扫描）单元测试
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { addManualInstallRoot, discoverEnvironmentWorkspaces, loadEnvironmentRegistry, removeManualInstallRoot } from '../core/environment/environmentRegistry';

const TEST_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-env-discovery-'));
const OLD_CDSROOT = process.env.CDSROOT;
const OLD_HOME = process.env.HOME;
const OLD_USERPROFILE = process.env.USERPROFILE;

beforeAll(() => {
  // 模拟 Cadence 嵌套安装布局：
  //   <root>/Cadence17_2/Cadence/SPB_17.2 + SPB_Data/pcbenv
  //   <root>/Cadence17/Cadence/SPB_17.4 + SPB_Data/pcbenv
  const mkdir = (rel: string) => fs.mkdirSync(path.join(TEST_ROOT, rel), { recursive: true });
  mkdir('Cadence17_2/Cadence/SPB_17.2/tools/bin');
  mkdir('Cadence17_2/Cadence/SPB_Data/pcbenv');
  mkdir('Cadence17/Cadence/SPB_17.4/tools/bin');
  mkdir('Cadence17/Cadence/SPB_Data/pcbenv');
  fs.writeFileSync(path.join(TEST_ROOT, 'Cadence17_2/Cadence/SPB_17.2/tools/bin/allegro.exe'), '', 'utf-8');
  fs.writeFileSync(path.join(TEST_ROOT, 'Cadence17/Cadence/SPB_17.4/tools/bin/allegro.exe'), '', 'utf-8');

  delete process.env.CDSROOT;
  process.env.ATM_CADENCE_BASES = TEST_ROOT;
  process.env.HOME = TEST_ROOT;
  process.env.USERPROFILE = TEST_ROOT;
  process.env.ATM_CONFIG_HOME = path.join(TEST_ROOT, 'config');
});

afterAll(() => {
  if (OLD_CDSROOT !== undefined) process.env.CDSROOT = OLD_CDSROOT;
  if (OLD_HOME !== undefined) process.env.HOME = OLD_HOME;
  if (OLD_USERPROFILE !== undefined) process.env.USERPROFILE = OLD_USERPROFILE;
  delete process.env.ATM_CONFIG_HOME;
  delete process.env.ATM_CADENCE_BASES;
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
});

describe('discoverEnvironmentWorkspaces', () => {
  it('discovers nested SPB install roots with their sibling SPB_Data pcbenv', () => {
    const workspaces = discoverEnvironmentWorkspaces();
    const byVersion = new Map<string, typeof workspaces>();
    for (const workspace of workspaces) {
      if (!workspace.installRoot) continue;
      const list = byVersion.get(workspace.allegroVersion ?? '') ?? [];
      list.push(workspace);
      byVersion.set(workspace.allegroVersion ?? '', list);
    }

    // 17.2 与 17.4 都必须被发现
    expect(byVersion.has('17.2')).toBe(true);
    expect(byVersion.has('17.4')).toBe(true);

    // 每个版本都必须关联到同级的 SPB_Data/pcbenv
    const v172 = byVersion.get('17.2')!;
    const v174 = byVersion.get('17.4')!;
    expect(v172.some((w) => w.pcbenvPath === path.join(TEST_ROOT, 'Cadence17_2/Cadence/SPB_Data/pcbenv'))).toBe(true);
    expect(v174.some((w) => w.pcbenvPath === path.join(TEST_ROOT, 'Cadence17/Cadence/SPB_Data/pcbenv'))).toBe(true);
  });
});

describe('manual install roots', () => {
  it('persists manual install root across refresh and discovery', () => {
    const fakeRoot = path.join(TEST_ROOT, 'Cadence17/Cadence/SPB_17.4');
    const added = addManualInstallRoot(fakeRoot);
    expect(added.manualInstallRoots).toContain(fakeRoot);

    // ?????????????
    const reloaded = loadEnvironmentRegistry();
    expect(reloaded.manualInstallRoots).toContain(fakeRoot);

    // ?????
    const removed = removeManualInstallRoot(fakeRoot);
    expect(removed.manualInstallRoots).toEqual([]);
  });
});
