import { describe, expect, it, vi, afterEach } from 'vitest';
import { loadHotkeyWorkspaceData } from '../src/services/loadHotkeyWorkspaceData';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadHotkeyWorkspaceData', () => {
  it('merges skill_direct hotkeys into reserved bindings', async () => {
    (window as any).atm = {
      locateEnvironment: vi.fn().mockResolvedValue({
        success: true,
        data: {
          envExists: false,
          envFilePath: '',
          pcbenvPath: '',
        },
      }),
      scanAllEnvironments: vi.fn().mockResolvedValue({
        success: false,
      }),
      listProfiles: vi.fn().mockResolvedValue({
        success: true,
        data: [],
      }),
      getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
        success: true,
        data: { profileId: '' },
      }),
      enhancedScanSkills: vi.fn().mockResolvedValue({
        success: true,
        data: {
          all: [
            {
              id: 'zsq-layer',
              name: 'zsqLayer',
              path: 'D:\\application\\Cadence\\Cadence17\\Cadence\\SPB_Data\\pcbenv\\skill\\zsqLayer.il',
              tier: 'user',
              sourceType: 'user_skill',
              hotkeyRefs: [
                {
                  key: '1',
                  command: 'zsqlayer_etchlayerall',
                  type: 'funckey',
                  sourceType: 'skill_direct',
                  source: 'D:\\application\\Cadence\\Cadence17\\Cadence\\SPB_Data\\pcbenv\\skill\\zsqLayer.il',
                  lineNumber: 12,
                },
              ],
            },
          ],
        },
      }),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await loadHotkeyWorkspaceData('', fetchImpl as any);

    expect(result.reservedBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: '1',
          command: 'zsqlayer_etchlayerall',
          bindingSource: 'skill_direct',
          editable: false,
        }),
      ]),
    );
  });

  it('materializes the selected hotkey profile bindings into the workspace bindings', async () => {
    (window as any).atm = {
      locateEnvironment: vi.fn().mockResolvedValue({
        success: true,
        data: {
          envExists: false,
          envFilePath: '',
          pcbenvPath: '',
        },
      }),
      scanAllEnvironments: vi.fn().mockResolvedValue({
        success: false,
      }),
      listProfiles: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'profile-a',
            name: '方案 A',
            createdAt: '2026-07-03T00:00:00.000Z',
            updatedAt: '2026-07-03T00:00:00.000Z',
            bindings: [
              { id: 'a-1', key: 'F1', command: 'alpha', type: 'funckey', enabled: true },
            ],
          },
          {
            id: 'profile-b',
            name: '方案 B',
            createdAt: '2026-07-03T00:00:00.000Z',
            updatedAt: '2026-07-03T00:00:00.000Z',
            bindings: [
              { id: 'b-1', key: 'F2', command: 'beta', type: 'funckey', enabled: true },
            ],
          },
        ],
      }),
      getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
        success: true,
        data: { profileId: 'profile-a' },
      }),
      enhancedScanSkills: vi.fn().mockResolvedValue({
        success: true,
        data: { all: [] },
      }),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await loadHotkeyWorkspaceData('profile-b', fetchImpl as any);

    expect(result.activeProfileId).toBe('profile-b');
    expect(result.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'F2',
          command: 'beta',
          bindingSource: 'active_profile',
          profileId: 'profile-b',
          profileName: '方案 B',
        }),
      ]),
    );
    expect(result.bindings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'F1',
          bindingSource: 'active_profile',
        }),
      ]),
    );
  });
});
