# 菜单恢复与编码

## 问题边界

菜单功能有两份不同职责的数据：`menu_profile.json` 是 ATM 编辑器的源数据，`generated_menu.il` 是应用后供 Allegro 加载的派生产物。旧 IL 仍存在并不代表源方案仍可编辑；多 Allegro 环境下，每个 `pcbenv` 又各自拥有独立的 `atm_generated`。

## 读取与恢复链

`menu:load-profiles` 返回当前环境、当前源仓库、备份恢复候选和其他环境摘要。`findMenuProfileRecovery()` 仅在当前所有方案都为空时扫描：

- `atm_generated/menu_profile.json*.bak`
- `atm_generated/backups/menu_profile.json*.bak`

它兼容 V2 仓库、V1 `menus` 格式和历史单方案备份，选择修改时间最新且包含菜单项的候选，不执行写入。

用户点击“审阅恢复计划”后，`menu:create-recovery-plan` 在主进程重新查找候选，先备份当前源文件，再生成只恢复 `menu_profile.json` 的一次性可信 Apply Plan。恢复不生成 IL；用户检查菜单树后，仍需走普通菜单 Apply Plan。

## 多环境处理

当前环境为空时，IPC 只读检查环境注册表中的其他 `pcbenv`。用户可显式切换环境，也可调用 `menu:create-environment-copy-plan` 把来源环境的一个非空方案复制为当前环境的新草稿。复制计划只写目标 `menu_profile.json`，使用主进程可信快照、备份和 `environmentId + pcbenvPath` 锁，不生成 IL、不改变来源环境。

`MenuPage` 在切换菜单方案、侧栏页面或页面内关联跳转前调用现有 `menu:save-draft`；侧栏或页面内切换 Allegro 环境时，经 `environmentSwitchGuard` 等待菜单草稿保存成功。保存失败、校验失败或页面保护拒绝时，不改变导航或活动环境。菜单仓库使用临时文件加原子替换，CRUD 不再忽略保存失败。

## 编码约定

Allegro 直接加载的脚本按版本编码：17.2 及更早版本使用 CP936/GBK，17.4 使用 UTF-8。17.2 的动态菜单 API `axlUIMenuInsert` 不具备 Unicode UI 支持：GBK 中文按西文字节显示，UTF-8 原文或 UTF-8 八进制转义同样被逐字节显示。

`MenuItemConfig.label` 始终保存用户的中文原名，`compatibilityLabel` 保存可选的 17.2 ASCII 显示名。`generateMenuIlContent(profile, { allegroVersion })` 与 `getMenuApplyPlanSteps(..., { allegroVersion })` 通过同一个版本策略选择标签：17.2 及更早版本遇到非 ASCII 原名时必须使用合法 `compatibilityLabel`，否则生成失败；17.4 及以后忽略兼容名并输出原始 `label`。Renderer 编辑器在 17.2 环境中同步执行必填和可打印 ASCII 校验。

读取现有脚本时先按字节自动识别 UTF-8/GBK，写入时由 Apply Plan 附加目标版本编码。禁止为了修复标签而把整个 17.2 `.il` 改成 UTF-8，也禁止把八进制字节转义宣传为 Unicode UI 修复。所有写入仍必须先备份、预览并确认。

## 可信度与验证

- 官方文档确认：`axlUIMenuInsert` 接收显示字符串，可用于插入 popup、command 和 separator；触发器回调有既有 API 限制。
- 官方 17.2 文档确认：`axlUIMenuInsert` 的 `t_display` 是普通显示字符串；Cadence 官方专家说明 SKILL 字符串可以存储 Unicode 字节，但同代 UI 控件并不会统一解释为 Unicode。
- 项目实机确认：17.2 S083 的 GBK 中文、UTF-8 整体脚本和 UTF-8 八进制字节均显示为乱码；八进制实验已通过 Apply Plan 撤销。
- 静态验证：脚本版本编码、17.2/17.4 标签选择、兼容名 UI 校验、GBK IL 与 UTF-8 JSON 分流、原子保存、回滚/撤销和 IPC/Renderer 契约由 Vitest 覆盖。
- 运行时边界：ASCII 标签是 17.2 当前可信的兼容范围；中文动态菜单标签标记为不支持，英文兼容名仍需在目标 17.2 会话确认视觉结果。
