import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  refreshEnvironmentRegistry,
  setActiveEnvironment,
  loadEnvironmentRegistry,
  saveEnvironmentRegistry,
  selectEnvironmentPerVersion,
} from '../core/environment/environmentRegistry';
import { locateEnvironment } from '../core/environment/locateEnvironment';
import { checkHotkeyProfileCompatibility } from '../core/environment/compatibility';
import { listCompatibilityRecords, saveCompatibilityRecord } from '../core/environment/compatibilityRecords';
import { parseVibeVersionResponse, verifyAllegroRuntimeViaVibeBridge } from '../core/environment/vibeBridgeProbe';

const tempRoots: string[] = [];

function makePcbenv(name: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `atm-env-${name}-`));
  tempRoots.push(root);
  const pcbenv = path.join(root, 'pcbenv');
  fs.mkdirSync(pcbenv, { recursive: true });
  fs.writeFileSync(path.join(pcbenv, 'env'), 'funckey m move\n', 'utf-8');
  return pcbenv;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  delete process.env.ATM_CONFIG_HOME;
});

describe('multi Allegro environment registry', () => {
  it('每个版本只保留一个环境，并优先保留当前选择', () => {
    const makeEnvironment = (id: string, version: string, pcbenvPath: string, installRoot: string) => ({
      id,
      name: `Allegro ${version}`,
      allegroVersion: version,
      installRoot,
      executablePath: null,
      homePath: path.dirname(pcbenvPath),
      pcbenvPath,
      envFilePath: path.join(pcbenvPath, 'env'),
      ilinitFilePath: path.join(pcbenvPath, 'allegro.ilinit'),
      writable: true,
      exists: true,
      sharedWithIds: [],
      source: 'discovered' as const,
    });
    const environments = [
      makeEnvironment('v172-user', '17.2', 'C:\\Users\\tester\\pcbenv', 'D:\\Cadence172\\SPB_17.2'),
      makeEnvironment('v172-install', '17.2', 'D:\\Cadence172\\SPB_Data\\pcbenv', 'D:\\Cadence172\\SPB_17.2'),
      makeEnvironment('v174-user', '17.4', 'C:\\Users\\tester\\pcbenv', 'D:\\Cadence174\\SPB_17.4'),
      makeEnvironment('v174-install', '17.4', 'D:\\Cadence174\\SPB_Data\\pcbenv', 'D:\\Cadence174\\SPB_17.4'),
    ];

    expect(selectEnvironmentPerVersion(environments).map(item => item.id)).toEqual([
      'v172-install',
      'v174-install',
    ]);
    expect(selectEnvironmentPerVersion(environments, 'v172-user').map(item => item.id)).toEqual([
      'v172-user',
      'v174-install',
    ]);
  });

  it('persists active environment and makes locateEnvironment use it', () => {
    const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-registry-'));
    tempRoots.push(configRoot);
    process.env.ATM_CONFIG_HOME = configRoot;
    const first = makePcbenv('first');
    const second = makePcbenv('second');

    const firstRegistry = refreshEnvironmentRegistry(first);
    const secondRegistry = refreshEnvironmentRegistry(second);
    expect(secondRegistry.environments.length).toBeGreaterThanOrEqual(2);
    const secondEnv = secondRegistry.environments.find((item) => item.pcbenvPath === path.normalize(second));
    expect(secondEnv).toBeDefined();
    setActiveEnvironment(secondEnv!.id);

    expect(loadEnvironmentRegistry().activeEnvironmentId).toBe(secondEnv!.id);
    expect(locateEnvironment().pcbenvPath).toBe(path.normalize(second));
    expect(firstRegistry.environments.length).toBeGreaterThanOrEqual(1);

    const manualSelected = refreshEnvironmentRegistry(first);
    expect(manualSelected.environments.find((item) => item.id === manualSelected.activeEnvironmentId)?.pcbenvPath).toBe(path.normalize(first));
  });

  it('refresh 时移除已消失的自动发现记录，并清理陈旧共享引用', () => {
    const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-registry-stale-'));
    tempRoots.push(configRoot);
    process.env.ATM_CONFIG_HOME = configRoot;
    const stalePcbenv = path.join(configRoot, 'missing', 'pcbenv');
    saveEnvironmentRegistry({
      version: 1,
      activeEnvironmentId: 'stale-discovered',
      environments: [{
        id: 'stale-discovered',
        name: 'Allegro 17.2',
        allegroVersion: '17.2',
        installRoot: path.join(configRoot, 'missing', 'SPB_17.2'),
        executablePath: null,
        homePath: path.dirname(stalePcbenv),
        pcbenvPath: stalePcbenv,
        envFilePath: path.join(stalePcbenv, 'env'),
        ilinitFilePath: path.join(stalePcbenv, 'allegro.ilinit'),
        writable: false,
        exists: false,
        sharedWithIds: ['missing-peer'],
        source: 'discovered',
      }],
      manualInstallRoots: [],
      updatedAt: new Date(0).toISOString(),
    });

    const manualPcbenv = makePcbenv('replacement');
    const refreshed = refreshEnvironmentRegistry(manualPcbenv);
    expect(refreshed.environments.some((item) => item.id === 'stale-discovered')).toBe(false);
    expect(refreshed.environments.every((item) => item.sharedWithIds.every(
      (peerId) => refreshed.environments.some((peer) => peer.id === peerId),
    ))).toBe(true);
  });
});

describe('hotkey profile compatibility', () => {
  it('warns for version changes and blocks absolute paths', () => {
    const report = checkHotkeyProfileCompatibility(
      {
        sourceEnvironmentId: 'source',
        sourceAllegroVersion: '17.4',
        bindings: [
          { id: 'a', key: 'm', command: 'move', type: 'funckey', enabled: true },
          { id: 'b', key: 'x', command: 'C:\\company\\tool.il', type: 'funckey', enabled: true },
        ],
      },
      { id: 'target', allegroVersion: '23.1', pcbenvPath: 'C:\\pcb', sharedWithIds: [] },
    );

    expect(report.verdict).toBe('blocked');
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(['version-diff', 'absolute-path']));
  });

  it('warns when the target pcbenv is shared', () => {
    const report = checkHotkeyProfileCompatibility(
      { sourceEnvironmentId: 'source', sourceAllegroVersion: '17.4', bindings: [] },
      { id: 'target', allegroVersion: '17.4', pcbenvPath: 'C:\\pcb', sharedWithIds: ['other'] },
    );
    expect(report.verdict).toBe('warning');
    expect(report.findings.some((finding) => finding.code === 'shared-pcbenv')).toBe(true);
  });

  it('persists version-scoped compatibility evidence', () => {
    const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-compat-record-'));
    tempRoots.push(configRoot);
    process.env.ATM_CONFIG_HOME = configRoot;
    saveCompatibilityRecord({
      environmentId: 'env-174',
      allegroVersion: '17.4',
      scope: 'hotkey',
      subjectId: 'profile-a',
      subjectType: 'profile',
      status: 'static_pass',
      evidenceSource: 'static',
      summary: '静态检查通过',
    });
    expect(listCompatibilityRecords({ environmentId: 'env-174', subjectId: 'profile-a' })).toHaveLength(1);
  });
});

describe('Vibe Bridge version verification', () => {
  it('parses the official axlVersion response shape', () => {
    expect(parseVibeVersionResponse('SUCCESS\n("17.4" "17.4-2024 S015" "allegro")')).toEqual({
      version: '17.4',
      fullVersion: '17.4-2024 S015',
      programName: 'allegro',
    });
  });

  it('keeps runtime status unverified when the bridge does not respond', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'atm-vibe-'));
    tempRoots.push(workspace);
    process.env.ATM_VIBE_WORKSPACE = workspace;
    const result = await verifyAllegroRuntimeViaVibeBridge({ allegroVersion: '17.4' }, 20);
    expect(result.status).toBe('unverified');
    expect(result.connected).toBe(false);
    delete process.env.ATM_VIBE_WORKSPACE;
  });
});
