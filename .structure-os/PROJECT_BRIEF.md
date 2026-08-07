# Project Brief

## Product Purpose

Allegro Toolkit Manager (ATM) is a desktop tool for inspecting and safely managing writable Allegro user configuration. It focuses on the user-owned config layer under `pcbenv` and avoids modifying shared company installs directly.

## Target Users

- PCB designers or CAD users working in Allegro on Windows
- Maintainers who need to inspect, back up, compare, and apply personal config changes safely

## Core Workflows

- Environment detection: locate `HOME`, `pcbenv`, `env`, `allegro.ilinit`, and ATM-managed directories.
- Hotkey management: inspect bindings, detect conflicts, preview changes, and apply them through Apply Plan.
- Skill management: scan user/company/ATM skills, inspect command exposure, and manage enable/disable flows safely.
- Menu management: edit ATM-managed overlay menus, validate menu trees, preview generated IL, and apply changes safely.

## Current Feature Status

- Complete: environment scan, hotkey command assistance and reliable env/Profile editing, skill workflow, menu workflow, shared profile bar/status UI, transactional Apply Plan pipeline, Windows CI and unsigned NSIS packaging
- Partial: Structure OS governance files, runtime registry, durable handoff memory
- Planned: incremental source-tree boundary cleanup, real publisher metadata and public-release code signing
- Deprecated: none recorded

## Tech Stack

- Runtime: Node.js on Windows
- Frontend: React 19 + Vite 6 + TypeScript
- Backend: Electron 35 main/preload + TypeScript
- Storage: local filesystem under `pcbenv`, ATM-generated files, JSON settings/history files
- External services: none required at runtime

## Main Modules

- `core/`: pure TS business logic and filesystem workflows
- `electron/`: Electron main process, preload bridge, IPC registration
- `src/`: renderer pages, components, hooks, and shared UI types
- `docs/`: Chinese manuals plus governance docs

## Data and Storage Model

- User environment files: `pcbenv/env`, `pcbenv/allegro.ilinit`
- ATM-managed output: `pcbenv/atm_generated/*`
- Settings and history: JSON files under ATM-managed directories
- Profiles: hotkey, skill, and menu profile JSON files

## External Dependencies

- Allegro user config layout and IL loading behavior
- Electron binary availability for local desktop runtime
- Windows filesystem permissions and path conventions

## Current Risks

- No project-local Structure OS CLI is installed.
- Source tree is functional but not yet aligned to the recommended `pages/modules/shared/infra` layout.
- Electron install health can affect both type declarations and binary availability if package contents are incomplete.
- Windows artifacts have a project icon but are not code-signed; publisher identity is still generic.

## Next Recommended Tasks

- Keep the new governance files updated when behavior or architecture changes.
- Run `npm run verify` before merging and `npm run package:dir` after packaging changes.
- Replace generic publisher metadata and add Windows signing before public distribution.
