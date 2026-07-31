# Feature: project-governance

## Purpose

Establish minimal Structure OS-compatible project memory and handoff documentation for ATM.

## Ownership

- Module: `.structure-os/`, `.agents/`, `docs/`
- Public entry points: onboarding and handoff docs
- Related docs: `AGENTS.md`, `docs/MODULE_MAP.md`

## Feature Chain

```txt
Agent reads shared instructions -> reads project brief/state/handoff -> runs validation commands -> updates docs/handoff before stopping
```

## Entry Points

- UI: none
- API/routes/IPC: none
- Services: none
- Storage: markdown/json governance files in repo

## Public Interfaces

- `.structure-os/PROJECT_BRIEF.md`
- `.structure-os/CURRENT_STATE.md`
- `.structure-os/HANDOFF.md`
- `.agents/protocol.md`
- `.agents/ownership.json`

## Data Model

- Project summary
- Current validation state
- Handoff notes
- Runtime registry and ownership rules

## Error Handling

- When CLI is absent, validation must be reported as file-based only.
- Missing governance files should be filled deliberately, not invented ad hoc during unrelated work.

## Tests and Verification

- Automated: none
- Manual: read-through plus command evidence in final reports
- Commands:
  - `npx.cmd tsc --noEmit`
  - `npx.cmd tsc -p tsconfig.electron.json --noEmit`
  - `npm test`

## Known Pitfalls

- Governance can drift quickly if `.structure-os/HANDOFF.md` is not updated after edits.

## Extension Notes

- Keep runtime entry files short and let `AGENTS.md` remain the canonical shared instruction source.
