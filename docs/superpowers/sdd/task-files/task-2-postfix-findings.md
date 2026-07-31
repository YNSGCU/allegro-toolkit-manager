# Task 2 Post-Fix Verification Finding

## Symptom

Local verification found this command is still not clean:

`npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`

Observed result:

- both test files report passed
- but Vitest exits with an unhandled error
- error message:
  - `ReferenceError: window is not defined`
  - caught after test environment teardown
  - reported as originating while running `tests/hotkeyWorkspaceRouting.test.tsx`

## Reproduction Narrowing

- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
  - reproduces the unhandled error
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
  - does not reproduce the unhandled error

## Root-Cause Hypothesis

Likely cause:

- `tests/hotkeyWorkspaceRouting.test.tsx` only waits for the subnav redirect/link state
- `HotkeyWorkspacePage` starts async `loadAll()` immediately
- the test finishes and jsdom tears down before that async load fully completes
- `loadAll()` then continues calling `setState(...)` after unmount/teardown
- React scheduler then touches `window` after the environment is gone

Relevant code points:

- `src/pages/HotkeyWorkspacePage.tsx:208-231`
  - async `loadAll()` performs many awaited operations and then many `setState(...)`
- `src/pages/HotkeyWorkspacePage.tsx:235-241`
  - effect kicks off `void loadAll()` with no unmount cancellation guard
- `tests/hotkeyWorkspaceRouting.test.tsx:26-43`
  - test asserts routing/subnav only and exits without waiting for shared load completion

## Fix Direction

- Stay within Task 2 scope
- Do not change user-facing task boundaries
- Make `HotkeyWorkspacePage` safe when unmounted before async load completion
- Preferred direction:
  - add a mounted/cancelled guard around the async effect and state writes
  - or another equally clean mechanism that prevents post-unmount state updates
- Ensure the same verification command exits fully clean with no unhandled errors

## Covering Verification To Re-Run

- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`
