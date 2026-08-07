# Feature: hotkey-command-assistant

## Purpose

为快捷键新增/编辑提供可搜索命令建议，并保证 renderer 展示的编辑字段在 Apply Plan 执行器中存在真实写入语义。

## Ownership

- Renderer：`HotkeyCommandAssist.tsx`、`AddHotkeyDialog.tsx`、`HotkeyEditor.tsx`
- Suggestion model：`src/utils/hotkeyCommandSuggestions.ts`
- Dictionary：`core/dictionary/command_dictionary.json`
- Plan/execute：`core/apply/hotkeyEditPlan.ts`
- IPC：`electron/ipc/hotkey.ipc.ts`
- Related docs：`docs/user/features/hotkey-command-assistant.md`

## Feature Chain

```txt
命令输入 -> renderer suggestion model -> 选择/验证提示
新增/编辑确认 -> preload -> hotkey:generate-*-plan -> hotkeyEditPlan
-> Apply Plan 预览 -> hotkey:execute-edit-plan -> 备份/前置条件检查/写入/历史
-> reloadData -> 列表与方案刷新
```

## Entry Points

- UI：新增绑定的“原始命令”、编辑快捷键的“原始命令”
- IPC：`hotkey:validate-edit`、`hotkey:generate-add-plan`、`hotkey:generate-edit-plan`、`hotkey:execute-edit-plan`
- Core：`generateAddPlan()`、`generateEditPlan()`、`executeEditPlan()`
- Storage：可写 `pcbenv/env`、`atm_generated/profiles/*.profile.json`、快捷键变更历史和备份目录

## Suggestion Model

`suggestHotkeyCommands()` 在 renderer 中直接读取构建时命令词典，并合并当前工作区已有命令。排序优先级为精确匹配、英文前缀、中文前缀、单词前缀、包含匹配、分类/说明匹配；常用命令仅作为同级排序提示。

建议来源标签描述数据范围，不证明 Allegro 运行时可用性。复杂宏、历史示例和用户截图中的命令不得直接提升为 trusted 模板。

## Edit Capability Contract

- `user_env_original` / `atm_managed_block`：只生成 env 行修改步骤。
- `active_profile` / `imported_profile`：读取真实 Profile，按物化 ID 找回原绑定，生成包含完整 `writeContent` 的 Profile 步骤。
- 其他来源：生成阶段直接拒绝，不允许空计划返回成功。
- env/Profile 写入前都校验生成计划时的原内容；不一致时失败并回滚。
- 每个旧版快捷键编辑计划当前只允许一个写入目标，以保持变更历史的单目标撤销语义。

## Error Handling

- UI 重复键位阻止提交；Core 再次校验，防止绕过 renderer。
- IPC 实时校验失败时 editor fail-closed，不保留“检测通过”假状态。
- 只读来源禁用编辑按钮并保留查看、接管或来源说明入口。
- 执行失败恢复目标文件；新文件在回滚时删除。

## Tests and Verification

- `tests/hotkeyCommandSuggestions.test.ts`
- `tests/businessDialogs.test.tsx`
- `tests/hotkeyEditPlan.test.ts`
- `tests/pcbenvApplyIntegration.test.ts`
- `tests/hotkeyWorkspacePanels.test.tsx`

## Evidence Status

- 命令建议排序与键盘交互：`project-confirmed`，自动化测试覆盖。
- env/Profile 文件修改、回滚和撤销：`project-confirmed`，临时 pcbenv 自动化测试覆盖。
- 参考截图中的复杂 Allegro 宏：`provisional`，仍需按具体 Allegro 版本和交互模式实机验证。

## Extension Notes

新增推荐数据源时必须保留来源标签和去重规则。若未来一个计划需要同时写 env、Profile 和来源覆盖文件，应迁移到统一多目标 Apply Plan 历史，不得直接放宽当前单目标执行限制。
