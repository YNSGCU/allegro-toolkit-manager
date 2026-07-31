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
