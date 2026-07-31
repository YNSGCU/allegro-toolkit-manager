# ATM UI Reset Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 ATM 第一阶段 UI 重置，让应用以快捷键为默认入口，并统一快捷键 / Skill / 菜单三页的全局布局与视觉外壳。

**Architecture:** 保持现有业务逻辑与 IPC 不变，新增一个轻量的应用骨架配置层，让导航、页面元信息与共享页面外壳从 UI 组件中解耦。样式层以 `src/App.css` 为主，集中替换设计令牌、布局骨架和共享组件观感。

**Tech Stack:** React 19、React Router 7、TypeScript、Vite 6、Vitest 3、CSS

## Global Constraints

- 第一阶段不重写 core / electron / IPC 逻辑。
- 第一阶段不整体拆分 HotkeyPage、SkillPage、MenuPage 的大文件。
- 不新增独立业务路由，只调整默认入口与导航优先级。
- 不使用 emoji 作为主 UI 图标。
- 必须先写最小失败测试，再改生产代码。
- 所有手工文件修改使用 `apply_patch`。

---

### Task 1: 建立应用骨架配置与测试

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\appShell.ts`
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\appShell.test.ts`

**Interfaces:**
- Produces: `APP_NAV_ITEMS`, `PRIMARY_WORKSPACES`, `getDefaultWorkspaceRoute(): string`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, PRIMARY_WORKSPACES, getDefaultWorkspaceRoute } from '../src/config/appShell';

describe('app shell config', () => {
  it('uses hotkeys as the default workspace route', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
  });

  it('keeps hotkeys, skills and menu as primary workspaces', () => {
    expect(PRIMARY_WORKSPACES.map((item) => item.key)).toEqual(['hotkeys', 'skills', 'menu']);
  });

  it('keeps overview and environment as utility entries', () => {
    const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');
    expect(utilityItems.map((item) => item.key)).toEqual(['overview', 'environment']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx.cmd vitest run tests/appShell.test.ts`

Expected: FAIL，原因是 `src/config/appShell.ts` 不存在。

- [ ] **Step 3: 写最小实现**

```ts
export type AppNavGroup = 'primary' | 'utility';

export interface AppNavItem {
  key: string;
  label: string;
  path: string;
  group: AppNavGroup;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { key: 'hotkeys', label: '快捷键', path: '/hotkeys', group: 'primary' },
  { key: 'skills', label: 'Skill', path: '/skills', group: 'primary' },
  { key: 'menu', label: '菜单', path: '/menu', group: 'primary' },
  { key: 'overview', label: '概览', path: '/', group: 'utility' },
  { key: 'environment', label: '环境', path: '/environment', group: 'utility' },
];

export const PRIMARY_WORKSPACES = APP_NAV_ITEMS.filter((item) => item.group === 'primary');

export function getDefaultWorkspaceRoute(): string {
  return '/hotkeys';
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx.cmd vitest run tests/appShell.test.ts`

Expected: PASS

### Task 2: 重做全局布局与共享条组件

**Files:**
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\ProfileBar.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\GlobalStatusBar.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MoreActionsMenu.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`
- Consumes: `APP_NAV_ITEMS`, `getDefaultWorkspaceRoute()`

**Interfaces:**
- Produces: 新版侧边导航、默认快捷键入口、浅色设计令牌、统一顶部条外观

- [ ] **Step 1: 让 `App.tsx` 使用默认工作区路由**

```tsx
import { getDefaultWorkspaceRoute } from './config/appShell';

<Route path="*" element={<Navigate to={getDefaultWorkspaceRoute()} replace />} />
```

- [ ] **Step 2: 用配置驱动 `Layout.tsx` 并去掉 emoji 图标**

```tsx
import { APP_NAV_ITEMS } from '../config/appShell';

const primaryItems = APP_NAV_ITEMS.filter((item) => item.group === 'primary');
const utilityItems = APP_NAV_ITEMS.filter((item) => item.group === 'utility');
```

- [ ] **Step 3: 重写共享条组件结构，保留原始 props，不改业务调用**

```tsx
<div className="profile-bar">...</div>
<div className="global-status-bar">...</div>
<div className="more-actions-wrapper">...</div>
```

- [ ] **Step 4: 在 `src/App.css` 中替换根级设计令牌与布局骨架**

```css
:root {
  --bg-primary: #f5f3ee;
  --bg-secondary: #fbfaf7;
  --bg-surface: #ffffff;
  --bg-hover: #f1ece4;
  --text-primary: #171717;
  --text-secondary: #5f5a52;
  --text-muted: #8d877f;
  --accent-blue: #0d9488;
  --accent-green: #0f766e;
  --accent-yellow: #d97706;
  --accent-red: #dc2626;
  --border-color: #e8e1d8;
  --shadow: 0 18px 40px rgba(43, 33, 20, 0.08);
}
```

- [ ] **Step 5: 运行类型检查**

Run: `npx.cmd tsc --noEmit`

Expected: PASS

### Task 3: 重做三个核心页的页面外壳

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\CoreWorkspaceHero.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\DashboardPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\EnvironmentPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`

**Interfaces:**
- Produces: `CoreWorkspaceHero` 共享英雄区；三大页面统一的“英雄区 + 方案区 + 状态区 + 工作区”节奏

- [ ] **Step 1: 新建共享英雄区组件**

```tsx
interface HeroMetric {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'warning';
}

interface CoreWorkspaceHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  metrics: HeroMetric[];
  actions?: React.ReactNode;
}
```

- [ ] **Step 2: 在 `HotkeyPage.tsx` 顶部替换旧 `page-header`**

```tsx
<div className="workspace-page">
  <CoreWorkspaceHero ... />
  <ProfileBar ... />
  <GlobalStatusBar ... />
```

- [ ] **Step 3: 在 `SkillPage.tsx`、`MenuPage.tsx` 套用同样骨架**

```tsx
<div className="workspace-page workspace-page-skill">...</div>
<div className="workspace-page workspace-page-menu">...</div>
```

- [ ] **Step 4: 让 Dashboard / Environment 跟随新壳层节奏**

```tsx
<div className="workspace-page utility-page">...</div>
```

- [ ] **Step 5: 跑完整验证**

Run:

```powershell
npx.cmd vitest run tests/appShell.test.ts
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npm test
npm run build:renderer
```

Expected:

- `tests/appShell.test.ts` PASS
- 两个 TypeScript 检查 PASS
- `npm test` PASS
- `npm run build:renderer` PASS

## Self-Review

- 规格覆盖：计划覆盖了默认入口、导航层级、全局设计令牌、共享条组件、三大核心页外壳重构。
- 无占位词：没有使用 TODO / TBD。
- 类型一致性：`APP_NAV_ITEMS` / `PRIMARY_WORKSPACES` / `getDefaultWorkspaceRoute()` 在测试与布局中保持一致。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-ui-reset-phase1.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Current session assumption: 用户已选择 Inline Execution，因此直接在当前会话执行第一阶段。
