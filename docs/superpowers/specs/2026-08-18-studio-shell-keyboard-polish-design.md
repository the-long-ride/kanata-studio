# Kanata Studio Shell & Keyboard UX Design

## Goal
Fix the broken app-profile modal and modernize the Studio shell so keyboard editing follows the selected physical keyboard, supports Fn/media-layer visualization, uses modal key/settings editors, provides per-key reset, resizable side panes, and a custom Tauri title bar.

## Confirmed behavior
- New app profile is a centered modal, never document-flow content.
- Left profile rail and right context pane are resizable; widths persist; double-clicking a divider resets its width.
- The center keyboard follows the currently selected keyboard.
- Visual keyboard shape is separate from ANSI/ISO/JIS electrical/layout semantics.
- Preset resolution order: configured visual override -> exact/heuristic device match -> generic layout fallback.
- Initial visual presets: Full size, TKL, 75%, 65%, 60%, plus ANSI/ISO/JIS generic fallback.
- Keyboard settings expose a visual-layout override so unknown/generic HID devices can still be rendered accurately.
- Fn/media view is available for supported presets. Base and Fn views share the same physical keys.
- Fn alternate legends are shown on keys where known.
- A physical Fn key is editable only when the device/preset marks it observable/remappable. Otherwise it is shown as `Hardware-controlled`.
- Clicking a key opens a modal editor. Existing action editors are reused.
- Every key modal provides `Reset to default` and `Clear override` semantics. Reset removes the current profile's direct mapping so inherited/default behavior takes over.
- Settings becomes a modal rather than replacing the center editor.
- Native window decorations are disabled and the app header becomes the title bar with logo, drag region, minimize/maximize/close controls.

## Root cause of the current profile-layout crash
`CreateProfileDialog.tsx` renders `.dialog-backdrop` and `.dialog`, but the branch has no shared modal positioning rules. The form therefore participates in normal layout and stretches across the workspace. The fix is a shared modal primitive plus explicit fixed-position backdrop/content CSS.

## Architecture
### Shared modal primitive
Add `Modal.tsx` with fixed backdrop, centered bounded content, Escape close, backdrop close, and accessible dialog attributes. Profile, keyboard manager, settings, and key editor compose it.

### Resizable workspace
`AppShell` owns left/right pane widths and drag handlers. Widths are stored in `StudioSettings` as `leftRailWidth` and `rightPaneWidth`, with defaults of 260 and 340 pixels and clamped ranges. CSS variables drive the grid.

### Custom title bar
`tauri.conf.json` sets `decorations: false`. `AppShell` renders `CustomTitleBar`, using `getCurrentWindow()` from `@tauri-apps/api/window` for minimize, toggleMaximize, close, and drag behavior. Interactive controls are excluded from drag regions.

### Keyboard visual model
Add `KeyboardVisualPreset` and `FnCapability` frontend types. `keyboardPresets.ts` contains geometry and Fn metadata. `keyboardCatalog.ts` resolves a visual preset from configured override and detected identity/name. `ConfiguredKeyboard` persists `visualPresetOverride`; the keyboard manager exposes the override.

### Fn model
Fn is presentation metadata rather than a synthetic Kanata action layer. A preset may define Fn legends and whether the physical Fn key is observable. When not observable, Studio displays the key but marks it hardware-controlled and disables editing. If observable, it is treated like any other remappable input id.

### Key editing/reset
`KeySettingsModal` wraps the existing `KeyInspector`/advanced editor flow and receives direct and inherited actions. Reset removes the mapping from the current profile/layer, rather than writing an identity mapping. `profileHelpers.ts` gains `clearLayerMapping`.

### Settings modal
`SettingsView` stays as the settings content component. `SettingsDialog` wraps it in the shared Modal, so the center editor remains mounted.

## Persistence compatibility
Rust `StudioSettings` and `ConfiguredKeyboard` add serde-defaulted fields so old JSON continues to load. Frontend fields are optional at the transport boundary and normalized to defaults.

## Testing
- Modal rendering/layout class and Escape/backdrop behavior.
- CreateProfileDialog uses shared modal and stays bounded.
- AppShell resizes/clamps/resets panes and emits persisted widths.
- Custom titlebar calls Tauri window methods through a thin wrapper that can be mocked.
- Keyboard preset resolution for override, heuristic match, and fallback.
- KeyboardCanvas renders selected visual preset and Fn legends/view.
- Hardware-controlled Fn key cannot open remap modal.
- clearLayerMapping removes direct mapping and exposes inherited/default action.
- Settings opens as modal without replacing editor.
- Rust serde migration tests for new settings/configured-keyboard fields.

## Non-goals
- Reverse engineering vendor-specific firmware Fn behavior.
- Pretending an unobservable firmware Fn key can be intercepted.
- Building a vendor/device database beyond the initial preset/heuristic system.
