# Task 5 Review Package

## Purpose

This file substitutes for a git diff package because this repository does not
have a `.git` directory.

- `Test-Path .git` => `False`
- Review scope is Task 5 only
- Do not treat Task 6 work as required for Task 5

## Task Boundary

Task 5 is only about:

- turning `/hotkeys/conflicts` into a real conflict-diagnostics page
- reusing the existing `EnhancedConflictList` and `ApplyPlanPreview` flow
- making raw-line view from conflicts route reliably resolve to actual file paths

Task 5 is not required to:

- redesign conflict-deduplication rules
- make `import-export` a real page yet
- change `core/`, `electron/`, IPC, parsing, or validation rules

## Inputs

- Brief:
  `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-5-brief.md`
- Global constraints:
  `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-1-global-constraints.txt`
- Implementer report:
  `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-5-report.md`

## Changed Files

- Created: `src/components/hotkeys/HotkeyConflictsPanel.tsx`
- Modified: `src/pages/HotkeyWorkspacePage.tsx`
- Modified: `src/App.css`
- Modified: `tests/hotkeyWorkspacePanels.test.tsx`

## Baseline Sources

Pre-task snapshots exist here:

- `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-5-baseline\HotkeyWorkspacePage.tsx`
- `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-5-baseline\App.css`
- `C:\Users\89539\Documents\ClaudeCode\AllegroDevOpsTool\docs\superpowers\sdd\task-files\task-5-baseline\hotkeyWorkspacePanels.test.tsx`

## Current Change Summary

### 1. Conflicts route is now a real diagnostics page

`src/components/hotkeys/HotkeyConflictsPanel.tsx`

- `:30-48` resolves raw-line targets from source token to actual file path
- `:75-81` routes resolved targets through shared `handleViewRawLine(...)`
- `:88-142` renders the real conflict page with:
  - refresh diagnostics
  - generate apply plan
  - summary strip
  - diagnostics list
- `:146-152` mounts `ApplyPlanPreview` when a plan exists

Review focus:

- whether the panel is a real route, not a placeholder shell
- whether raw-line resolution is reliable for reference env cases

### 2. Workspace page now mounts the real conflicts panel and shared raw-line modal

`src/pages/HotkeyWorkspacePage.tsx`

- `:5` imports `RawLineView`
- `:6` imports `HotkeyConflictsPanel`
- `:304-310` tightens shared `handleViewRawLine(...)` guard behavior
- `:403-425` adds a shared raw-line modal at workspace-page level
- `:428` replaces the inline placeholder conflicts route with the real panel

### 3. CSS adds conflict-page layout only

`src/App.css`

- `:5477-5578` adds `hotkey-conflicts-*` styles and summary layout

Review focus:

- lightweight layout, no dashboard regression
- consistent with overview/editor pages already landed

### 4. Tests now lock the diagnostics route and path resolution

`tests/hotkeyWorkspacePanels.test.tsx`

- `:38-233` adds the conflicts-route test
- it verifies:
  - real page heading and diagnostics section
  - warning summary rendering
  - apply-plan preview render
  - raw-line path resolution from `envSourceId` to `envSources.path`

## Verification Reported

Implementer-reported passing commands:

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- `npx.cmd tsc --noEmit`
- `Test-Path .git`

Controller local verification:

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - passed, `1` file / `6` tests
- `npx.cmd tsc --noEmit`
  - passed
- `Test-Path .git`
  - `False`

## Known Concern From Implementer

The implementer explicitly reported one non-blocking concern:

- current data loading still preserves both validation conflicts and synthesized
  `cross_env_override` hints, so a single key can appear as a warning plus an
  info-style reference override entry

For this review:

- treat that as a real issue only if Task 5 was required to change dedupe rules
- do not require a conflict-merging redesign unless the brief clearly demanded it

## Review Method For No-Git Repo

Because there is no repo diff, review against:

1. the task brief
2. the implementer report
3. the baseline snapshot files above
4. the current changed files above

If you need to compare a modified file directly, use the baseline copy and the
current file as the before/after pair for this task.
