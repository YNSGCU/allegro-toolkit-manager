### Task 5: 落地“冲突处理”子页

**Files:**
- Create: `src/components/hotkeys/HotkeyConflictsPanel.tsx`
- Modify: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/App.css`
- Test: `tests/hotkeyWorkspacePanels.test.tsx`

**Interfaces:**
- Consumes:
  - `EnhancedConflictList.tsx`
  - `ApplyPlanPreview.tsx`
  - 现有冲突跳转、原始行查看、方案应用回调
- Produces:
  - `HotkeyConflictsPanel(props: { state: HotkeyWorkspaceSharedState; actions: HotkeyWorkspaceActions }): JSX.Element`

- [ ] **Step 1: 写失败测试**

```tsx
it('renders conflicts route with diagnostics first layout', async () => {
  renderHotkeyWorkspace('/hotkeys/conflicts');

  expect(await screen.findByText('冲突处理')).toBeInTheDocument();
  expect(screen.getByText(/冲突检测/)).toBeInTheDocument();
  expect(screen.getByText(/Apply Plan/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: FAIL，冲突页还是占位内容。

- [ ] **Step 3: 写最小实现**

```tsx
// src/components/hotkeys/HotkeyConflictsPanel.tsx
import ApplyPlanPreview from '../ApplyPlanPreview';
import EnhancedConflictList from '../EnhancedConflictList';
import type { HotkeyWorkspaceActions, HotkeyWorkspaceSharedState } from './types';

export default function HotkeyConflictsPanel({
  state,
  actions,
}: {
  state: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}) {
  return (
    <section className="hotkey-conflicts-panel" aria-label="冲突处理">
      <header className="workspace-section-header">
        <h1>冲突处理</h1>
        <p>集中查看快捷键冲突、覆盖风险与应用前检查结果。</p>
      </header>

      <div className="workspace-status-strip">
        <span>{state.stats.errorCount} 个错误</span>
        <span>{state.stats.warningCount} 个警告</span>
        <span>{state.stats.overlayConflictCount} 个覆盖风险</span>
      </div>

      <EnhancedConflictList
        conflicts={state.filteredConflicts}
        enhancedConflicts={state.enhancedConflicts}
        ignoredConflictIds={actions.conflictIgnoreList}
        onIgnoreConflict={actions.handleIgnoreConflict}
        onEditBinding={actions.handleEditBindingById}
        onViewRawLine={actions.handleViewRawLine}
        onOverrideSource={actions.handleOverrideByCommand}
      />

      {actions.plan && (
        <ApplyPlanPreview
          plan={actions.plan}
          onConfirm={actions.handleApplyPlan}
          onCancel={actions.clearPlan}
          isApplying={state.loading}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: PASS。

- [ ] **Step 5: 记录无法提交 Git**

Run: `Test-Path .git`

Expected: `False`
