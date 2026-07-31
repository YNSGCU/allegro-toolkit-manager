# Feature: core-config-management

## Purpose

Provide the main environment, hotkey, skill, and menu management workflows for ATM.

## Ownership

- Module: `src/`, `electron/`, `core/`
- Public entry points: renderer pages, `window.atm.*`, IPC channels under `env:*`, `hotkey:*`, `skill:*`, `menu:*`
- Related docs: `docs/PRODUCT_OVERVIEW.md`, `docs/MODULE_MAP.md`

## Feature Chain

```txt
UI -> preload bridge -> IPC handler -> core logic -> filesystem -> UI refresh and status
```

## Entry Points

- UI: `src/pages/EnvironmentPage.tsx`, `src/pages/HotkeyWorkspacePage.tsx`, `src/pages/SkillPage.tsx`, `src/pages/MenuPage.tsx`
- API/routes/IPC: `electron/preload.ts`, `electron/ipc/*.ipc.ts`
- Services: `core/*`
- Storage: Allegro config files and ATM-managed JSON/IL output under `pcbenv`

## Public Interfaces

- `window.atm.*` methods declared in `src/types/window.d.ts`
- IPC channels documented in `AGENTS.md`

## Data Model

- Environment descriptors
- Hotkey bindings and conflicts
- Skill scan results, profiles, usage status
- Menu profile store and menu tree validation issues
- Apply Plan and change-history records

## Error Handling

- IPC handlers return `{ success, data }` or `{ success, error }`
- Risky file writes go through Apply Plan and backup flows
- Renderer pages show status pills, toasts, or error panels

## Tests and Verification

- Automated: `tests/*.test.ts` for `core/`
- Manual: launch Electron and navigate core pages
- Commands:
  - `npm test`
  - `npx.cmd tsc --noEmit`
  - `npx.cmd tsc -p tsconfig.electron.json --noEmit`

## Known Pitfalls

- See `.structure-os/PITFALLS.md`, especially `PIT-2026-07-02-01`

## Extension Notes

- Preserve the bridge chain when adding functionality: renderer -> preload -> IPC -> core.
- Avoid bypassing Apply Plan for user config writes.
