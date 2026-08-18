# Chord Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add profile-level visual input chord sets that compile to Kanata `defchordsv2`, preserve normal individual key mappings, support layer scope, reuse `ActionSpec`, and expose a compact Advanced Visual editor.

**Architecture:** Extend the existing visual profile model with `ChordSet` and `ChordEntry`, resolve them using the same profile precedence as mappings, validate/canonicalize physical input combinations, then compile all effective entries into one `defchordsv2`. The frontend edits chord sets immutably through profile helpers and reuses `AdvancedInspector` for chord output actions.

**Tech Stack:** Rust + serde + existing Kanata Studio compiler, React 19 + TypeScript + Vitest/Testing Library, Tauri IPC, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-18-chord-sets-design.md`

## Global Constraints

- Physical/input keys define chord triggers before remapping.
- Default timeout is exactly 50 ms and is configurable per Chord Set.
- Completed chords consume member keys; incomplete chords fall back to normal mappings through Kanata `defchordsv2`.
- Longest matching chord wins; `J+K` and `J+K+L` may coexist.
- Release behavior is always `first-release` in this version.
- Chord outputs use the complete existing `ActionSpec`; do not create a chord-specific action language.
- Empty `layers` means all layers; Studio converts this to Kanata disabled-layer lists.
- Minimum chord size is 2; duplicate keys inside one chord are invalid.
- Equal-precedence duplicate active chords are invalid; more-specific profile definitions override less-specific definitions.
- Missing serialized `chordSets` must load as `[]`.
- Raw `.kbd` profiles remain untouched.

---

### Task 1: Domain model, migration, and resolver precedence

**Files:**
- Modify: `studio/src-tauri/src/domain/profile.rs`
- Modify: `studio/src-tauri/src/domain/resolver.rs`
- Modify: `studio/src-tauri/src/domain/mod.rs`
- Modify: `studio/src/lib/types.ts`
- Modify: `studio/src/app/profileHelpers.ts`

**Interfaces:**
- Produces Rust `ChordSet { name, timeout_ms, layers, chords }` and `ChordEntry { keys, action }`.
- Produces TypeScript `ChordSet`/`ChordEntry` with camelCase fields.
- `AdvancedVisualConfig.chord_sets` uses `#[serde(default)]`.
- `ResolvedProfile.chord_sets: Vec<ChordSet>` is consumed by compiler task 2.
- `setChordSets(profile, chordSets)` is consumed by UI task 3.

- [ ] **Step 1: Write failing Rust deserialization/resolver tests**

Add tests equivalent to:

```rust
#[test]
fn visual_profile_without_chord_sets_deserializes_empty() {
    let json = r#"{"id":"global","revision":0,"name":"Global","enabled":true,"deviceTarget":{"kind":"all"},"source":{"kind":"visual","mappings":{},"advanced":{"layers":[]}}}"#;
    let profile: StudioProfile = serde_json::from_str(json).unwrap();
    let ProfileSource::Visual { advanced, .. } = profile.source else { panic!() };
    assert!(advanced.chord_sets.is_empty());
}

#[test]
fn app_chord_overrides_global_same_trigger() {
    // global J+K -> esc; app J+K -> p
    // resolved chord is the app definition.
}
```

- [ ] **Step 2: Run remote `studio-ci` and confirm RED**

Create/update the draft PR so `.github/workflows/studio-ci.yml` runs. Expected Rust failure: missing `chord_sets`, `ChordSet`, or `ResolvedProfile.chord_sets` symbols.

- [ ] **Step 3: Add Rust/TypeScript model and resolver implementation**

Use these shapes:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChordEntry {
    pub keys: Vec<String>,
    pub action: ActionSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChordSet {
    pub name: String,
    pub timeout_ms: u32,
    #[serde(default)]
    pub layers: Vec<String>,
    #[serde(default)]
    pub chords: Vec<ChordEntry>,
}

#[derive(Default)]
pub struct AdvancedVisualConfig {
    pub layers: Vec<VisualLayer>,
    #[serde(default)]
    pub chord_sets: Vec<ChordSet>,
}
```

TypeScript mirrors `timeoutMs`, `layers`, and `chords`. Update every visual-profile constructor to initialize `chordSets: []`. When mutating `advanced`, preserve both `layers` and `chordSets` rather than rebuilding only one field.

Resolver behavior: iterate candidates least-specific to most-specific; carry chord definitions keyed by `(canonical sorted keys, active layer scope)` so a later profile replaces an earlier equivalent trigger. Preserve independent overlapping-size chords such as two-key and three-key combinations.

- [ ] **Step 4: Run remote `studio-ci` and confirm GREEN for Task 1**

Expected: Rust tests compile/pass and TypeScript typecheck remains green.

- [ ] **Step 5: Commit**

Commit message: `feat: add chord sets to visual profiles`

---

### Task 2: Chord validation and `defchordsv2` compiler

**Files:**
- Create: `studio/src-tauri/src/compiler/chords.rs`
- Modify: `studio/src-tauri/src/compiler/mod.rs`
- Modify: `studio/src-tauri/src/compiler/escape.rs` only if an existing atom helper must be exposed

**Interfaces:**
- Produces `compile_chords(chord_sets, layer_names, platform, external) -> Result<String, CompileError>`.
- Reuses `basic::action_expression()` for every chord output.
- Adds compile errors with actionable text via existing `CompileError::InvalidExpression` unless a focused enum variant is cleaner.

- [ ] **Step 1: Write failing compiler tests**

Add tests that assert:

```rust
assert!(compiled.text.contains("(defchordsv2"));
assert!(compiled.text.contains("(j k) esc 50 first-release ()"));
assert!(compiled.text.contains("(j k l) C-S-p 50 first-release"));
```

Also test:

```rust
// fewer than 2 keys => Err
// duplicate participant j,j => Err
// unknown enabled layer => Err
// equal-scope duplicate j+k => Err
// scoped to base only => disabled list contains every non-base layer
// external LaunchApp/Text/OpenUrl action registers push-msg binding
```

- [ ] **Step 2: Run remote `studio-ci` and confirm RED**

Expected Rust compile/test failure because chord compiler does not exist or config lacks `defchordsv2`.

- [ ] **Step 3: Implement canonicalization, conflict detection, and emission**

Core helpers:

```rust
fn canonical_keys(keys: &[String]) -> Result<Vec<String>, CompileError> {
    if keys.len() < 2 { return Err(...); }
    let mut canonical = keys.to_vec();
    for key in &canonical { validate_atom(key)?; }
    canonical.sort();
    canonical.dedup();
    if canonical.len() != keys.len() { return Err(...); }
    Ok(canonical)
}
```

For each set require nonblank name and `timeout_ms > 0`. Validate enabled layer names against `base` plus resolved visual layers. Empty enabled-layer list means all layers and emits `()`. Otherwise compute `disabled_layers = all_layers - enabled_layers`.

Emit deterministic rows sorted first by chord size ascending and then lexical canonical keys; Kanata handles runtime longest-match resolution. Every action expression is generated by:

```rust
let action = basic::action_expression(
    &format!("chord-{set_index}-{chord_index}"),
    &entry.action,
    platform,
    external,
    0,
)?;
```

Append exactly one block when at least one chord exists:

```text
(defchordsv2
  (j k) esc 50 first-release ()
)
```

- [ ] **Step 4: Integrate with `compile_visual`**

Build layer names from `base` + `profile.layers`. Append chord output after layer definitions and before the optional `studio-paste` virtual key block. Ensure raw-profile code path never calls the chord compiler.

- [ ] **Step 5: Run remote `studio-ci` and confirm GREEN for Task 2**

Expected: all Rust tests pass on Linux/Windows/macOS, fmt/clippy clean.

- [ ] **Step 6: Commit**

Commit message: `feat: compile chord sets to defchordsv2`

---

### Task 3: Chord-set editor and immutable frontend helpers

**Files:**
- Create: `studio/src/features/advanced/ChordEditor.tsx`
- Create: `studio/src/features/advanced/ChordEditor.test.tsx`
- Modify: `studio/src/app/profileHelpers.ts`
- Modify: `studio/src/features/advanced/AdvancedWorkspace.tsx`
- Modify: `studio/src/styles/*` file that owns `.advanced-*` layout rules

**Interfaces:**
- `ChordEditor` receives `chordSets`, available `layers`, selected set/entry IDs or indices, and callbacks that return updated arrays.
- `AdvancedWorkspace` exposes `Layers | Chords` mode and forwards chord actions to the inspector through App-level selected chord state.
- Physical recording uses browser `keydown`/`keyup`, reads `event.code` through a small mapping to Kanata physical names, prevents repeat events, and commits once at least two distinct keys have been recorded. Manual comma/space-delimited key entry remains available.

- [ ] **Step 1: Write failing frontend helper/component tests**

Cover:

```tsx
expect(screen.getByRole('button', { name: 'Chords' })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: 'Add chord set' }));
expect(screen.getByDisplayValue('Chord Set 1')).toBeInTheDocument();
```

And recording:

```tsx
fireEvent.keyDown(window, { code: 'KeyJ' });
fireEvent.keyDown(window, { code: 'KeyK' });
expect(screen.getByText('J + K')).toBeInTheDocument();
```

Also assert default timeout `50`, layer selection, delete behavior, and conflict message for duplicate canonical keys in overlapping scope.

- [ ] **Step 2: Run remote `studio-ci` and confirm RED**

Expected frontend test/typecheck failure because `ChordEditor` and chord helpers are missing.

- [ ] **Step 3: Implement focused immutable helpers**

Add helpers with exact behavior:

```ts
export function setChordSets(profile: StudioProfile, chordSets: ChordSet[]): StudioProfile
export function addChordSet(profile: StudioProfile, name = 'Chord Set'): StudioProfile
```

They must preserve existing `advanced.layers`.

- [ ] **Step 4: Implement `ChordEditor`**

Render compact set rail and main editor. Set editor fields:

- Name text input.
- Timeout numeric input `min=1`, initialized to `50`.
- Active layers multi-checkbox list containing `base` and visual layers; empty saved list means All layers.
- Chord rows with combination label, action summary, Edit action, Delete.
- Add chord button creates `{ keys: [], action: { type: 'key', key: 'esc' } }` then starts record/manual entry.
- Show inline validation for fewer than two distinct keys and duplicate canonical combinations.

Use accessible button/input labels so Vitest can query behavior without implementation details.

- [ ] **Step 5: Integrate `Layers | Chords` in `AdvancedWorkspace`**

Keep Raw mode unchanged. In visual mode maintain local workspace mode (`layers`/`chords`). Layers renders the existing keyboard and rail exactly as before; Chords renders `ChordEditor` while retaining Preview and Raw mode toolbar actions.

- [ ] **Step 6: Run remote `studio-ci` and confirm GREEN for Task 3**

Expected frontend lint/typecheck/tests/build pass.

- [ ] **Step 7: Commit**

Commit message: `feat: add visual chord set editor`

---

### Task 4: Reuse the full action editor for chord outputs and end-to-end apply flow

**Files:**
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/features/advanced/AdvancedWorkspace.tsx`
- Modify: `studio/src/features/advanced/AdvancedInspector.tsx` only if label/title needs generic target text
- Modify/Create frontend integration tests under `studio/src/app` or `studio/src/features/advanced`

**Interfaces:**
- App tracks `selectedChord: { setIndex: number; chordIndex: number } | undefined` separately from `selectedKey`.
- Chord selection clears selected key; keyboard selection clears selected chord.
- Inspector receives selected chord action through the existing `AdvancedInspector`, with a display ID like `J + K`.
- Inspector `onChange` immutably replaces only that chord entry action then calls existing debounced `queueApply`, so persistence/runtime behavior stays identical to key mappings.

- [ ] **Step 1: Write failing integration test**

Test that selecting `J + K`, changing its action to Escape/advanced Macro through the inspector callback, and applying produces an updated profile whose chord entry contains that `ActionSpec` while ordinary `mappings.j` / `mappings.k` remain unchanged.

- [ ] **Step 2: Run remote `studio-ci` and confirm RED**

Expected failure because App cannot route chord selection/action changes yet.

- [ ] **Step 3: Implement App selection/action routing**

Derive:

```ts
const selectedChordEntry = selectedChord && profile?.source.kind === 'visual'
  ? profile.source.advanced.chordSets[selectedChord.setIndex]?.chords[selectedChord.chordIndex]
  : undefined;
```

`setAction` updates chord output when `selectedChord` is active, otherwise retains current key behavior. Pass a generic target label to `AdvancedInspector` (`J + K`) so the exact same Basic/advanced action UI is reused.

- [ ] **Step 4: Ensure validation errors block Apply**

Frontend should avoid queueing structurally invalid chord edits where possible, but backend compiler/validation remains authoritative. Surface backend `ApplyResult.validation.message` through the existing apply/error state rather than silently accepting invalid config.

- [ ] **Step 5: Run full PR CI**

Required checks from `studio-ci`:

```text
pnpm test:lines
pnpm test:rules
pnpm lint
pnpm lint:lines
pnpm typecheck
pnpm test
pnpm build
cargo fmt --all --check
cargo test -p kanata-studio --all-targets
cargo clippy -p kanata-studio --all-targets -- -D warnings
```

All Linux/Windows/macOS Rust jobs and frontend job must pass.

- [ ] **Step 6: Commit**

Commit message: `feat: wire chord actions into studio apply flow`

---

### Task 5: Final verification and cleanup

**Files:**
- Review all files changed in Tasks 1-4.
- Update spec/plan only if implementation intentionally differs; no hidden behavioral changes.

**Interfaces:** None new.

- [ ] **Step 1: Review PR diff against spec**

Confirm exact approved behaviors: 50 ms default, longest-match coexistence, physical keys, first-release, layer scope, normal fallback, duplicate blocking, complete ActionSpec reuse, profile override behavior.

- [ ] **Step 2: Confirm no placeholders or raw hacks**

Search changed code for `TODO`, temporary raw `defchordsv2` strings in React, duplicated action editors, or pseudo `Chord` ActionSpec variants. None should remain.

- [ ] **Step 3: Confirm CI is fully green on current head SHA**

Do not rely on an older green run.

- [ ] **Step 4: Commit any cleanup**

If needed: `refactor: finalize chord set support`.
