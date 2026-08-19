# Modal Layers, Chords, Switches, and Keyboard Detection Design

## Goal

Polish Kanata Studio's advanced editing flow and keyboard visualization so layer/chord creation uses focused modal dialogs, all boolean controls share one switch component, and automatically detected Windows keyboards show a useful physical geometry without pretending unsupported Fn behavior is known.

## Layer and chord editing

### Layers

- Keep the Layers list in the Advanced sidebar.
- `+ Layer` opens a modal instead of using `window.prompt`.
- The modal owns the layer name field, validation, Cancel, and Add actions.
- Empty names and duplicate names are rejected before mutation.
- Saving creates the layer and selects it.

### Chords

- Keep the Chords entry point in the Advanced sidebar, but do not squeeze chord-set configuration into the narrow pane.
- The sidebar shows the chord-set list and an `Add chord set` action.
- Adding a chord set opens a modal with name, timeout, active-layer scope, and combinations.
- Selecting an existing chord set opens the same modal for editing.
- Individual chord actions continue to use the existing key/action settings modal.
- Chord key recording/manual entry remains supported inside the chord-set modal.
- Existing chord validation remains authoritative; invalid sets may be staged in UI but are not applied to the runtime until valid.

## Common boolean switch

- Introduce one reusable `Switch` component for boolean settings.
- The component uses an accessible checkbox input internally but renders as a compact switch control.
- It supports label, checked, disabled, and `onChange`.
- Replace current `Toggle` usage and direct checkbox rendering in Studio UI with `Switch`.
- Chord active-layer scope also uses `Switch`, including `All layers` and per-layer controls.
- Preserve native keyboard accessibility: Space toggles, focus ring is visible, disabled state is exposed.

## Windows keyboard metadata

Windows Raw Input already exposes `RID_DEVICE_INFO_KEYBOARD`. Preserve additional metadata that is currently discarded:

- `reportedKeyCount` from `dwNumberOfKeysTotal`
- `functionKeyCount` from `dwNumberOfFunctionKeys`
- `keyboardType` from `dwType`

These fields are optional throughout Rust serialization and TypeScript transport so existing persisted data and non-Windows platforms remain backward compatible.

## Visual preset resolution

Resolution order:

1. Explicit visual preset override.
2. Strong known model/name heuristic.
3. Strong Windows keyboard metadata heuristic.
4. Generic extended fallback.

### Metadata heuristics

- Standard 101/102/104/105-key reports resolve to `fullsize`.
- Metadata that is not strong enough to identify a compact class does not guess a specific 60/65/75/TKL preset.
- Existing strong name heuristics continue to resolve known compact models.

### Generic extended fallback

When Auto cannot identify a preset, render a `Generic Extended` geometry containing:

- main ANSI/ISO/JIS block
- Print Screen / Scroll Lock / Pause
- Insert / Home / Page Up
- Delete / End / Page Down
- arrow cluster

Do not include a numpad unless Full size is resolved. Do not invent Fn/media legends or a physical Fn key for generic devices.

This directly fixes keyboards that report ordinary navigation keys but currently render only the main typing block.

## Keyboard settings UI

- Keep the existing manual `Full size / TKL / 75% / 65% / 60%` override.
- Auto shows the resolved visual class and, when available, the reported key count, e.g. `Auto (Full size · 104 keys)` or `Auto (Generic Extended · 87 keys)`.
- Preserve the USB VID:PID metadata display.

## Testing

Add focused tests for:

- Layer modal opening, duplicate/empty-name validation, and submit.
- Chord-set modal opening for add/edit and preserving existing validation/recording behavior.
- Common Switch behavior and disabled accessibility.
- No remaining direct checkbox usage in migrated interactive surfaces.
- Windows metadata extraction/group propagation.
- Preset resolver: override > name > metadata > generic extended.
- Generic extended contains Ins/Home/PgUp/Delete/End/PgDn/arrows and omits numpad/Fn legends.
- Full-size metadata includes navigation plus numpad.
- Keyboard Settings Auto label reports inferred class/key count.

## Non-goals

- Reverse-engineering vendor firmware Fn layers.
- Claiming exact physical geometry from Raw Input when Windows does not expose it.
- Guessing compact keyboard classes from weak key-count ranges.
- Reintroducing persistent GitHub Actions workflows.