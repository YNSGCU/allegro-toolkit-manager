# Cross-Agent Protocol

## Source of Truth

- `AGENTS.md` is the canonical cross-agent instruction file.
- `.structure-os/*` holds project memory, current state, pitfalls, and handoff notes.
- `.agents/*` holds runtime registry and shared ownership conventions.

## Working Rules

1. Read `AGENTS.md` and `.structure-os/HANDOFF.md` before editing.
2. Do not overwrite runtime entry files without an explicit merge decision.
3. Record new non-obvious failures in `.structure-os/PITFALLS.md`.
4. Update relevant docs when user-visible or architectural behavior changes.
5. Prefer file-based validation when the project-local Structure OS CLI is absent.

## Return Rule

- Before handing off, update `.structure-os/HANDOFF.md` with commands run, commands skipped, and the next recommended step.
