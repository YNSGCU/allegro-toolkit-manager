# Agent Onboarding

## First 5 Minutes

1. Read `AGENTS.md`.
2. Read `.structure-os/PROJECT_BRIEF.md`.
3. Read `.structure-os/CURRENT_STATE.md`.
4. Read `.structure-os/HANDOFF.md`.
5. Search `.structure-os/PITFALLS.md` for Electron install, hotkey, skill, menu, or IPC changes you plan to touch.

## Local Commands

```bash
npm test
npx.cmd tsc --noEmit
npx.cmd tsc -p tsconfig.electron.json --noEmit
npx.cmd electron --version
```

## Structure OS CLI Status

The project-local Structure OS CLI is not installed. Use file-based checks instead of claiming `doctor`, `brief`, or `validate` passed.

## Do Not Start Until

- The target feature chain is understood across renderer, preload, IPC, and `core/`.
- You know whether the change is user-visible, internal-only, or both.
- Relevant docs paths are identified before changing behavior.
