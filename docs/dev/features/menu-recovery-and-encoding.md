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

Allegro 直接读取的文本不能跨版本使用单一编码：17.2 及更早版本使用 CP936/GBK，17.4 使用 UTF-8。该策略覆盖 `generated_menu.il`、`generated_skill_loader.il`、`bootstrap.il` 和 `allegro.ilinit`；`menu_profile.json`、历史记录等 ATM 数据始终保持 UTF-8。

读取现有脚本时先按字节自动识别 UTF-8/GBK，写入时再按当前环境版本统一编码。这样可以把 17.2 中误写为 UTF-8、显示为“甯冨眬”的路径安全转换为 GBK，同时不会把 17.4 的脚本错误转码成显示为 `²âÊÔ` 的 GBK 字节。所有转换都属于普通 Apply Plan 步骤，必须先备份、预览并确认。

## 可信度与验证

- 官方文档确认：`axlUIMenuInsert` 接收显示字符串，可用于插入 popup、command 和 separator；触发器回调有既有 API 限制。
- 项目证据确认：17.4 旧 IL 中“测试”为 GBK 字节，截图显示为 `²âÊÔ`；17.2 的 UTF-8 `allegro.ilinit` 路径被按 GBK 解释为“甯冨眬”，两类乱码可由原始字节稳定复现。
- 静态验证：版本策略、UTF-8/GBK 自动识别、两种编码精确字节、JSON 保持 UTF-8、跨环境复制、切换保护、原子保存、回滚/撤销和 IPC/Renderer 契约由 Vitest 覆盖。
- 运行时边界：17.2 与 17.4 仍需分别在目标会话重启后确认中文菜单和 Skill 路径；完成前运行时状态为 provisional。
