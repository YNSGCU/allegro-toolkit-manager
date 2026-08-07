import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { refreshEnvironmentRegistry, setActiveEnvironment, loadEnvironmentRegistry } from '../core/environment/environmentRegistry';
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
