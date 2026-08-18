# Kanata Studio Shell & Keyboard UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken modal layout and ship a resizable custom-chrome Studio shell with modal settings/key editing, per-key reset, selected-keyboard visual presets, and Fn/media-layer visualization.

**Architecture:** Introduce shared modal/window-shell primitives, persist pane/keyboard visual preferences with serde-compatible defaults, and keep visual keyboard geometry/Fn metadata separate from Kanata mapping semantics. Existing action editors and profile overlay rules remain the source of truth for remaps.

**Tech Stack:** React 19, TypeScript 6, Vitest/Testing Library, Tauri 2.11, Rust/Serde.

**Spec:** `docs/superpowers/specs/2026-08-18-studio-shell-keyboard-polish-design.md`

## Global Constraints
- Keep all existing profiles backward compatible.
- Do not re-add persistent GitHub Actions/CI workflows.
- Physical Fn is editable only when explicitly observable; otherwise show `Hardware-controlled`.
- Reset removes the current direct override and falls back to inherited/default behavior.
- Native decorations are disabled only for the Studio main window.

---

### Task 1: Shared modal primitive and profile-layout regression

**Files:**
- Create: `studio/src/components/Modal.tsx`
- Create: `studio/src/components/Modal.test.tsx`
- Modify: `studio/src/features/profiles/CreateProfileDialog.tsx`
- Modify: `studio/src/features/keyboards/KeyboardManagerDialog.tsx`
- Modify: `studio/src/styles/shell.css`

**Interfaces:**
- Produces `Modal({ open, title, onClose, className?, children, footer? })`.

- [ ] Write tests asserting the modal has `role="dialog"`, closes on Escape/backdrop, and does not close on content click.
- [ ] Run `cd studio && pnpm test -- Modal.test.tsx`; expect failure before `Modal` exists.
- [ ] Implement fixed backdrop/content modal and shared CSS with `position: fixed; inset: 0; display: grid; place-items: center;` plus bounded width/height and inner overflow.
- [ ] Migrate profile and keyboard-manager dialogs to `Modal`.
- [ ] Run `cd studio && pnpm test -- Modal.test.tsx`; expect pass.

### Task 2: Modal settings and key editor with reset

**Files:**
- Create: `studio/src/features/settings/SettingsDialog.tsx`
- Create: `studio/src/features/inspector/KeySettingsModal.tsx`
- Create: `studio/src/features/inspector/KeySettingsModal.test.tsx`
- Modify: `studio/src/app/profileHelpers.ts`
- Modify: `studio/src/app/profileHelpers.test.ts`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/features/inspector/KeyInspector.tsx`

**Interfaces:**
- Produces `clearLayerMapping(profile, layer, key): StudioProfile`.
- Produces key modal props for `directAction`, `inheritedAction`, `onChange`, `onReset`, and `onClose`.

- [ ] Add a failing helper test proving clearing a direct base/layer mapping removes the key instead of writing an identity action.
- [ ] Implement `clearLayerMapping` for base and named layers.
- [ ] Add a failing UI test proving `Reset to default` invokes reset and inherited state is shown.
- [ ] Implement `KeySettingsModal` by reusing `KeyInspector` content and adding direct/inherited badges plus reset button.
- [ ] Replace full-page settings state with `SettingsDialog`, keeping the editor mounted behind it.
- [ ] Change beginner keyboard click to open the key modal; keep advanced inspector behavior available for advanced/chord flows.
- [ ] Run `cd studio && pnpm test -- profileHelpers.test.ts KeySettingsModal.test.tsx`.

### Task 3: Persisted resizable side panes

**Files:**
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src-tauri/src/domain/settings.rs`
- Modify: `studio/src/app/AppShell.tsx`
- Create: `studio/src/app/ResizableWorkspace.test.tsx`
- Modify: `studio/src/styles/shell.css`
- Modify: `studio/src/app/App.tsx`

**Interfaces:**
- `StudioSettings.leftRailWidth?: number`, default 260.
- `StudioSettings.rightPaneWidth?: number`, default 340.
- `AppShell` accepts widths and `onPaneWidthsChange(left, right)`.

- [ ] Add Rust/default migration assertions for missing pane widths and frontend tests for clamp/reset behavior.
- [ ] Add serde-defaulted Rust fields and optional TS fields.
- [ ] Implement pointer-based splitter handles, clamped left 180..420 and right 260..520; double click restores defaults.
- [ ] Drive `.workspace` with `--left-rail-width` and `--right-pane-width` CSS variables.
- [ ] Debounce persistence through existing `updateSettings` from `App.tsx`.
- [ ] Run `cd studio && pnpm test -- ResizableWorkspace.test.tsx` and `cargo test -p kanata-studio` where available.

### Task 4: Custom Tauri title bar

**Files:**
- Create: `studio/src/app/windowControls.ts`
- Create: `studio/src/app/CustomTitleBar.tsx`
- Create: `studio/src/app/CustomTitleBar.test.tsx`
- Modify: `studio/src/app/AppShell.tsx`
- Modify: `studio/src/styles/shell.css`
- Modify: `studio/src-tauri/tauri.conf.json`

**Interfaces:**
- `windowControls` exposes `minimizeWindow`, `toggleMaximizeWindow`, `closeWindow`, `startWindowDrag` using `getCurrentWindow()`.

- [ ] Write tests mocking the wrapper and asserting minimize/maximize/close callbacks.
- [ ] Implement wrapper and `CustomTitleBar` with logo/brand, drag region, existing Studio controls, and Windows-style window buttons.
- [ ] Set main Tauri window `decorations: false`.
- [ ] Ensure buttons/selectors are outside the drag region; allow double-click title drag area to toggle maximize.
- [ ] Run `cd studio && pnpm test -- CustomTitleBar.test.tsx` and `pnpm typecheck`.

### Task 5: Keyboard visual presets and selected-keyboard matching

**Files:**
- Create: `studio/src/features/keyboard/keyboardPresets.ts`
- Create: `studio/src/features/keyboard/keyboardPresets.test.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`
- Modify: `studio/src/features/keyboards/keyboardCatalog.ts`
- Modify: `studio/src/features/keyboards/keyboardCatalog.test.ts`
- Modify: `studio/src/features/keyboards/KeyboardManagerDialog.tsx`
- Modify: `studio/src/features/keyboards/useKeyboardRegistry.ts`
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src-tauri/src/domain/configured_keyboard.rs`
- Modify keyboard persistence command/input structs that mirror `ConfiguredKeyboard`.

**Interfaces:**
- `KeyboardVisualPreset = 'auto' | 'fullsize' | 'tkl' | '75' | '65' | '60'`.
- `ConfiguredKeyboard.visualPresetOverride?: KeyboardVisualPreset | null`.
- Catalog exposes resolved `visualPreset`.

- [ ] Add failing preset resolver tests: explicit override wins; name heuristic detects TKL/75/65/60/fullsize; unknown falls back from ANSI/ISO/JIS to fullsize-compatible generic geometry.
- [ ] Add serde-defaulted configured-keyboard field in Rust and transport type in TS.
- [ ] Add visual layout selector to Keyboard settings; persist it with name/physical-layout edits and copy operations.
- [ ] Implement geometry for fullsize, TKL, 75%, 65%, 60%, preserving Kanata ids.
- [ ] Change `KeyboardCanvas` to consume resolved visual preset instead of choosing only ANSI/ISO/JIS arrays.
- [ ] Run preset/catalog/canvas tests and `pnpm typecheck`.

### Task 6: Fn/media visualization and hardware-controlled Fn

**Files:**
- Modify: `studio/src/features/keyboard/keyboardPresets.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Create: `studio/src/features/keyboard/FnLayerToggle.tsx`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`
- Modify: `studio/src/features/inspector/KeySettingsModal.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`

**Interfaces:**
- Preset metadata includes `fnLegends: Record<string,string>` and optional `fnKey: { id: string; remappable: boolean }`.

- [ ] Add tests proving Fn view shows media/brightness legends and hardware-controlled Fn cannot be selected for remapping.
- [ ] Add Base/Fn toggle above the board and compact secondary legends on base view.
- [ ] For initial generic presets, define conventional F-row media legends; mark physical Fn hardware-controlled unless preset metadata explicitly says remappable.
- [ ] Show `Hardware-controlled` state in key modal when applicable and disable action editing/reset.
- [ ] Run keyboard canvas tests and full frontend suite.

### Task 7: Full verification and merge readiness

**Files:** all changed files.

- [ ] Run `cd studio && pnpm test`.
- [ ] Run `cd studio && pnpm lint`.
- [ ] Run `cd studio && pnpm typecheck`.
- [ ] Run `cd studio && pnpm build`.
- [ ] Run Rust formatting/tests locally where the environment supports the Studio Tauri sidecar requirements; otherwise report the exact blocker without claiming Rust verification.
- [ ] Confirm `.github/workflows` remains absent.
- [ ] Review diff against the design and merge the verified feature branch into `feat/add-GUI`.
