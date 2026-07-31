# Task 2 实现报告

## 改了什么

本次把 `HotkeyWorkspacePage` 从纯占位页提升为一个最小可工作的共享状态容器，先承接旧 `HotkeyPage` 的核心加载链路骨架，并让 `overview` 路由真正消费这份共享状态。

具体完成内容：

- 新增共享类型文件，定义 `HotkeyWorkspaceSharedState`、`HotkeyWorkspaceActions` 和四个子面板的基础 props 接口，给 Task 3-6 后续继续拆分留接口。
- 在 `HotkeyWorkspacePage` 中接入共享加载流程：
  - `window.atm.locateEnvironment()`
  - `window.atm.listProfiles()`
  - `window.atm.getAppliedHotkeyProfile()`
  - `window.atm.scanAllEnvironments()`（存在时调用）
  - `window.atm.parseEnvFile()`（仅 env 存在且方法可用时调用）
  - `window.atm.validateHotkeys()`（仅 env 存在且方法可用时调用）
  - `window.atm.loadFavorites()`（存在时调用）
  - `window.atm.getLastChange()`（存在时调用）
- `overview` 现在会显示当前方案、应用状态、方案数量、快捷键数量，证明共享状态已被路由子面板消费。
- `editor / conflicts / import-export` 继续保留占位路由，但都已经改为接收同一份 `sharedState + actions` 骨架，而不是独立占位文本。
- 保持对 Task 1 路由行为兼容，没有改动一级导航、没有碰 `core/`、`electron/`、IPC，也没有回退现有骨架。

## 改了哪些文件

实际改动：

- `src/components/hotkeys/types.ts`
- `src/pages/HotkeyWorkspacePage.tsx`
- `tests/hotkeyWorkspacePanels.test.tsx`

有意未改：

- `src/pages/HotkeyPage.tsx`

原因：Task 2 的最小目标是让 `HotkeyWorkspacePage` 接手共享容器职责，同时避免直接重构旧大页，减少对后续 Task 3-6 的连带风险。旧页逻辑保留，作为后续继续拆分的参考来源。

## RED / GREEN 证据

### RED

先新增失败测试：

- `tests/hotkeyWorkspacePanels.test.tsx:7`

执行命令：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

结果：`FAIL`

关键失败现象：

- 找不到文本 `默认方案`
- 原因是当时 `HotkeyWorkspacePage` 仍然只渲染 placeholder，没有消费共享数据

### GREEN

最小实现后再次执行：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

结果：`PASS`

随后补跑相关回归：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`2 passed`

## 跑了什么测试与结果

1. `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
   - RED：1 failed
   - GREEN：1 passed

2. `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`
   - 结果：2 passed

3. `Test-Path .git`
   - 结果：`False`
   - 结论：仓库没有 `.git`，按要求跳过 commit

## 关键代码落点

- `src/components/hotkeys/types.ts:25`
  - 定义 `HotkeyWorkspaceSharedState`
- `src/components/hotkeys/types.ts:45`
  - 定义 `HotkeyWorkspaceActions`
- `src/pages/HotkeyWorkspacePage.tsx:52`
  - `HotkeyOverviewPanel` 开始真实消费共享状态
- `src/pages/HotkeyWorkspacePage.tsx:124`
  - `buildStats()` 统一生成 overview 摘要统计
- `src/pages/HotkeyWorkspacePage.tsx:160`
  - `loadAll()` 集中承接共享加载流程
- `src/pages/HotkeyWorkspacePage.tsx:264`
  - 组装 `sharedState`
- `src/pages/HotkeyWorkspacePage.tsx:284`
  - 组装 `actions`
- `src/pages/HotkeyWorkspacePage.tsx:317`
  - overview/editor/conflicts/import-export 四个子路由统一接收容器 props

## 自审结论

结论：本次实现符合 Task 2 brief 的最小目标。

已满足：

- 按 TDD 执行，先 RED 再 GREEN
- `HotkeyWorkspacePage` 已从占位页升级为共享状态容器
- `overview` 已能消费共享状态，测试可以观察到同一份 profile 摘要
- 子路由接口骨架已统一成 `sharedState + actions`
- 没有碰禁改区域，也没有回退他人既有改动

## 顾虑

有两点需要明确记录：

1. 这次只承接了“共享容器 + 最小摘要展示”，没有把旧 `HotkeyPage` 的完整编辑器、冲突列表、导入导出真实 UI 接回去；这是按 brief 刻意收敛的，不是遗漏。
2. `HotkeyPage` 里的大部分复杂状态与事件还没有被正式抽出复用，目前是由 `HotkeyWorkspacePage` 先建立兼容骨架；后续 Task 3-6 继续拆时，建议逐步把真正可复用的行为从旧页安全迁出，而不是一次性大改。

## Git / 提交说明

执行：

```powershell
Test-Path .git
```

结果：

```text
False
```

因此本次**跳过 commit**，未尝试任何 git 提交操作。

---

## Review 修复追加（第二轮）

### reviewer 指向的问题

本轮 review 的核心结论是：

- `HotkeyWorkspacePage` 还只是“最小并行壳层”
- `sharedState / actions` 里保留了太多空值或 no-op
- 旧 `HotkeyPage` 里的真实加载链路、参考 env 合并语义和关键动作并没有真正下沉到共享容器
- `plan` 的 state 类型也不一致

### 这轮实际修了什么

1. 在 `HotkeyPage.tsx` 中补出了可复用的真实加载 helper：
   - 新增 `loadHotkeyWorkspaceData(...)`
   - 它承接旧页已有语义，统一加载：
     - 环境信息
     - profiles / appliedProfileId
     - 当前 env 解析与校验
     - 默认保留键库
     - reference env bindings
     - cross-env conflicts
     - favorites
     - undoStatus

2. `HotkeyWorkspacePage.tsx` 改为直接消费这条真实 helper，而不是自己维护一份缩水版加载逻辑。

3. 共享状态补成真实快照，不再只有空壳字段：
   - 新增真实承接：
     - `entries`
     - `parseWarnings`
     - `reservedKeysWarning`
     - `favoriteIds`
     - `undoStatus`
     - `rawLineView`
     - `envImportPreview`
     - `pendingOverrideBinding`

4. 共享 actions 不再是假的 no-op：
   - `handleEditBinding`
   - `handleAdoptBinding`
   - `handleOverrideSource`
   - `handleCreatePlan`
   - `handleApplyPlan`
   - `handleEnvImportClick`
   - `handleViewRawLine`
   - `handleIgnoreConflict`
   - `handleExportProfile`

5. 修复 `plan` 类型：
   - `HotkeyWorkspacePage` 中从 `null` only 改为 `ApplyPlan | null`

6. 修复初次加载重复调用：
   - 之前因为 `activeProfileId` 更新导致容器首屏 `loadAll()` 跑了两次
   - 现在通过一次性初始加载保护，恢复为首次进入只加载一次

7. 修复测试环境噪音：
   - 对缺失的 `scanAllEnvironments` 做了能力检测
   - 对 jsdom 下未 mock 的原生 `fetch` 做静默跳过，避免 teardown 后的 unhandled error

### 第二轮 TDD 证据

#### RED

先把 `tests/hotkeyWorkspacePanels.test.tsx` 强化为覆盖 reviewer 关注点的用例，新增断言：

- overview 能看到真实 `reservedBindings` 结果
- overview 能看到 reference env 带来的 conflict 结果
- `handleCreatePlan` 能通过 placeholder 面板触发真实 `createApplyPlan`
- 当前 env 与 reference env 的 `parse/validate` 都被调用

执行：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

首次失败，失败原因先后包括：

- `overview` 还看不到 `reserved / conflict` 真实摘要
- 修复后又暴露出首次加载重复调用，`locateEnvironment` 被调用 2 次而不是 1 次

这两次失败都对应 reviewer 的真实问题，不是无关噪音。

#### GREEN

修复后再次执行：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

结果：`PASS`

再跑要求覆盖集：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`2 passed`

并再次确认：

```powershell
Test-Path .git
```

结果仍为：

```text
False
```

因此第二轮修复后仍然**跳过 commit**。

### 第二轮改动文件

- `src/components/hotkeys/types.ts`
- `src/pages/HotkeyWorkspacePage.tsx`
- `src/pages/HotkeyPage.tsx`
- `tests/hotkeyWorkspacePanels.test.tsx`

### 第二轮自审结论

这轮之后，`HotkeyWorkspacePage` 已经不再是“只挂路由的最小壳层”，而是：

- 真实继承了旧 `HotkeyPage` 的关键加载语义
- 真实持有共享状态
- 真实提供关键动作
- 仍然没有抢跑 Task 3-6 的子面板 UI 回接

也就是说，这一轮既满足了 reviewer 对 Task 2 的修正方向，也保持了任务边界。

### 第二轮顾虑

仍有一个刻意保留的边界：

- 这轮把“共享容器 + 真实状态/动作”补齐了，但 placeholder panels 依旧只是轻量消费这些能力，并没有把旧页的完整编辑器、冲突面板、导入导出界面提前搬回来。

这是按本次修复目标刻意控制的，不属于遗漏。

---

## Post-Fix 追加修复（第三轮）

### 新发现的问题

本地补充验证发现：

- `tests/hotkeyWorkspaceRouting.test.tsx` 单跑时断言本身通过
- 但 teardown 后仍有 unhandled error：
  - `ReferenceError: window is not defined`

症状与新增 findings 一致，且可以稳定复现于：

```powershell
npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx
```

### 根因确认

这次没有扩散排查范围，只围绕 `HotkeyWorkspacePage` 的异步加载链路验证。

最终确认根因是：

- `HotkeyWorkspacePage` 的 `loadAll()` 会先 `await loadHotkeyWorkspaceData(...)`
- routing 测试只等待重定向与二级导航出现，不等待共享加载完成
- 测试结束后 jsdom teardown
- `loadAll()` 的 `catch/finally` 仍可能在 teardown 后继续运行
- 此时即使 React 组件卸载保护不足以完全兜住，`setLoading(false)` 仍可能落到一个已经没有 `window` 的环境里

也就是说，这不只是“组件卸载后 setState”，而是更具体的：

- **异步收尾阶段在 test environment teardown 后仍尝试 setState**

### 最小修复

只修改了：

- `src/pages/HotkeyWorkspacePage.tsx`

修复方式：

- 新增 `canSafelySetState()` 判断
- 条件同时要求：
  - `isMountedRef.current === true`
  - `typeof window !== 'undefined'`
- 在 `loadAll()` 的异步返回后、`catch`、`finally` 里的状态写入前统一使用这个判断

这一步没有顺手改动别的逻辑，也没有扩文件范围。

### 验证结果

1. 单跑 routing：

```powershell
npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`PASS`，且**无 teardown 后 unhandled error**

2. 跑指定覆盖集：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`2 passed`，且**无 unhandled error**

3. 再次确认 git：

```powershell
Test-Path .git
```

结果：

```text
False
```

因此本轮仍然**跳过 commit**。

### 第三轮自审结论

这次修复是一个纯粹的异步生命周期收口：

- 已验证新增 findings 的根因
- 已用最小改动修掉 teardown 后的状态写入
- 没有改动 Task 2 之外的边界

---

## Post-Fix 追加修复（第四轮，最终收口）

### 新 findings 与根因复核

继续本地验证后，发现上一轮还没有彻底收干净：

- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
  - 断言通过
  - 但仍会在 teardown 后报 `ReferenceError: window is not defined`

这次我先按 findings 的 refined root cause 重新验证：

```powershell
npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx
```

结果确实仍能复现“测试通过但进程带 unhandled error”。

### 这轮确认的真实残留点

上一轮只修掉了首轮 `loadAll()` 开头的冗余：

- `setLoading(true)`
- `setError(null)`

这能解释为什么单跑现象部分改善，但还不够。

最终确认剩余问题是：

- `loadAll()` 在 `await loadHotkeyWorkspaceData(...)` 返回后，会连续触发一串 state updates
- 即使这些调用发生时组件尚未卸载，它们仍可能留下 pending React work
- 在 `routing` 单测或组合跑的快速 teardown 场景下，这批 pending work 可能延后到 jsdom 环境销毁后才刷出

所以第四轮的最小修复目标变成：

- 不再只保护“能不能调用 setState”
- 还要让异步加载成功/失败后的这批状态更新**同步落地**

### 最小修复

仍然只改了：

- `src/pages/HotkeyWorkspacePage.tsx`

具体做法：

- 引入 `flushSync`（来自 `react-dom`）
- 在 `loadAll()` 的成功分支里，把这批共享状态写入包进一次 `flushSync`
- 在失败分支里，把 `setError(...) + setLoading(false)` 也包进 `flushSync`
- 保留上一轮的 mounted/window guard
- 保留上一轮“首轮不做冗余 resetState 调度”的修复

这次没有扩改 helper、tests 逻辑或 Task 2 外文件。

### 第四轮验证

1. 单跑 routing：

```powershell
npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`PASS`

2. 单跑 panels：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

结果：`PASS`

3. 跑组合覆盖：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx
```

结果：`2 passed`

4. 确认 git：

```powershell
Test-Path .git
```

结果：

```text
False
```

因此本轮仍然**跳过 commit**。

### 第四轮自审结论

Task 2 到这一轮为止已经把本地验证残留问题收干净：

- routing 单跑干净
- panels 单跑干净
- 组合跑也干净
- 无 teardown 后 `window is not defined`

并且这次收口仍然保持在 Task 2 允许文件内，没有继续扩散改动范围。

---

## Re-Review 定向修复（第五轮）

### 本轮只处理的 findings

这轮严格只修 reviewer 标出的两个 Important：

1. `handleExportProfile` 行为回退
2. `handleEnvImportClick` 丢失 async error containment

Minor 的 `handleAdoptBinding` snapshot drift 这次没有展开，以免超出当前定向修复范围。

### RED

先把 `tests/hotkeyWorkspacePanels.test.tsx` 补强为第二条用例，直接锁住这两个回归：

- 点击“导出当前方案”时，必须像旧页一样：
  - 调用 `window.atm.exportProfile(...)`
  - 生成 `Blob`
  - 调用 `URL.createObjectURL(...)`
  - 创建下载链接并触发 `click()`
  - 最后 `URL.revokeObjectURL(...)`
- 点击“打开 env 导入”时，如果 `openEnvFileDialog()` 异步抛错：
  - 不能出现未处理异步错误
  - 必须被容器 catch 住并转成可见错误状态

执行：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

首次结果：`FAIL`

失败点：

- `createObjectURL` 没有被调用

这正对应 reviewer 指出的 `handleExportProfile` 行为回退。

### GREEN

修复后再次执行：

```powershell
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx
```

结果：`PASS`

随后补跑要求覆盖：

```powershell
npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx
npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx
```

结果：

- `routing`: `PASS`
- `panels + routing`: `3 passed`

最后再次确认：

```powershell
Test-Path .git
```

结果：

```text
False
```

因此本轮仍然**跳过 commit**。

### 这轮实际修了什么

#### 1. 恢复 `handleExportProfile` 的旧用户可见行为

位置：

- `src/pages/HotkeyWorkspacePage.tsx`

修复前：

- 只调用 `window.atm.exportProfile(activeProfileId)`
- 丢弃返回值
- 不再生成下载结果

修复后：

- 保留 IPC 调用
- 当返回 `success + data` 时：
  - 用返回内容创建 `Blob`
  - 调用 `URL.createObjectURL(...)`
  - 创建 `<a>`
  - 使用当前 profile 名生成 `${profileName}.atm-profile.json`
  - 触发下载
  - 最后 `URL.revokeObjectURL(...)`

这与旧页行为重新对齐。

#### 2. 恢复 `handleEnvImportClick` 的 async containment

位置：

- `src/pages/HotkeyWorkspacePage.tsx`

修复前：

- 使用 `void (async () => ...)()`，但没有完整 `try/catch`
- `openEnvFileDialog()` / `parseImportEnvFile()` 等如果 reject，可能留下未处理异步错误

修复后：

- 保留 Task 2 的占位式 import/export 路由
- 但将整个异步流程重新包回 `try/catch`
- 分支行为与旧页语义对齐：
  - 选择失败：`选择文件失败: ...`
  - 解析失败：`解析 env 文件失败: ...`
  - 运行时异常：`导入过程异常: ...`
- 同时在 import-export placeholder 中显示 `sharedState.error`
  - 这样错误被真正消费到共享状态，而不是只停留在 promise rejection

### 本轮改动文件

- `src/pages/HotkeyWorkspacePage.tsx`
- `tests/hotkeyWorkspacePanels.test.tsx`

### 本轮自审结论

这轮之后，reviewer 标出的两个 Important 都已经补齐：

- `handleExportProfile` 不再只是“发 IPC 不处理结果”
- `handleEnvImportClick` 重新具备完整 async error containment

并且改动仍然收在 Task 2 允许范围内，没有扩到 Task 3+。
