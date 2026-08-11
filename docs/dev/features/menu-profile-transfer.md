# Feature: 菜单方案跨电脑导入导出

## Purpose

把单个 `MenuProfile` 作为可移植数据包导出，并在其他 pcbenv 中安全合并为新草稿，不复制机器相关路径、不覆盖现有方案、不绕过 Apply Plan。

## Ownership

- Module: `core/menu/menuProfileTransfer.ts`
- Public entry points: `createMenuProfilePackage`、`parseMenuProfilePackage`、`previewMenuProfileImport`、`importMenuProfilePackage`
- IPC: `menu:export-profile`、`menu:open-import-profile`、`menu:create-import-plan`
- UI: `MenuPage`、`MenuProfileImportDialog`

## Feature Chain

```txt
MenuPage 工作区工具
  -> preload menuExportProfile / menuOpenImportProfile / menuCreateImportPlan
  -> menu.ipc 文件对话框与目标环境解析
  -> menuProfileTransfer 创建/解析/预览/重新编号
  -> trustedApplyPlan 注册一次性 menu 计划
  -> menuExecuteApplyPlan
  -> applyPlanEngine 备份并合并 menu_profile.json
  -> MenuPage loadData 刷新为导入草稿
```

## Data Model

`.atmmenu` 是 UTF-8 JSON：

```json
{
  "kind": "atm-menu-profile",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "exportedByVersion": "0.3.5",
  "source": { "environmentName": "Allegro 17.4", "allegroVersion": "17.4" },
  "profile": { "id": "...", "name": "...", "items": [] }
}
```

导出会删除 `sourceEnvironmentId`、`targetCompatibility.intendedEnvironmentId`、菜单项 `sourceSkillFile` 和运行时 `issues`。导入时只复制白名单字段，全部 Profile/Item ID 重新生成，`parentId/path/order` 根据树结构重建，`menuSource` 统一改为 `imported`，本机来源路径不恢复。

解析器还接受单个 `MenuProfile` 和 V2 `MenuProfileStore` JSON。Store 格式优先选择活动且非空的方案，否则选第一个非空方案；导入永远只合并一个方案。

## Conflict and Compatibility Rules

- ID 冲突：无条件重新编号。
- 名称冲突：自动追加“（导入）”和数字后缀。
- 已应用状态：保持目标仓库原 `appliedProfileId`，只把 `activeProfileId` 指向新草稿。
- 跨版本：摘要提示来源/目标版本差异；17.2 缺 ASCII `compatibilityLabel` 时标记 warning，但允许先导入草稿。
- 命令依赖：摘要列出命令并明确方案包不包含 Skill 文件。

## Error Handling

- 文件对话框取消返回 `success: true, data: null`。
- 文件最大 5 MB，菜单最多 5000 项，防止异常输入耗尽内存。
- 未知 schema、畸形 JSON/Item、无效菜单树会在预览阶段阻断。
- `menu:create-import-plan` 重新读取并重新校验文件，避免预览后文件被替换而绕过验证。
- 真正写入使用主进程可信一次性 Apply Plan；执行前继续校验 `environmentId + pcbenvPath`。

## Tests and Verification

- `tests/menuProfileTransfer.test.ts`：包格式、路径清理、冲突重命名、ID/路径重建、17.2 警告、旧 JSON 与非法输入。
- `tests/menuProfileImportDialog.test.tsx`：摘要、警告、确认和忙碌态。
- `tests/pcbenvApplyIntegration.test.ts`：跨电脑包合并、备份、历史和撤销。
- `tests/menuWorkspace.test.tsx`：Renderer/preload 链与旧占位提示移除。

## Known Pitfalls

见 `.structure-os/PITFALLS.md`：`PIT-2026-08-12-01`。

## Extension Notes

新增 schema 时必须保留旧版本解析或给出明确迁移错误。不要把导入改成 Renderer 直接提交完整 Store，也不要在导入阶段自动生成 IL；菜单应用必须保持为独立、可审阅的第二个 Apply Plan。
