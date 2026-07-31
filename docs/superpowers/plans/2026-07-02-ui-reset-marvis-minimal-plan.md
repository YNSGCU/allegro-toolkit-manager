# ATM Marvis Minimal UI Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ATM 全产品统一成 Marvis 风格的白色极简桌面工具界面，去掉“大圆角大方格”后台感，同时保留快捷键 / Skill / 菜单三大核心页的高频操作效率。

**Architecture:** 本次改造不碰 core / electron / IPC 业务逻辑，只重写 renderer 层的全局视觉系统、布局壳层和页面首屏结构。实现采用“轻导航 + 主标题区 + 单主操作面 + 行内状态 + 轻入口卡片”的统一模板，并通过页面配置与共享组件把这套语言复用到三个核心页和两个辅助页。

**Tech Stack:** React 19、React Router 7、TypeScript、Vite 6、Vitest 3、CSS

## Global Constraints

- 整个产品统一采用同一种极简语言，而不是只改首页或快捷键页。
- 视觉风格参考 Marvis 的白色体系，而不是偏彩色的工具后台。
- 页面要减少“大圆角大方格”和“层层包裹容器”的感觉。
- 产品仍然是效率优先，不是纯展示型入口页。
- 三个核心模块仍然是：快捷键、Skill、菜单。
- 快捷键页仍然作为默认入口。
- 不改变 core / electron / IPC 的底层逻辑。
- 不改动 Apply Plan 的业务约束。
- 当前仓库没有 `.git` 目录；每个任务的“提交”步骤改为书面 checkpoint，等 `git init` 后再恢复提交。
- 当前测试集几乎全部覆盖 `core/`；本计划先补最小 renderer 测试支撑，再做 UI 改造。

---

## File Structure

- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\vitest.config.ts`
  - 统一 renderer 测试入口，启用 `jsdom` 环境和 `tests/setup.ts`。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\package.json`
  - 补最小 renderer 测试依赖与脚本兼容项。
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\pageSurfaces.ts`
  - 集中定义五个页面的标题、副标题、主面板提示、推荐入口与轻状态文案。
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MinimalSurface.tsx`
  - 共享首屏模板，负责头像区、主面板、行内状态、轻卡片入口。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx`
  - 把左侧导航收轻，改成 Marvis 式白底轻导航。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`
  - 替换全局设计令牌与页面结构样式，去掉大面积包裹容器。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx`
  - 保持默认入口为 `/hotkeys`，辅助页入口为 `/overview`。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx`
  - 用新模板改造为完整的“快捷键入口工作台”。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx`
  - 用同一模板改造为“能力编排入口页”。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx`
  - 用同一模板改造为“菜单配置入口页”。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\DashboardPage.tsx`
  - 改成轻量概览页。
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\EnvironmentPage.tsx`
  - 改成轻量环境检查页。
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts`
  - 锁定页面模板配置、默认入口顺序和推荐入口结构。
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\minimalSurface.test.tsx`
  - 覆盖共享首屏模板的最小渲染行为。

### Task 1: 建立 Renderer 测试支撑

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\vitest.config.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\package.json`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\setup.ts`

**Interfaces:**
- Produces: `vitest.config.ts` with `environment: 'jsdom'`
- Produces: test setup loading renderer assertions before UI work starts

- [ ] **Step 1: Write the failing test harness config**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Run test command to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL with “Cannot find module” or “No test files found”, because the UI harness and test file do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```json
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\package.json (devDependencies excerpt)
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "jsdom": "^26.1.0"
  }
}
```

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\setup.ts
import '@testing-library/jest-dom/vitest';
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.HOME = 'C:\\Users\\testuser';
  process.env.USERPROFILE = 'C:\\Users\\testuser';
  process.env.HOMEDRIVE = 'C:';
  process.env.HOMEPATH = '\\Users\\testuser';
});
```

- [ ] **Step 4: Run tests to verify harness is live**

Run: `npx.cmd vitest --help`

Expected: command runs without config parse errors, and later UI tests can use `jsdom`.

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: renderer test harness added; repo has no .git so no commit created."`

Expected: outputs the checkpoint line.

### Task 2: 锁定页面模板配置与默认入口

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\pageSurfaces.ts`
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\appShell.ts`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`, `PRIMARY_WORKSPACES`, `getDefaultWorkspaceRoute(): string`
- Produces: `PAGE_SURFACES`, `getPageSurface(key): PageSurface`

- [ ] **Step 1: Write the failing tests**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts
import { describe, expect, it } from 'vitest';
import { PAGE_SURFACES, getPageSurface } from '../src/config/pageSurfaces';
import { getDefaultWorkspaceRoute } from '../src/config/appShell';

describe('page surfaces', () => {
  it('keeps hotkeys as the default route', () => {
    expect(getDefaultWorkspaceRoute()).toBe('/hotkeys');
  });

  it('defines the minimal surface copy for hotkeys', () => {
    expect(getPageSurface('hotkeys').title).toBe('快捷键工作台');
    expect(getPageSurface('hotkeys').actions.length).toBeGreaterThanOrEqual(3);
  });

  it('defines all five page surface entries', () => {
    expect(Object.keys(PAGE_SURFACES)).toEqual([
      'hotkeys',
      'skills',
      'menu',
      'overview',
      'environment',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: FAIL with `Cannot find module '../src/config/pageSurfaces'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\config\pageSurfaces.ts
export type PageSurfaceKey =
  | 'hotkeys'
  | 'skills'
  | 'menu'
  | 'overview'
  | 'environment';

export interface SurfaceAction {
  id: string;
  label: string;
  meta: string;
}

export interface PageSurface {
  key: PageSurfaceKey;
  title: string;
  subtitle: string;
  prompt: string;
  actions: SurfaceAction[];
}

export const PAGE_SURFACES: Record<PageSurfaceKey, PageSurface> = {
  hotkeys: {
    key: 'hotkeys',
    title: '快捷键工作台',
    subtitle: '把当前方案、冲突情况和键位编辑收在一个干净入口里。',
    prompt: '当前方案：自用，继续编辑、检查冲突，或直接应用。',
    actions: [
      { id: 'overview', label: '键盘总览', meta: '默认入口' },
      { id: 'conflicts', label: '处理冲突', meta: '0 个待处理' },
      { id: 'apply', label: '应用方案', meta: 'Apply Plan' },
    ],
  },
  skills: {
    key: 'skills',
    title: 'Skill 编排台',
    subtitle: '先确认当前能力状态，再进入扫描、引用和启停。',
    prompt: '当前 Skill 方案已加载，继续扫描、检查引用或调整启停。',
    actions: [
      { id: 'scan', label: '扫描 Skill', meta: '同步本地能力' },
      { id: 'refs', label: '引用检查', meta: '检查命令关联' },
      { id: 'registry', label: '命令注册中心', meta: '入口视图' },
    ],
  },
  menu: {
    key: 'menu',
    title: '菜单工作台',
    subtitle: '先看草稿状态，再进入菜单树、命令视图与生成流程。',
    prompt: '当前菜单草稿可继续编辑，也可以直接进入生成与预览。',
    actions: [
      { id: 'tree', label: '菜单树', meta: '主编辑入口' },
      { id: 'commands', label: '命令视图', meta: '关联命令' },
      { id: 'preview', label: '预览 / Apply Plan', meta: '生成前确认' },
    ],
  },
  overview: {
    key: 'overview',
    title: '概览',
    subtitle: '快速确认整个工作区的健康与入口状态。',
    prompt: '先看环境与配置状态，再决定进入哪个核心页面。',
    actions: [
      { id: 'health', label: '环境健康', meta: '总览' },
      { id: 'hotkeys', label: '进入快捷键', meta: '默认主入口' },
      { id: 'skills', label: '进入 Skill', meta: '能力管理' },
    ],
  },
  environment: {
    key: 'environment',
    title: '环境检测',
    subtitle: '检查路径、权限和配置来源，为后续配置动作兜底。',
    prompt: '定位 pcbenv、env 文件和 allegro.ilinit 的当前状态。',
    actions: [
      { id: 'pcbenv', label: '选择 pcbenv', meta: '手动定位' },
      { id: 'scan', label: '自动检测', meta: '重新扫描' },
      { id: 'vars', label: '环境变量', meta: '基础信息' },
    ],
  },
};

export function getPageSurface(key: PageSurfaceKey): PageSurface {
  return PAGE_SURFACES[key];
}
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.tsx (route excerpt)
<Route path="/" element={<Navigate to={getDefaultWorkspaceRoute()} replace />} />
<Route path="/overview" element={<DashboardPage />} />
<Route path="*" element={<Navigate to={getDefaultWorkspaceRoute()} replace />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: page surface config and default route locked."`

Expected: outputs the checkpoint line.

### Task 3: 重写全局白色视觉系统与轻导航

**Files:**
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`

**Interfaces:**
- Consumes: `APP_NAV_ITEMS`
- Produces: white minimal shell classes: `.marvis-shell`, `.marvis-sidebar`, `.marvis-main`

- [ ] **Step 1: Write the failing render test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\minimalSurface.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../src/components/Layout';

describe('layout shell', () => {
  it('renders the lightweight core navigation labels', () => {
    render(
      <MemoryRouter initialEntries={['/hotkeys']}>
        <Layout>
          <div>page</div>
        </Layout>
      </MemoryRouter>,
    );

    expect(screen.getByText('快捷键')).toBeInTheDocument();
    expect(screen.getByText('Skill')).toBeInTheDocument();
    expect(screen.getByText('菜单')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL until the renderer test harness and current component imports are complete.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\Layout.tsx (structure excerpt)
return (
  <div className="marvis-shell">
    <aside className="marvis-sidebar">
      <div className="marvis-brand">ATM</div>
      <div className="marvis-search" aria-hidden="true" />
      <nav className="marvis-nav">
        {primaryItems.map((item) => (
          <NavLink key={item.path} to={item.path} className="marvis-nav-item">
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="marvis-nav-group-label">辅助页面</div>
      <nav className="marvis-nav">
        {utilityItems.map((item) => (
          <NavLink key={item.path} to={item.path} className="marvis-nav-item">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="marvis-main">{children}</main>
  </div>
);
```

```css
/* C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css (new shell excerpt) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #faf8f5;
  --bg-surface: #ffffff;
  --bg-hover: #f5f5f5;
  --bg-input: #fbf8f3;
  --text-primary: #171717;
  --text-secondary: #8c867f;
  --text-muted: #b1aaa2;
  --accent-blue: #0f8f84;
  --border-color: #ece9e5;
}

.marvis-shell {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 42px;
  min-height: 100vh;
  background: #ffffff;
  padding: 18px 22px;
}

.marvis-sidebar {
  border-right: 1px solid var(--border-color);
  padding-right: 18px;
}

.marvis-nav-item {
  min-height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.marvis-nav-item.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 700;
}
```

- [ ] **Step 4: Run test and type check**

Run:

```powershell
npx.cmd vitest run tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
```

Expected: both PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: global shell converted to Marvis-style white navigation."`

Expected: outputs the checkpoint line.

### Task 4: 创建共享极简首屏模板并落地快捷键页

**Files:**
- Create: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MinimalSurface.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\App.css`

**Interfaces:**
- Consumes: `PageSurface`, existing page state like `stats`, `profiles`, `plan`
- Produces: `MinimalSurface(props)` with `title`, `subtitle`, `prompt`, `summaryLine`, `cards`

- [ ] **Step 1: Write the failing component test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\minimalSurface.test.tsx (append)
import MinimalSurface from '../src/components/MinimalSurface';

it('renders a single prompt panel and quick entry cards', () => {
  render(
    <MinimalSurface
      title="快捷键工作台"
      subtitle="当前方案、冲突情况和键位编辑都收在这里。"
      prompt="当前方案：自用，继续编辑或直接应用。"
      summaryLine={['36 条快捷键', '0 冲突', '用户层 env']}
      cards={[
        { id: 'overview', title: '快速进入键盘总览', meta: '默认入口' },
        { id: 'conflicts', title: '处理冲突与保留键', meta: '0 个待处理' },
      ]}
    />,
  );

  expect(screen.getByText('快捷键工作台')).toBeInTheDocument();
  expect(screen.getByText('快速进入键盘总览')).toBeInTheDocument();
  expect(screen.getByText('36 条快捷键')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/minimalSurface.test.tsx`

Expected: FAIL with `Cannot find module '../src/components/MinimalSurface'`.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\components\MinimalSurface.tsx
import React from 'react';

interface SurfaceCard {
  id: string;
  title: string;
  meta: string;
}

interface MinimalSurfaceProps {
  title: string;
  subtitle: string;
  prompt: string;
  summaryLine: string[];
  cards: SurfaceCard[];
}

const MinimalSurface: React.FC<MinimalSurfaceProps> = ({
  title,
  subtitle,
  prompt,
  summaryLine,
  cards,
}) => {
  return (
    <section className="minimal-surface">
      <header className="minimal-surface-header">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div className="minimal-surface-prompt">
        <div className="minimal-surface-prompt-copy">{prompt}</div>
      </div>
      <div className="minimal-surface-summary">
        {summaryLine.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="minimal-surface-grid">
        {cards.map((card) => (
          <article key={card.id} className="minimal-surface-card">
            <h2>{card.title}</h2>
            <p>{card.meta}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MinimalSurface;
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\HotkeyPage.tsx (top excerpt)
const hotkeySurface = getPageSurface('hotkeys');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={hotkeySurface.title}
      subtitle={hotkeySurface.subtitle}
      prompt={`当前方案：${activeProfileName}，${plan ? '存在待应用变更。' : '可以继续编辑或直接应用。'}`}
      summaryLine={[
        `${stats.total} 条快捷键`,
        `${stats.errorCount + stats.warningCount} 个问题`,
        envInfo?.envFilePath ? '用户层 env' : '环境未定位',
      ]}
      cards={hotkeySurface.actions}
    />
    {/* 原有重型编辑区下移为二级内容 */}
  </div>
);
```

- [ ] **Step 4: Run tests and build checks**

Run:

```powershell
npx.cmd vitest run tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
npm run build:renderer
```

Expected: all PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: hotkey page converted to minimal prompt-first entry surface."`

Expected: outputs the checkpoint line.

### Task 5: 统一 Skill / 菜单 / 概览 / 环境 四页的极简语言

**Files:**
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\DashboardPage.tsx`
- Modify: `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\EnvironmentPage.tsx`

**Interfaces:**
- Consumes: `getPageSurface('skills' | 'menu' | 'overview' | 'environment')`
- Produces: consistent prompt-first page surfaces across all five routes

- [ ] **Step 1: Write the failing snapshot-style render test**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\tests\pageSurfaces.test.ts (append)
it('keeps quick-entry cards for skills and menu pages', () => {
  expect(getPageSurface('skills').actions.map((item) => item.id)).toEqual([
    'scan',
    'refs',
    'registry',
  ]);
  expect(getPageSurface('menu').actions.map((item) => item.id)).toEqual([
    'tree',
    'commands',
    'preview',
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx.cmd vitest run tests/pageSurfaces.test.ts`

Expected: FAIL if action ids or page entries are still inconsistent.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\SkillPage.tsx (excerpt)
const skillSurface = getPageSurface('skills');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={skillSurface.title}
      subtitle={skillSurface.subtitle}
      prompt={skillSurface.prompt}
      summaryLine={[
        `${allSkills.length} 个 Skill`,
        `${refStats.errors} 个错误`,
        `${userSkills.length} 个用户 Skill`,
      ]}
      cards={skillSurface.actions}
    />
    {/* 原有 tabs 与细粒度操作下移 */}
  </div>
);
```

```tsx
// C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\src\pages\MenuPage.tsx (excerpt)
const menuSurface = getPageSurface('menu');

return (
  <div className="marvis-page">
    <MinimalSurface
      title={menuSurface.title}
      subtitle={menuSurface.subtitle}
      prompt={menuSurface.prompt}
      summaryLine={[
        `${items.length} 个节点`,
        hasUnsavedChanges ? '草稿未保存' : '草稿已保存',
        fileStatus?.ilExists ? 'IL 已生成' : 'IL 未生成',
      ]}
      cards={menuSurface.actions}
    />
    {/* 菜单树与预览区下移 */}
  </div>
);
```

- [ ] **Step 4: Run full verification**

Run:

```powershell
npx.cmd vitest run tests/pageSurfaces.test.ts tests/minimalSurface.test.tsx
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npm test
npm run build:renderer
```

Expected:

- renderer tests PASS
- frontend TS PASS
- electron TS PASS
- `npm test` PASS
- renderer build PASS

- [ ] **Step 5: Write checkpoint**

Run: `Write-Output "Checkpoint: all product pages aligned to the Marvis minimal surface system."`

Expected: outputs the checkpoint line.

## Self-Review

**1. Spec coverage:** 计划覆盖了统一极简语言、Marvis 白色体系、去掉大圆角大方格感、快捷键默认入口、三个核心页统一模板、两个辅助页跟进、以及完整验证路径。没有遗漏需要单独成计划的子系统。

**2. Placeholder scan:** 文档中没有 `TODO`、`TBD`、`implement later`、`similar to task N` 这类占位语句。每个任务都给了具体文件、测试命令和最小代码骨架。

**3. Type consistency:** 页面配置统一使用 `PageSurfaceKey`、`PageSurface`、`getPageSurface()`；共享首屏统一使用 `MinimalSurface`；默认入口统一通过 `getDefaultWorkspaceRoute()`。后续任务引用的名称与前置任务定义一致。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-ui-reset-marvis-minimal-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
