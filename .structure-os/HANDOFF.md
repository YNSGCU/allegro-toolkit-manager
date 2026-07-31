# Handoff

## 当前状态

- 五个路由页已完成统一工作区 UI 重置。
- 第二轮 UI 排查已完成：字号、顶部层级、键盘可读性、Skill 空状态、Menu 剩余高度和错误文案已收口。
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
- 快捷键页删除基于 ResizeObserver 的整体缩放，键盘文字保持 12px，并在空间不足时由键盘容器内部滚动。
- ProfileBar 不再重复显示方案 ID/应用状态；空方案不会误报“已应用”。
- Skill 和 Menu 的关键工作区使用连续 `min-height: 0` 滚动链；深层可见 Emoji 已替换为 Lucide 图标或明确文字。
- 新增统一用户错误转换，浏览器或桌面桥接缺失时显示中文可恢复提示。

## 验证

- 前端 TypeScript：通过
- Electron TypeScript：通过
- 全量测试：35 个测试文件 / 199 项测试全部通过
- Renderer 生产构建：通过
- 浏览器：1220×820、1360×920、1600×856 的五个路由页均无页面级横向溢出；可见文字最小 12px

## 已知非阻断项

- Structure OS CLI 未安装，本次继续采用文件化治理。
- Vite 主 JS chunk 仍超过 500kB，建议后续使用路由级动态导入。
- 部分深层业务弹窗仍有历史内联样式；关键路由、共享壳层、菜单树/预览及通用反馈组件已改为令牌/CSS 类。
