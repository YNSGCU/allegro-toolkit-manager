import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import KeyboardVisualizer from '../KeyboardVisualizer';
import type { HotkeyOverviewPanelProps } from './types';

export default function HotkeyOverviewPanel({ sharedState: state, actions }: HotkeyOverviewPanelProps) {
  const issueCount = state.stats.errorCount + state.stats.warningCount;

  return (
    <div className="hotkey-overview-panel">
      <header className="hotkey-overview-header">
        <div>
          <h2>键盘占用总览</h2>
          <p>{state.stats.total} 条快捷键；{issueCount > 0 ? `${issueCount} 个问题待处理` : '当前未发现冲突问题'}。</p>
        </div>
        <div className="hotkey-overview-actions">
          <Link className="btn" to="/hotkeys/conflicts">
            <ShieldCheck aria-hidden="true" />
            检查冲突
          </Link>
          <Link className="btn btn-primary" to="/hotkeys/editor">
            编辑键位
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

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
        />
      </section>
    </div>
  );
}
