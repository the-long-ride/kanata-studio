# Windows Keyboard Reconciliation and Keypress Feedback Design

## Scope

This change fixes two related Kanata Studio usability/runtime issues on `feat/add-GUI`:

1. A configured Windows keyboard can become detached from its saved device-targeted profiles when its Raw Input path changes, causing runtime resolution to ignore those profiles and generate an empty `all.kbd` base layer.
2. While Studio is focused, physical keyboard presses should visually depress/highlight the matching key on the on-screen keyboard without changing the editor selection.

## Root Cause

Windows keyboard IDs are currently derived from a hash of the full Raw Input device path. Configured keyboards and device-targeted profiles persist that generated ID. If Windows later exposes the same physical keyboard under a different path, Studio detects a new ID and treats the saved keyboard as disconnected. Runtime topology only considers profiles whose device ID exists in the currently detected device list, so stale device-targeted profiles are skipped. When the shared global profile is empty, the generated runtime config contains an empty base `deflayermap`.

## Keyboard Identity Reconciliation

When refreshing or loading detected keyboards, Studio will attempt conservative reconciliation between saved configured keyboards and currently detected devices.

A saved keyboard may be automatically migrated only when all of the following hold:

- its current saved ID is not present in the detected devices;
- vendor ID and product ID are both available on the saved keyboard;
- exactly one currently detected, otherwise-unclaimed device has the same vendor ID and product ID;
- the match is therefore unambiguous.

If multiple matching devices exist, or VID/PID is missing, Studio will not auto-migrate.

For an unambiguous match, Studio will:

- replace the saved configured keyboard ID with the newly detected ID;
- preserve user-facing name and layout override;
- refresh detected metadata;
- rewrite every profile whose `deviceTarget` points at the old keyboard ID to the new ID;
- regenerate the deterministic keyboard-global profile ID when needed so it remains consistent with the new device ID;
- persist keyboards and profiles together before applying runtime configuration.

This migration must be idempotent: once IDs match, subsequent refreshes must make no further changes.

## Runtime Safety

The migration must never broaden a device-specific profile to `DeviceTarget::All` and must never guess when multiple identical keyboards make the match ambiguous.

After successful reconciliation, runtime topology sees the migrated device-targeted profile as connected and compiles its mappings for that keyboard instead of falling back to an empty shared global profile.

If persistence fails during migration, Studio must leave the in-memory configured keyboard/profile state unchanged and surface the existing persistence/runtime error path rather than partially migrating state.

## On-Screen Physical Key Feedback

`KeyboardCanvas` will track physical keyboard state only while the Studio window has focus.

- `keydown` adds the mapped Kanata key ID to a held-key set.
- `keyup` removes it.
- `window.blur` clears the entire held-key set to prevent visually stuck keys.
- Repeated `keydown` events do not create duplicate state.
- Physical input never changes `selectedKey`, never opens the inspector, and never invokes the on-screen button click handler.

A small mapping layer converts `KeyboardEvent.code` to the existing Kanata layout IDs, including letters, digits, punctuation, function keys, navigation/modifier keys represented by the current layouts, for example:

- `KeyA -> a`
- `CapsLock -> caps`
- `Space -> spc`
- `ControlLeft -> lctl`
- `ControlRight -> rctl`
- `ShiftLeft -> lsft`
- `ShiftRight -> rsft`
- `AltLeft -> lalt`
- `AltRight -> ralt`
- `MetaLeft -> lmet`
- `MetaRight -> rmet`

`KeyboardKey` receives a `pressed` boolean and adds a `pressed` CSS state. The pressed style will visually move/depress the key and strengthen its surface/border contrast while preserving existing selected/inherited/overridden indicators.

## Testing

### Rust / backend

Add regression coverage for reconciliation behavior:

- stale saved ID + one matching VID/PID device migrates configured keyboard and all targeted profiles;
- mappings survive migration;
- unrelated profiles are unchanged;
- multiple matching devices do not auto-migrate;
- missing VID/PID does not auto-migrate;
- already-current IDs are unchanged;
- migrated state remains valid under `validate_profile_set`.

Add a runtime-oriented regression asserting that after unique reconciliation a device-targeted mapping resolves for the detected keyboard instead of producing an empty resolved mapping.

### Frontend

Add tests for `KeyboardEvent.code` to Kanata key-ID conversion and pressed-state behavior where practical in the existing Node-based test setup.

Contract coverage should assert that physical key input controls only the `pressed` state and does not call `onSelect`.

### CI / Windows binary

After implementation:

- run the full `kanata-gui.yml` branch CI;
- require frontend lint/typecheck/tests/build to pass;
- require Rust formatting/tests/Clippy on Windows, Linux, and macOS to pass;
- require the dedicated Windows test-build workflow to complete successfully;
- provide fresh x64 `.exe` and `.msi` artifacts built from the final green commit.

## Non-Goals

- No global OS-level key hook while Studio is unfocused.
- No automatic selection of keys during typing.
- No VID/PID-only permanent keyboard identity scheme.
- No automatic reconciliation when multiple identical devices are connected.
- No change to profile inheritance semantics beyond repairing stale device IDs.
