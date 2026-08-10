import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAllegroLaunchSpec } from '../core/environment/allegroLauncher';

describe('Allegro environment launcher', () => {
  it('uses the selected workspace HOME and CDSROOT without mutating the global environment', () => {
    const baseEnv = {
      HOME: 'D:\\Cadence174\\SPB_Data',
      CDSROOT: 'D:\\Cadence174\\SPB_17.4',
      PATH: 'C:\\Windows\\System32',
    };
    const workspace = {
      id: 'env-172',
      name: 'Allegro 17.2',
      allegroVersion: '17.2',
      installRoot: 'D:\\Cadence172\\SPB_17.2',
      executablePath: 'D:\\Cadence172\\SPB_17.2\\tools\\bin\\allegro.exe',
      homePath: 'D:\\Cadence172\\SPB_Data',
      pcbenvPath: 'D:\\Cadence172\\SPB_Data\\pcbenv',
      envFilePath: 'D:\\Cadence172\\SPB_Data\\pcbenv\\env',
      ilinitFilePath: 'D:\\Cadence172\\SPB_Data\\pcbenv\\allegro.ilinit',
      writable: true,
      exists: true,
      sharedWithIds: [],
      source: 'discovered' as const,
    };

    const spec = buildAllegroLaunchSpec(workspace, baseEnv);

    expect(spec.executablePath).toBe(workspace.executablePath);
    expect(spec.cwd).toBe(path.dirname(workspace.executablePath));
    expect(spec.env.HOME).toBe(workspace.homePath);
    expect(spec.env.CDSROOT).toBe(workspace.installRoot);
    expect(spec.env.PATH).toBe(baseEnv.PATH);
    expect(baseEnv.HOME).toBe('D:\\Cadence174\\SPB_Data');
    expect(baseEnv.CDSROOT).toBe('D:\\Cadence174\\SPB_17.4');
  });

  it('rejects a workspace without a launchable executable', () => {
    expect(() => buildAllegroLaunchSpec({
      id: 'missing',
      name: 'Allegro',
      allegroVersion: null,
      installRoot: null,
      executablePath: null,
      homePath: null,
      pcbenvPath: 'C:\\pcbenv',
      envFilePath: 'C:\\pcbenv\\env',
      ilinitFilePath: 'C:\\pcbenv\\allegro.ilinit',
      writable: true,
      exists: true,
      sharedWithIds: [],
      source: 'manual',
    }, {})).toThrow('未找到 Allegro 可执行文件');
  });
});
