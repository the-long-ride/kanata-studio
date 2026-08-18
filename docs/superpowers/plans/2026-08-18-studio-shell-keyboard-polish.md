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

- [x] Add shared modal behavior with accessible dialog semantics, Escape close, backdrop close, and content click isolation.
- [x] Implement fixed backdrop/content modal and shared CSS with `position: fixed; inset: 0; display: grid; place-items: center;` plus bounded width/height and inner overflow.
- [x] Migrate profile and keyboard-manager dialogs to `Modal`.
- [x] Cover profile modal regression in frontend tests.

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

- [x] Add helper test proving clearing a direct base/layer mapping removes the key instead of writing an identity action.
- [x] Implement `clearLayerMapping` for base and named layers.
- [x] Add UI test proving `Reset to default` invokes reset and inherited state is shown.
- [x] Implement `KeySettingsModal` by reusing `KeyInspector` content and adding direct/inherited state plus reset button.
- [x] Replace full-page settings state with `SettingsDialog`, keeping the editor mounted behind it.
- [x] Change beginner keyboard click to open the key modal; keep advanced inspector behavior available for advanced/chord flows.

### Task 3: Persisted resizable side panes

**Files:**
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src-tauri/src/domain/settings.rs`
- Modify: `studio/src/app/AppShell.tsx`
- Modify: `studio/src/app/AppShell.test.tsx`
- Modify: `studio/src/styles/shell-polish.css`
- Modify: `studio/src/app/App.tsx`

**Interfaces:**
- `StudioSettings.leftRailWidth?: number`, default 260.
- `StudioSettings.rightPaneWidth?: number`, default 340.
- `AppShell` accepts widths and `onPaneWidthsChange(left, right)`.

- [x] Add Rust/default migration assertions for missing pane widths and frontend tests for reset behavior.
- [x] Add serde-defaulted Rust fields and optional TS fields.
- [x] Implement pointer-based splitter handles, clamped left 180..420 and right 260..520; each divider resets only its own pane on double-click.
- [x] Drive `.workspace` with `--left-rail-width` and `--right-pane-width` CSS variables.
- [x] Persist widths through existing `updateSettings` flow from `App.tsx`.

### Task 4: Custom Tauri title bar

**Files:**
- Create: `studio/src/app/windowControls.ts`
- Modify: `studio/src/app/AppShell.tsx`
- Modify: `studio/src/app/AppShell.test.tsx`
- Modify: `studio/src/styles/shell-polish.css`
- Modify: `studio/src-tauri/tauri.conf.json`
- Modify: `studio/src-tauri/capabilities/default.json`

**Interfaces:**
- `windowControls` exposes `minimizeWindow`, `toggleMaximizeWindow`, `closeWindow`, `startWindowDrag` using `getCurrentWindow()`.

- [x] Add tests mocking the wrapper and asserting minimize/maximize/close/drag callbacks.
- [x] Implement custom title bar in `AppShell` with packaged Kanata icon/brand, drag region, existing Studio controls, and Windows-style window buttons.
- [x] Set main Tauri window `decorations: false`.
- [x] Add Tauri ACL permissions for minimize/toggle-maximize/close/start-dragging.
- [x] Keep interactive controls outside drag regions; double-click title drag areas toggle maximize.

### Task 5: Keyboard visual presets and selected-keyboard matching

**Files:**
- Create: `studio/src/features/keyboard/keyboardPresets.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`
- Modify: `studio/src/features/keyboards/keyboardCatalog.ts`
- Modify: `studio/src/features/keyboards/keyboardCatalog.test.ts`
- Modify: `studio/src/features/keyboards/KeyboardManagerDialog.tsx`
- Modify: `studio/src/features/keyboards/useKeyboardRegistry.ts`
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src-tauri/src/domain/configured_keyboard.rs`
- Modify: `studio/src-tauri/src/commands/keyboards.rs`

**Interfaces:**
- `KeyboardVisualPreset = 'fullsize' | 'tkl' | '75' | '65' | '60'` with `null`/missing meaning Auto.
- `ConfiguredKeyboard.visualPresetOverride?: KeyboardVisualPreset | null`.
- Catalog exposes optional resolved `visualPreset`; absence means generic detected ANSI/ISO/JIS geometry.

- [x] Add preset resolver tests: explicit override wins; name heuristics detect TKL/75/65/60; unknown falls back to generic detected geometry.
- [x] Add serde-defaulted configured-keyboard field in Rust and transport type in TS.
- [x] Add visual layout selector to Keyboard settings; persist it with name/physical-layout edits and copy operations.
- [x] Implement geometry for fullsize, TKL, 75%, 65%, 60%, preserving Kanata ids.
- [x] Change `KeyboardCanvas` to consume resolved visual preset and generic ANSI/ISO/JIS fallback.

### Task 6: Fn/media visualization and hardware-controlled Fn

**Files:**
- Modify: `studio/src/features/keyboard/keyboardPresets.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`
- Modify: `studio/src/features/inspector/KeySettingsModal.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`

**Interfaces:**
- Preset metadata includes `fnLegends: Record<string,string>` and optional `fnKey: { id: string; remappable: boolean }`.

- [x] Add tests proving Fn view shows media/brightness legends and hardware-controlled Fn cannot be selected for remapping.
- [x] Add Base/Fn toggle above supported boards and compact secondary legends on base view.
- [x] Keep unknown generic boards free of invented Fn behavior; known presets carry conventional Fn/media metadata.
- [x] Show `Hardware-controlled` state for firmware Fn and disable remapping.

### Task 7: Full verification and merge readiness

**Files:** all changed files.

- [x] Frontend unit suite.
- [x] Frontend lint.
- [x] Frontend typecheck.
- [x] Frontend production build.
- [x] Studio line-limit/profile/config guardrails.
- [x] Rust formatting.
- [x] Rust Studio library tests on the current Rust source.
- [x] Review diff against the design.
- [ ] Remove temporary verification workflow/PR scaffolding.
- [ ] Fast-forward verified feature branch into `feat/add-GUI`.
