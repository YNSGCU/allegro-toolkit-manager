# Current State

## Snapshot

- Last updated: 2026-07-31
- Current branch: Git repository initialized; UI reset baseline commit `c95a222`
- App status: five routed pages use the shared workspace UI contract; write safety and IPC boundaries are unchanged
- Test status: 36 files / 202 tests pass after obsolete MinimalSurface and responsive-scale tests were removed
- Validation status: frontend TypeScript, Electron TypeScript and renderer production build pass

## Implemented Behavior

- Environment page locates and inspects Allegro config paths.
- Hotkey page supports layered visualization, conflict checks, profile preview/application, import/export, and change history.
- Skill page supports scanning, metadata inspection, impact analysis, loader/order checks, and skill profiles.
- Skill page now uses a compact workspace with a dense independently scrollable table, command/diagnostic views, a proportional detail inspector without decorative avatars, truthful diagnostic state and an in-page profile Apply Plan confirmation chain.
- Multi-file Skill subdirectories are now represented as one directory package; loader/main entry selection, aggregate command parsing and recursive static load-chain detection prevent internal modules from appearing as separate unloaded Skills.
- Menu page supports tree editing, validation, preview generation, linked command selection, and Apply Plan.
- Shared UI foundations now provide tokens, shell, workspace header, status strip, page states and a unified Apply Plan dialog.
- Hotkey data loading is isolated in `src/services/loadHotkeyWorkspaceData.ts`; the obsolete `HotkeyPage.tsx` UI was removed.
- Overview and Environment are operating dashboards with explicit loading/error states instead of MinimalSurface landing cards.

## Partial or Broken Behavior

- Structure OS CLI is not installed locally, so governance validation is file-based only.
- Route-level code splitting remains pending; Vite reports a non-blocking main-chunk size warning above 500kB.

## Recently Changed Areas

- `src/shared/ui/`, `src/components/Layout.tsx`: design tokens, app shell and shared workspace contract
- `src/pages/{DashboardPage,EnvironmentPage,HotkeyWorkspacePage,SkillPage,MenuPage}.tsx`: five-page UI reset
- `src/services/loadHotkeyWorkspaceData.ts`: hotkey read orchestration extracted from the deleted legacy page
- `docs/dev/features/workspace-ui-architecture.md`, `docs/user/features/workspace-ui.md`: developer and user documentation

## Open Questions

- Should route-level dynamic imports be introduced to remove the current Vite chunk-size warning?
- Should remaining large feature dialogs be migrated from inline styles into domain CSS modules in a dedicated cleanup?
