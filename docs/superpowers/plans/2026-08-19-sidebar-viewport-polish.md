# Sidebar + Keyboard Viewport Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move keyboard/mode controls into a wider left rail, move Advanced Layers/Chords into the right rail, use compact mapping modals everywhere, and add a reusable 50–200% pan/zoom keyboard viewport.

**Architecture:** `AppShell` becomes presentation-only with an optional Advanced right pane. `App` composes `PrimarySidebar`, center content, and `AdvancedSidebar`; `KeyboardCanvas` delegates transform interaction to a new `KeyboardViewport`. `KeySettingsModal` becomes the common action-editor shell for keys and chords.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Tauri v2, existing CSS/component primitives.

**Spec:** `docs/superpowers/specs/2026-08-19-sidebar-viewport-polish-design.md`

## Global Constraints

- Beginner mode has no right sidebar or right splitter.
- Left sidebar default is 320px; range 260–480px.
- Keyboard zoom clamps to 50%–200%.
- Left-drag pans only from empty viewport space; middle-drag pans from anywhere.
- Hardware-controlled Fn opens a read-only modal.
- No profile schema changes.
- `.github/workflows/windows-manual-build.yml` remains manual-only.

---

### Task 1: Shell ownership and primary sidebar

**Files:**
- Create: `studio/src/app/PrimarySidebar.tsx`
- Modify: `studio/src/app/AppShell.tsx`
- Modify: `studio/src/app/AppShell.test.tsx`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/styles/shell-polish.css`

**Interfaces:**
- `AppShell({ rail, main, inspector?, ... })` renders no keyboard/mode controls itself.
- `PrimarySidebar` receives keyboard selector node, `mode`, `onMode`, and profile-rail node.

- [ ] Write failing shell tests proving title bar excludes mode controls, Beginner has no right pane/splitter, Advanced can render a right pane, and left reset is 320px.
- [ ] Run `pnpm test -- AppShell.test.tsx` and confirm RED.
- [ ] Implement `PrimarySidebar` and simplify `AppShell`; update shell grid/CSS and `App` composition.
- [ ] Run the shell test and full frontend test suite; confirm GREEN.
- [ ] Commit shell changes.

### Task 2: Advanced Layers/Chords right sidebar

**Files:**
- Create: `studio/src/features/advanced/AdvancedSidebar.tsx`
- Create: `studio/src/features/advanced/AdvancedSidebar.test.tsx`
- Modify: `studio/src/features/advanced/ChordEditor.tsx`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/styles/shell-polish.css`
- Modify: existing advanced/chord CSS as needed.

**Interfaces:**
- `AdvancedSidebar` consumes visual profile, active tab/layer, chord sets, preview/raw callbacks, and selection callbacks.
- Visual center remains `KeyboardCanvas`; raw center remains `RawEditor`.

- [ ] Write failing tests for `Layers | Chords`, layer selection, chord-tab selection clearing semantics, and compact chord editor rendering.
- [ ] Run targeted tests and confirm RED.
- [ ] Implement `AdvancedSidebar`, move layer/chord ownership out of `AdvancedWorkspace`, and wire `App` so center remains keyboard in Advanced visual mode.
- [ ] Run targeted + full frontend tests; confirm GREEN.
- [ ] Commit Advanced sidebar changes.

### Task 3: Unified compact key/chord modal

**Files:**
- Modify: `studio/src/features/inspector/KeySettingsModal.tsx`
- Modify: `studio/src/features/inspector/KeySettingsModal.test.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`
- Modify: `studio/src/app/App.tsx`

**Interfaces:**
- `KeySettingsModal` accepts optional `title`, `advanced`, and optional reset capability while retaining existing key state props.
- Hardware-controlled keys still call selection, but modal is read-only.
- Chord selection opens the same modal shell with `AdvancedInspector` for action editing and no key reset.

- [ ] Write failing tests for Advanced key modal, chord modal shell behavior, and selectable read-only Fn.
- [ ] Run targeted tests and confirm RED.
- [ ] Extend modal and key selection behavior; remove permanent action inspector usage from `App`.
- [ ] Run targeted + full tests; confirm GREEN.
- [ ] Commit modal changes.

### Task 4: KeyboardViewport pan/zoom

**Files:**
- Create: `studio/src/features/keyboard/KeyboardViewport.tsx`
- Create: `studio/src/features/keyboard/KeyboardViewport.test.tsx`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`
- Modify: `studio/src/app/App.tsx`

**Interfaces:**
- `KeyboardViewport({ boardWidth, boardHeight, viewMode, resetKey, children })` owns per-mode transient `{zoom,x,y}` states.
- Toolbar exposes minus/current percent/plus/Fit.
- `resetKey` change clears both mode views and fits.

- [ ] Write failing tests for 50/200 clamps, Fit centering, cursor-focal wheel zoom, empty-space left pan, key non-pan, middle pan, and resetKey Fit.
- [ ] Run targeted viewport tests and confirm RED.
- [ ] Implement transform/pointer/wheel state and wrap `KeyboardCanvas` board with it.
- [ ] Run viewport + canvas + full frontend tests; confirm GREEN.
- [ ] Commit viewport changes.

### Task 5: Defaults, guardrails, and final verification

**Files:**
- Modify settings defaults only if needed so new installs use 320px.
- Modify tests/guardrails only where the current source-of-truth moved.
- Do not modify `.github/workflows/windows-manual-build.yml` except to preserve `workflow_dispatch` only.

- [ ] Add/update regression checks for 320px default and manual-only Windows build workflow.
- [ ] Run `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm lint:lines`, `pnpm test:lines`, `pnpm test:rules`, and `pnpm test:config`.
- [ ] Run `cargo fmt --all -- --check` and sidecar-aware `cargo test -p kanata-studio --lib` in temporary verification CI.
- [ ] Review diff for temporary workflows/PR scaffolding and remove them before integration.
- [ ] Fast-forward `feat/add-GUI` only after all required verification is green.
