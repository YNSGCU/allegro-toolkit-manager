import KeyboardVisualizer from '../KeyboardVisualizer';
import MinimalSurface from '../MinimalSurface';
import { getPageSurface } from '../../config/pageSurfaces';
import type { HotkeyOverviewPanelProps } from './types';

const HOTKEY_ROUTE_MAP: Record<string, string> = {
  editor: '/hotkeys/editor',
  conflicts: '/hotkeys/conflicts',
  'import-export': '/hotkeys/import-export',
};

export default function HotkeyOverviewPanel({ sharedState: state, actions }: HotkeyOverviewPanelProps) {
  const surface = getPageSurface('hotkeys');
  const issueCount = state.stats.errorCount + state.stats.warningCount;
  const summaryLine = [
    `${state.stats.total} 条快捷键`,
    `${issueCount} 个问题`,
    state.appliedProfileId ? '已应用方案' : '未应用方案',
  ];

  return (
    <div className="hotkey-overview-panel">
      <span className="sr-only">快捷键总览</span>

      <MinimalSurface
        title="快捷键总览"
        subtitle={surface.subtitle}
        prompt="从当前方案继续，检查冲突、整理映射，或直接进入具体工作区。"
        summaryLine={summaryLine}
        density="balanced"
        showCopy={false}
        showPrompt={false}
        summaryPosition="below-copy"
        cards={surface.actions.map((action) => ({
          id: action.id,
          title: action.label,
          meta: action.meta,
          to: HOTKEY_ROUTE_MAP[action.id],
        }))}
      />

      {state.error ? <p className="hotkey-overview-note">{state.error}</p> : null}
      {state.loading ? <p className="hotkey-overview-note">正在加载快捷键总览...</p> : null}

      <section className="hotkey-overview-keyboard" aria-label="快捷键键盘总览">
        <KeyboardVisualizer
          bindings={state.bindings}
          reservedBindings={state.reservedBindings}
          conflicts={state.filteredConflicts}
          selectedKey={null}
          onSelectKey={() => {}}
          viewMode={state.viewMode}
          onViewModeChange={actions.setViewMode}
          activeLayer={state.activeLayer}
          onLayerChange={actions.setActiveLayer}
          workspaceScale={state.workspaceScale}
        />
      </section>
    </div>
  );
}
