# 快捷键工作台拆分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前单页巨石式快捷键页面拆成“总览 / 编辑 / 冲突 / 导入导出”四个子工作区，同时保留现有数据加载、编辑、诊断和导入导出能力。

**Architecture:** 保留左侧一级导航与 `/hotkeys` 入口不变，在快捷键模块内部新增二级子路由。`HotkeyWorkspacePage` 作为共享容器承接现有 `HotkeyPage` 的数据加载与事件分发，四个子面板只消费整理后的状态与回调。第一轮以“结构拆分 + 组件复挂”为主，不重写 `core/`、`electron/` 和 IPC。

**Tech Stack:** React 19、React Router 7、TypeScript、Vitest、现有 `window.atm` IPC 接口、现有 `MinimalSurface` / `ProfileBar` / `KeyboardVisualizer` 等组件。

## Global Constraints

- 一级导航保持不变：快捷键、Skill、菜单、概览、环境。
- 快捷键模块内部必须拆成四个子工作区：`/hotkeys/overview`、`/hotkeys/editor`、`/hotkeys/conflicts`、`/hotkeys/import-export`。
- 默认进入 `/hotkeys` 时必须重定向到 `/hotkeys/overview`。
- 不改动 `core/`、`electron/`、IPC 协议和快捷键解析/校验规则。
- 视觉继续沿用当前白色极简主题，不把所有功能重新塞回同一页。
- 第一轮优先做结构拆分与组件复挂，不强行重写所有弹窗。
- 所有验证必须至少覆盖：`npm test`、`npx.cmd tsc --noEmit`、`npx.cmd tsc -p tsconfig.electron.json --noEmit`、`npm run build:renderer`。
- 仓库当前没有 `.git`，所有“提交”步骤改为显式记录“跳过 commit，因为仓库未初始化 Git”。

---

### Task 1: 建立快捷键子路由与二级导航骨架

**Files:**
- Create: `src/components/hotkeys/hotkeyWorkspaceSections.ts`
- Create: `src/components/hotkeys/HotkeySubnav.tsx`
- Create: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/HotkeyPage.tsx`
- Modify: `src/App.css`
- Test: `tests/hotkeyWorkspaceRouting.test.tsx`

**Interfaces:**
- Consumes: `react-router-dom` 中的 `NavLink`、`Navigate`、`Route`、`Routes`
- Produces:
  - `HOTKEY_WORKSPACE_SECTIONS: readonly { key: 'overview' | 'editor' | 'conflicts' | 'import-export'; label: string; path: string; summary: string }[]`
  - `HotkeySubnav(): JSX.Element`
  - `HotkeyWorkspacePage(): JSX.Element`

- [ ] **Step 1: 写失败测试**

```tsx
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HotkeyWorkspacePage from '../src/pages/HotkeyWorkspacePage';

function mockAtm() {
  Object.defineProperty(window, 'atm', {
    writable: true,
    value: {
      locateEnvironment: vi.fn().mockResolvedValue({ success: true, data: { envExists: false, warnings: [], pcbenvPath: null, envFilePath: null } }),
      listProfiles: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getAppliedHotkeyProfile: vi.fn().mockResolvedValue({ success: true, data: { profileId: '' } }),
    },
  });
}

describe('hotkey workspace routing', () => {
  it('redirects /hotkeys to /hotkeys/overview and renders subnav labels', async () => {
    mockAtm();

    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Routes>
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: '总览' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '编辑' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '冲突' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '导入导出' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`

Expected: FAIL，报错找不到 `HotkeyWorkspacePage` 或找不到“总览 / 编辑 / 冲突 / 导入导出”子导航。

- [ ] **Step 3: 写最小实现**

```ts
// src/components/hotkeys/hotkeyWorkspaceSections.ts
export const HOTKEY_WORKSPACE_SECTIONS = [
  { key: 'overview', label: '总览', path: '/hotkeys/overview', summary: '查看当前方案与键盘占用' },
  { key: 'editor', label: '编辑', path: '/hotkeys/editor', summary: '查找、修改、新增和删除快捷键' },
  { key: 'conflicts', label: '冲突', path: '/hotkeys/conflicts', summary: '集中处理冲突与覆盖风险' },
  { key: 'import-export', label: '导入导出', path: '/hotkeys/import-export', summary: '导入 env、方案与导出速查表' },
] as const;

export type HotkeyWorkspaceSectionKey =
  (typeof HOTKEY_WORKSPACE_SECTIONS)[number]['key'];
```

```tsx
// src/components/hotkeys/HotkeySubnav.tsx
import { NavLink } from 'react-router-dom';
import { HOTKEY_WORKSPACE_SECTIONS } from './hotkeyWorkspaceSections';

export default function HotkeySubnav() {
  return (
    <nav className="hotkey-subnav" aria-label="快捷键工作区">
      {HOTKEY_WORKSPACE_SECTIONS.map((section) => (
        <NavLink
          key={section.key}
          to={section.path}
          className={({ isActive }) => `hotkey-subnav-link${isActive ? ' active' : ''}`}
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

```tsx
// src/pages/HotkeyWorkspacePage.tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import HotkeySubnav from '../components/hotkeys/HotkeySubnav';

const Placeholder = ({ title }: { title: string }) => <section aria-label={title}>{title}</section>;

export default function HotkeyWorkspacePage() {
  return (
    <div className="hotkey-workspace-page">
      <HotkeySubnav />
      <Routes>
        <Route path="/" element={<Navigate to="/hotkeys/overview" replace />} />
        <Route path="/overview" element={<Placeholder title="快捷键总览" />} />
        <Route path="/editor" element={<Placeholder title="键位编辑" />} />
        <Route path="/conflicts" element={<Placeholder title="冲突处理" />} />
        <Route path="/import-export" element={<Placeholder title="导入导出" />} />
      </Routes>
    </div>
  );
}
```

```tsx
// src/pages/HotkeyPage.tsx
import HotkeyWorkspacePage from './HotkeyWorkspacePage';

export default HotkeyWorkspacePage;
```

```tsx
// src/App.tsx
<Route path="/hotkeys/*" element={<HotkeyPage />} />
```

```css
/* src/App.css */
.hotkey-subnav {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.hotkey-subnav-link {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 6px 0;
  border-bottom: 1px solid transparent;
}

.hotkey-subnav-link.active {
  color: var(--accent-teal);
  border-color: var(--accent-teal);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`

Expected: PASS。

- [ ] **Step 5: 记录无法提交 Git**

Run: `Test-Path .git`

Expected: `False`

Then: 在计划文档对应任务前打勾，明确注明“仓库未初始化 Git，跳过 commit”。

### Task 2: 抽出共享容器，承接 HotkeyPage 的现有数据与事件

**Files:**
- Create: `src/components/hotkeys/types.ts`
- Modify: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/pages/HotkeyPage.tsx`
- Test: `tests/hotkeyWorkspacePanels.test.tsx`

**Interfaces:**
- Consumes: `window.atm` 的 `locateEnvironment`、`parseEnvFile`、`validateHotkeys`、`listProfiles`、`getAppliedHotkeyProfile`、`scanAllEnvironments`、`loadFavorites`、`getLastChange`
- Produces:
  - `HotkeyWorkspaceSharedState`
  - `HotkeyWorkspaceActions`
  - 四个子面板的 props 基础接口

- [ ] **Step 1: 写失败测试**

```tsx
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HotkeyWorkspacePage from '../src/pages/HotkeyWorkspacePage';

describe('hotkey workspace shared data', () => {
  it('loads shared data once and shows the same profile summary on overview', async () => {
    const locateEnvironment = vi.fn().mockResolvedValue({
      success: true,
      data: {
        envExists: false,
        envFilePath: null,
        pcbenvPath: null,
        warnings: [],
      },
    });

    Object.defineProperty(window, 'atm', {
      writable: true,
      value: {
        locateEnvironment,
        listProfiles: vi.fn().mockResolvedValue({ success: true, data: [{ id: 'default', name: '默认方案', bindings: [] }] }),
        getAppliedHotkeyProfile: vi.fn().mockResolvedValue({ success: true, data: { profileId: 'default' } }),
        scanAllEnvironments: vi.fn().mockResolvedValue({ success: true, data: { sources: { sources: [] }, settings: null } }),
        loadFavorites: vi.fn().mockResolvedValue({ success: true, data: { favoriteBindingIds: [] } }),
        getLastChange: vi.fn().mockResolvedValue({ success: true, data: { canUndo: false } }),
      },
    });

    render(
      <MemoryRouter initialEntries={['/hotkeys/overview']}>
        <Routes>
          <Route path="/hotkeys/*" element={<HotkeyWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('默认方案')).toBeInTheDocument();
    expect(locateEnvironment).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: FAIL，原因是当前 `HotkeyWorkspacePage` 还是占位组件，无法显示共享数据。

- [ ] **Step 3: 写最小实现**

```ts
// src/components/hotkeys/types.ts
import type { ApplyPlan, Conflict, HotkeyBinding, HotkeyProfile, EnhancedConflict } from '../../types/hotkey';
import type { EnvironmentInfo, EnvSourceList, AtmSettings } from '../../types/environment';
import type { ActiveLayer } from '../../utils/hotkeyItem';
import type { MapFilter, MapViewMode } from '../HotkeyMap';

export interface HotkeyWorkspaceStats {
  total: number;
  funckeyCount: number;
  aliasCount: number;
  errorCount: number;
  warningCount: number;
  overlayConflictCount: number;
}

export interface HotkeyWorkspaceSharedState {
  loading: boolean;
  error: string | null;
  envInfo: EnvironmentInfo | null;
  profiles: HotkeyProfile[];
  activeProfileId: string;
  appliedProfileId: string;
  bindings: HotkeyBinding[];
  reservedBindings: HotkeyBinding[];
  filteredConflicts: Conflict[];
  enhancedConflicts: EnhancedConflict[];
  activeLayer: ActiveLayer;
  viewMode: MapViewMode;
  mapFilter: MapFilter;
  searchQuery: string;
  stats: HotkeyWorkspaceStats;
  envSources: EnvSourceList | null;
  settings: AtmSettings | null;
}

export interface HotkeyWorkspaceActions {
  selectedBindingId: string | null;
  tableBindings: HotkeyBinding[];
  conflictIgnoreList: string[];
  plan: ApplyPlan | null;
  setSelectedBindingId: (value: string | null) => void;
  setSearchQuery: (value: string) => void;
  setMapFilter: (value: MapFilter) => void;
  setShowExportDialog: (value: boolean) => void;
  setShowChangeHistory: (value: boolean) => void;
  handleEditBinding: (binding: HotkeyBinding) => void;
  handleAdoptBinding: (binding: HotkeyBinding) => void;
  handleOverrideSource: (binding: HotkeyBinding) => void;
  handleEditBindingById: (bindingId: string) => void;
  handleIgnoreConflict: (conflictId: string) => void;
  handleViewRawLine: (filePath: string, lineNumber: number, isReference?: boolean) => void;
  handleOverrideByCommand: (command: string) => void;
  handleApplyPlan: () => Promise<void>;
  clearPlan: () => void;
  handleEnvImportClick: () => void;
  handleImportProfileClick: () => void;
  handleExportProfile: () => Promise<void>;
}
```

```tsx
// src/pages/HotkeyWorkspacePage.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HotkeySubnav from '../components/hotkeys/HotkeySubnav';
import type { HotkeyWorkspaceSharedState } from '../components/hotkeys/types';
import { enrichWithPhysicalKey, filterHotkeysByKeyboardLayer } from '../utils/hotkeyItem';

export default function HotkeyWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState('');
  const [appliedProfileId, setAppliedProfileId] = useState('');
  const [bindings, setBindings] = useState<any[]>([]);
  const [reservedBindings, setReservedBindings] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const envResult = await window.atm.locateEnvironment();
      const profileResult = await window.atm.listProfiles();
      const appliedResult = await window.atm.getAppliedHotkeyProfile();

      if (profileResult.success && profileResult.data) {
        setProfiles(profileResult.data);
        if (!activeProfileId && profileResult.data.length > 0) {
          setActiveProfileId(profileResult.data[0].id);
        }
      }

      if (appliedResult.success && appliedResult.data) {
        setAppliedProfileId(appliedResult.data.profileId || '');
      }

      if (!envResult.success) {
        setError(envResult.error || '环境检测失败');
      }
    } finally {
      setLoading(false);
    }
  }, [activeProfileId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const enrichedBindings = useMemo(() => bindings.map((binding) => enrichWithPhysicalKey(binding)), [bindings]);
  const layerFilteredBindings = useMemo(() => filterHotkeysByKeyboardLayer(enrichedBindings, 'normal'), [enrichedBindings]);

  const sharedState: HotkeyWorkspaceSharedState = {
    loading,
    error,
    envInfo: null,
    profiles,
    activeProfileId,
    appliedProfileId,
    bindings: layerFilteredBindings,
    reservedBindings,
    filteredConflicts: conflicts,
    enhancedConflicts: [],
    activeLayer: 'normal',
    viewMode: 'my',
    mapFilter: 'all',
    searchQuery: '',
    stats: {
      total: layerFilteredBindings.length,
      funckeyCount: layerFilteredBindings.filter((item) => item.type === 'funckey').length,
      aliasCount: layerFilteredBindings.filter((item) => item.type === 'alias').length,
      errorCount: conflicts.filter((item) => item.severity === 'error').length,
      warningCount: conflicts.filter((item) => item.severity === 'warning').length,
      overlayConflictCount: 0,
    },
    envSources: null,
    settings: null,
  };

  return (
    <div className="hotkey-workspace-page">
      <HotkeySubnav />
      <Routes>
        <Route path="/" element={<Navigate to="/hotkeys/overview" replace />} />
        <Route path="/overview" element={<section aria-label="快捷键总览">快捷键总览</section>} />
        <Route path="/editor" element={<section aria-label="键位编辑">键位编辑</section>} />
        <Route path="/conflicts" element={<section aria-label="冲突处理">冲突处理</section>} />
        <Route path="/import-export" element={<section aria-label="导入导出">导入导出</section>} />
      </Routes>
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: PASS，且 `locateEnvironment` 只调用一次。

- [ ] **Step 5: 记录无法提交 Git**

Run: `Test-Path .git`

Expected: `False`

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

### Task 6: 落地“导入导出”子页并完成总体验证

**Files:**
- Create: `src/components/hotkeys/HotkeyImportExportPanel.tsx`
- Modify: `src/pages/HotkeyWorkspacePage.tsx`
- Modify: `src/App.css`
- Modify: `tests/pageSurfaces.test.ts`
- Test: `tests/hotkeyWorkspacePanels.test.tsx`

**Interfaces:**
- Consumes:
  - `ImportPreviewDialog.tsx`
  - `EnvImportDialog.tsx`
  - `ExportCheatsheetDialog.tsx`
  - `ChangeHistoryDialog.tsx`
- Produces:
  - `HotkeyImportExportPanel(props: { state: HotkeyWorkspaceSharedState; actions: HotkeyWorkspaceActions }): JSX.Element`

- [ ] **Step 1: 写失败测试**

```tsx
it('renders import-export route with import and export entry actions', async () => {
  renderHotkeyWorkspace('/hotkeys/import-export');

  expect(await screen.findByText('导入导出')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导入 env' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导入方案' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出方案' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '导出速查表' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认它失败**

Run: `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

Expected: FAIL，导入导出路由还是占位内容。

- [ ] **Step 3: 写最小实现**

```tsx
// src/components/hotkeys/HotkeyImportExportPanel.tsx
import type { HotkeyWorkspaceActions, HotkeyWorkspaceSharedState } from './types';

export default function HotkeyImportExportPanel({
  state,
  actions,
}: {
  state: HotkeyWorkspaceSharedState;
  actions: HotkeyWorkspaceActions;
}) {
  return (
    <section className="hotkey-import-export-panel" aria-label="导入导出">
      <header className="workspace-section-header">
        <h1>导入导出</h1>
        <p>管理 env、方案和速查表的输入输出操作。</p>
      </header>

      <div className="hotkey-io-actions">
        <button className="btn btn-primary" onClick={actions.handleEnvImportClick}>导入 env</button>
        <button className="btn" onClick={actions.handleImportProfileClick}>导入方案</button>
        <button className="btn" onClick={actions.handleExportProfile}>导出方案</button>
        <button className="btn" onClick={() => actions.setShowExportDialog(true)}>导出速查表</button>
        <button className="btn" onClick={() => actions.setShowChangeHistory(true)}>变更历史</button>
      </div>

      <div className="workspace-status-strip">
        <span>{state.envSources?.sources.length || 0} 个 env 来源</span>
        <span>{state.profiles.length} 个方案</span>
        <span>{state.stats.total} 条快捷键</span>
      </div>
    </section>
  );
}
```

```ts
// tests/pageSurfaces.test.ts
expect(getPageSurface('hotkeys').actions.map((item) => item.id)).toEqual([
  'editor',
  'conflicts',
  'import-export',
]);
```

- [ ] **Step 4: 运行全量验证**

Run: `npm test`

Expected: PASS。

Run: `npx.cmd tsc --noEmit`

Expected: PASS。

Run: `npx.cmd tsc -p tsconfig.electron.json --noEmit`

Expected: PASS。

Run: `npm run build:renderer`

Expected: PASS，允许保留既有 chunk size warning，但不得出现新的 TypeScript 或构建错误。

- [ ] **Step 5: 记录无法提交 Git**

Run: `Test-Path .git`

Expected: `False`

## Self-Review

### Spec coverage

- 一级导航不变：Task 1 只改 `/hotkeys/*` 内部路由，不碰左侧一级导航结构。
- 四个子工作区：Task 1 建骨架，Task 3-6 分别落地总览、编辑、冲突、导入导出。
- 默认进入 `/hotkeys/overview`：Task 1 覆盖。
- 共享数据单源：Task 2 覆盖。
- 结构拆分优先、不动 core/electron：全部任务都只在 `src/` 和 `tests/` 内动作。
- 白色极简主题延续：Task 1、3、4、5、6 都通过 `src/App.css` 局部新增样式实现。

### Placeholder scan

- 已检查无 `TODO`、`TBD`、`之后补`、`类似 Task N` 之类占位语。
- 每个任务都给出了明确文件、命令与预期结果。

### Type consistency

- 子工作区 key 统一为 `overview | editor | conflicts | import-export`。
- 顶层容器统一命名为 `HotkeyWorkspacePage`。
- 二级导航统一来自 `HOTKEY_WORKSPACE_SECTIONS`。
- 子面板统一消费 `HotkeyWorkspaceSharedState` 与 `HotkeyWorkspaceActions`。

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-02-hotkey-workspace-split-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
