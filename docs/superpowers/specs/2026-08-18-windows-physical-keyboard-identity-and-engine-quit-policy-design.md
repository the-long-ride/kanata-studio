# Windows Physical Keyboard Identity and Engine Quit Policy

## Context

Kanata Studio on Windows currently derives each keyboard's durable Studio ID by hashing the full Raw Input device-interface path returned by `RIDI_DEVICENAME`. That interface path is also reused for Kanata/Interception device filtering.

The observed failure is that Kanata starts and reloads successfully, but Studio generates an empty base layer in `runtime/all.kbd`. This means the runtime compiler resolved no effective device-targeted mappings for the engine context, even though the user configured a keyboard profile. The current fallback reconciliation by VID/PID is intentionally conservative and cannot safely recover when multiple interfaces or multiple identical physical keyboards make VID/PID ambiguous.

This design replaces the Windows Studio identity boundary with physical-device identity while preserving interface-level paths for execution, and adds a user setting controlling whether Studio-managed Kanata engines are stopped on a true application quit.

## Goals

1. A physical Windows keyboard should retain one stable Studio identity across Raw Input interface-path churn and across composite-interface enumeration changes.
2. Composite keyboards exposing multiple Raw Input keyboard interfaces should appear as one physical keyboard in Studio when Windows reports the same physical-device container.
3. Two physically distinct keyboards with the same VID/PID must remain distinct.
4. Existing saved keyboard profiles should migrate conservatively to the new identity model without guessing.
5. Runtime diagnostics must make future empty-layer failures explainable from logs.
6. Add a General setting, enabled by default, that stops Studio-managed Kanata engines when Kanata Studio truly quits.
7. Clicking the main window X must continue hiding Studio to the tray and must not stop Kanata.

## Non-goals

- Do not change disconnected-target semantics: disconnected keyboard targets remain ignored by runtime topology.
- Do not use VID/PID alone as the durable identity for newly detected Windows keyboards.
- Do not add process-name-based cleanup such as `taskkill kanata.exe`.
- Do not force-kill independently launched Kanata processes that Studio does not own.
- Do not make window close equivalent to application quit.
- Do not use a kill-on-close Windows Job Object in this iteration, because the setting must be switchable OFF without changing ownership semantics for already-running child processes.

## Windows Physical Keyboard Model

### Durable Studio identity

For every Raw Input keyboard interface, Studio resolves the Windows Plug and Play device associated with the interface and reads `DEVPKEY_Device_ContainerId`.

The primary durable Studio keyboard ID is derived from that ContainerId rather than from the full Raw Input interface string. The serialized form should be deterministic and stable, for example:

`windows-container-<normalized-guid>`

The exact display format is implementation detail, but the same ContainerId must always produce the same Studio ID.

If ContainerId cannot be resolved for an interface, Studio falls back to the existing path-derived identity for that interface rather than dropping the device.

### Interface paths remain execution metadata

A physical `KeyboardDevice` can own one or more Raw Input interface paths. These paths are not the Studio identity; they are execution metadata needed to produce Kanata/Interception filtering configuration.

The Windows device model should therefore support a collection of interface paths for one physical keyboard. Existing cross-platform callers that only need one path must not accidentally collapse multi-interface Windows execution behavior.

For Windows `IncludeDevice`, Kanata config generation should include all hardware/interface identifiers belonging to the selected physical keyboard. For Windows `ExcludeDevices`, all interface identifiers belonging to all excluded physical keyboards must be emitted.

Linux and macOS behavior stays unchanged.

## Enumeration and Grouping

Windows enumeration proceeds in these stages:

1. Enumerate Raw Input keyboard interfaces as today.
2. For each interface, retain its original Raw Input interface path.
3. Resolve that interface through SetupAPI/PnP to obtain physical-device properties, especially ContainerId.
4. Group interfaces with the same resolved ContainerId into one `KeyboardDevice`.
5. Preserve aggregate metadata:
   - stable physical Studio ID,
   - user-facing/friendly name,
   - VID/PID when available,
   - all Raw Input interface paths,
   - detected layout information.
6. If ContainerId is unavailable, keep the interface as its own fallback device using the legacy path-derived ID.

A physical keyboard with two keyboard-class interfaces sharing one ContainerId must therefore produce one Studio catalog entry, not two.

Two keyboards with equal VID/PID but different ContainerIds must produce two Studio catalog entries.

## Legacy Identity Migration

Migration runs before runtime application at startup and after explicit device refresh, using the same persistence transaction pattern as current keyboard reconciliation.

Migration priority is conservative and ordered:

1. **Exact current ID match:** no migration.
2. **Exact legacy interface-path identity match:** if a saved path-hash ID corresponds to one of the current physical keyboard's constituent interface paths, migrate it to that physical keyboard ID.
3. **Unique physical VID/PID fallback:** only when exactly one unclaimed current physical keyboard matches the saved VID/PID, migrate to it.
4. **Ambiguous match:** do not migrate. Keep the saved keyboard disconnected and log the ambiguity.

When a keyboard ID migrates:

- migrate every `DeviceTarget::Device` referencing the old ID;
- rename the device-global profile ID from `keyboard-<old>-global` to `keyboard-<new>-global` when applicable;
- preserve profile mappings, app matchers, revisions, keyboard name, and layout override;
- validate the full profile set before replacing persisted state;
- preserve rollback behavior if keyboard persistence fails after profile persistence.

The migration algorithm must never assign one current physical keyboard to two saved keyboards in the same reconciliation pass.

## Runtime Resolution and Empty-Layer Diagnostics

The current runtime contract remains: a device-specific profile contributes only when its `DeviceTarget` matches the active engine's device ID. The physical-ID migration is intended to make that match durable.

Before writing each generated runtime config, Studio logs a concise diagnostic record containing:

- engine ID;
- engine device scope / physical keyboard ID when applicable;
- physical interface count for Windows device scopes;
- contributing profile IDs;
- resolved base mapping count;
- resolved advanced layer count;
- whether the result came from a Raw profile;
- any migration performed since the previous apply, including old ID, new ID, and match reason.

If the generated visual profile resolves to zero mappings, logging must make that explicit. The runtime remains valid: an intentionally empty profile is allowed. The diagnostic exists to distinguish intentional emptiness from an identity mismatch.

## Quit Policy Setting

### Settings model

Add a persisted boolean field to `StudioSettings`:

`stopKanataOnQuit` / Rust `stop_kanata_on_quit`

Default: `true`.

Backward compatibility requirement: existing `settings.json` files that do not contain the field must deserialize successfully and behave as `true`. This must be implemented with an explicit serde/default rule rather than relying only on `StudioSettings::default()` for newly created files.

The TypeScript `StudioSettings` type and bootstrap fallback must include the field with default `true`.

### Settings UI

Under **Settings → General**, add a toggle:

`Stop Kanata engine when Kanata Studio quits`

The toggle is ON by default and saves immediately through the existing `update_settings` path.

This setting controls true application exit only. It does not control minimize, hide, or close-to-tray behavior.

## Application Exit Semantics

### Window X

Existing behavior is preserved:

1. Tauri receives `CloseRequested` for the main window.
2. Studio prevents the close.
3. Studio hides the window to the system tray.
4. Kanata engines continue running regardless of `stopKanataOnQuit`.

### True quit

All true quit paths must route through one centralized shutdown function. The tray Quit action is the primary current path.

When `stopKanataOnQuit` is ON:

1. Read all Studio supervisor statuses.
2. Stop every Studio-managed engine that is not already stopped using the existing supervisor `stop()` method.
3. Continue attempting remaining engines even if one stop fails.
4. Record/log stop failures.
5. Exit Studio after shutdown attempts complete.

When `stopKanataOnQuit` is OFF:

1. Do not call supervisor `stop()` as part of quit.
2. Exit Studio, intentionally leaving Studio-owned Kanata child processes running.

Only processes tracked by `LocalSupervisor` are in scope. Studio must not enumerate or kill arbitrary Kanata processes by executable name.

## Engine Ownership Considerations

`LocalSupervisor` already owns child handles and exposes `stop()`, which marks the engine stopped and kills its owned child. The quit implementation should reuse this path so normal termination is not misclassified as a crash and does not trigger automatic restart logic.

Because OFF explicitly means "leave Kanata running after Studio exits", this design does not use a Windows Job Object with `KILL_ON_JOB_CLOSE`. A future stronger crash-cleanup mode could be designed separately if needed.

## Error Handling

### Device identity resolution

- Failure to resolve ContainerId for one interface must not fail the entire device enumeration.
- Fall back to the legacy interface identity for that interface and emit a diagnostic warning.
- SetupAPI/PnP resource handles must be released on all paths.

### Migration

- Never migrate when the candidate set is ambiguous.
- Persist profiles and keyboard registry transactionally using the existing rollback strategy.
- Validate profiles before installing migrated in-memory state.

### Quit

- Quit should make a best effort to stop all engines when the setting is ON.
- One engine stop failure must not prevent attempts to stop other engines.
- Shutdown errors should be logged; the app may still exit after best-effort cleanup so Quit does not become permanently blocked by one stale child handle.

## Testing

### Windows identity tests

Add unit/contract coverage for:

1. Two Raw Input interfaces with one ContainerId group into one physical keyboard.
2. Two physical keyboards with identical VID/PID but different ContainerIds remain distinct.
3. ContainerId-unavailable interfaces retain fallback legacy identities.
4. Legacy path-hash ID matching one constituent interface migrates to the physical ContainerId ID.
5. A unique VID/PID legacy fallback migrates.
6. Ambiguous legacy VID/PID does not migrate.
7. Migration preserves mappings and device-global profile semantics.
8. Re-enumeration with changed interface path but the same ContainerId preserves the Studio keyboard ID and profile resolution.
9. Windows device-scope config includes every interface identifier for a grouped physical keyboard.

### Runtime tests

Add a regression demonstrating that a mapped device using the new physical identity resolves a non-empty mapping after simulated restart/re-enumeration.

Add diagnostic contract coverage where practical so contributing profile IDs and mapping counts are produced by a testable helper rather than only ad-hoc log formatting.

### Quit-policy tests

Add coverage for:

1. `StudioSettings::default().stop_kanata_on_quit == true`.
2. Deserializing an older settings JSON without the field yields `true`.
3. Settings update accepts `stopKanataOnQuit`.
4. Window `CloseRequested` still selects hide-to-tray behavior and never requests engine shutdown.
5. Centralized true quit requests all managed engines to stop when the setting is ON.
6. Centralized true quit does not request engine stops when OFF.
7. Multiple engines are all attempted even if one stop fails, using a testable shutdown helper or supervisor abstraction.

## CI and Delivery

Implementation targets `feat/add-GUI`.

Before handing over a Windows test build:

1. Frontend lint, typecheck, tests, and production build must pass.
2. Rust formatting must pass.
3. Native tests and Clippy must pass on Windows; existing cross-platform GUI CI should remain green.
4. Dedicated Windows x64 Tauri packaging must succeed.
5. Download the resulting artifact and provide fresh EXE and MSI binaries to the user.

## Success Criteria

The change is successful when:

- the same physical Windows keyboard keeps the same Studio ID across interface-path changes when ContainerId is stable;
- composite interfaces no longer fragment one physical keyboard into multiple Studio identities;
- identical VID/PID devices remain independently addressable;
- legacy profiles migrate only when a match is provably unambiguous;
- the previously observed mapped-key flow no longer generates an empty layer because of path-derived identity churn;
- logs make any remaining zero-mapping runtime resolution immediately diagnosable;
- Settings → General shows `Stop Kanata engine when Kanata Studio quits` ON by default;
- clicking X hides Studio and keeps Kanata running;
- tray Quit stops all Studio-managed Kanata engines by default;
- turning the setting OFF leaves those engines running on true Studio exit;
- the final Windows EXE and MSI build successfully from the validated commit.
