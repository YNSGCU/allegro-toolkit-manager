# Core Config Management

## What It Does

ATM helps you inspect your Allegro environment and safely manage personal hotkeys, skills, and ATM-managed menu overlays.

## When To Use It

- When you need to confirm which `pcbenv` and `env` files are active
- When you want to preview hotkey, skill, or menu changes before writing files
- When you need backups and change history around personal config changes

## How To Use It

1. Open ATM and confirm the detected environment on the dashboard or environment page.
2. Go to Hotkeys, Skills, or Menu depending on what you want to change.
3. Review the preview/status information and generate an Apply Plan before writing changes.
4. Apply the plan and re-open Allegro or reload the relevant config if needed.

## Limitations

- ATM manages writable user config, not shared company install directories.
- Electron runtime health is required for launching the desktop app.
- `core/` logic has automated tests; Electron UI flows still need manual verification.

## Troubleshooting

- Symptom: Electron type-check fails because the `electron` module has no declarations.
  - What to try: verify `node_modules/electron/electron.d.ts` exists and re-run backend type-check.
- Symptom: App starts but behavior looks stale after backend changes.
  - What to try: rebuild Electron with `npm run build:electron` and restart the app.

## Related Features

- `docs/用户手册.md`
- `docs/开发手册.md`
