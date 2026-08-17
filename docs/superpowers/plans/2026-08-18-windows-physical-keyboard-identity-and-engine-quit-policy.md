# Windows Physical Keyboard Identity and Engine Quit Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile path-hash Windows keyboard identity with ContainerId-backed physical identity, preserve multi-interface execution metadata, add runtime diagnostics for empty mappings, and add a default-ON setting that stops Studio-managed Kanata engines only on true Studio quit.

**Architecture:** Keep device discovery and persistence boundaries intact, but split Windows identity resolution into a focused platform helper and keep reconciliation pure/testable. `KeyboardDevice` gains backwards-compatible `interfacePaths`; Windows grouping derives durable IDs from PnP ContainerId while retaining every Raw Input path for Kanata filtering. True quit routes through a testable shutdown helper that either stops managed engines or explicitly detaches their child handles; window X remains hide-to-tray.

**Tech Stack:** Rust 2024, Tauri 2, `windows-sys` Win32 bindings, React 19, TypeScript 6, Vitest/Testing Library, GitHub Actions.

## Global Constraints

- `feat/add-GUI` is the implementation branch.
- Window X must continue to hide Studio to tray and must never stop Kanata.
- `stopKanataOnQuit` defaults to `true`, including when loading legacy `settings.json` without the field.
- Only Studio-managed Kanata children may be stopped or detached; never kill by process name.
- Disconnected keyboard-target semantics remain unchanged: disconnected targets are ignored by runtime topology.
- New Windows durable identity uses PnP physical-device ContainerId when available; VID/PID is migration fallback only.
- Composite Raw Input interfaces sharing one ContainerId represent one Studio keyboard.
- Identical VID/PID keyboards with different ContainerIds remain distinct.
- Legacy migration must never guess when candidates are ambiguous.
- Windows include/exclude device config must emit every interface path belonging to the physical keyboard.
- No new logging dependency; runtime diagnostics are appended to a Studio-owned text log in the existing logs directory.
- Before delivery: frontend lint/typecheck/tests/build, Rust fmt/tests/Clippy, full GUI CI, and Windows x64 packaging must pass.

---

## File Structure

- `studio/src-tauri/src/domain/device.rs` — add backwards-compatible physical-device interface-path metadata.
- `studio/src/lib/types.ts` — mirror `interfacePaths` and new quit setting for frontend bootstrap state.
- `studio/src-tauri/src/platform/devices/windows.rs` — Raw Input enumeration plus physical grouping orchestration.
- `studio/src-tauri/src/platform/devices/windows_identity.rs` — Windows SetupAPI lookup from interface path to ContainerId and pure ID normalization helpers.
- `studio/src-tauri/src/platform/devices/mod.rs` — expose the Windows identity module only on Windows.
- `studio/src-tauri/src/compiler/device_scope.rs` — emit all physical keyboard interface paths for Windows include/exclude filters.
- `studio/src-tauri/src/commands/keyboard_identity.rs` — legacy path-hash + VID/PID reconciliation and migration reasons.
- `studio/src-tauri/src/runtime/diagnostics.rs` — create concise runtime-resolution diagnostic lines and append them to `studio-runtime.log`.
- `studio/src-tauri/src/runtime/apply.rs` — record contributing profile IDs/mapping counts immediately before writing generated config.
- `studio/src-tauri/src/runtime/mod.rs` — expose diagnostics helper.
- `studio/src-tauri/src/domain/settings.rs` — add serde-compatible default-ON quit policy.
- `studio/src-tauri/src/commands/settings.rs` — persist `stopKanataOnQuit` updates.
- `studio/src-tauri/src/engine/supervisor.rs` — add explicit managed-child detach path for quit-policy OFF.
- `studio/src-tauri/src/engine/shutdown.rs` — testable centralized true-quit engine policy.
- `studio/src-tauri/src/engine/mod.rs` — expose shutdown helper.
- `studio/src-tauri/src/tray/events.rs` — route tray Quit through centralized shutdown.
- `studio/src-tauri/src/lib.rs` — preserve X→hide behavior; no engine shutdown in close event.
- `studio/src/features/settings/GeneralSettings.tsx` — add the new General toggle.
- `studio/src/features/settings/SettingsView.tsx` — pass the quit setting/update callback.
- `studio/src/app/App.tsx` — include default setting and persist toggle updates.
- `studio/src-tauri/tests/keyboard_identity_contract.rs` — migration + restart/re-enumeration regression.
- `studio/src-tauri/tests/compiler_contract.rs` — Windows multi-interface include/exclude generation contract.
- `studio/src-tauri/tests/storage_contract.rs` — legacy settings JSON default test.
- `studio/src-tauri/tests/shutdown_contract.rs` — centralized true-quit policy tests with fake managed engines.
- `studio/src/features/settings/GeneralSettings.test.tsx` — toggle rendering/change contract.

---

### Task 1: Extend the keyboard device model for physical multi-interface identity

**Files:**
- Modify: `studio/src-tauri/src/domain/device.rs`
- Modify: `studio/src/lib/types.ts`
- Modify: existing Rust test fixtures constructing `KeyboardDevice`

**Interfaces:**
- Produces Rust field: `KeyboardDevice::interface_paths: Vec<String>` with `#[serde(default)]`.
- Produces TS field: `interfacePaths?: string[]`.
- Compatibility rule: `path` remains the primary/legacy single path; `interface_paths` carries all interfaces and may be empty for old serialized data/non-Windows devices.

- [ ] **Step 1: Write the failing serialization/model tests**

Add to `studio/src-tauri/tests/storage_contract.rs`:

```rust
#[test]
fn keyboard_device_without_interface_paths_deserializes_for_backcompat() {
    let json = r#"{
      "id":"legacy",
      "name":"Keyboard",
      "vendorId":1,
      "productId":2,
      "path":"legacy-path",
      "layout":"Ansi",
      "manualLayout":null
    }"#;
    let device: kanata_studio::domain::KeyboardDevice = serde_json::from_str(json).unwrap();
    assert!(device.interface_paths.is_empty());
    assert_eq!(device.path.as_deref(), Some("legacy-path"));
}
```

- [ ] **Step 2: Run the targeted test and confirm RED**

Run:

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml keyboard_device_without_interface_paths_deserializes_for_backcompat
```

Expected: compile failure because `KeyboardDevice` has no `interface_paths` field.

- [ ] **Step 3: Add the model field and frontend mirror**

Rust:

```rust
pub struct KeyboardDevice {
    pub id: String,
    pub name: String,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub path: Option<String>,
    #[serde(default)]
    pub interface_paths: Vec<String>,
    pub layout: KeyboardLayout,
    pub manual_layout: Option<KeyboardLayout>,
}
```

TypeScript:

```ts
export type KeyboardDevice = {
  id: string;
  name: string;
  vendorId?: number | null;
  productId?: number | null;
  path?: string | null;
  interfacePaths?: string[];
  layout: KeyboardLayout;
  manualLayout?: KeyboardLayout | null;
};
```

Update every Rust fixture literal to use `interface_paths: vec![]` unless the test intentionally exercises multi-interface behavior.

- [ ] **Step 4: Run model/storage tests**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test storage_contract
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add studio/src-tauri/src/domain/device.rs studio/src/lib/types.ts studio/src-tauri/tests
git commit -m "feat: model physical keyboard interfaces"
```

---

### Task 2: Resolve Windows Raw Input interfaces to ContainerId and group physical keyboards

**Files:**
- Create: `studio/src-tauri/src/platform/devices/windows_identity.rs`
- Modify: `studio/src-tauri/src/platform/devices/windows.rs`
- Modify: `studio/src-tauri/src/platform/devices/mod.rs`
- Modify: `studio/src-tauri/Cargo.toml`

**Interfaces:**
- Produces: `pub(crate) fn container_id_for_interface(path: &str) -> Result<Option<String>, PlatformError>`.
- Produces: `pub(crate) fn physical_id_from_container(container_id: &str) -> String`.
- Produces pure grouping helper inside `windows.rs`: `fn group_interfaces(rows: Vec<RawKeyboardInterface>) -> Vec<KeyboardDevice>`.
- Uses Microsoft SetupAPI flow: open an existing device interface by path, obtain its `SP_DEVINFO_DATA`, then retrieve `DEVPKEY_Device_ContainerId` with `SetupDiGetDevicePropertyW`.

- [ ] **Step 1: Write failing Windows grouping tests**

Inside `studio/src-tauri/src/platform/devices/windows.rs` under `#[cfg(test)]`, define a small test-only `RawKeyboardInterface` fixture and add:

```rust
#[test]
fn groups_two_interfaces_with_same_container_into_one_keyboard() {
    let devices = group_interfaces(vec![
        raw("path-a", Some("{11111111-1111-1111-1111-111111111111}"), 0x1234, 0x5678),
        raw("path-b", Some("{11111111-1111-1111-1111-111111111111}"), 0x1234, 0x5678),
    ]);
    assert_eq!(devices.len(), 1);
    assert_eq!(devices[0].interface_paths, vec!["path-a", "path-b"]);
}

#[test]
fn identical_vid_pid_different_containers_stay_distinct() {
    let devices = group_interfaces(vec![
        raw("path-a", Some("{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}"), 1, 2),
        raw("path-b", Some("{bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb}"), 1, 2),
    ]);
    assert_eq!(devices.len(), 2);
    assert_ne!(devices[0].id, devices[1].id);
}

#[test]
fn missing_container_keeps_legacy_path_identity() {
    let devices = group_interfaces(vec![raw("path-a", None, 1, 2)]);
    assert_eq!(devices.len(), 1);
    assert!(devices[0].id.starts_with("windows-"));
    assert_eq!(devices[0].interface_paths, vec!["path-a"]);
}
```

- [ ] **Step 2: Run Windows targeted tests and confirm RED in CI/local Windows**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml platform::devices::windows::tests
```

Expected: compile failure because grouping/ContainerId helpers do not exist.

- [ ] **Step 3: Add the Windows API feature surface**

Extend the existing Windows `windows-sys` dependency with SetupAPI/property namespaces required by the compiler version in the lockfile. Keep the current `windows-sys = "0.52"` version; do not upgrade the crate in this task.

Required Win32 namespaces are the equivalents of:

```toml
"Win32_Devices_DeviceAndDriverInstallation",
"Win32_Devices_Properties",
"Win32_Foundation"
```

Use only bindings already available in the pinned `windows-sys` version. If the generated binding namespace differs, inspect the pinned crate source in Cargo cache and choose the exact feature names before editing Cargo.toml.

- [ ] **Step 4: Implement `windows_identity.rs`**

Implement this lifecycle:

```rust
pub(crate) fn container_id_for_interface(path: &str) -> Result<Option<String>, PlatformError> {
    // 1. Convert path to NUL-terminated UTF-16.
    // 2. SetupDiCreateDeviceInfoList(None, HWND/0) or SetupDiGetClassDevsW as appropriate.
    // 3. SetupDiOpenDeviceInterfaceW(... path ...).
    // 4. SetupDiGetDeviceInterfaceDetailW(..., DeviceInfoData = &mut SP_DEVINFO_DATA)
    //    to resolve the devnode supporting that interface.
    // 5. SetupDiGetDevicePropertyW(..., DEVPKEY_Device_ContainerId, ...)
    //    into a GUID-sized buffer.
    // 6. Normalize the GUID to lowercase hyphenated text.
    // 7. SetupDiDestroyDeviceInfoList on every exit path via a small RAII guard.
}

pub(crate) fn physical_id_from_container(container_id: &str) -> String {
    format!("windows-container-{}", container_id.trim_matches(['{', '}']).to_ascii_lowercase())
}
```

Do not parse semantic identity from the Raw Input device path.

- [ ] **Step 5: Refactor Windows enumeration into interface rows then grouping**

Introduce:

```rust
struct RawKeyboardInterface {
    path: String,
    container_id: Option<String>,
    vendor_id: Option<u16>,
    product_id: Option<u16>,
    layout: KeyboardLayout,
}
```

For each Raw Input keyboard interface, resolve ContainerId independently. Container lookup failure is non-fatal: record `None` and continue. Group by ContainerId when present; missing ContainerId gets a unique legacy path-hash group.

For each grouped `KeyboardDevice`:

```rust
KeyboardDevice {
    id,
    name,
    vendor_id,
    product_id,
    path: interface_paths.first().cloned(),
    interface_paths,
    layout,
    manual_layout: None,
}
```

Sort `interface_paths` before storing so generated config and tests are deterministic.

- [ ] **Step 6: Run Windows device tests**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml platform::devices::windows::tests
```

Expected: PASS on Windows.

- [ ] **Step 7: Commit**

```bash
git add studio/src-tauri/Cargo.toml studio/src-tauri/src/platform/devices
 git commit -m "feat: use Windows physical keyboard identity"
```

---

### Task 3: Emit every physical keyboard interface in Windows device filters

**Files:**
- Modify: `studio/src-tauri/src/compiler/device_scope.rs`
- Modify: `studio/src-tauri/tests/compiler_contract.rs`

**Interfaces:**
- Produces helper: `fn windows_interface_paths(device: &KeyboardDevice) -> Vec<&str>` where `interface_paths` wins and `path` is fallback.
- Windows include/exclude `defcfg` contains all interface HWID byte strings for grouped physical keyboards.

- [ ] **Step 1: Write failing compiler contract tests**

Add a Windows-scope device fixture with:

```rust
interface_paths: vec![
    r"\\?\HID#VID_1234&PID_5678&A".into(),
    r"\\?\HID#VID_1234&PID_5678&B".into(),
],
```

Assert `defcfg_for_scope(Platform::Windows, &EngineDeviceScope::IncludeDevice(device))` contains the encoded UTF-16 bytes for both paths. Add an exclude test with two physical devices and assert all constituent paths appear.

- [ ] **Step 2: Run compiler contract and confirm RED**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test compiler_contract windows
```

Expected: only the legacy `path` is emitted.

- [ ] **Step 3: Implement multi-interface path expansion**

Use:

```rust
fn windows_interface_paths(device: &KeyboardDevice) -> Vec<&str> {
    if device.interface_paths.is_empty() {
        device.path.as_deref().into_iter().collect()
    } else {
        device.interface_paths.iter().map(String::as_str).collect()
    }
}
```

Generate one quoted HWID byte string per returned path for both include and exclude variants.

- [ ] **Step 4: Re-run compiler contract**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test compiler_contract
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add studio/src-tauri/src/compiler/device_scope.rs studio/src-tauri/tests/compiler_contract.rs
git commit -m "fix: filter every Windows keyboard interface"
```

---

### Task 4: Upgrade legacy keyboard-ID reconciliation to understand physical interface membership

**Files:**
- Modify: `studio/src-tauri/src/commands/keyboard_identity.rs`
- Modify: `studio/src-tauri/tests/keyboard_identity_contract.rs`

**Interfaces:**
- `ReconciledKeyboardState` gains `pub migrations: Vec<KeyboardIdentityMigration>`.
- New type:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KeyboardIdentityMigration {
    pub old_id: String,
    pub new_id: String,
    pub reason: KeyboardIdentityMigrationReason,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyboardIdentityMigrationReason {
    LegacyInterfacePath,
    UniqueVidPid,
}
```

- Exact legacy interface match is evaluated before VID/PID fallback.

- [ ] **Step 1: Add failing reconciliation regressions**

Extend `keyboard_identity_contract.rs` with:

```rust
#[test]
fn legacy_path_hash_matching_member_interface_migrates_to_container_id() {
    let path = r"\\?\HID#VID_1234&PID_5678&MI_01#OLD";
    let old = legacy_windows_id_for_test(path);
    let mut current = device("windows-container-abc", Some(0x1234), Some(0x5678));
    current.path = Some(path.into());
    current.interface_paths = vec![path.into(), r"\\?\HID#VID_1234&PID_5678&MI_00#OTHER".into()];

    let result = reconcile_keyboard_identities(
        &[configured(&old, Some(0x1234), Some(0x5678))],
        &[global_profile(), mapped_profile(&old)],
        &[current],
    ).unwrap();

    assert_eq!(result.keyboards[0].id, "windows-container-abc");
    assert_eq!(result.migrations[0].reason, KeyboardIdentityMigrationReason::LegacyInterfacePath);
}

#[test]
fn same_container_after_interface_path_change_keeps_profile_resolution() {
    // configured ID already equals physical ID; paths may change but no migration is needed.
    // Resolve profile with the physical ID and assert caps -> esc remains present.
}
```

Retain and adapt the existing ambiguous-identical-device test.

- [ ] **Step 2: Confirm RED**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test keyboard_identity_contract
```

Expected: migration types/path-membership behavior missing.

- [ ] **Step 3: Implement ordered matching**

For each disconnected saved keyboard:

1. Build legacy path IDs for every unclaimed detected device interface with the existing SHA-256 format `windows-<16 hex>`.
2. If exactly one physical device contains an interface whose legacy ID equals `saved.id`, choose it and record `LegacyInterfacePath`.
3. Otherwise run the existing unique VID/PID candidate rule and record `UniqueVidPid`.
4. If zero/multiple candidates, do not migrate.
5. Preserve the existing claimed-device set so one current device cannot satisfy two saved records.

Do not change mapping/profile migration semantics except to populate `migrations`.

- [ ] **Step 4: Re-run keyboard identity contract**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test keyboard_identity_contract
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add studio/src-tauri/src/commands/keyboard_identity.rs studio/src-tauri/tests/keyboard_identity_contract.rs
git commit -m "fix: migrate legacy Windows keyboard identities"
```

---

### Task 5: Add runtime-resolution diagnostics for empty mappings

**Files:**
- Create: `studio/src-tauri/src/runtime/diagnostics.rs`
- Modify: `studio/src-tauri/src/runtime/mod.rs`
- Modify: `studio/src-tauri/src/runtime/apply.rs`
- Modify: `studio/src-tauri/src/app_state.rs`
- Modify: `studio/src-tauri/src/lib.rs`
- Modify: `studio/src-tauri/src/commands/devices.rs`
- Test: add focused unit tests in `diagnostics.rs` and/or `studio/src-tauri/tests/domain_resolution.rs`

**Interfaces:**
- `AppState` gains `identity_migrations: RwLock<Vec<KeyboardIdentityMigration>>` to carry migrations from startup/refresh into the next apply diagnostic; clear only after a successful apply log write.
- Produces:

```rust
pub struct RuntimeResolutionDiagnostic<'a> {
    pub engine_id: &'a str,
    pub device_id: Option<&'a str>,
    pub interface_count: usize,
    pub contributing_profile_ids: &'a [String],
    pub base_mapping_count: usize,
    pub advanced_layer_count: usize,
    pub raw_profile: bool,
}

pub fn format_resolution_diagnostic(d: &RuntimeResolutionDiagnostic<'_>) -> String;
pub fn append_runtime_diagnostic(logs_dir: &Path, line: &str) -> std::io::Result<()>;
```

- [ ] **Step 1: Write failing formatting tests**

```rust
#[test]
fn zero_mapping_diagnostic_is_explicit() {
    let line = format_resolution_diagnostic(&RuntimeResolutionDiagnostic {
        engine_id: "all",
        device_id: None,
        interface_count: 0,
        contributing_profile_ids: &[],
        base_mapping_count: 0,
        advanced_layer_count: 0,
        raw_profile: false,
    });
    assert!(line.contains("baseMappings=0"));
    assert!(line.contains("profiles=[]"));
}
```

Add a migration-line formatter test containing old ID, new ID, and reason.

- [ ] **Step 2: Confirm RED**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml runtime::diagnostics
```

Expected: diagnostics module missing.

- [ ] **Step 3: Implement diagnostics helper**

Append to `<logs>/studio-runtime.log` with `OpenOptions::new().create(true).append(true)`. One line per event; no JSON/logging dependency is required. Prefix with an epoch-millisecond timestamp and event type (`resolve` or `identity-migration`).

- [ ] **Step 4: Capture diagnostic data during preparation**

Extend `PreparedEngine` with diagnostic metadata created from the already-resolved profile before compile. For visual profiles use `resolved.mappings.len()` and `resolved.layers.len()`; for Raw set `raw_profile = true` and mapping/layer counts to zero. Compute Windows interface count from `EngineDeviceScope::IncludeDevice(device)` using `interface_paths` fallback to `path`.

Immediately before `write_atomic`, append the resolution diagnostic. On successful runtime application, drain and log pending identity migrations.

At startup and device refresh, store `reconciled.migrations` in `state.identity_migrations` before calling `apply_current_context`.

- [ ] **Step 5: Run runtime/domain tests**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml runtime::diagnostics
cargo test --manifest-path studio/src-tauri/Cargo.toml --test domain_resolution
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/runtime studio/src-tauri/src/app_state.rs studio/src-tauri/src/lib.rs studio/src-tauri/src/commands/devices.rs
git commit -m "feat: log runtime profile resolution"
```

---

### Task 6: Add the default-ON persisted quit policy and Settings UI

**Files:**
- Modify: `studio/src-tauri/src/domain/settings.rs`
- Modify: `studio/src-tauri/src/commands/settings.rs`
- Modify: `studio/src-tauri/tests/storage_contract.rs`
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/features/settings/GeneralSettings.tsx`
- Modify: `studio/src/features/settings/SettingsView.tsx`
- Create: `studio/src/features/settings/GeneralSettings.test.tsx`

**Interfaces:**
- Rust field: `stop_kanata_on_quit: bool`.
- TS field: `stopKanataOnQuit: boolean`.
- Explicit serde default helper:

```rust
fn default_true() -> bool { true }

#[serde(default = "default_true")]
pub stop_kanata_on_quit: bool,
```

- [ ] **Step 1: Write failing Rust backcompat tests**

Add to `storage_contract.rs`:

```rust
#[test]
fn legacy_settings_missing_quit_policy_defaults_to_true() {
    let json = r#"{
      "onboardingCompleted":true,
      "startWithSystem":false,
      "remappingEnabled":true,
      "deviceLayoutOverrides":{},
      "uiMode":"Beginner"
    }"#;
    let settings: kanata_studio::domain::StudioSettings = serde_json::from_str(json).unwrap();
    assert!(settings.stop_kanata_on_quit);
}
```

Also assert `StudioSettings::default().stop_kanata_on_quit`.

- [ ] **Step 2: Confirm RED**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test storage_contract legacy_settings_missing_quit_policy_defaults_to_true
```

- [ ] **Step 3: Implement Rust setting and update command**

In `update_settings`:

```rust
if let Some(value) = input.get("stopKanataOnQuit").and_then(|value| value.as_bool()) {
    settings.stop_kanata_on_quit = value;
}
```

- [ ] **Step 4: Write failing frontend toggle test**

```tsx
it('renders the quit engine toggle and reports changes', () => {
  const onQuitPolicy = vi.fn();
  render(<GeneralSettings start={true} stopKanataOnQuit={true} onStart={() => {}} onStopKanataOnQuit={onQuitPolicy} />);
  const toggle = screen.getByRole('checkbox', { name: 'Stop Kanata engine when Kanata Studio quits' });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  expect(onQuitPolicy).toHaveBeenCalledWith(false);
});
```

- [ ] **Step 5: Implement TS model, fallback, and settings wiring**

Update fallback in `App.tsx`:

```ts
settings: {
  onboardingCompleted: false,
  startWithSystem: true,
  remappingEnabled: true,
  stopKanataOnQuit: true,
  deviceLayoutOverrides: {},
  uiMode: 'Beginner',
},
```

Extend `GeneralSettings` props and render a second `Toggle` labeled exactly:

`Stop Kanata engine when Kanata Studio quits`

Wire `SettingsView` to call `saveSetting({ stopKanataOnQuit: value })` through a new callback prop from `App`.

- [ ] **Step 6: Run targeted tests**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test storage_contract
pnpm --dir studio test -- GeneralSettings.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add studio/src-tauri/src/domain/settings.rs studio/src-tauri/src/commands/settings.rs studio/src-tauri/tests/storage_contract.rs studio/src/lib/types.ts studio/src/app/App.tsx studio/src/features/settings
git commit -m "feat: add Kanata quit policy setting"
```

---

### Task 7: Centralize true quit and stop or detach Studio-managed engines

**Files:**
- Create: `studio/src-tauri/src/engine/shutdown.rs`
- Modify: `studio/src-tauri/src/engine/mod.rs`
- Modify: `studio/src-tauri/src/engine/supervisor.rs`
- Modify: `studio/src-tauri/src/tray/events.rs`
- Modify: `studio/src-tauri/src/lib.rs` only if needed to expose/test close policy; do not change X behavior.
- Create: `studio/src-tauri/tests/shutdown_contract.rs`

**Interfaces:**
- Add supervisor method on `LocalSupervisor`:

```rust
pub fn detach_all(&self) {
    let mut engines = self.engines.lock();
    for engine in engines.values_mut() {
        if let Some(child) = engine.child.take() {
            std::mem::forget(child);
        }
        engine.status.state = EngineState::Stopped;
        engine.status.message = Some("Detached because Studio quit policy keeps Kanata running".into());
    }
}
```

This is intentionally used only immediately before process exit. Forgetting the child handle makes the OFF semantics explicit instead of depending on a future `Drop` implementation in `tauri-plugin-shell`.

- Add a testable shutdown abstraction:

```rust
pub trait QuitEngineController {
    fn engine_ids(&self) -> Vec<EngineId>;
    fn stop_engine(&self, id: &EngineId) -> Result<(), String>;
    fn detach_all(&self);
}

pub fn prepare_true_quit(controller: &dyn QuitEngineController, stop_on_quit: bool) -> Vec<String>;
```

- [ ] **Step 1: Write failing shutdown contract tests**

Use a fake controller recording calls:

```rust
#[test]
fn true_quit_stops_every_engine_when_enabled_even_if_one_fails() {
    let fake = FakeController::with_engines(["a", "b", "c"]).fail_stop("b");
    let errors = prepare_true_quit(&fake, true);
    assert_eq!(fake.stopped(), vec!["a", "b", "c"]);
    assert_eq!(errors.len(), 1);
    assert!(!fake.detached());
}

#[test]
fn true_quit_detaches_and_does_not_stop_when_disabled() {
    let fake = FakeController::with_engines(["a"]);
    let errors = prepare_true_quit(&fake, false);
    assert!(errors.is_empty());
    assert!(fake.stopped().is_empty());
    assert!(fake.detached());
}
```

- [ ] **Step 2: Confirm RED**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test shutdown_contract
```

- [ ] **Step 3: Implement shutdown helper and LocalSupervisor adapter**

`prepare_true_quit` behavior:

```rust
if !stop_on_quit {
    controller.detach_all();
    return Vec::new();
}

let mut errors = Vec::new();
for id in controller.engine_ids() {
    if let Err(error) = controller.stop_engine(&id) {
        errors.push(format!("{}: {error}", id.0));
    }
}
errors
```

`LocalSupervisor` adapter obtains IDs only for statuses not already `Stopped` and delegates to existing `EngineSupervisor::stop`.

- [ ] **Step 4: Route tray Quit through one function**

Replace direct `"quit" => app.exit(0)` with:

```rust
"quit" => quit(app),
```

`quit(app)` reads `state.settings.read().stop_kanata_on_quit`, calls `prepare_true_quit`, appends any errors to `studio-runtime.log`, then calls `app.exit(0)`.

Do not invoke this function from `WindowEvent::CloseRequested`; retain the existing `prevent_close(); window.hide();` path verbatim in behavior.

- [ ] **Step 5: Add a close-policy pure test if necessary**

If close behavior cannot be asserted without constructing Tauri windows, extract only the decision:

```rust
#[derive(Debug, PartialEq, Eq)]
pub enum WindowCloseAction { HideToTray }
pub fn main_window_close_action() -> WindowCloseAction { WindowCloseAction::HideToTray }
```

Keep it minimal; do not redesign window lifecycle.

- [ ] **Step 6: Run shutdown and engine tests**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test shutdown_contract
cargo test --manifest-path studio/src-tauri/Cargo.toml engine::
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add studio/src-tauri/src/engine studio/src-tauri/src/tray/events.rs studio/src-tauri/src/lib.rs studio/src-tauri/tests/shutdown_contract.rs
git commit -m "feat: apply Kanata policy on true Studio quit"
```

---

### Task 8: Validate the full regression path and all project checks

**Files:**
- Modify only files required by failures exposed by this validation task.

**Interfaces:**
- No new product interface; this task proves the completed design.

- [ ] **Step 1: Run frontend validation**

```bash
pnpm --dir studio lint
pnpm --dir studio exec tsc -b --noEmit
pnpm --dir studio test
pnpm --dir studio build
```

Expected: all PASS.

- [ ] **Step 2: Run Rust formatting and native tests**

```bash
cargo fmt --manifest-path studio/src-tauri/Cargo.toml -- --check
cargo test --manifest-path studio/src-tauri/Cargo.toml
cargo clippy --manifest-path studio/src-tauri/Cargo.toml --all-targets -- -D warnings
```

Expected: all PASS on the current platform; Windows-only tests are additionally required in GitHub Actions.

- [ ] **Step 3: Run contract tests explicitly**

```bash
cargo test --manifest-path studio/src-tauri/Cargo.toml --test keyboard_identity_contract
cargo test --manifest-path studio/src-tauri/Cargo.toml --test compiler_contract
cargo test --manifest-path studio/src-tauri/Cargo.toml --test storage_contract
cargo test --manifest-path studio/src-tauri/Cargo.toml --test shutdown_contract
```

Expected: all PASS.

- [ ] **Step 4: Commit any validation-only corrections**

```bash
git add <only files changed by validated corrections>
git commit -m "fix: satisfy physical keyboard and quit policy checks"
```

Skip this commit if no corrections are needed.

---

### Task 9: Run GitHub CI to green and produce Windows binaries

**Files:**
- No product file changes unless CI exposes a real defect.

**Interfaces:**
- Final delivery artifact must be produced from the same commit whose Windows test-build workflow succeeds.

- [ ] **Step 1: Push/confirm final head on `feat/add-GUI`**

Record the exact head SHA.

- [ ] **Step 2: Watch `.github/workflows/kanata-gui.yml`**

Require green results for:

- frontend lint/typecheck/tests/build;
- Windows native tests + Clippy;
- Linux native tests + Clippy + rustfmt;
- macOS ARM64 native tests + Clippy;
- macOS x64 native tests + Clippy.

If any job fails, fetch its exact logs, apply the smallest root-cause fix, commit, and let the next push supersede the run.

- [ ] **Step 3: Watch `.github/workflows/kanata-gui-windows-test.yml`**

Require successful sidecar compile, Tauri bundle, verification, and artifact upload on the final SHA.

- [ ] **Step 4: Download and inspect the artifact ZIP**

Confirm both files exist:

```text
*.exe
*.msi
```

Verify ZIP integrity and compute SHA-256 for each installer.

- [ ] **Step 5: Deliver binaries**

Provide direct sandbox links for the extracted EXE and MSI, the final commit SHA, Windows workflow result, full GUI CI result, and hashes.

---

## Plan Self-Review

- Spec coverage: physical ContainerId identity, composite grouping, identical-device separation, fallback identity, path-hash migration, VID/PID fallback, ambiguous no-op, multi-interface Kanata filtering, runtime diagnostics, default-ON quit setting, legacy settings compatibility, X→tray preservation, true quit stop/detach semantics, CI and binary delivery are each assigned to a task.
- Placeholder scan: no `TBD`/`TODO` implementation gaps remain. Windows binding feature names are deliberately constrained to the pinned `windows-sys` crate and require inspecting that pinned generated binding before editing rather than guessing/upgrading dependencies.
- Type consistency: Rust `interface_paths` ↔ TS `interfacePaths`; Rust `stop_kanata_on_quit` ↔ JSON/TS `stopKanataOnQuit`; reconciliation migrations flow into AppState diagnostics; `prepare_true_quit` consumes `QuitEngineController` consistently.
