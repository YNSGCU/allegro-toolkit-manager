import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HotkeyOverviewPanel from '../src/components/hotkeys/HotkeyOverviewPanel';
import type { HotkeyWorkspaceSharedState } from '../src/components/hotkeys/types';

const { keyboardVisualizerSpy } = vi.hoisted(() => ({
  keyboardVisualizerSpy: vi.fn(),
}));

vi.mock('../src/components/KeyboardVisualizer', () => ({
  default: (props: unknown) => {
    keyboardVisualizerSpy(props);
    return <div data-testid="keyboard-visualizer-stub">键盘占用总览</div>;
  },
}));

function createState(): HotkeyWorkspaceSharedState {
  return {
    loading: false,
    error: null,
    envInfo: null,
    profiles: [],
    activeProfileId: 'default',
    appliedProfileId: 'default',
    bindings: [],
    reservedBindings: [
      {
        id: 'reserved-1',
        key: '1',
        command: 'skill.bound.command',
        type: 'funckey',
        bindingSource: 'install_default_env',
        status: 'reserved',
        editable: false,
      },
    ],
    filteredConflicts: [],
    enhancedConflicts: [],
    activeLayer: 'normal',
    viewMode: 'my',
    mapFilter: 'all',
    searchQuery: '',
    parseWarnings: [],
    entries: [],
    reservedKeysWarning: null,
    favoriteIds: [],
    undoStatus: { canUndo: false, message: '' },
    rawLineView: null,
    envImportPreview: null,
    pendingOverrideBinding: null,
    stats: {
      total: 97,
      funckeyCount: 97,
      aliasCount: 0,
      errorCount: 0,
      warningCount: 0,
      overlayConflictCount: 0,
    },
    envSources: null,
    settings: null,
  };
}

describe('hotkey overview panel', () => {
  it('renders a compact overview header and passes reserved bindings to the keyboard view', () => {
    keyboardVisualizerSpy.mockReset();

    const { container } = render(
      <MemoryRouter>
        <HotkeyOverviewPanel
          sharedState={createState()}
          actions={{
            selectedBindingId: null,
            tableBindings: [],
            conflictIgnoreList: [],
            plan: null,
            reloadData: async () => {},
            setActiveLayer: () => {},
            setSelectedBindingId: () => {},
            setViewMode: () => {},
            setSearchQuery: () => {},
            setMapFilter: () => {},
            setShowExportDialog: () => {},
            setShowChangeHistory: () => {},
            handleEditBinding: () => {},
            handleAdoptBinding: () => {},
            handleOverrideSource: () => {},
            handleCreatePlan: async () => {},
            handleEditBindingById: () => {},
            handleIgnoreConflict: () => {},
            handleViewRawLine: () => {},
            handleOverrideByCommand: () => {},
            handleApplyPlan: async () => {},
            clearPlan: () => {},
            handleEnvImportClick: () => {},
            handleImportProfileClick: () => {},
            handleExportProfile: async () => {},
          }}
        />
      </MemoryRouter>,
    );

    expect(container.querySelector('.minimal-surface')).toBeNull();
    expect(screen.getByRole('heading', { name: '键盘占用总览' })).toBeInTheDocument();
    expect(screen.getByText(/97 条快捷键/)).toBeInTheDocument();
    expect(screen.getByText(/当前未发现冲突问题/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '编辑键位' })).toHaveAttribute('href', '/hotkeys/editor');
    expect(screen.getByTestId('keyboard-visualizer-stub')).toBeInTheDocument();
    expect(keyboardVisualizerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reservedBindings: expect.arrayContaining([
          expect.objectContaining({
            id: 'reserved-1',
            key: '1',
          }),
        ]),
      }),
    );
  });
});
