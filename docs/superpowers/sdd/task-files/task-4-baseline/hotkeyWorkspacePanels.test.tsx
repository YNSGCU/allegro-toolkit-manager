import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { keyboardVisualizerSpy } = vi.hoisted(() => ({
  keyboardVisualizerSpy: vi.fn(),
}));

vi.mock('../src/components/KeyboardVisualizer', () => ({
  default: (props: unknown) => {
    keyboardVisualizerSpy(props);
    return <div data-testid="keyboard-visualizer-stub">键盘占用总览</div>;
  },
}));

import HotkeyWorkspacePage from '../src/pages/HotkeyWorkspacePage';

afterEach(() => {
  cleanup();
  keyboardVisualizerSpy.mockReset();
  vi.unstubAllGlobals();
});

function renderHotkeyWorkspace(initialPath: string) {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );

  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('hotkey workspace shared data', () => {
  it('renders overview with three navigation cards and keyboard summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    Object.defineProperty(window, 'atm', {
      writable: true,
      value: {
        locateEnvironment: vi.fn().mockResolvedValue({
          success: true,
          data: {
            envExists: true,
            envFilePath: 'C:\\pcb\\env',
            pcbenvPath: 'C:\\pcb',
            warnings: [],
            homePath: 'C:\\Users\\tester',
            ilinitFilePath: null,
            atmGeneratedPath: null,
            envReadable: true,
            envWritable: true,
            ilinitExists: false,
            ilinitReadable: false,
            ilinitWritable: false,
            pcbenvExists: true,
            pcbenvWritable: true,
            detectedMode: 'local',
          },
        }),
        listProfiles: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'default',
              name: '默认方案',
              createdAt: '2026-07-02T00:00:00.000Z',
              updatedAt: '2026-07-02T00:00:00.000Z',
              bindings: [],
            },
          ],
        }),
        getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
          success: true,
          data: { profileId: 'default' },
        }),
        scanAllEnvironments: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sources: { sources: [], activeEnvId: 'user-env', activeEnvPath: 'C:\\pcb\\env' },
            settings: null,
          },
        }),
        parseEnvFile: vi.fn().mockResolvedValue({
          success: true,
          data: {
            entries: [{ type: 'funckey', raw: 'funckey Ctrl+A user.command', lineNumber: 1, source: 'user_original' }],
            warnings: [],
            hasManagedBlock: false,
          },
        }),
        validateHotkeys: vi.fn().mockResolvedValue({
          success: true,
          data: {
            bindings: [
              {
                id: 'binding-1',
                key: 'Ctrl+A',
                command: 'user.command',
                type: 'funckey',
                bindingSource: 'user_env_original',
                status: 'normal',
              },
            ],
            conflicts: [],
          },
        }),
        loadFavorites: vi.fn().mockResolvedValue({
          success: true,
          data: { favoriteBindingIds: [] },
        }),
        getLastChange: vi.fn().mockResolvedValue({
          success: true,
          data: { canUndo: false },
        }),
      },
    });

    renderHotkeyWorkspace('/hotkeys/overview');

    expect(await screen.findByText('快捷键总览')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /编辑键位.*进入主编辑工作区/ })).toHaveAttribute('href', '/hotkeys/editor');
    expect(screen.getByRole('link', { name: /处理冲突.*集中处理覆盖与冲突/ })).toHaveAttribute('href', '/hotkeys/conflicts');
    expect(screen.getByRole('link', { name: /导入导出.*管理 env、方案与速查表/ })).toHaveAttribute('href', '/hotkeys/import-export');
    expect(screen.getByText(/键盘占用总览/)).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-visualizer-stub')).toBeInTheDocument();
    expect(keyboardVisualizerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bindings: [],
        conflicts: [],
        selectedKey: null,
        viewMode: 'my',
        activeLayer: 'normal',
      }),
    );
  });

  it('loads real shared data into the overview panel while preserving reference env reads', async () => {
    const locateEnvironment = vi.fn().mockResolvedValue({
      success: true,
      data: {
        envExists: true,
        envFilePath: 'C:\\pcb\\env',
        pcbenvPath: 'C:\\pcb',
        warnings: [],
        homePath: 'C:\\Users\\tester',
        ilinitFilePath: null,
        atmGeneratedPath: null,
        envReadable: true,
        envWritable: true,
        ilinitExists: false,
        ilinitReadable: false,
        ilinitWritable: false,
        pcbenvExists: true,
        pcbenvWritable: true,
        detectedMode: 'local',
      },
    });
    const parseEnvFile = vi.fn().mockImplementation(async (filePath: string) => ({
      success: true,
      data: {
        entries: [{ type: 'funckey', raw: 'funckey Ctrl+A user.command', lineNumber: 1, source: 'user_original' }],
        warnings: filePath === 'C:\\pcb\\env' ? [] : [`ref:${filePath}`],
        hasManagedBlock: false,
      },
    }));
    const validateHotkeys = vi.fn().mockImplementation(async (filePath: string) => {
      if (filePath === 'C:\\pcb\\env') {
        return {
          success: true,
          data: {
            bindings: [
              {
                id: 'user-binding',
                key: 'Ctrl+A',
                command: 'user.command',
                type: 'funckey',
                bindingSource: 'user_env_original',
                status: 'normal',
              },
            ],
            conflicts: [],
          },
        };
      }

      return {
        success: true,
        data: {
          bindings: [
            {
              id: 'ref-binding',
              key: 'Ctrl+A',
              command: 'reference.command',
              type: 'funckey',
              bindingSource: 'reference_env',
              status: 'normal',
            },
          ],
          conflicts: [],
        },
      };
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 'reserved-f1',
            rawKey: 'F1',
            command: 'help',
            zhName: '帮助',
            bindingSource: 'allegro_default',
            physicalKey: 'F1',
            modifiers: [],
            displayKey: 'F1',
          },
        ],
      }),
    );

    Object.defineProperty(window, 'atm', {
      writable: true,
      value: {
        locateEnvironment,
        listProfiles: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'default',
              name: '默认方案',
              createdAt: '2026-07-02T00:00:00.000Z',
              updatedAt: '2026-07-02T00:00:00.000Z',
              bindings: [],
            },
          ],
        }),
        getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
          success: true,
          data: { profileId: 'default' },
        }),
        scanAllEnvironments: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sources: {
              sources: [
                {
                  id: 'ref-env',
                  path: 'C:\\refs\\site.env',
                  role: 'reference_env',
                  readable: true,
                  writable: false,
                  exists: true,
                  priority: 2,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '参考 env',
                },
              ],
              activeEnvId: 'user-env',
              activeEnvPath: 'C:\\pcb\\env',
            },
            settings: null,
          },
        }),
        parseEnvFile,
        validateHotkeys,
        loadFavorites: vi.fn().mockResolvedValue({
          success: true,
          data: { favoriteBindingIds: [] },
        }),
        getLastChange: vi.fn().mockResolvedValue({
          success: true,
          data: { canUndo: false },
        }),
      },
    });

    renderHotkeyWorkspace('/hotkeys/overview');

    expect(await screen.findByText('快捷键总览')).toBeInTheDocument();
    expect(screen.getByText('已应用方案')).toBeInTheDocument();
    expect(screen.getByText(/条快捷键/)).toBeInTheDocument();
    expect(keyboardVisualizerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewMode: 'my',
        activeLayer: 'normal',
      }),
    );
    expect(locateEnvironment).toHaveBeenCalledTimes(1);
    expect(parseEnvFile).toHaveBeenCalledWith('C:\\refs\\site.env');
    expect(validateHotkeys).toHaveBeenCalledWith('C:\\refs\\site.env');
  });

  it('preserves export download behavior and contains async import errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const createObjectURL = vi.fn().mockReturnValue('blob:profile');
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.fn();
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation(((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', {
          value: anchorClick,
          configurable: true,
        });
      }
      return element;
    }) as typeof document.createElement);

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURL,
    });

    Object.defineProperty(window, 'atm', {
      writable: true,
      value: {
        locateEnvironment: vi.fn().mockResolvedValue({
          success: true,
          data: {
            envExists: true,
            envFilePath: 'C:\\pcb\\env',
            pcbenvPath: 'C:\\pcb',
            warnings: [],
            homePath: 'C:\\Users\\tester',
            ilinitFilePath: null,
            atmGeneratedPath: null,
            envReadable: true,
            envWritable: true,
            ilinitExists: false,
            ilinitReadable: false,
            ilinitWritable: false,
            pcbenvExists: true,
            pcbenvWritable: true,
            detectedMode: 'local',
          },
        }),
        listProfiles: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'default',
              name: '默认方案',
              createdAt: '2026-07-02T00:00:00.000Z',
              updatedAt: '2026-07-02T00:00:00.000Z',
              bindings: [],
            },
          ],
        }),
        getAppliedHotkeyProfile: vi.fn().mockResolvedValue({
          success: true,
          data: { profileId: 'default' },
        }),
        scanAllEnvironments: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sources: { sources: [], activeEnvId: 'user-env', activeEnvPath: 'C:\\pcb\\env' },
            settings: null,
          },
        }),
        parseEnvFile: vi.fn().mockResolvedValue({
          success: true,
          data: { entries: [], warnings: [], hasManagedBlock: false },
        }),
        validateHotkeys: vi.fn().mockResolvedValue({
          success: true,
          data: { bindings: [], conflicts: [] },
        }),
        loadFavorites: vi.fn().mockResolvedValue({
          success: true,
          data: { favoriteBindingIds: [] },
        }),
        getLastChange: vi.fn().mockResolvedValue({
          success: true,
          data: { canUndo: false },
        }),
        exportProfile: vi.fn().mockResolvedValue({
          success: true,
          data: '{"profile":"ok"}',
        }),
        openEnvFileDialog: vi.fn().mockRejectedValue(new Error('dialog boom')),
        parseImportEnvFile: vi.fn(),
        computeImportConflicts: vi.fn(),
      },
    });

    renderHotkeyWorkspace('/hotkeys/import-export');

    expect(await screen.findByText('环境文件：C:\\pcb\\env')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导出当前方案' }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile');

    fireEvent.click(screen.getByRole('button', { name: '打开 env 导入' }));
    expect(
      await screen.findByText('导入过程异常: Error: dialog boom'),
    ).toBeInTheDocument();

    createElement.mockRestore();
  });
});
