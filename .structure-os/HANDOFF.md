# Handoff

## 当前状态

- 五个路由页已完成统一工作区 UI 重置。
- 应用壳层、设计令牌、页头、状态条、页面状态与 Apply Plan 对话框已集中到 `src/shared/ui/`。
- Hotkey、Skill、Menu 写入仍经过原 Apply Plan、备份、回滚和历史记录链路。
- Git 已初始化；重置前基线提交为 `c95a222`。

## 本次主要变化

- 用 216px 分组侧栏替换旧壳层，不再使用 JavaScript 整页缩放。
- 快捷键页改为紧凑页签和固定密度键盘工作区；数据装载抽到 service。
- Skill 和 Menu 共用 Apply Plan 对话框；Menu 使用树/属性稳定分栏。
- 概览改为健康度、核心入口和关键文件状态；环境页改为来源优先级、活动路径、权限和环境变量。
- 删除 `HotkeyPage.tsx`、MinimalSurface、CoreWorkspaceHero、ProfileSelector、旧 ApplyPlanPreview 和响应式缩放实现。
- `App.css` 删除旧 Hero、Marvis、MinimalSurface 样式；新基础位于 `src/shared/ui/foundations/`。

## 验证

- 前端 TypeScript：通过
- Electron TypeScript：通过
- 全量测试：36 个测试文件 / 202 项测试全部通过
- Renderer 生产构建：通过
- 浏览器：1220×820、1360×920、1600×1000 的五个路由页均无横向溢出；截图保存在 `.structure-os/ui-final/2026-07-31/`

## 已知非阻断项

- Structure OS CLI 未安装，本次继续采用文件化治理。
- Vite 主 JS chunk 仍超过 500kB，建议后续使用路由级动态导入。
- 部分深层业务弹窗仍有历史内联样式；路由页、共享壳层与本次新增组件已改为令牌/CSS 类。
