# Modal Layers, Chords, Switches, and Keyboard Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move layer/chord creation into reusable modals, standardize boolean UI on a shared switch, and make Windows keyboard Auto visualization include the navigation cluster using preserved Raw Input metadata.

**Architecture:** Keep mutation ownership in `App.tsx`/profile helpers, move focused editing UI into modal components, and make the Advanced sidebar a compact navigator. Add optional keyboard hardware metadata at the platform/domain boundary, then resolve visuals through a pure inference helper before rendering either a known preset or a generic extended geometry.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Tauri v2, Rust, Windows Raw Input (`RID_DEVICE_INFO_KEYBOARD`).

**Spec:** `docs/superpowers/specs/2026-08-19-modal-layers-chords-switches-keyboard-detection-design.md`

## Global Constraints

- Existing profile JSON/settings remain backward compatible.
- Generic/unknown keyboards must not invent Fn/media behavior.
- Manual visual preset override remains authoritative.
- All boolean UI uses one reusable Switch component.
- No persistent GitHub Actions workflow is added to `feat/add-GUI`.
- Work is isolated on `feat/modal-layers-chords-keyboard-detection` until verified.

---

### Task 1: Shared Switch control

**Files:**
- Create: `studio/src/components/Switch.tsx`
- Create: `studio/src/components/Switch.test.tsx`
- Modify: `studio/src/features/settings/GeneralSettings.tsx`
- Modify: `studio/src/features/onboarding/StartupStep.tsx`
- Modify: `studio/src/features/advanced/ChordEditor.tsx` or its replacement modal from Task 3
- Modify: `studio/src/styles/shell-polish.css`
- Delete after migration if unused: `studio/src/components/Toggle.tsx`

**Interfaces:**
- Produces: `Switch({ checked, onChange, label, disabled?, ariaLabel? })`.
- Consumers receive `(checked: boolean) => void` exactly like the old Toggle.

- [ ] **Step 1: Write failing Switch behavior tests**

```tsx
render(<Switch label="Start with system" checked={false} onChange={onChange} />);
expect(screen.getByRole('checkbox', { name: 'Start with system' })).not.toBeChecked();
await user.click(screen.getByRole('checkbox', { name: 'Start with system' }));
expect(onChange).toHaveBeenCalledWith(true);
```

Also assert disabled switches expose `disabled` and do not call `onChange`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test -- Switch.test.tsx`
Expected: FAIL because `Switch` does not exist.

- [ ] **Step 3: Implement the accessible switch primitive**

Use a native `<input type="checkbox">` as the semantic control, visually styled with `.ui-switch`, `.ui-switch-track`, and `.ui-switch-thumb`. Keep the label text in the clickable label.

- [ ] **Step 4: Migrate existing Toggle consumers and chord layer booleans**

Replace `Toggle` imports/usages and direct chord scope checkboxes with `Switch`. Remove `Toggle.tsx` when no consumer remains.

- [ ] **Step 5: Run focused + frontend tests**

Run: `pnpm test -- Switch.test.tsx GeneralSettings StartupStep ChordEditor`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add studio/src/components studio/src/features studio/src/styles/shell-polish.css
git commit -m "feat: standardize boolean controls on switches"
```

---

### Task 2: Layer creation modal

**Files:**
- Create: `studio/src/features/advanced/LayerDialog.tsx`
- Create: `studio/src/features/advanced/LayerDialog.test.tsx`
- Modify: `studio/src/features/advanced/LayerRail.tsx`
- Modify: `studio/src/features/advanced/AdvancedSidebar.tsx`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/styles/shell-polish.css`

**Interfaces:**
- Produces: `LayerDialog({ open, existingNames, onClose, onSubmit })` where `onSubmit(name: string): void`.
- `App.tsx` continues to own `addLayer(profile, name)` and active-layer selection.

- [ ] **Step 1: Write failing modal tests**

Test that clicking `+ Layer` results in an accessible dialog, Add is disabled for empty/duplicate names, and a unique trimmed name is submitted.

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm test -- LayerDialog.test.tsx`
Expected: FAIL because `LayerDialog` does not exist / sidebar still uses prompt-driven callback.

- [ ] **Step 3: Implement LayerDialog using shared Modal**

The dialog contains one name field, validation text, Cancel, and Add. Duplicate comparison is case-insensitive after trimming.

- [ ] **Step 4: Replace `window.prompt` flow in App**

Change `onAddLayer` from prompt mutation to an `addLayerOpen` state. On modal submit, call `queueApply(addLayer(profile, name))`, select the new layer, then close.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- LayerDialog.test.tsx AdvancedWorkspace App`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add studio/src/features/advanced studio/src/app/App.tsx studio/src/styles/shell-polish.css
git commit -m "feat: add layers through modal"
```

---

### Task 3: Chord-set modal workflow

**Files:**
- Create: `studio/src/features/advanced/ChordSetDialog.tsx`
- Create: `studio/src/features/advanced/ChordSetDialog.test.tsx`
- Refactor: `studio/src/features/advanced/ChordEditor.tsx`
- Modify: `studio/src/features/advanced/AdvancedSidebar.tsx`
- Modify: `studio/src/app/App.tsx`
- Modify: `studio/src/styles/shell-polish.css`

**Interfaces:**
- `ChordEditor` becomes the compact chord-set navigator and owns which set modal is open.
- `ChordSetDialog` consumes `{ set, setIndex, layers, conflicts, onChange, onDelete, onSelectAction, onClose }`.
- Existing `onSelect(setIndex, chordIndex)` remains the bridge to `KeySettingsModal` for action editing.

- [ ] **Step 1: Write failing add/edit modal tests**

Assert `Add chord set` opens a dialog prefilled with `Chord Set N`, selecting an existing set opens the same dialog with current name/timeout/layers, and layer scope renders shared Switch controls.

- [ ] **Step 2: Verify RED**

Run: `pnpm test -- ChordSetDialog.test.tsx ChordEditor.test.tsx`
Expected: FAIL because chord configuration is still inline.

- [ ] **Step 3: Extract chord-set form/recording into ChordSetDialog**

Move name, timeout, layer scope, add/remove chord, recording listeners/manual keys, validation messages, and action buttons into the modal. Preserve `MAX_CHORD_TIMEOUT_MS` and `chordConflictIds` behavior.

- [ ] **Step 4: Reduce ChordEditor to set navigation**

Render set rows and `Add chord set`; opening a row sets the modal index. Keep `onChange` immutable and close safely after deleting the active set.

- [ ] **Step 5: Verify regression behavior**

Run: `pnpm test -- ChordSetDialog.test.tsx ChordEditor.test.tsx KeySettingsModal.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add studio/src/features/advanced studio/src/app/App.tsx studio/src/styles/shell-polish.css
git commit -m "feat: edit chord sets in modal"
```

---

### Task 4: Preserve Windows keyboard metadata

**Files:**
- Modify: `studio/src-tauri/src/domain/device.rs`
- Modify: `studio/src-tauri/src/platform/devices/windows.rs`
- Modify: `studio/src-tauri/src/platform/devices/linux.rs`
- Modify: `studio/src-tauri/src/platform/devices/macos.rs`
- Modify: `studio/src/lib/types.ts`

**Interfaces:**
- Extend `KeyboardDevice` with optional/defaulted `reported_key_count`, `function_key_count`, and `keyboard_type` in Rust, serialized as camelCase.
- TypeScript receives `reportedKeyCount?`, `functionKeyCount?`, `keyboardType?`.

- [ ] **Step 1: Add failing Rust grouping/serialization tests**

Construct Windows raw keyboard rows with keyboard metadata and assert grouped `KeyboardDevice` preserves the first meaningful values. Add serde migration coverage proving old JSON without fields still deserializes.

- [ ] **Step 2: Verify RED**

Run: `cargo test -p kanata-studio platform::devices::windows domain::device`
Expected: FAIL because fields are absent.

- [ ] **Step 3: Implement metadata extraction**

Change Windows `detected_layout` into a metadata reader (or add a sibling helper) that reads `dwType`, `dwNumberOfFunctionKeys`, and `dwNumberOfKeysTotal` once. Store the values on each raw interface and carry them into grouped devices. Non-Windows constructors set them to `None`.

- [ ] **Step 4: Update TypeScript transport type**

Add optional fields to `KeyboardDevice`; no persistence schema changes are required for configured keyboards.

- [ ] **Step 5: Verify Rust tests + format**

Run: `cargo test -p kanata-studio --lib && cargo fmt --all -- --check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri studio/src/lib/types.ts
git commit -m "feat: preserve keyboard hardware metadata"
```

---

### Task 5: Metadata-aware Auto visual resolution and Generic Extended geometry

**Files:**
- Modify: `studio/src/features/keyboards/keyboardCatalog.ts`
- Modify: `studio/src/features/keyboards/keyboardCatalog.test.ts`
- Modify: `studio/src/features/keyboard/keyboardPresets.ts`
- Modify: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`
- Modify: `studio/src/features/keyboards/KeyboardManagerDialog.tsx`
- Modify: `studio/src/features/keyboards/KeyboardManagerDialog.test.tsx`

**Interfaces:**
- Add pure resolver input metadata: `reportedKeyCount?: number | null`, `functionKeyCount?: number | null`, `keyboardType?: number | null`.
- Resolution still returns `KeyboardVisualPreset | undefined`; `undefined` means Generic Extended.
- `presetKeys(undefined, layout)` returns Generic Extended geometry with no Fn legends.

- [ ] **Step 1: Write failing resolver tests**

Cover:

```ts
expect(resolveVisualPreset({ override: '65', name: 'Keyboard', layout: 'Ansi', reportedKeyCount: 104 })).toBe('65');
expect(resolveVisualPreset({ name: 'Keyboard', layout: 'Ansi', reportedKeyCount: 104 })).toBe('fullsize');
expect(resolveVisualPreset({ name: 'Keychron K8', layout: 'Ansi', reportedKeyCount: 104 })).toBe('tkl');
expect(resolveVisualPreset({ name: 'Windows keyboard', layout: 'Ansi', reportedKeyCount: 87 })).toBeUndefined();
```

This proves override > name > strong metadata > fallback.

- [ ] **Step 2: Write failing geometry test**

For `presetKeys(undefined, 'Ansi')`, assert IDs include `ins`, `home`, `pgup`, `del`, `end`, `pgdn`, `up`, `left`, `down`, `right`, and exclude `kp0`, `kp1`, `fn`; assert `fnLegends` is empty.

- [ ] **Step 3: Verify RED**

Run: `pnpm test -- keyboardCatalog.test.ts KeyboardCanvas.test.tsx`
Expected: FAIL because metadata is ignored and generic geometry lacks navigation keys.

- [ ] **Step 4: Implement inference and Generic Extended**

Preserve existing name heuristics. Add only strong standard full-size counts (`101 | 102 | 104 | 105`) as metadata inference. Change generic geometry to `[layoutBase, ...navKeys]`, deduplicating IDs if layout-specific geometry already contains any nav keys.

- [ ] **Step 5: Add and implement Keyboard Settings Auto label test**

Expected labels include `Auto (Full size · 104 keys)` for inferred full size and `Auto (Generic Extended · 87 keys)` for unresolved metadata. Keep manual options unchanged.

- [ ] **Step 6: Run focused frontend tests**

Run: `pnpm test -- keyboardCatalog.test.ts KeyboardCanvas.test.tsx KeyboardManagerDialog.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add studio/src/features/keyboards studio/src/features/keyboard
git commit -m "feat: improve automatic keyboard visualization"
```

---

### Task 6: Full verification and integration

**Files:**
- Modify: `docs/superpowers/plans/2026-08-19-modal-layers-chords-switches-keyboard-detection.md` checkboxes/status only
- Temporary verifier may exist only on the isolated branch and must be deleted before integration if local execution remains unavailable.

**Interfaces:** None.

- [ ] **Step 1: Run full frontend verification**

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm lint:lines
pnpm test:lines
pnpm test:rules
pnpm test:config
```

Expected: all PASS.

- [ ] **Step 2: Run full Rust verification**

```bash
cargo fmt --all -- --check
cargo test -p kanata-studio --lib
```

Expected: PASS.

- [ ] **Step 3: Verify no product checkbox regression**

Search `studio/src` for direct `type="checkbox"`; the only allowed occurrence is inside `components/Switch.tsx` (tests may mention it).

- [ ] **Step 4: Verify target remains workflow-free**

Ensure temporary verifier files are removed before branch integration and `.github/workflows` is absent on the final target.

- [ ] **Step 5: Review branch diff against spec**

Confirm modal flows, switch migration, navigation geometry, metadata, Fn non-invention, and backwards compatibility are all represented by tests.

- [ ] **Step 6: Fast-forward `feat/add-GUI` only after verification**

Use a fast-forward ref update so target contains exactly the verified product commit(s), with no persistent workflow.