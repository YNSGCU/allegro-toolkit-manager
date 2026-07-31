# PhysicalKeyBindingPanel — Keyboard Detail Panel Upgrade

## Context

The keyboard detail panel (shown when clicking a physical key like "S") currently only shows static binding info with NO action buttons and has a bug: it only displays bindings matching the **current modifier layer** instead of ALL bindings for that physical key. This plan upgrades it to a full management panel.

**Root cause**: `KeyboardVisualizer` receives `layerFilteredBindings` (already filtered by Ctrl/Shift/Alt layer). The `selectedDetail` useMemo filters within that, so `S` (Shift layer) is invisible when in plain layer.

**Fix**: Pass `visibleBindings` (viewMode-filtered but NOT modifier-filtered) as a separate `allPhysicalKeyBindings` prop. The panel uses this for its binding list, while the keyboard visualization continues using `layerFilteredBindings`.

## Files to Create

### 1. `src/utils/hotkeyItem.ts` (NEW)
Physical key normalization utilities and shared configs.

**Functions:**
- `normalizeHotkeyKey(rawKey, type?)` → `{ physicalKey, displayKey, modifiers }` — strips modifier prefixes, lowercases base key. Delegates to existing `normalizeKey()` in `keyNormalizer.ts`.
- `enrichWithPhysicalKey(binding)` — adds `physicalKey` field
- `getBindingsByPhysicalKey(bindings, physicalKey)` — filters funckey bindings; excludes alias
- `filterBindingsByModifiers(bindings, activeModifiers)` — wraps `matchesModifiers`
- `isReadonlyBinding(binding)` — true for `allegro_default` / `system_reserved`
- `getLayerLabel(modifiers)` → "普通层" / "Ctrl 层"

**Shared configs** (extracted from KeyboardVisualizer.tsx):
- `BINDING_SRC_CONFIG` — maps source keys to `{ label, className }`
- `CMD_SRC_CONFIG` — maps command source keys to `{ label, className }`

### 2. `src/components/PhysicalKeyBindingPanel.tsx` (NEW)
The detail panel, replaces the inline `key-detail-panel` div.

**Props:**
```ts
selectedKey: string;                           // e.g. "S"
bindings: HotkeyBinding[];                     // all funckey bindings for this key
conflicts: Conflict[];
activeModifiers: string[];                     // for "仅当前层" filter
onClose: () => void;
onEdit: (b) => void;
onDelete: (b) => void;
onAdopt: (b) => void;
onOverrideSource: (b) => void;
onAddBinding: (physicalKey: string) => void;
```

**Internal state:**
- `showFilterAll: boolean` — toggle "全部绑定" / "仅当前层"

**Structure:**
```
phy-key-panel
├── phy-key-panel-header — "物理键 S 的绑定（N 个）" | [新增绑定] [关闭]
├── phy-key-panel-filter — [全部绑定] [仅当前层] toggle
└── phy-key-binding-list
    └── phy-key-binding-card (per binding)
        ├── info: badge, displayKey, layer label, zhName, command, source tags, line
        └── actions: [编辑] [删除] [接管] [修正来源] [查看原始行]
```

**Button rules:**
- `[编辑]` / `[删除]` — hidden when `isReadonlyBinding(b)` (reserved/allegro_default)
- `[接管]` — only if `bindingSource === 'user_env_original' && !isAdopted`
- `[修正来源]` — only if `!isSourceOverridden`
- `[查看原始行]` — shows expanded raw line if `lineNumber` exists

## Files to Modify

### 3. `src/components/KeyboardVisualizer.tsx` — MODIFY

**Prop additions:**
```ts
allPhysicalKeyBindings: HotkeyBinding[];     // viewMode-filtered, NOT modifier-filtered
onEditBinding?: (b) => void;
onDeleteBinding?: (b) => void;
onAdoptBinding?: (b) => void;
onOverrideSource?: (b) => void;
onAddBinding?: (key: string) => void;
```

**Changes:**
1. `selectedDetail` useMemo: switch from `bindings` to `allPhysicalKeyBindings` for the binding filter
2. Extract inline `RAW_ROWS` iteration into `findKeyDef` helper to avoid duplication
3. Replace `<div className="key-detail-panel">` with `<PhysicalKeyBindingPanel>`
4. Import shared configs from `hotkeyItem.ts` (remove local `BINDING_SRC_CONFIG`/`CMD_SRC_CONFIG`)

### 4. `src/pages/HotkeyPage.tsx` — MODIFY

**Handlers to add:**
- `handleDeleteBinding(binding)` — calls `window.atm.generateEditPlan({ bindingId, command: '' }, binding, envPath)` → sets `editPlan` state. Empty command triggers `comment_env_line` in the existing plan generator.
- `handleAddBindingConfirm(draft)` — calls `window.atm.generateAddPlan(key, command, type, envPath)` → sets `editPlan` state, closes dialog
- `showAddDialog: string | null` — state for controlling AddHotkeyDialog visibility

**Prop changes to `<KeyboardOccupancy>`:**
- Pass `allPhysicalKeyBindings={visibleBindings}` (NEW prop)
- Pass all new handler props
- Remove `_overridden` filter from the keyboard-level bindings (the panel already handles this)

### 5. `core/apply/hotkeyEditPlan.ts` — MODIFY

**Extend `EditOpType`:**
```ts
| 'add_env_line'
```

**Add `generateAddPlan(key, command, type, envFilePath, entries)`:**  
Creates a plan with:
1. Backup step
2. `add_env_line` step — adds `{type} {key} {command}` to managed block (or end of file if no block)

**Extend `executeEditPlan`:**
Handle `add_env_line` by inserting the new line before the `ATM_MANAGED_BLOCK_END` marker, or appending to end of file.

### 6. `electron/ipc/hotkey.ipc.ts` — MODIFY

Add handler `hotkey:generate-add-plan`:
```ts
ipcMain.handle('hotkey:generate-add-plan', async (_event, key, command, type, filePath) => {
  // imports generateAddPlan + parseEnvFile 
  // returns { success, data: EditApplyPlan }
})
```

### 7. `electron/preload.ts` — MODIFY

Expose `generateAddPlan` bridge:
```ts
generateAddPlan: (key, command, type, filePath) =>
  ipcRenderer.invoke('hotkey:generate-add-plan', key, command, type, filePath),
```

### 8. `src/App.css` — MODIFY

Add new CSS classes for the panel:
- `.phy-key-panel` — main container (border, radius, bg)
- `.phy-key-panel-header` — flex row with title + action buttons
- `.phy-key-panel-filter` — segmented toggle buttons
- `.phy-key-binding-card` — individual binding card
- `.phy-key-binding-card--readonly` — dashed border, reduced opacity
- `.phy-key-display-key` — cyan monospace for key name
- `.phy-key-layer-label` — small muted label for layer
- `.phy-key-command` — monospace command display
- `.phy-key-binding-card__actions` — flex row for action buttons
- `.phy-key-panel-empty` — centered empty state

## Out of Scope (Use Existing)

- **Editor dialog** — reuse `HotkeyEditor` component (opened via `onEdit`)
- **Edit plan preview** — reuse `EditApplyPlanPreview` (from `editPlan` state)
- **Adopt to profile** — reuse `saveProfileBindings` IPC (via `onAdopt`)
- **Source override dialog** — reuse existing modal (via `onOverrideSource`)
- **Conflicts display** — reuse `ConflictList` component
- **Apply Plan execution** — reuse existing `hotkey:execute-edit-plan` IPC

## Verification

1. `npx.cmd tsc -p tsconfig.electron.json` — no errors
2. `npx.cmd vitest run` — all 117+ tests pass (add_env_line in executeEditPlan needs test)
3. `npx.cmd vite build` — frontend compiles
4. Manual: Click S key → see BOTH `s` (普通层) and `S` (Shift层) and `Ctrl+S` (Ctrl层)
5. Manual: Toggle "仅当前层" in plain layer → only `s`
6. Manual: Toggle "仅当前层" in Shift layer → only `S`
7. Manual: [编辑] opens HotkeyEditor modal
8. Manual: [删除] generates comment-out plan → preview shows
9. Manual: [接管] adds to profile without removing env line
10. Manual: [＋ 新增绑定] shows AddHotkeyDialog with layer selector
11. Manual: Reserved keys (allegro_default) show 🔒, no edit/delete buttons

## Implementation Order

```
1. src/utils/hotkeyItem.ts          CREATE
2. src/App.css                      MODIFY (add styles)
3. core/apply/hotkeyEditPlan.ts     MODIFY (generateAddPlan + add_env_line)
4. electron/ipc/hotkey.ipc.ts       MODIFY (hotkey:generate-add-plan handler)
5. electron/preload.ts              MODIFY (expose generateAddPlan)
6. src/components/PhysicalKeyBindingPanel.tsx  CREATE
7. src/components/KeyboardVisualizer.tsx       MODIFY (replace detail panel)
8. src/pages/HotkeyPage.tsx         MODIFY (add handlers, pass props)
9. Build & verify
```
