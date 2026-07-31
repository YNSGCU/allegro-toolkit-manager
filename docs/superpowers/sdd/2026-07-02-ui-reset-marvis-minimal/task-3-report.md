# Task 3 报告

## 范围

- 负责文件：`src/components/Layout.tsx`
- 负责文件：`src/App.css`
- 负责文件：`tests/minimalSurface.test.tsx`
- 未改动 `core/`、`electron/`、IPC 与 page 组件结构

## TDD 过程

1. 先新增 `tests/minimalSurface.test.tsx`，约束新外壳必须提供：
   - `.marvis-shell`
   - `.marvis-sidebar`
   - `.marvis-main`
   - 核心模块 / 辅助模块分组
   - 五个导航标签可见
   - 不再渲染旧的 `Allegro Workspace` 文案
2. 运行 `npx.cmd vitest run tests/minimalSurface.test.tsx`
   - 首次失败
   - 失败原因先是测试字面量被当前仓库中文编码污染，修正为读取 `APP_NAV_ITEMS` 后再次运行
   - 第二次失败为预期红灯：当前 `Layout` 尚未输出 `.marvis-*` 壳层
3. 在红灯后实现最小改动并重跑测试至通过

## 实现内容

### `src/components/Layout.tsx`

- 移除 `NavGlyph`
- 移除大块说明文案
- 移除 sidebar note
- 保留并明确分组：
  - 核心模块：`hotkeys / skills / menu`
  - 辅助模块：`overview / environment`
- 新外壳改为：
  - `.marvis-shell`
  - `.marvis-sidebar`
  - `.marvis-main`
- 导航项只保留轻量文字标签，不再显示 summary

### `src/App.css`

- 追加最小白色外壳 reset，覆盖旧的厚重侧栏视觉
- 将整体背景收回纯白主界面
- 为 `Layout` 新增 `.marvis-*` 样式
- 对现有常用 surface 做轻量化兼容覆盖：
  - `workspace-hero`
  - `profile-bar`
  - `global-status-bar`
  - `card`
  - 常用按钮 / pills / dropdown / modal 容器
- 目标是降低大圆角、大卡片拼贴感和“框套框”观感，同时不改 page 组件结构

## 验证

- `npx.cmd vitest run tests/minimalSurface.test.tsx` ✅
- `npx.cmd tsc --noEmit` ✅
- `Write-Output "Checkpoint: global shell converted to Marvis-style white navigation."` ✅

## 风险与关注点

- 仓库内中文文案当前存在编码异常，测试里已避免直接硬编码受污染字符串，但 UI 文案本体不在本 task 修复范围内。
- `App.css` 体量很大，当前采用“末尾覆盖”策略做最小兼容；这能避免误伤他人改动，但旧样式定义仍然留在文件中。
