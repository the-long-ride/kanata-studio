# Windows Keyboard Reconciliation and Keypress Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair stale Windows keyboard identities without broadening device scopes, and show foreground physical key presses on the on-screen keyboard without changing selection.

**Architecture:** Add a pure Rust reconciliation unit that maps uniquely identifiable configured keyboards to newly detected IDs and rewrites only their device-targeted profiles. Call it from startup and keyboard refresh before runtime compilation, persisting the migrated keyboard/profile pair before updating in-memory state. On the frontend, isolate `KeyboardEvent.code` conversion in a small helper and let `KeyboardCanvas` maintain a held-key set that drives a `pressed` prop on `KeyboardKey`.

**Tech Stack:** Rust/Tauri, React 19, TypeScript 6, Vitest/Testing Library, GitHub Actions.

## Global Constraints

- Never migrate a stale device profile to `DeviceTarget::All`.
- Only auto-migrate when a stale configured keyboard has VID/PID and exactly one otherwise-unclaimed detected device matches both values.
- Do not guess when multiple identical devices are candidates.
- Preserve configured keyboard name, layout override, profile mappings, app matchers, and revisions.
- Regenerate only the deterministic keyboard-global profile ID (`keyboard-<device>-global`) when its device ID changes; leave app-profile IDs stable.
- Persist migrated profiles and keyboards before swapping in-memory state.
- Physical key feedback is foreground-only, visual-only, and must not call `onSelect`.
- Clear held-key visual state on `window.blur`.

---

### Task 1: Backend keyboard identity reconciliation

**Files:**
- Create: `studio/src-tauri/src/commands/keyboard_identity.rs`
- Modify: `studio/src-tauri/src/commands/mod.rs`
- Modify: `studio/src-tauri/src/commands/devices.rs`
- Modify: `studio/src-tauri/src/lib.rs`
- Test: `studio/src-tauri/src/commands/keyboard_identity.rs`
- Test: `studio/scripts/keyboard-registry-contract.test.mjs`

**Interfaces:**
- Consumes: `ConfiguredKeyboard`, `KeyboardDevice`, `StudioProfile`, `DeviceTarget`, `validate_profile_set`.
- Produces: `pub(crate) struct ReconciledKeyboardState { pub keyboards: Vec<ConfiguredKeyboard>, pub profiles: Vec<StudioProfile>, pub changed: bool }` and `pub(crate) fn reconcile_keyboard_identities(configured: &[ConfiguredKeyboard], profiles: &[StudioProfile], detected: &[KeyboardDevice]) -> Result<ReconciledKeyboardState, String>`.

- [ ] **Step 1: Write failing Rust tests**

Add tests for: unique VID/PID migration, mappings preserved, global profile ID rewritten, app profile ID preserved, unrelated profiles unchanged, ambiguous duplicate devices skipped, missing VID/PID skipped, current IDs unchanged, and post-migration `validate_profile_set` success.

Use a mapped profile such as:

```rust
let mut profile = device_global_profile("old", ProfileSource::Visual {
    mappings: BTreeMap::from([("caps".into(), ActionSpec::Key { key: "esc".into() })]),
    advanced: Default::default(),
});
```

Assert the migrated profile has `DeviceTarget::Device { id: "new" }`, ID `keyboard-new-global`, and still contains `caps -> esc`.

- [ ] **Step 2: Write failing contract coverage**

Extend `studio/scripts/keyboard-registry-contract.test.mjs` to require a reconciliation module and calls from both `src-tauri/src/lib.rs` startup and `src-tauri/src/commands/devices.rs` refresh.

- [ ] **Step 3: Run the tests and confirm RED**

Run in CI or locally:

```bash
cd studio
node --experimental-strip-types --test scripts/keyboard-registry-contract.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml keyboard_identity
```

Expected: failure because the reconciliation module/calls do not exist yet.

- [ ] **Step 4: Implement the pure reconciler**

Implement conservative matching:

```rust
pub(crate) fn reconcile_keyboard_identities(
    configured: &[ConfiguredKeyboard],
    profiles: &[StudioProfile],
    detected: &[KeyboardDevice],
) -> Result<ReconciledKeyboardState, String>
```

Start from cloned vectors. Mark exact-ID detected devices as claimed. For each stale configured keyboard with `Some(vendor_id)` and `Some(product_id)`, collect unclaimed detected devices with exactly equal VID/PID. Migrate only when `matches.len() == 1`. Update configured ID + detected metadata, rewrite all matching `DeviceTarget::Device` IDs, and if a migrated profile is a no-app global whose ID is exactly `keyboard-{old}-global`, rename it to `keyboard-{new}-global`. Validate the final profile set before returning it.

- [ ] **Step 5: Wire reconciliation into startup and refresh**

At startup, after detecting devices and before `AppState` construction/runtime apply, reconcile loaded keyboards/profiles. If changed, save profiles then keyboards; only then construct state with migrated vectors.

In `list_keyboards`, after detection and before layout application/in-memory replacement, reconcile against current configured keyboards/profiles. If changed, persist both stores before updating `state.profiles` and `state.configured_keyboards`. Then apply configured layouts using the reconciled keyboard list and publish detected devices.

- [ ] **Step 6: Run backend and contract tests GREEN**

```bash
cd studio
node --experimental-strip-types --test scripts/keyboard-registry-contract.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml keyboard_identity
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add studio/src-tauri/src/commands/keyboard_identity.rs studio/src-tauri/src/commands/mod.rs studio/src-tauri/src/commands/devices.rs studio/src-tauri/src/lib.rs studio/scripts/keyboard-registry-contract.test.mjs
git commit -m "fix: reconcile stale keyboard identities"
```

### Task 2: Physical keypress feedback

**Files:**
- Create: `studio/src/features/keyboard/keyEventCode.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Modify: `studio/src/features/keyboard/KeyboardKey.tsx`
- Modify: `studio/src/features/keyboard/keyboard.css`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`

**Interfaces:**
- Produces: `export function keyboardEventCodeToKanataId(code: string): string | undefined`.
- `KeyboardKey` adds required prop `pressed: boolean`.

- [ ] **Step 1: Write failing frontend tests**

Expand `KeyboardCanvas.test.tsx` with tests that dispatch `keydown`/`keyup` for `CapsLock`, verify the Caps key gains/loses `.pressed`, verify `onSelect` remains untouched, and verify `blur` clears the class. Add direct helper assertions for `KeyA -> a`, `Space -> spc`, `ControlLeft -> lctl`, `ShiftRight -> rsft`, and unknown code -> `undefined`.

- [ ] **Step 2: Run the tests and confirm RED**

```bash
cd studio
pnpm test -- src/features/keyboard/KeyboardCanvas.test.tsx
```

Expected: fail because key event mapping/pressed state is not implemented.

- [ ] **Step 3: Implement code-to-Kanata mapping**

Create `keyEventCode.ts` with explicit modifier/special mappings plus predictable letter/digit/function mappings. Include current layout punctuation IDs (`grv`, `-`, `=`, `[`, `]`, `\\`, `;`, `'`, `,`, `.`, `/`) and `non_us_bslash` for `IntlBackslash`.

- [ ] **Step 4: Implement held-key state in `KeyboardCanvas`**

Use `useEffect` + `useState<Set<string>>`. Register `window` `keydown`, `keyup`, and `blur`; update held state without touching `selected` or `onSelect`. Pass `pressed={held.has(k.id)}` to every `KeyboardKey`.

- [ ] **Step 5: Add pressed visual style**

Append a `.keyboard-key.pressed` state that depresses the key by roughly 1px and removes/reduces the inset bottom shadow while strengthening background/border contrast. Do not override selected/inherited/overridden markers.

- [ ] **Step 6: Run frontend tests GREEN**

```bash
cd studio
pnpm test -- src/features/keyboard/KeyboardCanvas.test.tsx
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add studio/src/features/keyboard/keyEventCode.ts studio/src/features/keyboard/KeyboardCanvas.tsx studio/src/features/keyboard/KeyboardKey.tsx studio/src/features/keyboard/keyboard.css studio/src/features/keyboard/KeyboardCanvas.test.tsx
git commit -m "feat: show physical keypress feedback"
```

### Task 3: Full verification and Windows binaries

**Files:**
- Verify: `.github/workflows/kanata-gui.yml`
- Verify: `.github/workflows/kanata-gui-windows-test.yml`

- [ ] **Step 1: Verify full GUI CI**

Require the `kanata-gui.yml` run for the final commit to complete successfully across frontend, Windows, Linux, macOS ARM64, and macOS x64 jobs.

- [ ] **Step 2: Verify Windows installer workflow**

Require `kanata-gui-windows-test.yml` to complete successfully on the same final commit, including sidecars, Tauri bundle, bundle verification, and artifact upload.

- [ ] **Step 3: Inspect the final artifact**

Download the workflow artifact, confirm it contains both the NSIS `.exe` and WiX `.msi`, compute SHA-256 checksums, and provide both files to the user.
