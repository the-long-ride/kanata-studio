# Sidebar + Keyboard Viewport Polish Design

## Goal

Restructure Kanata Studio so the title bar stays minimal, the primary controls live in the left sidebar, Advanced Layers/Chords live in the right sidebar, all key/chord editing uses compact modals, and the center keyboard viewport supports pan + 50–200% zoom.

## Layout ownership

### Title bar
- Keep Kanata logo/name, drag region, runtime status/actions, and Windows controls.
- Remove the keyboard selector and Beginner/Advanced mode switch from the title bar.

### Left sidebar
- Default width: 320px.
- Resizable range: 260–480px.
- Double-clicking its splitter resets only the left sidebar to 320px.
- Top section contains the keyboard selector/manage control and Beginner/Advanced mode switch.
- Profiles remain below those controls.

### Center workspace
- Visual profiles always show the selected keyboard model through the existing visual preset/fallback system.
- Beginner and Advanced use the same visual keyboard canvas.
- Raw Advanced profiles keep the raw editor path instead of the visual keyboard.
- Selecting any key opens the shared compact mapping modal.

### Right sidebar
- Hidden completely in Beginner mode.
- Visible and resizable in Advanced mode.
- Visual profiles show `Layers | Chords` tabs.
- Layers owns layer selection/addition; the selected layer immediately drives the center keyboard mappings.
- Chords owns the Chord Sets editor. Selecting a chord action opens the same compact modal family as key editing.
- Preview `.kbd` and Raw mode actions live with Advanced tooling, not over the center keyboard.
- Raw profiles show raw-profile contextual tooling instead of Layers/Chords.

## Compact mapping modal

- Key settings use the same compact modal in Beginner and Advanced.
- Show target name, direct/inherited/default state, current action, Apply state, Reset to default, and Close.
- In Advanced mode the modal exposes the existing Advanced action kind/editor inside the compact modal.
- Chord action editing uses the same modal shell with the chord trigger as the title/context; no per-key reset button for chord actions.
- Hardware-controlled Fn remains selectable but opens a read-only modal explaining that firmware owns the key and Kanata cannot remap it.

## Keyboard viewport interaction

- Zoom range: 50%–200%.
- Toolbar: minus, current percent, plus, Fit.
- Wheel over the viewport zooms around the cursor focal point; Ctrl+wheel behaves the same.
- Left-dragging empty viewport space pans.
- Left-dragging a key does not start panning and normal key clicks still select.
- Middle-mouse drag pans from anywhere in the viewport.
- Double-clicking empty viewport space runs Fit.
- Cursor: `grab` on pannable empty space, `grabbing` while panning, normal pointer on keys.
- Pan is loosely clamped so at least part of the keyboard remains recoverable on screen.
- Changing selected keyboard automatically recenters/fits the new board.
- View state is transient UI state. Beginner and Advanced remember independent pan/zoom states during the session; changing keyboard resets both to Fit.

## Components and state

- `App` keeps selected keyboard/profile, mode, active layer, selected key/chord, and Advanced right-tab state.
- `AppShell` owns only shell presentation and sidebar resizing/visibility.
- Add `PrimarySidebar` for keyboard selector + mode switch + profiles.
- Add `AdvancedSidebar` for Layers/Chords and Advanced actions.
- Add `KeyboardViewport` for transform, pan, zoom, Fit, and pointer/wheel behavior.
- `KeyboardCanvas` keeps physical-key pressed state, Fn/base display, keyboard key rendering, and delegates viewport interaction to `KeyboardViewport`.
- Reuse `KeySettingsModal`; extend it so Advanced key actions and chord actions use the same compact modal shell.

## Compatibility

- No profile schema changes are required.
- Existing layers/chords/actions remain unchanged.
- Existing keyboard visual preset/Fn metadata remains unchanged.
- Existing persisted left/right pane widths remain valid; new default left width is 320px.
- The existing Windows build workflow remains manual-only (`workflow_dispatch`).

## Validation and tests

- Title bar no longer renders keyboard or mode controls.
- Left sidebar renders keyboard selector, mode switch, and profiles.
- Beginner omits the right sidebar/splitter entirely.
- Advanced visual mode shows Layers/Chords on the right.
- Left default reset is 320px and right reset stays independent.
- Key settings modal is used in both Beginner and Advanced.
- Hardware-controlled Fn opens a read-only modal rather than suppressing selection.
- Zoom clamps exactly at 50% and 200%.
- Wheel zoom preserves the cursor focal point.
- Fit recenters the board.
- Empty left-drag pans; key left-drag does not; middle-drag pans.
- Keyboard identity change resets the viewport to Fit.
- Existing chord/profile/compiler/frontend guardrail tests remain green.
- Manual Windows workflow remains `workflow_dispatch` only.
