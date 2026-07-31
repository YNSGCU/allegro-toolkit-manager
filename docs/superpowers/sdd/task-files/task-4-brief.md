### Task 4: 落地“键位编辑”子页

**Files:**
- Create: `src/components/hotkeys/HotkeyEditorPanel.tsx`
- Modify: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/App.css`
- Test: `tests/hotkeyWorkspacePanels.test.tsx`

**Interfaces:**
- Consumes:
  - `HotkeyMap.tsx`
  - `HotkeyList.tsx`
  - `HotkeyEditor.tsx`
  - `AddHotkeyDialog.tsx`
  - `RawLineView.tsx`
- Produces:
  - `HotkeyEditorPanel(props: { state: HotkeyWorkspaceSharedState; actions: HotkeyWorkspaceActions }): JSX.Element`

- [ ] **Step 1: 写失败测试**

```tsx
it('renders editor route with search, map/list area and edit actions', async () => {
  renderHotkeyWorkspace('/hotkeys/editor');

  expect(await screen.findByText('键位编辑')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('搜索命令、按键或中文名...')).toBeInTheDocument();
  expect(screen.getByText('快捷键地图')).toBeInTheDocument();
  expect(screen.getByText('快捷键列表')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: FAIL，编辑路由还是占位内容。

- [ ] **Step 3: 写最小实现**

```tsx
// src/components/hotkeys/HotkeyEditorPanel.tsx
import HotkeyList from '../HotkeyList';
import HotkeyMap from '../HotkeyMap';
import type { HotkeyWorkspaceActions, HotkeyWorkspaceSharedState } from './types';

export default function HotkeyEditorPanel({
  state,
  actions,
}: {
  state: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}) {
  return (
    <section className="hotkey-editor-panel" aria-label="键位编辑">
      <header className="workspace-section-header">
        <h1>键位编辑</h1>
        <p>查找、筛选、修改和新增当前方案中的快捷键。</p>
      </header>

      <div className="workspace-section-toolbar">
        <input
          value={state.searchQuery}
          onChange={(event) => actions.setSearchQuery(event.target.value)}
          placeholder="搜索命令、按键或中文名..."
        />
      </div>

      <div className="hotkey-editor-grid">
        <div className="hotkey-editor-map">
          <h2>快捷键地图</h2>
          <HotkeyMap
            bindings={state.bindings}
            reservedBindings={state.reservedBindings}
            conflicts={state.filteredConflicts}
            selectedBindingId={actions.selectedBindingId}
            onSelectBinding={actions.setSelectedBindingId}
            searchQuery={state.searchQuery}
            onSearchChange={actions.setSearchQuery}
            filter={state.mapFilter}
            onFilterChange={actions.setMapFilter}
            viewMode={state.viewMode}
            onEdit={actions.handleEditBinding}
          />
        </div>

        <div className="hotkey-editor-list">
          <h2>快捷键列表</h2>
          <HotkeyList
            bindings={actions.tableBindings}
            highlightId={actions.selectedBindingId || undefined}
            onEdit={actions.handleEditBinding}
            onAdopt={actions.handleAdoptBinding}
            onOverrideSource={actions.handleOverrideSource}
          />
        </div>
      </div>
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
