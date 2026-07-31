# Task 5 Report

## Scope

- Owner files only:
  - `src/pages/SkillPage.tsx`
  - `src/pages/MenuPage.tsx`
  - `src/pages/DashboardPage.tsx`
  - `src/pages/EnvironmentPage.tsx`
  - `tests/pageSurfaces.test.ts`

## TDD record

1. Extended `tests/pageSurfaces.test.ts` first.
2. Ran `npx.cmd vitest run tests/pageSurfaces.test.ts` and confirmed RED.
3. Swapped the four remaining page headers from `CoreWorkspaceHero` to `MinimalSurface`.
4. Reused `getPageSurface(...)` for all four pages and kept the existing page-specific controls, tabs, cards, and actions below the new minimal header.
5. Added short summary lines per page using existing state only, keeping the copy compact and resilient to the current encoding noise.

## Implementation summary

- `SkillPage`
  - Replaced the old hero with `MinimalSurface`.
  - Wired the surface to `getPageSurface('skills')`.
  - Added a compact summary line from skill count, ref status, and active profile.

- `MenuPage`
  - Replaced the old hero with `MinimalSurface`.
  - Wired the surface to `getPageSurface('menu')`.
  - Added a compact summary line from node count, draft status, and IL/error state.

- `DashboardPage`
  - Replaced the old hero with `MinimalSurface`.
  - Wired the surface to `getPageSurface('overview')`.
  - Kept the lighter helper-page tone with score/env/pcbenv summary status.

- `EnvironmentPage`
  - Replaced the old hero with `MinimalSurface`.
  - Wired the surface to `getPageSurface('environment')`.
  - Kept the lighter helper-page tone with detection mode/env/pcbenv summary status.

## Verification

- `npx.cmd vitest run tests/pageSurfaces.test.ts`
  - PASS after implementation.

- `npx.cmd vitest run tests/pageSurfaces.test.ts tests/minimalSurface.test.tsx`
  - Page-level target tests PASS.
  - Command exit code still fails because Vitest also collects an unrelated fixture suite at:
    - `docs/superpowers/sdd/2026-07-02-ui-reset-marvis-minimal/task-5-before/tests/pageSurfaces.test.ts`
  - That suite imports `../src/config/appShell` from inside the docs snapshot folder and is broken independently of Task 5.

- `npx.cmd tsc --noEmit`
  - PASS

- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
  - PASS

- `npm test`
  - All real repo test files passed (`131 passed`).
  - Overall command still fails for the same unrelated docs fixture suite above.

- `npm run build:renderer`
  - PASS
  - Existing Vite chunk-size warning remains on the renderer bundle.

## Concerns

- The only blocking verification noise is the pre-existing docs fixture suite under `docs/.../task-5-before/tests/`, which is outside this task's owned files.
- The repository still has visible encoding noise in some source/doc output; this task avoided broad text rewrites and kept changes local to the owned files.

## Reviewer follow-up

### Fixed findings

- `MenuPage`
  - Restored first-screen warning visibility in `menuSummaryLine`.
  - The summary now preserves three branches: `error` -> `warning` -> `IL` fallback.

- `tests/pageSurfaces.test.ts`
  - Upgraded from shallow action-id / component-name checks to stronger prompt-first contract checks.
  - The test now verifies each owned page keeps:
    - a `Surface = getPageSurface(...)` binding
    - a `SummaryLine` array
    - `MinimalSurface` wired with `title/subtitle/prompt/summaryLine/cards`
    - page-specific summary signals
  - Added a dedicated assertion that `MenuPage` keeps `hasError`, `hasWarning`, warning count, and IL fallback visible in source.

- `SkillPage`
  - Replaced the duplicated profile-name third signal with a more operational composition signal.
  - The third summary item now surfaces user/company Skill composition instead of repeating the adjacent `ProfileBar`.

### Follow-up verification

- `npx.cmd vitest run tests/pageSurfaces.test.ts tests/minimalSurface.test.tsx`
  - PASS

- `npx.cmd tsc --noEmit`
  - PASS

- `npx.cmd tsc -p tsconfig.electron.json --noEmit`
  - PASS

- `npm test`
  - PASS (`134 passed`)

- `npm run build:renderer`
  - PASS
  - Existing Vite chunk-size warning remains.
