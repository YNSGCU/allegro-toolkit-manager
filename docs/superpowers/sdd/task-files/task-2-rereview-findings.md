# Task 2 Re-Review Findings

## Important

### 1. `handleExportProfile` behavior regressed

- Current behavior in shared container:
  - `src/pages/HotkeyWorkspacePage.tsx:471`
  - `src/pages/HotkeyWorkspacePage.tsx:475`
- Reviewer says it now only calls IPC and discards the return value, so the
  user gets no download/file result.
- Old working reference:
  - `src/pages/HotkeyPage.tsx:691`
  - `src/pages/HotkeyPage.tsx:703`

Fix direction:

- Make shared `handleExportProfile` preserve the old user-visible behavior,
  not just fire the IPC call.

### 2. `handleEnvImportClick` lost async error containment

- Current behavior in shared container:
  - `src/pages/HotkeyWorkspacePage.tsx:435`
  - `src/pages/HotkeyWorkspacePage.tsx:443`
  - `src/pages/HotkeyWorkspacePage.tsx:457`
- Reviewer says this now uses `void (async () => ...)()` without the old
  `try/catch` containment, so rejected promises can become unhandled async
  errors.
- Old working reference:
  - `src/pages/HotkeyPage.tsx:1250`
  - `src/pages/HotkeyPage.tsx:1288`

Fix direction:

- Restore proper async error handling/containment for the shared action.
- Keep Task 2 scope; no need to build the full import UI.

## Minor

### 3. `handleAdoptBinding` may leave profile snapshot stale

- Reviewer notes local profile snapshot drift risk:
  - `src/pages/HotkeyWorkspacePage.tsx:345`
  - `src/pages/HotkeyWorkspacePage.tsx:359`
  - `src/pages/HotkeyWorkspacePage.tsx:360`

This is nice-to-have and not blocking unless you can fix it cheaply while
addressing the important findings without expanding scope.

## Covering Verification To Re-Run

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`
