# Task 5 报告：落地“冲突处理”子页

## 实现内容

- 新建 `src/components/hotkeys/HotkeyConflictsPanel.tsx`
  - 将 `/hotkeys/conflicts` 从占位内容替换为真实子页。
  - 复挂现有 `EnhancedConflictList` 与 `ApplyPlanPreview`，不重造冲突组件。
  - 增加错误/警告/覆盖风险/已忽略摘要区。
  - 提供“刷新诊断”“生成 Apply Plan”入口。
  - 在 panel 内对 `onViewRawLine(sourceToken, lineNumber)` 做路径解析：
    - 优先用 `state.envSources.sources` 通过 `envSourceId` 找真实 `path`
    - 否则回退到当前用户 `envInfo.envFilePath`
    - 同时推断 `isReference`

- 修改 `src/pages/HotkeyWorkspacePage.tsx`
  - 接入新的 `HotkeyConflictsPanel` 组件，替换原本的本地占位实现。
  - 复用现有 `rawLineView` 状态，在工作区页面层统一渲染 `RawLineView` 弹窗。
  - 调整 `handleViewRawLine`，支持在传入空路径/非法行号时清空弹窗状态。

- 修改 `src/App.css`
  - 增加冲突页样式：
    - `hotkey-conflicts-panel`
    - `hotkey-conflicts-panel-header`
    - `hotkey-conflicts-summary*`
    - `hotkey-conflicts-meta`
    - `hotkey-conflicts-diagnostics`
    - `hotkey-conflicts-plan`
  - 视觉保持白色极简方向，与 overview/editor 子页一致。

- 修改 `tests/hotkeyWorkspacePanels.test.tsx`
  - 新增 `/hotkeys/conflicts` 回归测试。
  - 覆盖项：
    - 真实冲突页标题与诊断区渲染
    - 摘要区警告计数
    - Apply Plan 入口与预览渲染
    - “查看原始行”通过 `envSourceId -> envSources.path` 正确解析参考 env 文件路径

## 测试与验证

- RED：
  - 先补冲突页测试后执行：
  - `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - 结果：FAIL
  - 失败点：`/hotkeys/conflicts` 仍然是占位内容，缺少“冲突检测”等真实子页结构

- GREEN：
  - 完成实现后再次执行：
  - `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - 结果：PASS（6/6）

- 额外验证：
  - `npx.cmd tsc --noEmit`
  - 结果：PASS

- 仓库状态检查：
  - `Test-Path .git`
  - 输出：`False`

## 改动文件清单

- `src/components/hotkeys/HotkeyConflictsPanel.tsx`
- `src/pages/HotkeyWorkspacePage.tsx`
- `src/App.css`
- `tests/hotkeyWorkspacePanels.test.tsx`

## 自检结论

- 已满足本任务最低目标：
  - 错误/警告摘要
  - 真实冲突列表
  - Apply Plan 预览/应用入口
  - 原始行查看可靠接线

- 实现遵循限制：
  - 未改动 `core/`、`electron/`、IPC 协议、快捷键校验规则
  - 未触碰职责范围外文件
  - 未尝试提交或回退他人修改

## 遗留担忧

- 当前数据装载层会同时保留已有 `validateHotkeys` 冲突和自动补充的 `cross_env_override` 提示，因此同一按键在冲突页里可能看到“警告 + 提示”两条近似记录。这个行为来自现有数据源合并逻辑，本次按“优先复挂真实诊断流”保留现状，没有扩到去重规则重写。
