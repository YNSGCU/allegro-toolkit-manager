# Connectivity Checklist

## Renderer to Core Chains

| Feature | UI | Preload | IPC | Core | Refresh/Error States |
|---|---|---|---|---|---|
| Environment detection | Yes | Yes | Yes | Yes | Yes |
| Hotkey management | Yes | Yes | Yes | Yes | Yes |
| Skill management | Yes | Yes | Yes | Yes | Yes |
| Menu management | Yes | Yes | Yes | Yes | Yes |
| Runtime diagnostics | Yes | Yes | Yes | N/A | Yes |
| Multi-version environments | Yes | Yes | Yes | Yes | Yes |
| Hotkey cross-version migration | Yes | Yes | Yes | Yes | Yes |
| Allegro runtime version verification | Yes | Yes | Yes | Yes | Yes |

## Current Gaps

- No project-local Structure OS CLI to automate governance validation.
- Source layout has not yet been migrated to the recommended module-boundary structure.
- Electron production runtime has verified renderer chunks, preload injection, IPC environment reads and real Hotkey data loading; Skill/Menu write-plan execution still requires a user-approved manual smoke test because it can affect local Allegro configuration.
- Hotkey Key/List/Conflict child routes share the same renderer data owner; route switches do not add IPC calls or bypass Apply Plan.
- Hotkey command suggestions are renderer-local and read-only; selected commands enter the existing Apply Plan chain. Editable env/Profile sources refresh after execution, while reference/default/Skill-direct sources remain read-only.
- Multi-version environment switching is persisted outside any individual pcbenv. Apply Plans lock environment identity and reject confirmation after an environment change. Runtime compatibility of complex commands, menus and SKILL APIs still needs target-version Allegro verification.

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
