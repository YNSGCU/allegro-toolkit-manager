# Feature: multi-allegro-environments

## 目标

在多 Allegro 安装环境中提供稳定、显式且可持久化的写入目标，防止各 IPC 根据进程环境变量分别落到不同 `pcbenv`。

## 功能链

`EnvironmentPage` → `window.atm.listAllegroEnvironments/setActiveAllegroEnvironment` → preload → `env:list-workspaces/env:set-active-workspace` → `environmentRegistry.ts` → `%APPDATA%/AllegroToolkitManager/environments.json`。

现有快捷键、Skill、菜单 IPC 继续调用 `locateEnvironment()`；该函数现在优先解析环境注册表的活动工作区，因此不需要让 renderer 传递任意文件路径，也不会破坏现有 Apply Plan 安全边界。

每个 Apply Plan 生成时写入 `environmentId` 与 `environmentPcbenvPath`。执行器在第一项写入前重新解析活动环境；版本切换或目标目录变化会拒绝执行，要求重新生成计划。

## 数据模型

- `AllegroEnvironmentWorkspace`：版本、安装根目录、可执行文件、HOME、pcbenv、env、ilinit、共享关系。
- `EnvironmentRegistry`：环境列表与 `activeEnvironmentId`。
- `HotkeyProfile`：可选的 `sourceEnvironmentId`、`sourceAllegroVersion`、`testedAllegroVersions`。
- `SkillProfile`、`MenuProfile`：使用相同来源/测试版本字段；新建方案时由对应 IPC 填充。
- `ProfileCompatibilityReport`：`portable / warning / blocked` 和结构化 findings。

## 共享目录判定

环境发现结束后按规范化 `pcbenvPath` 分组；同组环境互相写入 `sharedWithIds`。共享目录不是错误，但应用前必须提示影响范围。

## 兼容性边界

`checkHotkeyProfileCompatibility` 能静态发现版本差异、复杂命令、绝对路径和共享目标。Allegro 命令行为、SKILL API、表单与菜单运行时仍需按准确版本验证。

快捷键工作区提供迁移对话框。预检通过后，在目标环境的 `atm_generated/profiles` 创建独立方案副本；共享同一 `pcbenv` 时不重复复制。

## 测试

`tests/multiEnvironmentCompatibility.test.ts` 覆盖注册表持久化、活动环境定位、手动切换、版本差异、绝对路径和共享目录风险。

## 兼容证据与 Vibe Bridge

兼容记录存放在 `%APPDATA%/AllegroToolkitManager/compatibility-records.json`，按环境、版本、范围、对象和证据来源保存。静态检查、Vibe Bridge 和人工验证互不覆盖。

`core/environment/vibeBridgeProbe.ts` 只发送：

```skill
list(axlVersion('tVersion) axlVersion('fullVersion) axlVersion('programName))
```

`axlVersion` 的三个选项来自本机当前 Allegro 官方 FUNCS 文档，证据等级为 `official-confirmed`。Bridge 未响应或版本不符时不得写入 `runtime_pass`。
