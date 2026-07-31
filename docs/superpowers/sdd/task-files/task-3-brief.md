### Task 3: 落地“快捷键总览”子页

**Files:**
- Create: `src/components/hotkeys/HotkeyOverviewPanel.tsx`
- Modify: `src/components/MinimalSurface.tsx`
- Modify: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/config/pageSurfaces.ts`
- Modify: `src/App.css`
- Test: `tests/hotkeyWorkspacePanels.test.tsx`
- Test: `tests/minimalSurface.test.tsx`

**Interfaces:**
- Consumes:
  - `HotkeyWorkspaceSharedState`
  - `KeyboardVisualizer.tsx`
  - `getPageSurface('hotkeys')`
- Produces:
  - `HotkeyOverviewPanel(props: { state: HotkeyWorkspaceSharedState }): JSX.Element`
  - `MinimalSurface` 支持可跳转卡片：`{ id: string; title: string; meta: string; to?: string }`

- [ ] **Step 1: 写失败测试**

```tsx
it('renders overview with three navigation cards and keyboard summary', async () => {
  renderHotkeyWorkspace('/hotkeys/overview');

  expect(await screen.findByText('快捷键总览')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '编辑键位' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '处理冲突' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '导入导出' })).toBeInTheDocument();
  expect(screen.getByText('键盘占用总览')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/minimalSurface.test.tsx`

Expected: FAIL，原因是总览面板不存在，`MinimalSurface` 也不支持导航卡片。

- [ ] **Step 3: 写最小实现**

```tsx
// src/components/MinimalSurface.tsx
import { Link } from 'react-router-dom';

interface MinimalSurfaceCard {
  id: string;
  title: string;
  meta: string;
  to?: string;
}

{cards.map((card) => {
  const content = (
    <>
      <h2>{card.title}</h2>
      <p>{card.meta}</p>
    </>
  );

  return card.to ? (
    <Link key={card.id} to={card.to} className="minimal-surface-card minimal-surface-card--link">
      {content}
    </Link>
  ) : (
    <article key={card.id} className="minimal-surface-card">
      {content}
    </article>
  );
})}
```

```tsx
// src/components/hotkeys/HotkeyOverviewPanel.tsx
import KeyboardOccupancy from '../KeyboardVisualizer';
import MinimalSurface from '../MinimalSurface';
import { getPageSurface } from '../../config/pageSurfaces';
import type { HotkeyWorkspaceSharedState } from './types';

export default function HotkeyOverviewPanel({ state }: { state: HotkeyWorkspaceSharedState }) {
  const surface = getPageSurface('hotkeys');
  const summaryLine = [
    `${state.stats.total} 条快捷键`,
    `${state.stats.errorCount + state.stats.warningCount} 个问题`,
    state.appliedProfileId ? '已应用方案' : '未应用方案',
  ];

  return (
    <div className="hotkey-overview-panel">
      <MinimalSurface
        title="快捷键总览"
        subtitle={surface.subtitle}
        prompt={surface.prompt}
        summaryLine={summaryLine}
        cards={[
          { id: 'editor', title: '编辑键位', meta: '查找、修改与新增快捷键', to: '/hotkeys/editor' },
          { id: 'conflicts', title: '处理冲突', meta: '集中处理冲突与覆盖风险', to: '/hotkeys/conflicts' },
          { id: 'import-export', title: '导入导出', meta: '管理 env、方案与速查表', to: '/hotkeys/import-export' },
        ]}
      />

      <section className="hotkey-overview-keyboard" aria-label="键盘占用总览">
        <KeyboardOccupancy
          bindings={state.bindings}
          conflicts={state.filteredConflicts}
          selectedKey={null}
          onSelectKey={() => {}}
          viewMode={state.viewMode}
          activeLayer={state.activeLayer}
        />
      </section>
    </div>
  );
}
```

```ts
// src/config/pageSurfaces.ts
actions: [
  { id: 'editor', label: '编辑键位', meta: '进入主编辑工作区' },
  { id: 'conflicts', label: '处理冲突', meta: '集中处理覆盖与冲突' },
  { id: 'import-export', label: '导入导出', meta: '管理 env、方案与速查表' },
]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/minimalSurface.test.tsx tests/pageSurfaces.test.ts`

Expected: PASS。

- [ ] **Step 5: 记录无法提交 Git**

Run: `Test-Path .git`

Expected: `False`
