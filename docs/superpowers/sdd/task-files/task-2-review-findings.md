# Task 2 Review Findings

## Critical

- `HotkeyWorkspacePage` 只是复刻了一个最小骨架，并没有把旧页已有的数据与事件真正抽出来复用。
- Reviewer evidence:
  - new container keeps `reservedBindings` / `enhancedConflicts` / `plan` empty or null:
    - `src/pages/HotkeyWorkspacePage.tsx:143`
    - `src/pages/HotkeyWorkspacePage.tsx:145`
    - `src/pages/HotkeyWorkspacePage.tsx:154`
  - new container leaves key actions as no-op:
    - `src/pages/HotkeyWorkspacePage.tsx:294`
    - `src/pages/HotkeyWorkspacePage.tsx:295`
    - `src/pages/HotkeyWorkspacePage.tsx:303`
    - `src/pages/HotkeyWorkspacePage.tsx:305`
    - `src/pages/HotkeyWorkspacePage.tsx:307`
    - `src/pages/HotkeyWorkspacePage.tsx:309`
  - old page still owns the real implementations:
    - `src/pages/HotkeyPage.tsx:83`
    - `src/pages/HotkeyPage.tsx:176`
    - `src/pages/HotkeyPage.tsx:475`
    - `src/pages/HotkeyPage.tsx:504`
    - `src/pages/HotkeyPage.tsx:531`
    - `src/pages/HotkeyPage.tsx:868`
    - `src/pages/HotkeyPage.tsx:989`
    - `src/pages/HotkeyPage.tsx:1052`

## Important

- Shared data semantics still diverge from the old page.
- Reviewer specifically called out:
  - new container only validates current env and leaves `reservedBindings` empty:
    - `src/pages/HotkeyWorkspacePage.tsx:193`
    - `src/pages/HotkeyWorkspacePage.tsx:223`
    - `src/pages/HotkeyWorkspacePage.tsx:272`
  - old page still loads default/reserved key library, reference env bindings, and cross-env conflicts:
    - `src/pages/HotkeyPage.tsx:176`
    - `src/pages/HotkeyPage.tsx:212`
    - `src/pages/HotkeyPage.tsx:260`
    - `src/pages/HotkeyPage.tsx:297`
    - `src/pages/HotkeyPage.tsx:321`

## Minor

- `plan` state is currently typed as `null` only instead of `ApplyPlan | null`:
  - `src/pages/HotkeyWorkspacePage.tsx:154`
  - `src/components/hotkeys/types.ts:49`

## Fix Direction

- Stay within Task 2 scope.
- Do not build the real editor/conflicts/import-export UI yet.
- Do make `HotkeyWorkspacePage` genuinely inherit reusable data/event behavior from the old `HotkeyPage`.
- It is acceptable for placeholder panels to remain placeholders, but they must now receive non-fake shared state / actions.
- `src/pages/HotkeyPage.tsx` is allowed and expected to participate in this fix if needed.

## Covering Tests To Re-Run

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`
