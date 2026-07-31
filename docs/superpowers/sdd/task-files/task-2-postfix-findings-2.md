# Task 2 Post-Fix Verification Finding 2

## Current Symptom

The previous fix did not fully resolve the verification issue.

Still reproduces:

- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
  - test assertion passes
  - but Vitest still reports:
    - `ReferenceError: window is not defined`
    - caught after test environment teardown

Does not reproduce when running:

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`

And surprisingly may be masked when running both files together:

- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`

That masking strongly suggests timing/scheduling rather than a fully fixed root cause.

## Refined Root-Cause Hypothesis

The remaining issue is likely caused by the *initial synchronous state scheduling*
at the top of `loadAll()`, not the guarded post-await writes.

Relevant code:

- `src/pages/HotkeyWorkspacePage.tsx:214`
  - `setLoading(true);`
- `src/pages/HotkeyWorkspacePage.tsx:215`
  - `setError(null);`

Why this matters:

- component initial state is already `loading = true` and `error = null`
- first mount still schedules those updates again inside the effect-triggered `loadAll()`
- `tests/hotkeyWorkspaceRouting.test.tsx` ends quickly after asserting redirect/subnav
- React may flush those scheduled updates after jsdom teardown
- this explains why the “panels” test is clean while the “routing” test alone still throws

The previous `isMountedRef` / `canSafelySetState()` guard only protects state
writes after the awaited load finishes. It does not prevent the immediate
scheduling of the initial redundant updates.

## Fix Direction

- Make the initial `loadAll()` call not schedule redundant state updates on first mount
- Prefer the smallest fix that removes the teardown-time scheduling hazard
- Examples of acceptable approaches:
  - skip `setLoading(true)` / `setError(null)` on the first load when state is already in that shape
  - or refactor the first-run flow so no redundant initial state update is scheduled
- Keep the existing unmount guard for post-await writes if still useful

## Covering Verification To Re-Run

- `npx.cmd vitest run tests/hotkeyWorkspaceRouting.test.tsx`
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx`
- `npx.cmd vitest run tests/hotkeyWorkspacePanels.test.tsx tests/hotkeyWorkspaceRouting.test.tsx`
