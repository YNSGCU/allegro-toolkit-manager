# Connectivity Checklist

## Renderer to Core Chains

| Feature | UI | Preload | IPC | Core | Refresh/Error States |
|---|---|---|---|---|---|
| Environment detection | Yes | Yes | Yes | Yes | Yes |
| Hotkey management | Yes | Yes | Yes | Yes | Yes |
| Skill management | Yes | Yes | Yes | Yes | Yes |
| Menu management | Yes | Yes | Yes | Yes | Yes |
| Runtime diagnostics | Yes | Yes | Yes | N/A | Yes |

## Current Gaps

- No project-local Structure OS CLI to automate governance validation.
- Source layout has not yet been migrated to the recommended module-boundary structure.
- Electron production runtime has verified renderer chunks, preload injection, IPC environment reads and real Hotkey data loading; Skill/Menu write-plan execution still requires a user-approved manual smoke test because it can affect local Allegro configuration.

## Verification Commands

```bash
npm test
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npx.cmd electron --version
```
