# Feature: multi-allegro-environments

## 目标

在多 Allegro 安装环境中提供稳定、显式且可持久化的写入目标，防止各 IPC 根据进程环境变量分别落到不同 `pcbenv`。

## 功能链

`EnvironmentPage` → `window.atm.listAllegroEnvironments/setActiveAllegroEnvironment` → preload → `env:list-workspaces/env:set-active-workspace` → `environmentRegistry.ts` → `%APPDATA%/AllegroToolkitManager/environments.json`。

现有快捷键、Skill、菜单 IPC 继续调用 `locateEnvironment()`；该函数现在优先解析环境注册表的活动工作区，因此不需要让 renderer 传递任意文件路径，也不会破坏现有 Apply Plan 安全边界。

每个 Apply Plan 生成时写入 `environmentId` 与 `environmentPcbenvPath`。执行器在第一项写入前重新解析活动环境；版本切换或目标目录变化会拒绝执行，要求重新生成计划。

## 数据模型

- `AllegroEnvironmentWorkspace`：版本、安装根目录、可执行文件、HOME、pcbenv、env、ilinit、共享关系。
- `EnvironmentRegistry`：环境列表与 `activeEnvironmentId`；IPC 响应额外携带 ATM 进程继承的只读 `hostEnvironment`，不写入注册表文件。
- `HotkeyProfile`：可选的 `sourceEnvironmentId`、`sourceAllegroVersion`、`testedAllegroVersions`。
- `SkillProfile`、`MenuProfile`：使用相同来源/测试版本字段；新建方案时由对应 IPC 填充。
- `ProfileCompatibilityReport`：`portable / warning / blocked` 和结构化 findings。

## 共享目录判定

环境发现结束后按规范化 `pcbenvPath` 分组；同组环境互相写入 `sharedWithIds`。共享目录不是错误，但应用前必须提示影响范围。

注册表加载、保存和刷新时都会根据当前环境集合重新构建 `sharedWithIds`，不信任历史 ID。显式刷新会删除已经不存在的自动发现目录，但保留仍存在的自动环境以及手动/导入环境。侧栏环境选择器在挂载时请求一次刷新，避免长期展示已消失的安装记录。

同一 Allegro 版本可能发现多个候选配置，例如安装目录下的 `SPB_Data/pcbenv` 与 Windows 用户目录下的 `pcbenv`，但注册表和下拉框对每个版本只保留一个活动环境。归并时优先保留该版本当前已选中的环境；没有当前选择时，优先使用安装目录旁的 `SPB_Data/pcbenv`，再按存在性和可写性选择。若最终选中的同一 `pcbenv` 被多个版本复用，仍按实际路径重建共享关系。

## 兼容性边界

`checkHotkeyProfileCompatibility` 能静态发现版本差异、复杂命令、绝对路径和共享目标。Allegro 命令行为、SKILL API、表单与菜单运行时仍需按准确版本验证。

快捷键工作区提供迁移对话框。预检通过后，在目标环境的 `atm_generated/profiles` 创建独立方案副本；共享同一 `pcbenv` 时不重复复制。

## 测试

`tests/multiEnvironmentCompatibility.test.ts` 覆盖每版本唯一、当前选择保留、默认安装配置优先、注册表持久化、活动环境定位、陈旧自动记录清理、版本差异、绝对路径和共享目录风险；`tests/environmentSwitcher.test.tsx` 覆盖刷新后每个版本只渲染一个选项。

## 兼容证据与 Vibe Bridge

兼容记录存放在 `%APPDATA%/AllegroToolkitManager/compatibility-records.json`，按环境、版本、范围、对象和证据来源保存。静态检查、Vibe Bridge 和人工验证互不覆盖。

`core/environment/vibeBridgeProbe.ts` 只发送：

```skill
list(axlVersion('tVersion) axlVersion('fullVersion) axlVersion('programName))
```

`axlVersion` 的三个选项来自本机当前 Allegro 官方 FUNCS 文档，证据等级为 `official-confirmed`。Bridge 未响应或版本不符时不得写入 `runtime_pass`。

## 按环境切换管理目标

侧栏版本选择器只决定 ATM 的管理与写入目标，不会在“切换环境”时隐式启动 Allegro，也不修改 Windows 全局 `HOME/CDSROOT`。已经运行的 Allegro 进程仍保持原有环境。

切换链路为：

```txt
AllegroEnvironmentSwitcher
  -> selectedEnvironmentId
  -> window.atm.setActiveAllegroEnvironment(environmentId)
  -> env:set-active-workspace
  -> environmentRegistry.ts
  -> window.location.reload()
```

切换提交前会执行页面级保护器，避免未保存的工作区被切换覆盖。IPC 列表响应将 `process.env.HOME/CDSROOT` 作为只读主机上下文返回；侧栏按 Windows 路径规范化后与活动环境比较，不一致时显示警告。

显式启动链路为：

```txt
AllegroEnvironmentSwitcher
  -> window.atm.launchAllegroEnvironment(activeEnvironmentId)
  -> env:launch-workspace
  -> environmentRegistry.ts 重新解析环境 ID
  -> allegroLauncher.ts 构造子进程 HOME/CDSROOT
  -> spawn(allegro.exe)
```

Renderer 只提交环境 ID，不提交执行文件或 HOME；主进程必须从注册表重新解析。启动环境只作用于新子进程，不得修改 `process.env` 或 Windows 全局环境变量。

自动化测试覆盖下拉选择、切换按钮不隐式启动、显式隔离启动、HOME/CDSROOT 不匹配告警和页面刷新前的环境保护。实际 Allegro 17.2 是否读取预期 `pcbenv` 仍需在“按此环境启动”的新会话中确认。
