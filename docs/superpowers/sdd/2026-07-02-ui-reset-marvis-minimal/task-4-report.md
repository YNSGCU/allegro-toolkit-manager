# Task 4 Report

## 状态

已完成。快捷键页首屏从 `CoreWorkspaceHero + 统计卡` 收敛为共享的 prompt-first 极简入口，后续 Profile、状态栏、编辑区和 Apply Plan 流程保持原样。

## 本次改动

- 新建 `src/components/MinimalSurface.tsx`
  - 提供共享极简首屏模板，暴露 `title`、`subtitle`、`prompt`、`summaryLine`、`cards` 五个输入。
- 修改 `src/pages/HotkeyPage.tsx`
  - 接入 `getPageSurface('hotkeys')`
  - 用 `MinimalSurface` 替换原首屏 `CoreWorkspaceHero`
  - 清理 `CoreWorkspaceHero` import
  - 将顶部摘要改为基于现有 `stats`、`activeProfileName`、`plan`、`envInfo` 的 prompt 与 summary line
  - 保留后续 ProfileBar、GlobalStatusBar、冲突提示、三层编辑区和 Apply Plan 能力
- 修改 `src/App.css`
  - 增加 `minimal-surface` 相关样式
  - 维持白底轻分区，避免“大框套小框”
  - 增加移动端下的字号与卡片栅格适配
- 修改 `tests/minimalSurface.test.tsx`
  - 先追加失败测试，再实现组件
  - 断言标题、快捷入口卡片、摘要项可渲染

## TDD 记录

1. 先在 `tests/minimalSurface.test.tsx` 增加 `MinimalSurface` 渲染用例。
2. 运行 `npx.cmd vitest run tests/minimalSurface.test.tsx`。
3. 观察到失败，原因为 `../src/components/MinimalSurface` 不存在。
4. 新建组件并接入 `HotkeyPage`。
5. 再次运行测试，确认转绿。

## 首轮验证

- `npx.cmd vitest run tests/minimalSurface.test.tsx`
  - 通过，2 tests passed
- `npx.cmd tsc --noEmit`
  - 通过
- `npm run build:renderer`
  - 通过
  - Vite 仍提示主包体积超过 500 kB，这是现有构建告警，不是本任务新引入的阻塞

## Minor Cleanup Follow-up

- `src/components/MinimalSurface.tsx`
  - 把 `Prompt-first workspace` 改为 `工作入口`
  - 把 `Next move` 改为 `当前提示`
  - 同时把辅助 `aria-label` 也统一成中文，保持界面语言一致
- `tests/minimalSurface.test.tsx`
  - 删除与 `MinimalSurface` 无直接关系的 Layout 壳层测试，使文件边界更聚焦
  - 新增中文 helper label 断言，并确认英文文案不再出现
- `src/pages/HotkeyPage.tsx`
  - 评估并尝试清理 `false &&` 包裹的旧统计卡 dead code
  - 由于当前文件存在终端可见的中文编码污染，`apply_patch` 无法稳定定位该段 JSX；为避免误删同文件内其他协作中的内容，这次保守保留该 inert 片段

## Follow-up Validation

- `npx.cmd vitest run tests/minimalSurface.test.tsx`
  - 通过，2 tests passed
- `npx.cmd tsc --noEmit`
  - 通过
- `npm run build:renderer`
  - 通过
  - 仍有现存的 Vite chunk size warning，不是这次 minor cleanup 引入的问题

## 说明

- 本任务未修改 Skill/Menu/Overview/Environment 页面。
- 未修改 `core/`、`electron/`、IPC。
- 仓库无 `.git`，未创建提交。
