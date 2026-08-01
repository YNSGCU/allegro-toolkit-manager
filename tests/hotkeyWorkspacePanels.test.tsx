import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { keyboardVisualizerSpy } = vi.hoisted(() => ({
  keyboardVisualizerSpy: vi.fn(),
}));

vi.mock('../src/components/KeyboardVisualizer', () => ({
  default: (props: unknown) => {
    keyboardVisualizerSpy(props);
    return <div data-testid="keyboard-visualizer-stub">閿洏鍗犵敤鎬昏</div>;
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

async function openWorkspaceTools() {
  fireEvent.click(await screen.findByRole('button', { name: '工作区工具' }));
  fireEvent.click(screen.getByRole('button', { name: '导入、导出与历史' }));
  await screen.findByRole('heading', { name: '导入导出' });
}

describe('hotkey workspace shared data', () => {
  it('renders conflicts route with diagnostics layout and resolves raw line paths from env sources', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const readRawLine = vi.fn().mockResolvedValue({
      success: true,
      data: {
        lineContent: 'funckey Ctrl+K ref.command',
        contextBefore: ['11\t# reference env'],
        contextAfter: ['13\tfunckey Ctrl+L other.command'],
      },
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
              name: '榛樿鏂规',
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
                  id: 'company-ref',
                  path: 'C:\\refs\\company.env',
                  role: 'company_env',
                  readable: true,
                  writable: false,
                  exists: true,
                  priority: 2,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '鍏徃鍙傝€?env',
                },
              ],
              activeEnvId: 'user-env',
              activeEnvPath: 'C:\\pcb\\env',
            },
            settings: null,
          },
        }),
        parseEnvFile: vi.fn().mockImplementation(async (filePath: string) => ({
          success: true,
          data: {
            entries:
              filePath === 'C:\\pcb\\env'
                ? [
                    {
                      type: 'funckey',
                      raw: 'funckey Ctrl+K user.command',
                      lineNumber: 8,
                      source: 'user_original',
                    },
                  ]
                : [
                    {
                      type: 'funckey',
                      raw: 'funckey Ctrl+K ref.command',
                      lineNumber: 12,
                      source: 'reference',
                    },
                  ],
            warnings: [],
            hasManagedBlock: false,
          },
        })),
        validateHotkeys: vi.fn().mockImplementation(async (filePath: string) => {
          if (filePath === 'C:\\pcb\\env') {
            return {
              success: true,
              data: {
                bindings: [
                  {
                    id: 'user-binding',
                    key: 'Ctrl+K',
                    command: 'user.command',
                    type: 'funckey',
                    bindingSource: 'user_env_original',
                    status: 'normal',
                    lineNumber: 8,
                  },
                ],
                conflicts: [
                  {
                    type: 'cross_env_override',
                    severity: 'warning',
                    message: '鐢ㄦ埛 env 瑕嗙洊浜嗗弬鑰?env 鐨?Ctrl+K',
                    bindings: [
                      {
                        id: 'user-binding',
                        key: 'Ctrl+K',
                        command: 'user.command',
                        type: 'funckey',
                        bindingSource: 'user_env_original',
                        status: 'normal',
                        lineNumber: 8,
                      },
                      {
                        id: 'ref-binding',
                        key: 'Ctrl+K',
                        command: 'ref.command',
                        type: 'funckey',
                        bindingSource: 'company_env',
                        envSourceId: 'company-ref',
                        status: 'reserved',
                        lineNumber: 12,
                      },
                    ],
                  },
                ],
              },
            };
          }

          return {
            success: true,
            data: {
              bindings: [
                {
                  id: 'ref-binding',
                  key: 'Ctrl+K',
                  command: 'ref.command',
                  type: 'funckey',
                  bindingSource: 'company_env',
                  status: 'reserved',
                  lineNumber: 12,
                },
              ],
              conflicts: [],
            },
          };
        }),
        loadFavorites: vi.fn().mockResolvedValue({
          success: true,
          data: { favoriteBindingIds: [] },
        }),
        getLastChange: vi.fn().mockResolvedValue({
          success: true,
          data: { canUndo: false },
        }),
        createApplyPlan: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'plan-1',
            summary: 'Apply Plan for conflicts',
            createdAt: '2026-07-02T00:00:00.000Z',
            requiresRestart: false,
            warnings: [],
            steps: [
              {
                type: 'backup',
                target: 'C:\\pcb\\env',
                description: '澶囦唤 env',
                backupTo: 'C:\\pcb\\env.bak',
              },
            ],
          },
        }),
        applyPlan: vi.fn().mockResolvedValue({
          success: true,
        }),
        readRawLine,
      },
    });

    renderHotkeyWorkspace('/hotkeys/conflicts');

    expect(await screen.findByRole('heading', { name: '冲突处理' })).toBeInTheDocument();
    expect(screen.getByText('冲突摘要')).toBeInTheDocument();
    expect(screen.getByText('警告', { selector: '.hotkey-conflicts-summary-label' })).toBeInTheDocument();
    expect(screen.getByText('1 个', { selector: '.hotkey-conflicts-summary-value' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '生成 Apply Plan' }));
    expect(await screen.findByText(/Apply Plan for conflicts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部' })).toHaveClass('btn', 'btn-sm', 'btn-primary');
    expect(screen.getByRole('button', { name: '错误' })).toHaveClass('btn', 'btn-sm');
    expect(document.querySelector('.enhanced-conflict-list .atm-btn')).toBeNull();

    const conflictGroupHeader = document.querySelector('.conflict-group-header');
    expect(conflictGroupHeader).not.toBeNull();
    fireEvent.click(conflictGroupHeader as Element);
    const conflictMessages = await screen.findAllByText(
      (_, element) =>
        element?.classList.contains('conflict-message')
        && /ctrl\+k/i.test(element.textContent ?? ''),
    );
    expect(conflictMessages.length).toBeGreaterThan(0);

    const rawLineButtons = await screen.findAllByRole('button', { name: /查看原始行/ });
    fireEvent.click(rawLineButtons[1]);

    await waitFor(() =>
      expect(readRawLine).toHaveBeenCalledWith('C:\\refs\\company.env', 12, true),
    );
    const rawLineMatches = await screen.findAllByText(
      (_, element) => element?.textContent?.includes('funckey Ctrl+K ref.command') ?? false,
    );
    expect(rawLineMatches.length).toBeGreaterThan(0);
    expect(document.querySelector('.raw-line-view .atm-btn')).toBeNull();
  });

  it('renders editor route with shared binding data and opens editor from selection', async () => {
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
              name: '榛樿鏂规',
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
                  id: 'user-env',
                  path: 'C:\\pcb\\env',
                  role: 'user_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 0,
                  selectedAsActive: true,
                  isReference: false,
                  displayName: '当前 env',
                },
                {
                  id: 'site-env',
                  path: 'C:\\refs\\site.env',
                  role: 'site_env',
                  readable: true,
                  writable: false,
                  exists: true,
                  priority: 1,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '站点 env',
                },
                {
                  id: 'install-default-env',
                  path: 'C:\\Cadence\\SPB_17.4\\share\\pcb\\text\\env',
                  role: 'install_default_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 2,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '安装默认 env',
                },
              ],
              activeEnvId: 'user-env',
              activeEnvPath: 'C:\\pcb\\env',
            },
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
                key: 'a',
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

    renderHotkeyWorkspace('/hotkeys/keys');

    expect(await screen.findByRole('heading', { name: '键位' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索键位、命令或来源')).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-visualizer-stub')).toBeInTheDocument();
    expect(screen.getByText('快捷键列表')).toBeInTheDocument();
    const keyMatches = await screen.findAllByText('a');
    expect(keyMatches.length).toBeGreaterThan(0);
    expect(await screen.findAllByText('user.command')).not.toHaveLength(0);

    fireEvent.click(keyMatches[0]);

    expect(await screen.findByText('当前选择')).toBeInTheDocument();
    expect(screen.getAllByText('a').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: '编辑此绑定' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑此绑定' }));
    expect(await screen.findByText('编辑快捷键')).toBeInTheDocument();
  });

  it('allows adding a binding without preselecting an existing binding', async () => {
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
              name: '榛樿鏂规',
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
                  id: 'user-env',
                  path: 'C:\\pcb\\env',
                  role: 'user_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 0,
                  selectedAsActive: true,
                  isReference: false,
                  displayName: '当前 env',
                },
                {
                  id: 'site-env',
                  path: 'C:\\refs\\site.env',
                  role: 'site_env',
                  readable: true,
                  writable: false,
                  exists: true,
                  priority: 1,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '站点 env',
                },
                {
                  id: 'install-default-env',
                  path: 'C:\\Cadence\\SPB_17.4\\share\\pcb\\text\\env',
                  role: 'install_default_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 2,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '安装默认 env',
                },
              ],
              activeEnvId: 'user-env',
              activeEnvPath: 'C:\\pcb\\env',
            },
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
      },
    });

    renderHotkeyWorkspace('/hotkeys/keys');

    expect(await screen.findByRole('heading', { name: '键位' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新增绑定' }));

    expect(await screen.findByText('选择物理键')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('物理键'), { target: { value: 'F2' } });
    fireEvent.click(screen.getByRole('button', { name: '继续新增' }));

    expect(await screen.findByText(/物理键 F2/)).toBeInTheDocument();
  });

  it('redirects the legacy overview route into the merged key workspace', async () => {
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
              name: '榛樿鏂规',
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
                key: 'a',
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

    expect(await screen.findByRole('heading', { name: '键位' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByTestId('keyboard-visualizer-stub')).toBeInTheDocument();
    expect(keyboardVisualizerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bindings: [],
        conflicts: [],
        selectedKey: null,
        viewMode: 'my',
        activeLayer: 'normal',
        onViewModeChange: expect.any(Function),
        onLayerChange: expect.any(Function),
      }),
    );

    const initialProps = keyboardVisualizerSpy.mock.calls.at(-1)?.[0] as
      | {
          onViewModeChange?: (mode: 'my' | 'reserved' | 'overlay') => void;
          onLayerChange?: (layer: 'normal' | 'shift' | 'ctrl' | 'alt' | 'special') => void;
        }
      | undefined;

    expect(initialProps?.onViewModeChange).toBeTypeOf('function');
    expect(initialProps?.onLayerChange).toBeTypeOf('function');

    initialProps?.onViewModeChange?.('reserved');
    initialProps?.onLayerChange?.('ctrl');

    await waitFor(() => {
      expect(keyboardVisualizerSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          viewMode: 'reserved',
          activeLayer: 'ctrl',
        }),
      );
    });
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
                key: 'a',
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
            zhName: '甯姪',
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
              name: '榛樿鏂规',
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
                  displayName: '鍙傝€?env',
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

    expect(await screen.findByRole('heading', { name: '键位' })).toBeInTheDocument();
    expect(screen.getByLabelText('快捷键当前状态')).toHaveTextContent('配置2 条');
    expect(screen.getByLabelText('快捷键当前状态')).not.toHaveTextContent('应用状态');
    expect(screen.getByText('快捷键列表')).toBeInTheDocument();
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
              name: '榛樿鏂规',
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
        openEnvSourceFolder: vi.fn().mockResolvedValue({
          success: true,
        }),
        openEnvFileDialog: vi.fn().mockRejectedValue(new Error('dialog boom')),
        parseImportEnvFile: vi.fn(),
        computeImportConflicts: vi.fn(),
      },
    });

    renderHotkeyWorkspace('/hotkeys/keys');
    await openWorkspaceTools();

    expect(screen.getByRole('heading', { name: '导入导出' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入方案' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出速查表' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '变更历史' })).toBeInTheDocument();
    expect(screen.getByText('当前 env：C:\\pcb\\env')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导出方案' }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile');

    fireEvent.click(screen.getByRole('button', { name: '导入 env' }));
    expect(
      await screen.findByText('导入过程异常: Error: dialog boom'),
    ).toBeInTheDocument();

    createElement.mockRestore();
  });

  it('renders export cheatsheet with the shared modal shell instead of a custom popup shell', async () => {
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
              name: '姒涙顓婚弬瑙勵攳',
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
          data: {
            bindings: [
              {
                id: 'binding-1',
                key: 'a',
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
          data: { favoriteBindingIds: ['binding-1'] },
        }),
        getLastChange: vi.fn().mockResolvedValue({
          success: true,
          data: { canUndo: false },
        }),
        exportCheatsheet: vi.fn().mockResolvedValue({
          success: true,
          data: { markdown: '# demo', html: '<h1>demo</h1>' },
        }),
      },
    });

    renderHotkeyWorkspace('/hotkeys/keys');
    await openWorkspaceTools();

    const exportButton = await screen.findByRole('button', { name: '导出速查表' });
    await waitFor(() => {
      expect(exportButton).not.toBeDisabled();
    });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(document.querySelector('.export-dialog')).not.toBeNull();
    });

    const dialog = document.querySelector('.export-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveClass('export-dialog');
    expect(dialog).toHaveClass('modal-dialog');
    expect(dialog).toHaveClass('export-dialog--compact');
    expect(dialog?.classList.contains('modal-content')).toBe(false);
    const closeButton = screen.getByRole('button', { name: '关闭导出弹窗' });
    expect(closeButton).toHaveClass('modal-close-btn');
    expect(dialog?.querySelector('.modal-footer')).not.toBeNull();
    const footerButtons = dialog?.querySelectorAll('.modal-footer button') ?? [];
    expect(footerButtons).toHaveLength(2);
    expect(footerButtons[0]).toHaveClass('btn');
    expect(footerButtons[1]).toHaveClass('btn', 'btn-primary');
  });

  it('renders change history with the shared modal shell instead of the legacy popup shell', async () => {
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
        loadChangeHistory: vi.fn().mockResolvedValue({
          success: true,
          data: { records: [] },
        }),
        clearChangeHistory: vi.fn().mockResolvedValue({
          success: true,
        }),
        undoLastChange: vi.fn().mockResolvedValue({
          success: true,
        }),
      },
    });

    renderHotkeyWorkspace('/hotkeys/keys');
    await openWorkspaceTools();

    const historyButton = await screen.findByRole('button', { name: '变更历史' });
    fireEvent.click(historyButton);

    const dialog = await screen.findByLabelText('变更历史弹窗');
    expect(dialog).toHaveClass('change-history-dialog');
    expect(dialog).toHaveClass('modal-dialog');
    expect(dialog?.classList.contains('modal-content')).toBe(false);

    const closeButton = screen.getByRole('button', { name: '关闭变更历史弹窗' });
    expect(closeButton).toHaveClass('modal-close-btn');
    expect(screen.getByRole('button', { name: '刷新历史' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: '清空历史' })).toHaveClass('btn', 'btn-danger');
    expect(dialog.querySelector('.change-history-toolbar .atm-btn')).toBeNull();
    expect(dialog.querySelector('.change-history-empty .empty-icon')).toBeNull();
  });

  it('shows extra env sources in import-export and opens their folders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const openEnvSourceFolder = vi.fn().mockResolvedValue({
      success: true,
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
              name: '榛樿鏂规',
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
                  id: 'user-env',
                  path: 'C:\\pcb\\env',
                  role: 'user_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 0,
                  selectedAsActive: true,
                  isReference: false,
                  displayName: '当前 env',
                },
                {
                  id: 'site-env',
                  path: 'C:\\refs\\site.env',
                  role: 'site_env',
                  readable: true,
                  writable: false,
                  exists: true,
                  priority: 1,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '站点 env',
                },
                {
                  id: 'install-default-env',
                  path: 'C:\\Cadence\\SPB_17.4\\share\\pcb\\text\\env',
                  role: 'install_default_env',
                  readable: true,
                  writable: true,
                  exists: true,
                  priority: 2,
                  selectedAsActive: false,
                  isReference: true,
                  displayName: '安装默认 env',
                },
              ],
              activeEnvId: 'user-env',
              activeEnvPath: 'C:\\pcb\\env',
            },
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
        openEnvSourceFolder,
        openEnvFileDialog: vi.fn().mockResolvedValue({
          success: true,
          data: null,
          info: '鍙栨秷閫夋嫨',
        }),
        parseImportEnvFile: vi.fn(),
        computeImportConflicts: vi.fn(),
      },
    });

    renderHotkeyWorkspace('/hotkeys/keys');
    await openWorkspaceTools();

    expect(screen.getByRole('heading', { name: '导入导出' })).toBeInTheDocument();
    expect(screen.getByText('已生效')).toBeInTheDocument();
    expect(screen.getByText('其他 env 来源')).toBeInTheDocument();
    expect(screen.getByText('站点 env')).toBeInTheDocument();
    expect(screen.getByText('安装默认 env')).toBeInTheDocument();
    expect(screen.getByText('基础参考层')).toBeInTheDocument();
    expect(screen.getByText('文件可写，但不建议作为日常编辑目标')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开 安装默认 env 所在文件夹' }));
    await waitFor(() => expect(openEnvSourceFolder).toHaveBeenCalledWith('C:\\Cadence\\SPB_17.4\\share\\pcb\\text\\env'));
  });
});
