import EnhancedConflictList from '../EnhancedConflictList';
import { ApplyPlanDialog } from '../../shared/ui';
import type { HotkeyWorkspaceActions, HotkeyWorkspaceSharedState } from './types';

type RawLineTarget = {
  filePath: string;
  lineNumber: number;
  isReference?: boolean;
};

function normalizePath(value: string | null | undefined) {
  return (value ?? '').replace(/\//g, '\\').toLowerCase();
}

function looksLikeFilePath(value: string) {
  return /^[a-z]:\\/i.test(value) || value.startsWith('\\\\') || value.includes('/') || value.includes('\\');
}

function resolveSource(envSources: HotkeyWorkspaceSharedState['envSources'], token: string) {
  if (!token) {
    return null;
  }

  return (
    envSources?.sources.find((source) => source.id === token || normalizePath(source.path) === normalizePath(token)) ??
    null
  );
}

function resolveRawLineTarget(
  state: HotkeyWorkspaceSharedState,
  sourceToken: string,
  lineNumber: number,
): RawLineTarget | null {
  if (!lineNumber) {
    return null;
  }

  const activeEnvPath = state.envInfo?.envFilePath ?? '';
  const matchedSource = resolveSource(state.envSources, sourceToken);
  const resolvedPath = matchedSource?.path
    ?? (looksLikeFilePath(sourceToken) ? sourceToken : activeEnvPath);

  if (!resolvedPath) {
    return null;
  }

  const isReference = matchedSource?.isReference ?? normalizePath(resolvedPath) !== normalizePath(activeEnvPath);
  return {
    filePath: resolvedPath,
    lineNumber,
    isReference,
  };
}

function buildSummaryItems(state: HotkeyWorkspaceSharedState, ignoredCount: number) {
  return [
    { label: '错误', value: `${state.stats.errorCount} 个`, tone: 'error' as const },
    { label: '警告', value: `${state.stats.warningCount} 个`, tone: 'warning' as const },
    { label: '覆盖风险', value: `${state.stats.overlayConflictCount} 个`, tone: 'muted' as const },
    { label: '已忽略', value: `${ignoredCount} 个`, tone: 'muted' as const },
  ];
}

export default function HotkeyConflictsPanel({
  state,
  actions,
}: {
  state: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}) {
  const issueCount = state.stats.errorCount + state.stats.warningCount;
  const summaryItems = buildSummaryItems(state, actions.conflictIgnoreList.length);

  const handleViewRawLine = (sourceToken: string, lineNumber: number) => {
    const target = resolveRawLineTarget(state, sourceToken, lineNumber);
    if (!target) {
      return;
    }

    actions.handleViewRawLine(target.filePath, target.lineNumber, target.isReference);
  };

  const activeEnvSource = state.envSources?.sources.find((source) => source.selectedAsActive) ?? null;
  const referenceSourceCount = state.envSources?.sources.filter((source) => source.isReference).length ?? 0;

  return (
    <section className="hotkey-conflicts-panel" aria-label="冲突处理">
      <header className="hotkey-conflicts-panel-header">
        <div>
          <h1>冲突处理</h1>
          <p>集中查看冲突、覆盖风险与应用前检查结果，直接复用现有诊断和 Apply Plan 流。</p>
        </div>
        <div className="hotkey-conflicts-panel-actions">
          <button className="btn" onClick={() => void actions.reloadData()} disabled={state.loading}>
            刷新诊断
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void actions.handleCreatePlan()}
            disabled={state.loading || !state.envInfo?.envFilePath}
          >
            生成 Apply Plan
          </button>
        </div>
      </header>

      {state.error ? <div className="message message-error">{state.error}</div> : null}
      {state.parseWarnings.map((warning) => (
        <div key={warning} className="message message-warning">
          {warning}
        </div>
      ))}

      <section className="card hotkey-conflicts-summary" aria-label="冲突摘要">
        <div className="card-header">冲突摘要</div>
        <div className="hotkey-conflicts-summary-grid">
          {summaryItems.map((item) => (
            <div key={item.label} className={`hotkey-conflicts-summary-item tone-${item.tone}`}>
              <span className="hotkey-conflicts-summary-label">{item.label}</span>
              <strong className="hotkey-conflicts-summary-value">{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="hotkey-conflicts-meta">
          <span>当前诊断：{issueCount > 0 ? `${issueCount} 个待处理问题` : '未发现阻断性问题'}</span>
          <span>活动 env：{activeEnvSource?.displayName ?? '当前用户 env'}</span>
          <span>参考 env：{referenceSourceCount} 个</span>
        </div>
      </section>

      <section className="card hotkey-conflicts-diagnostics" aria-label="冲突检测">
        <div className="card-header">冲突检测</div>
        <EnhancedConflictList
          conflicts={state.filteredConflicts}
          enhancedConflicts={state.enhancedConflicts}
          ignoredConflictIds={actions.conflictIgnoreList}
          onIgnoreConflict={actions.handleIgnoreConflict}
          onEditBinding={actions.handleEditBindingById}
          onViewRawLine={handleViewRawLine}
          onOverrideSource={actions.handleOverrideByCommand}
        />
      </section>

      <ApplyPlanDialog
        open={Boolean(actions.plan)}
        plan={actions.plan}
        applying={state.loading}
        title="应用快捷键变更"
        intro="确认目标文件、备份与执行步骤后再写入 env。"
        onConfirm={() => void actions.handleApplyPlan()}
        onCancel={actions.clearPlan}
      />
    </section>
  );
}
