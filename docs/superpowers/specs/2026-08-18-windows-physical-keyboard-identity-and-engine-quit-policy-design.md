# Windows Physical Keyboard Identity and Engine Quit Policy

## Context

Kanata Studio on Windows currently derives each keyboard's durable Studio ID by hashing the full Raw Input device-interface path returned by `RIDI_DEVICENAME`. That interface path is also reused for Kanata/Interception device filtering.

The observed failure signature is that Kanata starts and reloads successfully, but Studio generates an empty base layer in `runtime/all.kbd`. That proves the runtime compiler supplied no effective visual mappings to the active `all` engine. The current source allows this when a saved device-target profile no longer matches any currently detected device ID, because disconnected targets are intentionally ignored and runtime falls back to the all-device profile set. The current VID/PID reconciliation is deliberately conservative and cannot safely recover every composite-device or identical-device case.

This design fixes the unstable Windows identity boundary, preserves interface-level paths for execution, adds explicit runtime diagnostics so any remaining empty-layer case identifies the exact resolution state, and adds a user setting controlling whether Studio-managed Kanata engines are stopped on a true application quit.

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

The primary durable Studio keyboard ID is derived from that ContainerId rather than from the full Raw Input interface string. The serialized form is deterministic and stable:

`windows-container-<normalized-guid>`

Normalization uses the GUID value, lower-case hexadecimal, without braces. The same ContainerId must always produce the same Studio ID.

If ContainerId cannot be resolved for an interface, Studio falls back to the existing path-derived identity for that interface rather than dropping the device.

### Backwards-compatible interface metadata

`KeyboardDevice` keeps its existing `path: Option<String>` field for current cross-platform callers and frontend compatibility, and adds:

`interface_paths: Vec<String>` with serde default / camelCase `interfacePaths`.

Semantics:

- Windows grouped physical keyboard: `interface_paths` contains every Raw Input keyboard interface path in deterministic sorted order; `path` is the first path in that sorted list for backwards compatibility.
- Windows fallback device without ContainerId: `interface_paths` contains its one Raw Input path; `path` contains the same value.
- Linux: existing `path` remains the event-device path; `interface_paths` is empty.
- macOS: existing behavior remains unchanged; `interface_paths` is empty unless a future platform-specific implementation needs it.

Execution code must use a helper that returns `interface_paths` when non-empty, otherwise the single legacy `path`. This prevents old callers from silently losing Windows composite interfaces while avoiding a breaking replacement of the existing field.

For Windows `IncludeDevice`, Kanata config generation emits all interface identifiers belonging to the selected physical keyboard. For Windows `ExcludeDevices`, it emits all interface identifiers belonging to all excluded physical keyboards.

## Enumeration and Grouping

Windows enumeration proceeds in these stages:

1. Enumerate Raw Input keyboard interfaces as today.
2. For each interface, retain its original Raw Input interface path.
3. Resolve that interface through SetupAPI/PnP to obtain physical-device properties, especially ContainerId.
4. Group keyboard interfaces with the same resolved ContainerId into one `KeyboardDevice`.
5. Preserve aggregate metadata:
   - stable physical Studio ID,
   - user-facing/friendly name,
   - VID/PID when available,
   - all Raw Input interface paths,
   - detected layout information.
6. If ContainerId is unavailable, keep the interface as its own fallback device using the legacy path-derived ID.

A physical keyboard with two keyboard-class interfaces sharing one ContainerId produces one Studio catalog entry, not two.

Two keyboards with equal VID/PID but different ContainerIds produce two Studio catalog entries.

Grouping only considers interfaces already classified by Raw Input as keyboards; sharing a ContainerId with non-keyboard devnodes does not cause those non-keyboard interfaces to enter Studio's keyboard list.

## Legacy Identity Migration

Migration runs before runtime application at startup and after explicit device refresh, using the same persistence transaction pattern as current keyboard reconciliation.

Migration priority is conservative and ordered:

1. **Exact current ID match:** no migration.
2. **Exact legacy interface-path identity match:** compute the legacy path-hash ID for every constituent current interface path. If a saved ID equals exactly one of those legacy IDs, migrate it to that physical keyboard ID.
3. **Unique physical VID/PID fallback:** only when exactly one unclaimed current physical keyboard matches the saved VID/PID, migrate to it.
4. **Ambiguous match:** do not migrate. Keep the saved keyboard disconnected and log the ambiguity.

When a keyboard ID migrates:

- migrate every `DeviceTarget::Device` referencing the old ID;
- rename the device-global profile ID from `keyboard-<old>-global` to `keyboard-<new>-global` when applicable;
- preserve profile mappings, app matchers, revisions, keyboard name, and layout override;
- validate the full profile set before replacing persisted state;
- preserve rollback behavior if keyboard persistence fails after profile persistence.

The migration algorithm never assigns one current physical keyboard to two saved keyboards in the same reconciliation pass.

## Runtime Resolution and Empty-Layer Diagnostics

The current runtime contract remains: a device-specific profile contributes only when its `DeviceTarget` matches the active engine's device ID. The physical-ID migration is intended to make that match durable without changing disconnected-device behavior.

Before writing each generated runtime config, Studio produces a structured/testable runtime-resolution diagnostic containing:

- engine ID;
- engine device scope / physical keyboard ID when applicable;
- physical interface count for Windows device scopes;
- contributing profile IDs;
- resolved base mapping count;
- resolved advanced layer count;
- whether the result came from a Raw profile.

Migration diagnostics are logged at the point migration occurs and contain old ID, new ID, and match reason (`legacy-interface`, `unique-vid-pid`, or fallback/ambiguity status). They do not rely on transient "since previous apply" state.

If a generated visual profile resolves to zero mappings, Studio logs that explicitly together with the contributing profile IDs and scope. An intentionally empty profile remains valid. The diagnostic distinguishes intentional emptiness, all-device fallback, and a device-specific engine with zero mappings without changing runtime semantics.

## Quit Policy Setting

### Settings model

Add a persisted boolean field to `StudioSettings`:

`stopKanataOnQuit` / Rust `stop_kanata_on_quit`

Default: `true`.

Backward compatibility requirement: existing `settings.json` files that do not contain the field must deserialize successfully and behave as `true`. This is implemented with an explicit serde default function for the field rather than relying only on `StudioSettings::default()` for newly created files.

The TypeScript `StudioSettings` type and bootstrap fallback include the field with default `true`.

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

All explicit true-quit paths route through one centralized shutdown function. The tray Quit action is the primary current path and future explicit Quit actions must call the same function.

When `stopKanataOnQuit` is ON:

1. Read all Studio supervisor statuses.
2. Stop every Studio-managed engine that is not already stopped using the existing supervisor `stop()` method.
3. Continue attempting remaining engines even if one stop fails.
4. Record/log stop failures.
5. Exit Studio after shutdown attempts complete.

When `stopKanataOnQuit` is OFF:

1. Do not call supervisor `stop()` as part of quit.
2. Ensure the owned Kanata child processes survive Studio/supervisor teardown.
3. Exit Studio.

Only processes tracked by `LocalSupervisor` are in scope. Studio never enumerates or kills arbitrary Kanata processes by executable name.

## Engine Ownership and OFF-mode Detach

`LocalSupervisor` owns `CommandChild` handles and exposes `stop()`, which marks the engine stopped and kills its owned child. The ON path reuses this existing ownership-aware stop operation so normal shutdown is not misclassified as a crash and does not trigger automatic restart logic.

The OFF path must not assume that merely dropping `CommandChild` leaves the process alive. Implementation must verify the shell child's drop behavior against the version used by the project. If dropping the child handle would terminate or otherwise couple the child lifetime to Studio, `LocalSupervisor` must provide an explicit detach operation that relinquishes Studio management without signaling or killing the child. The acceptance test for OFF mode is observable child survival after the shutdown helper releases supervisor ownership.

After detaching, listener/restart bookkeeping for that child is abandoned because Studio is exiting. No persisted adoption of those detached processes is required in this scope; reopening Studio may start a new managed engine according to current startup logic.

Because OFF explicitly means "leave Kanata running after Studio exits", this design does not use a Windows Job Object with `KILL_ON_JOB_CLOSE`. A future stronger crash-cleanup mode can be designed separately if needed.

## Error Handling

### Device identity resolution

- Failure to resolve ContainerId for one interface does not fail the entire device enumeration.
- Fall back to the legacy interface identity for that interface and emit a diagnostic warning.
- SetupAPI/PnP resource handles are released on all paths.

### Migration

- Never migrate when the candidate set is ambiguous.
- Persist profiles and keyboard registry transactionally using the existing rollback strategy.
- Validate profiles before installing migrated in-memory state.

### Quit

- Quit makes a best effort to stop all engines when the setting is ON.
- One engine stop failure does not prevent attempts to stop other engines.
- Shutdown errors are logged; the app still exits after best-effort cleanup so Quit cannot be permanently blocked by one stale child handle.
- When OFF, a detach failure that would otherwise kill Kanata is logged and treated as a shutdown-policy failure; implementation must not silently claim "leave running" while terminating the process.

## Testing

### Windows identity tests

Add unit/contract coverage for:

1. Two Raw Input interfaces with one ContainerId group into one physical keyboard.
2. Two physical keyboards with identical VID/PID but different ContainerIds remain distinct.
3. ContainerId-unavailable interfaces retain fallback legacy identities.
4. `interface_paths` ordering is deterministic and `path` equals the first path for Windows grouped devices.
5. Legacy path-hash ID matching one constituent interface migrates to the physical ContainerId ID.
6. A unique VID/PID legacy fallback migrates.
7. Ambiguous legacy VID/PID does not migrate.
8. Migration preserves mappings and device-global profile semantics.
9. Re-enumeration with changed interface path but the same ContainerId preserves the Studio keyboard ID and profile resolution.
10. Windows device-scope config includes every interface identifier for a grouped physical keyboard.

### Runtime tests

Add a regression demonstrating that a mapped device using the new physical identity resolves a non-empty mapping after simulated restart/re-enumeration.

Add diagnostic contract coverage so contributing profile IDs, mapping counts, layer counts, engine ID, and scope are produced by a testable helper rather than only ad-hoc log formatting.

### Quit-policy tests

Add coverage for:

1. `StudioSettings::default().stop_kanata_on_quit == true`.
2. Deserializing an older settings JSON without the field yields `true`.
3. Settings update accepts `stopKanataOnQuit`.
4. Window `CloseRequested` still selects hide-to-tray behavior and never requests engine shutdown.
5. Centralized true quit requests all managed engines to stop when the setting is ON.
6. Centralized true quit does not request engine stops when OFF.
7. Multiple engines are all attempted even if one stop fails, using a testable shutdown helper or supervisor abstraction.
8. OFF-mode detach leaves the child process alive after supervisor ownership is released.

## CI and Delivery

Implementation targets `feat/add-GUI`.

Before handing over a Windows test build:

1. Frontend lint, typecheck, tests, and production build pass.
2. Rust formatting passes.
3. Native tests and Clippy pass on Windows; existing cross-platform GUI CI remains green.
4. Dedicated Windows x64 Tauri packaging succeeds.
5. Download the resulting artifact and provide fresh EXE and MSI binaries to the user.

## Success Criteria

The change is successful when:

- the same physical Windows keyboard keeps the same Studio ID across interface-path changes when ContainerId is stable;
- composite interfaces no longer fragment one physical keyboard into multiple Studio identities;
- identical VID/PID devices remain independently addressable;
- legacy profiles migrate only when a match is provably unambiguous;
- a mapped connected keyboard keeps resolving its device profile after restart/re-enumeration rather than silently falling back because its interface-derived ID changed;
- logs make any remaining zero-mapping runtime resolution immediately diagnosable;
- Settings → General shows `Stop Kanata engine when Kanata Studio quits` ON by default;
- clicking X hides Studio and keeps Kanata running;
- tray Quit stops all Studio-managed Kanata engines by default;
- turning the setting OFF demonstrably leaves those engines running on true Studio exit;
- the final Windows EXE and MSI build successfully from the validated commit.
