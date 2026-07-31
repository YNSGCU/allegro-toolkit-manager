# Task 2 Report

## Status

完成。

## 初始交付记录

1. 先新增 `tests/pageSurfaces.test.ts`，覆盖以下行为：
   - 默认入口保持为 `/hotkeys`
   - `hotkeys` surface 使用最小白色极简文案结构，且至少包含 3 个动作
   - 五个页面都存在 surface 配置，且顺序与导航顺序一致
   - 所有 `APP_NAV_ITEMS` 都有对应的 surface 配置
   - `overview` surface 明确把快捷键标记为默认入口
2. 运行 `npx.cmd vitest run tests/pageSurfaces.test.ts`，先看到失败：
   - `Failed to resolve import "../src/config/pageSurfaces"`
3. 新增 `src/config/pageSurfaces.ts`，补齐 `PAGE_SURFACES`、`getPageSurface()`，并提供按导航顺序输出的辅助方法。
4. 修正 `src/config/appShell.ts` 中导航文案为正常中文，同时保留既有信息架构：
   - 主工作区仍为 `hotkeys` / `skills` / `menu`
   - 默认入口仍为 `/hotkeys`
   - `overview` / `environment` 仍为 utility 分组
5. 重新运行测试并通过。

## 初始变更文件

- `src/config/pageSurfaces.ts`
- `src/config/appShell.ts`
- `tests/pageSurfaces.test.ts`

## 未改动但已核对

- `src/App.tsx`
  - 现有 `/overview` 路由、`/` 默认跳转和 `*` 兜底跳转都已经满足 brief，因此未做不必要改动。

## 初始验证结果

- `npx.cmd vitest run tests/pageSurfaces.test.ts`
  - 1 个测试文件通过，5 个测试通过
- `npx.cmd vitest run tests/appShell.test.ts`
  - 1 个测试文件通过，3 个测试通过
- `Write-Output "Checkpoint: page surface config and default route locked."`
  - 已输出 checkpoint

## Review Finding Follow-up

1. 核对 reviewer finding 后确认问题成立：
   - `tests/appShell.test.ts` 已经单独锁定了 `PRIMARY_WORKSPACES`
   - 但 `tests/pageSurfaces.test.ts` 之前只校验 `APP_NAV_ITEMS` 与 `PAGE_SURFACES` 的 key/顺序对齐
   - 这意味着 surface 配置层没有直接把“三大核心模块”绑定到 `PRIMARY_WORKSPACES`
2. 先按 TDD 补红灯测试：
   - 在 `tests/pageSurfaces.test.ts` 新增 `binds the core workspace surfaces to PRIMARY_WORKSPACES`
   - 首次运行 `npx.cmd vitest run tests/pageSurfaces.test.ts` 失败：
     - `getPrimaryWorkspaceSurfaces is not a function`
3. 最小实现：
   - 在 `src/config/pageSurfaces.ts` 新增 `getPrimaryWorkspaceSurfaces()`
   - 该方法直接基于 `PRIMARY_WORKSPACES.map(...)` 生成核心页面 surface 集合
4. 修复结果：
   - “hotkeys / skills / menu 是三大核心模块” 现在不再只靠导航顺序或文案隐含，而是由 `PRIMARY_WORKSPACES` 驱动的代码路径显式约束
   - `/hotkeys` 默认入口约束保持不变，相关测试继续覆盖
   - 没有提前进入布局或页面重构

## Follow-up 验证结果

- `npx.cmd vitest run tests/pageSurfaces.test.ts`
  - 1 个测试文件通过，6 个测试通过
- `npx.cmd vitest run tests/appShell.test.ts`
  - 1 个测试文件通过，3 个测试通过

## 风险与说明

- 仓库当前不是 git 仓库，未创建提交。
- 终端读取中文源码时仍可能显示乱码，但当前改动已通过实际测试断言验证。
