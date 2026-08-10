# Connectivity Checklist

## Renderer to Core Chains

| Feature | UI | Preload | IPC | Core | Refresh/Error States |
|---|---|---|---|---|---|
| Environment detection | Yes | Yes | Yes | Yes | Yes |
| Hotkey management | Yes | Yes | Yes | Yes | Yes |
| Skill management | Yes | Yes | Yes | Yes | Yes |
| Menu management | Yes | Yes | Yes | Yes | Yes |
| Version-aware Allegro text encoding | N/A | N/A | Yes | Yes | Yes |
| Menu backup discovery/recovery | Yes | Yes | Yes | Yes | Yes |
| Menu cross-environment copy and switch guard | Yes | Yes | Yes | Yes | Yes |
| Runtime diagnostics | Yes | Yes | Yes | N/A | Yes |
| Multi-version environments | Yes | Yes | Yes | Yes | Yes |
| Per-environment management switch | Yes | Yes | Yes | Yes | Yes |
| Hotkey cross-version migration | Yes | Yes | Yes | Yes | Yes |
| Allegro runtime version verification | Yes | Yes | Yes | Yes | Yes |
| Unified workspace binding/application | Yes | Yes | Yes | Yes | Yes |

## Current Gaps

- No project-local Structure OS CLI to automate governance validation.
- Source layout has not yet been migrated to the recommended module-boundary structure.
- Electron production runtime has verified renderer chunks, preload injection, IPC environment reads and real Hotkey data loading; Skill/Menu write-plan execution still requires a user-approved manual smoke test because it can affect local Allegro configuration.
- Hotkey Key/List/Conflict child routes share the same renderer data owner; route switches do not add IPC calls or bypass Apply Plan.
- Hotkey command suggestions are renderer-local and read-only; selected commands enter the existing Apply Plan chain. Editable env/Profile sources refresh after execution, while reference/default/Skill-direct sources remain read-only.
- Multi-version environment switching is persisted outside any individual pcbenv. Apply Plans lock environment identity and reject confirmation after an environment change. Runtime compatibility of complex commands, menus and SKILL APIs still needs target-version Allegro verification.
- The sidebar can launch the selected Allegro executable with per-process `HOME/CDSROOT`; it never rewrites global Windows environment variables. A real 17.2 launch still needs manual confirmation after rebuilding Electron.
- Unified workspace binding loads candidates from the selected environment, persists atomically, and rejects apply when the active environment is missing or different. Menu/Skill/Bridge execution consumes a one-time main-process plan snapshot.
- Menu loading reports active-environment identity, read-only alternatives and backup recovery candidates. Recovery or explicit cross-environment copy writes only `menu_profile.json` through a trusted Apply Plan；方案/环境切换前会先保存当前草稿。派生 IL 的生成仍是独立 Apply Plan，并按 17.2=GBK、17.4=UTF-8 写入。

## Verification Commands

```bash
npm test
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npx.cmd electron --version
```


## 应用内更新链路

- [x] Renderer 更新面板、preload、IPC 和 Main 更新服务已连接。
- [x] 开发模式、未配置源、下载失败和安装前置条件有明确状态。
- [ ] 真实 ATM HTTPS Release、签名安装包和旧版本覆盖升级 E2E 尚未完成。
