# Kanata Studio GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current `jtroo/kanata` fork into a beginner-friendly, cross-platform Tauri + React desktop app while preserving Kanata as the keyboard engine and keeping future upstream syncs low-conflict.

**Architecture:** Add a separate `studio/` Tauri workspace member rather than extending Kanata's existing Windows-only `src/gui` feature. The Tauri process owns profiles, active-app detection, device discovery, storage, tray/autostart, action execution, updates, and supervision; one or more bundled Kanata sidecar processes own interception/remapping. Visual profiles compile to generated `.kbd`, validate through `kanata-parser`, and activate through the existing Kanata TCP protocol. Raw profiles keep `.kbd` as source of truth.

**Tech Stack:** Kanata Rust workspace at upstream commit `0a391a021247aaa1cf8784dc20ef9e53a31349ca`; Rust 2024 edition; Tauri 2; React + TypeScript + Vite; pnpm; CodeMirror 6 for raw `.kbd`; Vitest + React Testing Library; Cargo test/clippy/fmt; GitHub Actions native Windows/macOS/Linux runners.

## Global Constraints

- Base repository: `the-long-ride/kanata-gui`, fork of `jtroo/kanata`.
- Base SHA: `0a391a021247aaa1cf8784dc20ef9e53a31349ca`.
- Implementation branch: `feat/kanata-studio`; never implement on `main`.
- Keep upstream Kanata engine changes minimal. Prefer new `studio/` code and adapters over edits under `src/`, `parser/`, `keyberon/`, or `tcp_protocol/`.
- Preserve the existing upstream Windows `gui` feature and its `src/gui` implementation; do not turn it into the Tauri app.
- UI modes are exactly `Beginner` and `Advanced`.
- Beginner primary surface is visual-keyboard-first, not a 50/50 table layout.
- Beginner app mappings use profiles. Global is the base; app profiles inherit Global and override only changed keys.
- A profile can target `All keyboards` or a specific detected physical keyboard when the platform/backend can enforce that scope.
- Active application matching uses executable/process first. Advanced may additionally add a window-title condition.
- Beginner actions are limited to: Remap key, Shortcut, Type text, Launch app, Open URL, Media controls, Disable key.
- Beginner/visual changes auto-apply after validation; invalid candidates never replace the last-known-good runtime config.
- Advanced includes visual layers/tap-hold/chords/macros/sequences/mouse actions/commands/variables/device rules/window-title conditions plus a raw `.kbd` editor.
- Converting a profile to Raw Kanata mode is one-way for source-of-truth: raw `.kbd` becomes authoritative and the visual editor becomes read-only for that profile.
- Startup behavior: start with OS, tray only, remapping active immediately.
- Closing the main window hides it; it does not quit the runtime.
- App + bundled Kanata engine update as one tested application release.
- Visual style: xAI-inspired monochrome/minimal desktop tooling, but denser than normal xAI surfaces; compact typography, minimal card chrome, 1px separators, restrained radii, small controls.
- Hard physical line-count lint:
  - `studio/src/**/*.{ts,tsx}`: 250 lines max.
  - `studio/src/**/*.css`: 300 lines max.
  - `studio/src-tauri/src/**/*.rs`: 300 lines max.
  - frontend tests: 400 lines max.
  - Tauri Rust tests: 400 lines max.
  - generated/vendor/upstream Kanata files are excluded.
- No blanket line-limit exceptions for Studio production files.
- CI must build installers on native OS runners:
  - Windows x64: NSIS `.exe` + MSI.
  - macOS arm64 + x64: `.app` + `.dmg`.
  - Linux x64: `.AppImage` + `.deb`.
- Preserve existing upstream raw-binary workflows unless a conflict makes a targeted adjustment necessary.
- Use TDD for domain behavior, config compilation, profile resolution, engine supervision, platform capability logic, and user-visible interaction behavior.
- Raw `.kbd` and Advanced command execution are trusted-user features; Beginner mode must not silently expose arbitrary shell execution.
- Bind Kanata TCP control servers to loopback only.
- Store persistent app data in the Tauri application-data directory, never in the repo or current working directory.
- Every runtime profile change must be recoverable to a last-known-good config.
- Linux Wayland has no universal active-window API: Global/manual profile switching must remain functional when automatic per-app detection is unavailable. Do not fake process detection.
- Windows specific-device remapping requires the Interception backend; do not silently claim the normal LLHOOK backend can distinguish physical keyboards.
- Do not bundle the external Interception kernel driver. Detect it and guide setup when a Windows user selects a specific-device profile.
- Keep LGPL notices/obligations for Kanata intact; do not relicense upstream code.

---

## Repository Baseline and Integration Decisions

The current fork is effectively pristine upstream Kanata at the base SHA. Existing relevant seams:

- Root Cargo workspace contains the Kanata binary/library plus `parser`, `keyberon`, `tcp_protocol`, simulator crates, etc.
- Existing `src/gui` is a Windows-only native tray GUI behind the `gui` Cargo feature; it remains upstream/legacy behavior.
- `kanata-parser` publicly exposes configuration parsing and is already used by `kanata --check`.
- Kanata CLI supports `--cfg`, `--cfg-stdin`, `--check`, `--port`, `--nodelay`, `--no-wait`, and macOS permission requests.
- `kanata-tcp-protocol` supports `Hello`, layer queries, `ReloadFile { wait, timeout_ms }`, `ActOnFakeKey`, `MessagePush`, and error/reload responses.
- `push-msg` is the safe bridge for a key mapping to trigger a typed Studio action.
- Kanata device-related config is not live-reloaded; changes to engine device scope require a process restart.
- `definputdevices`/`device-history` is currently macOS-only; Windows/Linux per-device behavior therefore uses backend-specific engine topology rather than pretending one common config primitive exists.

### Target repository layout

```text
/
├─ Cargo.toml                         # add studio/src-tauri workspace member only
├─ Cargo.lock
├─ src/                               # upstream Kanata: minimal edits
├─ parser/                            # upstream Kanata: no Studio feature code
├─ keyberon/                          # upstream Kanata: untouched
├─ tcp_protocol/                      # reuse existing protocol
├─ studio/
│  ├─ package.json
│  ├─ pnpm-lock.yaml
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ tsconfig.node.json
│  ├─ eslint.config.js
│  ├─ .line-limits.json
│  ├─ scripts/
│  │  ├─ check-line-limits.mjs
│  │  ├─ check-line-limits.test.mjs
│  │  └─ prepare-kanata-sidecars.mjs
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ features/
│  │  │  ├─ onboarding/
│  │  │  ├─ profiles/
│  │  │  ├─ keyboard/
│  │  │  ├─ inspector/
│  │  │  ├─ advanced/
│  │  │  ├─ settings/
│  │  │  └─ status/
│  │  ├─ lib/
│  │  └─ styles/
│  └─ src-tauri/
│     ├─ Cargo.toml
│     ├─ build.rs
│     ├─ tauri.conf.json
│     ├─ capabilities/default.json
│     ├─ binaries/                    # generated at build time, ignored
│     └─ src/
│        ├─ main.rs
│        ├─ lib.rs
│        ├─ app_state.rs
│        ├─ commands/
│        ├─ domain/
│        ├─ storage/
│        ├─ compiler/
│        ├─ validation/
│        ├─ engine/
│        ├─ platform/
│        ├─ actions/
│        ├─ tray/
│        └─ updates/
├─ docs/superpowers/specs/
│  └─ 2026-08-16-kanata-studio-design.md
├─ docs/superpowers/plans/
│  └─ 2026-08-16-kanata-studio.md
└─ .github/workflows/
   ├─ rust.yml                         # preserve upstream checks; add Studio path awareness if needed
   ├─ studio-ci.yml
   ├─ studio-build-installers.yml
   └─ upstream-sync-check.yml
```

---

### Task 0: Establish the Feature Branch, Record the Approved Design, and Verify Baseline

**Files:**
- Create: `docs/superpowers/specs/2026-08-16-kanata-studio-design.md`
- Create: `docs/superpowers/plans/2026-08-16-kanata-studio.md`
- No production-code edits.

**Interfaces:**
- Consumes: upstream fork `main` at `0a391a021247aaa1cf8784dc20ef9e53a31349ca`.
- Produces: branch `feat/kanata-studio`, approved design record, this implementation plan.

- [ ] **Step 1: Create the feature branch from the exact base SHA**

```bash
git fetch origin main
git switch --create feat/kanata-studio 0a391a021247aaa1cf8784dc20ef9e53a31349ca
git rev-parse HEAD
```

Expected SHA:

```text
0a391a021247aaa1cf8784dc20ef9e53a31349ca
```

- [ ] **Step 2: Verify the fork has not already diverged from the intended base**

```bash
git status --short
git log -1 --oneline
```

Expected: clean worktree and HEAD `0a391a0`.

- [ ] **Step 3: Run upstream baseline formatting/tests**

```bash
cargo fmt --all --check
cargo test --all
cargo clippy --all -- -D warnings
```

Expected: all pass before Studio changes.

- [ ] **Step 4: Write the approved design spec**

The spec must capture the exact Global Constraints above plus:
- Beginner keyboard-first + right inspector.
- Advanced Visual + Raw `.kbd`.
- Global inheritance.
- process-first app matching.
- platform-aware physical-device capability.
- tray/autostart behavior.
- atomic last-known-good rollback.
- native installer matrix.
- compact xAI-inspired density.

- [ ] **Step 5: Save this plan at its canonical repo path**

Copy this document to:

```text
docs/superpowers/plans/2026-08-16-kanata-studio.md
```

- [ ] **Step 6: Commit docs only**

```bash
git add docs/superpowers/specs/2026-08-16-kanata-studio-design.md \
        docs/superpowers/plans/2026-08-16-kanata-studio.md
git commit -m "docs: plan Kanata Studio desktop UI"
```

---

### Task 1: Scaffold the Tauri + React Workspace and Hard Line-Limit Lint

**Files:**
- Modify: `Cargo.toml`
- Modify: `.gitignore`
- Create: `studio/package.json`
- Create: `studio/pnpm-lock.yaml`
- Create: `studio/index.html`
- Create: `studio/vite.config.ts`
- Create: `studio/tsconfig.json`
- Create: `studio/tsconfig.node.json`
- Create: `studio/eslint.config.js`
- Create: `studio/.line-limits.json`
- Create: `studio/scripts/check-line-limits.mjs`
- Create: `studio/scripts/check-line-limits.test.mjs`
- Create: `studio/src/main.tsx`
- Create: `studio/src/app/App.tsx`
- Create: `studio/src/styles/tokens.css`
- Create: `studio/src/styles/global.css`
- Create: `studio/src-tauri/Cargo.toml`
- Create: `studio/src-tauri/build.rs`
- Create: `studio/src-tauri/tauri.conf.json`
- Create: `studio/src-tauri/tauri.windows.conf.json`
- Create: `studio/src-tauri/tauri.macos.conf.json`
- Create: `studio/src-tauri/tauri.linux.conf.json`
- Create: `studio/src-tauri/capabilities/default.json`
- Create: `studio/src-tauri/src/main.rs`
- Create: `studio/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: root Cargo workspace.
- Produces: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm lint:lines`, and a buildable `kanata-studio` Tauri package.

- [ ] **Step 1: Write failing line-lint tests**

`studio/scripts/check-line-limits.test.mjs` must create temporary fixtures and verify:
- a 250-line `.tsx` passes;
- a 251-line `.tsx` fails;
- a 300-line `.rs` passes;
- a 301-line `.rs` fails;
- a 400-line test file passes;
- excluded `dist/`, `target/`, generated, and `binaries/` files are ignored.

Use Node's built-in `node:test` and export the checker from the implementation module.

- [ ] **Step 2: Run the test and verify RED**

```bash
cd studio
pnpm exec node --test scripts/check-line-limits.test.mjs
```

Expected: FAIL because `check-line-limits.mjs` does not exist.

- [ ] **Step 3: Implement `.line-limits.json`**

```json
{
  "rules": [
    { "glob": "src/**/*.test.{ts,tsx}", "max": 400 },
    { "glob": "src/**/*.{ts,tsx}", "max": 250 },
    { "glob": "src/**/*.css", "max": 300 },
    { "glob": "src-tauri/tests/**/*.rs", "max": 400 },
    { "glob": "src-tauri/src/**/*_test.rs", "max": 400 },
    { "glob": "src-tauri/src/**/*.rs", "max": 300 }
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "src/generated/**",
    "src-tauri/target/**",
    "src-tauri/binaries/**"
  ]
}
```

Rules are first-match-wins so test rules override production rules.

- [ ] **Step 4: Implement `check-line-limits.mjs`**

Requirements:
- physical line count includes blank/comment lines;
- CRLF and LF behave the same;
- final trailing newline does not create a phantom extra line;
- report `path: actual/max`;
- exit code 1 on any violation;
- no per-file inline disable comment.

- [ ] **Step 5: Verify line-lint GREEN**

```bash
pnpm exec node --test scripts/check-line-limits.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Scaffold React/Vite/Tauri with compact base tokens**

Frontend runtime dependencies:
- `react`, `react-dom`;
- `@tauri-apps/api`;
- Tauri JS plugins matching the Rust plugins actually exposed to the UI;
- `lucide-react` for compact line icons;
- CodeMirror packages are added only in Task 17;
- `fast-glob` is a dev dependency for the line-limit script.

Tauri Rust dependencies:
- `tauri = "2"` with tray support;
- `tauri-plugin-autostart = "2"`;
- `tauri-plugin-single-instance = "2"`;
- `tauri-plugin-updater = "2"`;
- `tauri-plugin-dialog = "2"`;
- `tauri-plugin-shell = "2"` for fixed bundled sidecars only;
- `serde`, `serde_json`, `thiserror`;
- `tokio = "1"` with `net`, `io-util`, `process`, `sync`, and `time`;
- `sha2`, `hex`, `url`, `parking_lot`, `rustc-hash`;
- path dependencies on `kanata-parser` and `kanata-tcp-protocol`.

Do not expose a general shell execution capability to the React frontend. Advanced command actions are stored as profile data and executed by Kanata only after explicit Advanced configuration.

Use React + TypeScript and Tauri 2. `tokens.css` defines at minimum:

```css
:root {
  --chrome-h: 44px;
  --control-h: 32px;
  --row-h: 34px;
  --sidebar-w: 184px;
  --inspector-w: 300px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --font-ui: 13px;
  --font-small: 12px;
  --border: 1px;
}
```

No large-card design system.

- [ ] **Step 7: Add platform-specific Tauri bundle config**

Base `tauri.conf.json` declares the normal `kanata-engine` external binary. `tauri.windows.conf.json` additionally declares `kanata-engine-interception`; macOS/Linux configs do not reference that Windows-only sidecar. Keep target-specific bundle metadata out of React code.

- [ ] **Step 8: Add Tauri crate to root workspace**

Add only:

```toml
"studio/src-tauri",
```

to `[workspace].members`. Do not restructure upstream crates.

- [ ] **Step 9: Add package scripts**

Required `studio/package.json` scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "lint:lines": "node scripts/check-line-limits.mjs",
  "typecheck": "tsc -b --pretty false",
  "tauri": "tauri"
}
```

- [ ] **Step 10: Verify scaffold**

```bash
cd studio
pnpm install
pnpm lint
pnpm lint:lines
pnpm typecheck
pnpm test
cd ..
cargo check -p kanata-studio
```

- [ ] **Step 11: Commit**

```bash
git add Cargo.toml Cargo.lock .gitignore studio
git commit -m "feat(studio): scaffold Tauri React workspace"
```

---

### Task 2: Define the Studio Domain Model and Profile Invariants

**Files:**
- Create: `studio/src-tauri/src/domain/mod.rs`
- Create: `studio/src-tauri/src/domain/profile.rs`
- Create: `studio/src-tauri/src/domain/action.rs`
- Create: `studio/src-tauri/src/domain/device.rs`
- Create: `studio/src-tauri/src/domain/settings.rs`
- Create: `studio/src-tauri/src/domain/error.rs`
- Create: `studio/src/lib/types.ts`
- Test: colocated Rust `#[cfg(test)]` modules under 400 lines each.

**Interfaces:**
- Produces:
  - `StudioProfile`
  - `ProfileSource`
  - `AppMatcher`
  - `DeviceTarget`
  - `ActionSpec`
  - `AdvancedActionSpec`
  - `KeyboardDevice`
  - `KeyboardLayout`
  - `StudioSettings`
  - `CapabilitySet`

Core Rust shape:

```rust
pub struct StudioProfile {
    pub id: String,
    pub revision: u64,
    pub name: String,
    pub enabled: bool,
    pub app_matcher: Option<AppMatcher>,
    pub device_target: DeviceTarget,
    pub source: ProfileSource,
}

pub enum ProfileSource {
    Visual { mappings: BTreeMap<String, ActionSpec>, advanced: AdvancedVisualConfig },
    Raw { kbd: String },
}

pub struct AppMatcher {
    pub executable: String,
    pub window_title_contains: Option<String>,
}

pub enum DeviceTarget {
    All,
    Device { id: String },
}
```

`ActionSpec` Beginner-safe variants:

```rust
Key { key: String }
Shortcut { modifiers: Vec<Modifier>, key: String }
Text { text: String }
LaunchApp { path: String, args: Vec<String> }
OpenUrl { url: String }
Media { action: MediaAction }
Disabled
Advanced { action: AdvancedActionSpec }
```

- [ ] **Step 1: Write failing invariant tests**

Cover:
- exactly one all-device Global profile is recognized as root;
- duplicate `(app executable, device target)` Beginner profile keys are rejected;
- `window_title_contains` is rejected for Beginner-created matchers but valid in Advanced update input;
- `ActionSpec::is_beginner_safe()` returns false only for `Advanced`;
- Raw source has no editable visual mappings.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio domain::
```

Expected: compile/test failure because model modules do not exist.

- [ ] **Step 3: Implement domain types and validation helpers**

Required helpers:

```rust
impl ActionSpec {
    pub fn is_beginner_safe(&self) -> bool;
}

impl StudioProfile {
    pub fn scope_key(&self) -> ProfileScopeKey;
    pub fn is_raw(&self) -> bool;
}

pub fn validate_profile_set(profiles: &[StudioProfile]) -> Result<(), DomainError>;
```

- [ ] **Step 4: Mirror command DTOs in TypeScript**

Keep frontend types limited to JSON DTOs. Do not duplicate backend-only engine types.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test -p kanata-studio domain::
cd studio && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/domain studio/src/lib/types.ts
git commit -m "feat(studio): add profile and action domain model"
```

---

### Task 3: Implement Versioned Atomic Storage and Recovery Snapshots

**Files:**
- Create: `studio/src-tauri/src/storage/mod.rs`
- Create: `studio/src-tauri/src/storage/paths.rs`
- Create: `studio/src-tauri/src/storage/profile_store.rs`
- Create: `studio/src-tauri/src/storage/settings_store.rs`
- Create: `studio/src-tauri/src/storage/recovery.rs`

**Interfaces:**
- Consumes: Task 2 domain.
- Produces:

```rust
pub trait ProfileRepository {
    fn load_all(&self) -> Result<Vec<StudioProfile>, StorageError>;
    fn save_all(&self, profiles: &[StudioProfile]) -> Result<(), StorageError>;
}

pub struct RecoveryStore;
impl RecoveryStore {
    pub fn write_last_known_good(&self, engine_id: &str, config: &str) -> Result<PathBuf, StorageError>;
    pub fn read_last_known_good(&self, engine_id: &str) -> Result<Option<String>, StorageError>;
}
```

Storage layout:

```text
<AppData>/kanata-studio/
├─ profiles.json
├─ settings.json
├─ profiles/<raw-profile-id>.kbd
├─ runtime/<engine-id>.kbd
├─ recovery/<engine-id>.kbd
└─ logs/
```

- [ ] **Step 1: Write failing atomicity tests**

Use a temp directory. Assert:
- first boot creates a Global visual profile;
- save writes schema version;
- interrupted temp file does not replace existing valid store;
- revision increments on accepted save;
- stale `expected_revision` is rejected;
- recovery snapshot reads exactly what was written.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio storage::
```

- [ ] **Step 3: Implement atomic write**

Pattern:

```text
serialize -> write *.tmp -> fsync file -> rename over destination
```

On Windows, handle replace semantics explicitly rather than assuming Unix rename behavior.

- [ ] **Step 4: Implement schema envelope**

```rust
struct ProfilesFile {
    schema_version: u32, // starts at 1
    profiles: Vec<StudioProfile>,
}
```

Unknown future schema versions must fail safely rather than overwrite.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test -p kanata-studio storage::
```

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/storage
git commit -m "feat(studio): add atomic profile storage and recovery"
```

---

### Task 4: Implement Profile Resolution and Inheritance

**Files:**
- Create: `studio/src-tauri/src/domain/resolver.rs`
- Test: `studio/src-tauri/src/domain/resolver.rs` tests.

**Interfaces:**
- Consumes: `StudioProfile`, active executable/title, device ID.
- Produces:

```rust
pub struct ResolutionContext<'a> {
    pub executable: Option<&'a str>,
    pub window_title: Option<&'a str>,
    pub device_id: Option<&'a str>,
    pub ui_mode: UiMode,
}

pub struct ResolvedProfile {
    pub contributing_profile_ids: Vec<String>,
    pub mappings: BTreeMap<String, ActionSpec>,
}

pub fn resolve_profile(
    profiles: &[StudioProfile],
    ctx: ResolutionContext<'_>,
) -> Result<ResolvedProfile, DomainError>;
```

Priority, highest last override:

```text
Global All
→ Global specific device
→ App All
→ App specific device
```

- [ ] **Step 1: Write failing resolver tests**

Cases:
- Global only.
- App inherits Global.
- App override replaces one key and preserves other Global keys.
- Specific-device Global overrides Global All.
- Specific-device app beats App All.
- disabled profile is ignored.
- executable match is case-insensitive on Windows only, case-sensitive elsewhere via platform normalizer.
- Advanced window-title matcher is applied only after executable match.
- no app match falls back to Global layers.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio resolver
```

- [ ] **Step 3: Implement deterministic resolver**

No hash-map iteration may determine priority; sort scopes explicitly.

- [ ] **Step 4: Verify GREEN**

```bash
cargo test -p kanata-studio resolver
```

- [ ] **Step 5: Commit**

```bash
git add studio/src-tauri/src/domain/resolver.rs
git commit -m "feat(studio): resolve inherited app and device profiles"
```

---

### Task 5: Compile Visual Profiles to Kanata `.kbd` and Validate with `kanata-parser`

**Files:**
- Create: `studio/src-tauri/src/compiler/mod.rs`
- Create: `studio/src-tauri/src/compiler/basic.rs`
- Create: `studio/src-tauri/src/compiler/advanced.rs`
- Create: `studio/src-tauri/src/compiler/escape.rs`
- Create: `studio/src-tauri/src/validation/mod.rs`
- Create: `studio/src-tauri/src/validation/kanata.rs`

**Interfaces:**
- Consumes: `ResolvedProfile`, platform info, Studio action registry.
- Produces:

```rust
pub struct CompileContext<'a> {
    pub platform: Platform,
    pub device_scope: &'a EngineDeviceScope,
}

pub struct CompiledConfig {
    pub text: String,
    pub action_bindings: BTreeMap<String, StudioExternalAction>,
    pub sha256: String,
}

pub fn compile_visual(
    profile: &ResolvedProfile,
    ctx: CompileContext<'_>,
) -> Result<CompiledConfig, CompileError>;

pub fn validate_kbd(text: &str) -> ValidationResult;
```

- [ ] **Step 1: Write failing compiler golden tests**

Required expected snippets:

Disable:

```lisp
(deflayermap (base)
  caps XX)
```

Simple remap:

```lisp
(deflayermap (base)
  caps esc)
```

Shortcut uses Kanata modifier chord syntax, e.g.:

```lisp
f8 C-S-p
```

External Studio action:

```lisp
f9 (push-msg ("kanata-studio" "action" "action-123"))
```

All generated visual configs include an empty `defsrc` and a `deflayermap` base so sparse mappings stay compact.

- [ ] **Step 2: Write failing validation tests**

Call:

```rust
kanata_parser::cfg::new_from_str(text, rustc_hash::FxHashMap::default())
```

Assert:
- generated caps→esc parses;
- malformed raw config returns structured diagnostic;
- a compile result is never considered valid solely because generation succeeded.

- [ ] **Step 3: Verify RED**

```bash
cargo test -p kanata-studio compiler::
cargo test -p kanata-studio validation::
```

- [ ] **Step 4: Implement Beginner compiler**

Direct Kanata actions:
- Remap key.
- Shortcut.
- Media keys.
- Disable.

Bridge actions via `push-msg`:
- Type text.
- Launch app.
- Open URL.

Use opaque action IDs, not user-controlled shell fragments.

- [ ] **Step 5: Implement safe string/S-expression escaping**

Reject NUL and invalid unpaired control data. Escape quotes/backslashes correctly before embedding user strings.

- [ ] **Step 6: Implement validation diagnostics DTO**

```rust
pub struct ValidationResult {
    pub ok: bool,
    pub message: Option<String>,
    pub span: Option<DiagnosticSpan>,
}
```

Preserve parser location information when available.

- [ ] **Step 7: Verify GREEN and mutation sanity**

```bash
cargo test -p kanata-studio compiler::
cargo test -p kanata-studio validation::
```

Temporarily change one golden expected action and confirm the corresponding test fails, then restore.

- [ ] **Step 8: Commit**

```bash
git add studio/src-tauri/src/compiler studio/src-tauri/src/validation
git commit -m "feat(studio): compile and validate visual Kanata profiles"
```

---

### Task 6: Add Bundled Kanata Sidecars, TCP Client, and Engine Supervisor

**Files:**
- Create: `studio/scripts/prepare-kanata-sidecars.mjs`
- Modify: `studio/src-tauri/tauri.conf.json`
- Create: `studio/src-tauri/src/engine/mod.rs`
- Create: `studio/src-tauri/src/engine/model.rs`
- Create: `studio/src-tauri/src/engine/tcp.rs`
- Create: `studio/src-tauri/src/engine/supervisor.rs`
- Create: `studio/src-tauri/src/engine/ports.rs`
- Create: `studio/src-tauri/src/engine/logs.rs`

**Interfaces:**
- Consumes: existing `kanata` binary and `kanata-tcp-protocol`.
- Produces:

```rust
pub trait EngineSupervisor {
    fn start(&self, spec: EngineSpec) -> Result<EngineHandle, EngineError>;
    fn reload(&self, id: &EngineId, config_path: &Path) -> Result<(), EngineError>;
    fn stop(&self, id: &EngineId) -> Result<(), EngineError>;
    fn restart(&self, id: &EngineId) -> Result<(), EngineError>;
    fn status(&self) -> Vec<EngineStatus>;
}
```

Kanata launch baseline:

```text
kanata-engine
  --cfg <runtime.kbd>
  --port 127.0.0.1:<allocated-port>
  --no-wait
  --nodelay
```

- [ ] **Step 1: Write failing TCP serialization/handshake tests**

Test:
- `Hello {}` → `HelloOk`.
- `ReloadFile { wait: Some(true), timeout_ms: Some(5000) }`.
- newline-delimited JSON framing.
- `MessagePush` is forwarded to the internal action dispatcher.
- server `Error` becomes `EngineError`.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio engine::tcp
```

- [ ] **Step 3: Implement TCP client using `kanata-tcp-protocol`**

Do not duplicate protocol enums.

- [ ] **Step 4: Write failing supervisor tests with a fake engine process adapter**

Assert:
- start waits for TCP `HelloOk`;
- failed startup leaves no stale handle;
- reload timeout preserves old config;
- unexpected process exit transitions to `Crashed`;
- a crash restarts at most once automatically before entering recovery state.

- [ ] **Step 5: Implement process adapter and supervisor**

Keep process spawning behind a trait so unit tests never require keyboard interception.

- [ ] **Step 6: Implement loopback port allocation with retry**

Bind `127.0.0.1:0`, capture the port, close, spawn immediately, retry on bind/connect race. Never bind `0.0.0.0`.

- [ ] **Step 7: Implement sidecar preparation**

Build targets:

Windows normal:

```bash
cargo build --release --target x86_64-pc-windows-msvc \
  --features cmd,tcp_server,winiov2,win_manifest
```

Windows Interception-capable sidecar:

```bash
cargo build --release --target x86_64-pc-windows-msvc \
  --features cmd,tcp_server,interception_driver,win_manifest
```

macOS/Linux:

```bash
cargo build --release --target <target> --features cmd,tcp_server
```

Copy with Tauri external-binary target-triple naming under `studio/src-tauri/binaries/`.

Do **not** bundle the external Interception kernel driver.

- [ ] **Step 8: Verify GREEN**

```bash
cargo test -p kanata-studio engine::
cd studio && pnpm lint:lines
```

- [ ] **Step 9: Commit**

```bash
git add studio/scripts/prepare-kanata-sidecars.mjs studio/src-tauri
git commit -m "feat(studio): supervise bundled Kanata engines"
```

---

### Task 7: Execute Safe Beginner External Actions from `push-msg`

**Files:**
- Create: `studio/src-tauri/src/actions/mod.rs`
- Create: `studio/src-tauri/src/actions/dispatcher.rs`
- Create: `studio/src-tauri/src/actions/launch.rs`
- Create: `studio/src-tauri/src/actions/type_text.rs`
- Create: `studio/src-tauri/src/actions/clipboard.rs`

**Interfaces:**
- Consumes: `ServerMessage::MessagePush`, compiled `action_bindings`.
- Produces:

```rust
pub trait ExternalActionExecutor {
    fn execute(&self, action: &StudioExternalAction) -> Result<(), ActionError>;
}
```

- [ ] **Step 1: Write failing dispatcher tests**

Reject:
- unknown action ID;
- malformed message shape;
- a message not beginning `["kanata-studio","action", ...]`.

Accept only action IDs present in the current compiled registry.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio actions::
```

- [ ] **Step 3: Implement Launch App and Open URL**

Use typed process/open APIs. Never interpolate into a shell command.

- [ ] **Step 4: Implement Type Text clipboard bridge**

Flow:
1. Save clipboard text when readable.
2. Write requested text.
3. Trigger a generated `studio-paste` Kanata fake key through TCP.
4. Restore previous clipboard after a conservative delay when restoration is safe.
5. If restore cannot be guaranteed, preserve pasted text and surface a nonfatal diagnostic instead of losing user clipboard data silently.

Generated fake-key paste chord:
- Windows/Linux: `C-v`.
- macOS: `M-v`.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test -p kanata-studio actions::
```

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/actions
git commit -m "feat(studio): bridge safe external keyboard actions"
```

---

### Task 8: Implement Platform Capability, Keyboard Discovery, Layout Detection, and Permissions

**Files:**
- Create: `studio/src-tauri/src/platform/mod.rs`
- Create: `studio/src-tauri/src/platform/capabilities.rs`
- Create: `studio/src-tauri/src/platform/devices/mod.rs`
- Create: `studio/src-tauri/src/platform/devices/windows.rs`
- Create: `studio/src-tauri/src/platform/devices/macos.rs`
- Create: `studio/src-tauri/src/platform/devices/linux.rs`
- Create: `studio/src-tauri/src/platform/layout/mod.rs`
- Create: `studio/src-tauri/src/platform/layout/windows.rs`
- Create: `studio/src-tauri/src/platform/layout/macos.rs`
- Create: `studio/src-tauri/src/platform/layout/linux.rs`
- Create: `studio/src-tauri/src/platform/permissions/mod.rs`
- Platform-specific permission modules.

**Interfaces:**
- Produces:

```rust
pub trait DeviceProvider {
    fn list_keyboards(&self) -> Result<Vec<KeyboardDevice>, PlatformError>;
}

pub trait LayoutDetector {
    fn detect(&self, device: &KeyboardDevice) -> Result<LayoutDetection, PlatformError>;
}

pub struct LayoutDetection {
    pub layout: KeyboardLayout, // Ansi | Iso | Jis | Unknown
    pub confidence: DetectionConfidence,
    pub reason: String,
}

pub struct CapabilitySet {
    pub per_app_auto_switch: bool,
    pub per_device_mapping: DeviceMappingCapability,
    pub window_title_matching: bool,
}
```

- [ ] **Step 1: Write failing capability-matrix tests**

Expected:
- Windows normal backend: device list yes, specific-device interception no.
- Windows Interception installed: specific-device yes.
- macOS: specific-device yes through Kanata device-history.
- Linux with device access: specific-device yes through dedicated filtered engines.
- Linux Wayland with no supported active-app provider: per-app auto-switch false, manual profile selection true.

- [ ] **Step 2: Implement Windows device discovery**

Use Raw Input enumeration for display/device IDs even when normal LLHOOK is active. Interception capability detection is separate.

- [ ] **Step 3: Implement macOS device discovery**

Reuse the same Karabiner device source Kanata uses. Normalize a stable Studio device ID from available hash/name/vendor/product data.

- [ ] **Step 4: Implement Linux device discovery**

Use `evdev` enumeration and stable `/dev/input/by-id` path when available; otherwise retain event path plus vendor/product/name fingerprint.

- [ ] **Step 5: Write failing ANSI/ISO/JIS detector tests**

Use platform-neutral fixture metadata:
- JIS evidence beats ISO.
- ISO extra key evidence beats ANSI.
- weak/unknown evidence returns `Unknown` rather than guessing with false confidence.
- manual override always wins.

- [ ] **Step 6: Implement best-effort detector + manual override**

Never block profile use when detection is unknown; use user-selected layout.

- [ ] **Step 7: Implement permission status**

Windows:
- normal backend ready state;
- Interception driver installed/not-installed capability.

macOS:
- Accessibility status;
- Karabiner virtual HID presence.

Linux:
- readable input devices;
- writable `/dev/uinput`.

- [ ] **Step 8: Verify**

```bash
cargo test -p kanata-studio platform::
cargo clippy -p kanata-studio -- -D warnings
```

- [ ] **Step 9: Commit**

```bash
git add studio/src-tauri/src/platform
git commit -m "feat(studio): discover keyboard and platform capabilities"
```

---

### Task 9: Implement Active-App Detection and Automatic Profile Switching

**Files:**
- Create: `studio/src-tauri/src/platform/active_app/mod.rs`
- Create: `studio/src-tauri/src/platform/active_app/windows.rs`
- Create: `studio/src-tauri/src/platform/active_app/macos.rs`
- Create: `studio/src-tauri/src/platform/active_app/linux_x11.rs`
- Create: `studio/src-tauri/src/platform/active_app/unavailable.rs`
- Create: `studio/src-tauri/src/engine/switcher.rs`

**Interfaces:**
- Produces:

```rust
pub struct ActiveApp {
    pub executable: String,
    pub window_title: Option<String>,
}

pub trait ActiveAppProvider: Send + Sync {
    fn current(&self) -> Result<ActiveApp, PlatformError>;
}

pub struct ProfileSwitcher;
impl ProfileSwitcher {
    pub fn on_context_change(&mut self, app: ActiveApp, devices: &[KeyboardDevice]) -> Result<(), EngineError>;
}
```

- [ ] **Step 1: Write failing switcher tests**

Assert:
- unchanged effective mapping hash does not reload;
- executable change that resolves to a new profile does reload;
- title change is ignored unless an Advanced title matcher exists;
- unavailable provider leaves manual/Global profile active;
- rapid app changes coalesce and do not create reload storms.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio switcher
```

- [ ] **Step 3: Implement Windows provider**

Use foreground window → PID → full process image name. Normalize executable basename for profile matching while retaining full path as metadata.

- [ ] **Step 4: Implement macOS provider**

Use the frontmost running application for executable/bundle identity. Add window-title lookup only when Advanced title matching is actually needed.

- [ ] **Step 5: Implement Linux X11 provider**

Read `_NET_ACTIVE_WINDOW` and `_NET_WM_PID`; resolve `/proc/<pid>/exe`.

For Wayland without a supported provider, instantiate `UnavailableActiveAppProvider`; never scrape random compositor internals.

- [ ] **Step 6: Poll/event cadence**

Use event APIs where practical; otherwise 150–250 ms foreground polling is acceptable. Only resolution-hash changes can trigger engine work.

- [ ] **Step 7: Verify GREEN**

```bash
cargo test -p kanata-studio switcher
```

- [ ] **Step 8: Commit**

```bash
git add studio/src-tauri/src/platform/active_app studio/src-tauri/src/engine/switcher.rs
git commit -m "feat(studio): switch profiles with the focused application"
```

---

### Task 10: Implement Per-Device Engine Topology Without False Cross-Platform Assumptions

**Files:**
- Create: `studio/src-tauri/src/engine/topology.rs`
- Create: `studio/src-tauri/src/compiler/device_scope.rs`
- Modify: `studio/src-tauri/src/engine/supervisor.rs`
- Modify: `studio/src-tauri/src/compiler/mod.rs`

**Interfaces:**
- Produces:

```rust
pub enum EngineBackend {
    Standard,
    WindowsInterception,
}

pub enum EngineDeviceScope {
    All,
    IncludeDevice(KeyboardDevice),
    ExcludeDevices(Vec<KeyboardDevice>),
    MacDeviceAware(Vec<KeyboardDevice>),
}

pub fn plan_engine_topology(
    profiles: &[StudioProfile],
    devices: &[KeyboardDevice],
    capabilities: &CapabilitySet,
) -> Result<EngineTopology, CapabilityError>;
```

- [ ] **Step 1: Write failing topology tests**

Windows:
- no specific profiles → one Standard engine.
- specific profile + Interception unavailable → explicit capability error; never silently apply to all keyboards.
- specific profile + Interception available → one filtered engine per specifically targeted device plus a fallback engine excluding targeted devices.

Linux:
- specific profiles → filtered engine per targeted device plus fallback excluding those exact devices.

macOS:
- one device-aware engine using `definputdevices`/`device-history`, not multiple conflicting grabs.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio topology
```

- [ ] **Step 3: Implement platform-specific generated device scopes**

Important: device config is process-start state. A change to the target-device set marks topology `RequiresRestart`; app/profile mapping changes with unchanged scope remain `ReloadOnly`.

- [ ] **Step 4: Implement Windows guided capability failure**

Backend must return a typed error:

```rust
CapabilityError::WindowsInterceptionRequired
```

Frontend will show a setup action rather than a generic engine error.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test -p kanata-studio topology
```

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/engine/topology.rs \
        studio/src-tauri/src/compiler/device_scope.rs \
        studio/src-tauri/src/engine/supervisor.rs \
        studio/src-tauri/src/compiler/mod.rs
git commit -m "feat(studio): support platform-aware per-device mappings"
```

---

### Task 11: Expose a Narrow Tauri Command API and Bootstrap State

**Files:**
- Create: `studio/src-tauri/src/app_state.rs`
- Create: `studio/src-tauri/src/commands/mod.rs`
- Create: `studio/src-tauri/src/commands/bootstrap.rs`
- Create: `studio/src-tauri/src/commands/profiles.rs`
- Create: `studio/src-tauri/src/commands/devices.rs`
- Create: `studio/src-tauri/src/commands/engine.rs`
- Create: `studio/src-tauri/src/commands/settings.rs`
- Create: `studio/src/lib/tauri.ts`

**Interfaces:**
Frontend wrappers:

```ts
getBootstrapState(): Promise<BootstrapState>
createProfile(input: CreateProfileInput): Promise<StudioProfile>
updateProfile(input: UpdateProfileInput): Promise<ApplyResult>
deleteProfile(id: string): Promise<void>
validateRawProfile(input: ValidateRawInput): Promise<ValidationResult>
setRawProfileText(input: SaveRawInput): Promise<ApplyResult>
listKeyboards(): Promise<KeyboardDevice[]>
setRemappingEnabled(enabled: boolean): Promise<EngineStatus[]>
restartEngines(): Promise<EngineStatus[]>
updateSettings(input: UpdateSettingsInput): Promise<StudioSettings>
```

- [ ] **Step 1: Write failing command/service tests**

Commands should be thin. Test service behavior underneath:
- stale revision rejected;
- valid visual update saves, compiles, validates, activates, then updates recovery;
- invalid visual update does not persist candidate as current;
- delete active profile resolves and activates fallback safely.

- [ ] **Step 2: Implement `AppState`**

Hold:
- repositories;
- engine supervisor;
- current profiles/settings;
- capabilities/devices;
- current active app;
- remapping enabled state.

Use locks only at service boundaries; never hold a write lock while waiting for engine network/process I/O.

- [ ] **Step 3: Implement transactional apply sequence**

```text
candidate
→ domain validate
→ resolve
→ compile
→ parser validate
→ write candidate runtime file
→ engine reload/restart
→ persist profile revision
→ write last-known-good
→ emit UI state event
```

If any step before persistence fails, current persisted profile/runtime stays unchanged.

- [ ] **Step 4: Verify**

```bash
cargo test -p kanata-studio commands::
cargo clippy -p kanata-studio -- -D warnings
```

- [ ] **Step 5: Commit**

```bash
git add studio/src-tauri/src/app_state.rs studio/src-tauri/src/commands studio/src/lib/tauri.ts
git commit -m "feat(studio): expose transactional Tauri command API"
```

---

### Task 12: Build the Compact App Shell, Design Tokens, and Shared UI Primitives

**Files:**
- Create: `studio/src/app/AppShell.tsx`
- Create: `studio/src/app/ModeSwitch.tsx`
- Create: `studio/src/components/Button.tsx`
- Create: `studio/src/components/IconButton.tsx`
- Create: `studio/src/components/Select.tsx`
- Create: `studio/src/components/Toggle.tsx`
- Create: `studio/src/components/StatusDot.tsx`
- Create: `studio/src/components/Tooltip.tsx`
- Create: `studio/src/styles/tokens.css`
- Create: `studio/src/styles/shell.css`
- Create: `studio/src/app/AppShell.test.tsx`

**Interfaces:**
- Consumes: bootstrap status.
- Produces: common chrome for Beginner/Advanced.

Target geometry:
- Header: 44px.
- Sidebar rows: 34px.
- Controls: 30–32px.
- Profile rail: ~184px.
- Inspector: 300px.
- 4/8/12px spacing scale.
- 4–6px radii.
- No giant cards.

- [ ] **Step 1: Write failing shell interaction tests**

Assert:
- mode labels are exactly `Beginner` and `Advanced`;
- remapping status is visible;
- switching mode changes surface without changing profile;
- keyboard navigation/focus is usable;
- no accidental `I am keyboard wizard` copy remains.

- [ ] **Step 2: Verify RED**

```bash
cd studio
pnpm vitest run src/app/AppShell.test.tsx
```

- [ ] **Step 3: Implement compact shell**

Use semantic buttons, visible focus, no icon-only action without tooltip/accessible name.

- [ ] **Step 4: Verify GREEN + lint**

```bash
pnpm test
pnpm lint
pnpm lint:lines
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add studio/src/app studio/src/components studio/src/styles
git commit -m "feat(studio): add compact desktop app shell"
```

---

### Task 13: Implement Three-Step Onboarding

**Files:**
- Create: `studio/src/features/onboarding/Onboarding.tsx`
- Create: `studio/src/features/onboarding/DeviceStep.tsx`
- Create: `studio/src/features/onboarding/StartupStep.tsx`
- Create: `studio/src/features/onboarding/ProfileStep.tsx`
- Create: `studio/src/features/onboarding/Onboarding.test.tsx`

**Interfaces:**
- Step 1: detect keyboards/layout/permissions.
- Step 2: confirm start-with-OS + tray-only defaults.
- Step 3: create first app profile or finish with Global only.

- [ ] **Step 1: Write failing onboarding tests**

Cover:
- first run opens Step 1;
- detected keyboard/layout shown with manual override;
- missing macOS/Linux permission shows actionable state;
- Windows specific-device selection explains Interception requirement when unavailable;
- completion stores `onboarding_completed = true`.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run src/features/onboarding/Onboarding.test.tsx
```

- [ ] **Step 3: Implement**

Keep each step under 250 lines. No modal carousel; use one compact centered setup panel.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test
pnpm lint:lines
```

- [ ] **Step 5: Commit**

```bash
git add studio/src/features/onboarding
git commit -m "feat(studio): add three-step keyboard onboarding"
```

---

### Task 14: Implement Beginner Profile Rail and Visual Keyboard

**Files:**
- Create: `studio/src/features/profiles/ProfileRail.tsx`
- Create: `studio/src/features/profiles/ProfileRow.tsx`
- Create: `studio/src/features/profiles/CreateProfileDialog.tsx`
- Create: `studio/src/features/keyboard/KeyboardCanvas.tsx`
- Create: `studio/src/features/keyboard/KeyboardKey.tsx`
- Create: `studio/src/features/keyboard/layouts/ansi.ts`
- Create: `studio/src/features/keyboard/layouts/iso.ts`
- Create: `studio/src/features/keyboard/layouts/jis.ts`
- Create: `studio/src/features/keyboard/KeyboardCanvas.test.tsx`

**Interfaces:**
- Consumes: profiles, selected profile, detected/manual layout.
- Produces: selected physical key.

- [ ] **Step 1: Write failing profile/keyboard tests**

Assert:
- Global always appears first and cannot be deleted;
- app profile shows executable identity;
- specific-device profile shows compact device chip;
- inherited mapping key has a distinct inherited state;
- direct override has selected/modified state;
- clicking a key selects it and opens the inspector;
- keyboard layout switch swaps ANSI/ISO/JIS geometry without losing mappings.

- [ ] **Step 2: Verify RED**

```bash
pnpm vitest run src/features/keyboard/KeyboardCanvas.test.tsx
```

- [ ] **Step 3: Implement keyboard geometry as data**

Each key descriptor:

```ts
type KeyGeometry = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};
```

Do not hardcode hundreds of JSX nodes.

- [ ] **Step 4: Implement inherited/override visual states**

Do not use color alone; include subtle corner marker/tooltip `Inherited from Global`.

- [ ] **Step 5: Verify**

```bash
pnpm test
pnpm lint
pnpm lint:lines
```

- [ ] **Step 6: Commit**

```bash
git add studio/src/features/profiles studio/src/features/keyboard
git commit -m "feat(studio): add app profiles and visual keyboard"
```

---

### Task 15: Implement the Beginner Right-Side Action Inspector and Auto-Apply/Undo

**Files:**
- Create: `studio/src/features/inspector/KeyInspector.tsx`
- Create: `studio/src/features/inspector/ActionPicker.tsx`
- Create: `studio/src/features/inspector/editors/RemapEditor.tsx`
- Create: `studio/src/features/inspector/editors/ShortcutEditor.tsx`
- Create: `studio/src/features/inspector/editors/TextEditor.tsx`
- Create: `studio/src/features/inspector/editors/LaunchAppEditor.tsx`
- Create: `studio/src/features/inspector/editors/OpenUrlEditor.tsx`
- Create: `studio/src/features/inspector/editors/MediaEditor.tsx`
- Create: `studio/src/features/inspector/useAutoApply.ts`
- Create: `studio/src/features/inspector/useUndoStack.ts`
- Test: inspector and hooks.

**Interfaces:**
- Beginner action list exactly:
  - Remap key
  - Shortcut
  - Type text
  - Launch app
  - Open URL
  - Media controls
  - Disable key

- [ ] **Step 1: Write failing action-picker test**

Assert no Command/Script/Macro/Mouse/Layer controls appear in Beginner.

- [ ] **Step 2: Write failing auto-apply tests**

Behavior:
- valid change → optimistic local state → backend apply → `Applied`.
- invalid change → backend error → revert local candidate → status `Error`, runtime unaffected.
- no network/backend call when value is unchanged.
- undo replays the previous valid profile revision.
- cap in-memory undo history at 50 snapshots.

- [ ] **Step 3: Verify RED**

```bash
pnpm vitest run src/features/inspector
```

- [ ] **Step 4: Implement inspector**

Right panel fixed at `--inspector-w`, scroll internally, main keyboard canvas does not shift horizontally due field errors.

- [ ] **Step 5: Implement auto-apply**

For simple controls apply immediately; for text/path fields debounce 250 ms. Backend remains authoritative.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm test
pnpm lint
pnpm lint:lines
pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
git add studio/src/features/inspector
git commit -m "feat(studio): add beginner action inspector and auto-apply"
```

---

### Task 16: Implement Advanced Visual Actions and Layers

**Files:**
- Create: `studio/src/features/advanced/AdvancedVisual.tsx`
- Create: `studio/src/features/advanced/LayerRail.tsx`
- Create: `studio/src/features/advanced/AdvancedActionPicker.tsx`
- Create: focused editors under `studio/src/features/advanced/editors/`
- Modify: `studio/src-tauri/src/domain/action.rs`
- Modify: `studio/src-tauri/src/compiler/advanced.rs`

**Interfaces:**
Advanced visual scope for v1:
- layers;
- layer momentary/switch;
- tap-hold;
- chords;
- macros;
- sequences;
- multi action;
- mouse buttons/move/scroll;
- command/script argv;
- variables/aliases represented by structured reusable actions;
- device rules;
- Advanced window-title profile condition.

Raw mode is the escape hatch for Kanata syntax outside this visual subset.

- [ ] **Step 1: Write failing Rust compile tests for each Advanced action family**

Each action must compile to a valid Kanata config and pass `kanata_parser::cfg::new_from_str`.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio compiler::advanced
```

- [ ] **Step 3: Implement the minimal recursive Advanced AST**

Prevent unbounded visual recursion. Enforce a reasonable nesting depth in visual mode and direct users to Raw mode for pathological configs.

- [ ] **Step 4: Write failing Advanced UI tests**

Assert:
- layers can be created/renamed/deleted;
- deleting a referenced layer is blocked with explanation;
- Beginner-safe mappings remain editable;
- an Advanced key shown in Beginner has `Advanced action` read-only summary and a button to switch to Advanced.

- [ ] **Step 5: Implement Advanced UI**

Keep each editor isolated and under line limits.

- [ ] **Step 6: Verify**

```bash
cargo test -p kanata-studio compiler::advanced
cd studio
pnpm test
pnpm lint:lines
```

- [ ] **Step 7: Commit**

```bash
git add studio/src/features/advanced \
        studio/src-tauri/src/domain/action.rs \
        studio/src-tauri/src/compiler/advanced.rs
git commit -m "feat(studio): add advanced visual Kanata editor"
```

---

### Task 17: Implement Raw `.kbd` Mode with CodeMirror, Live Validation, and One-Way Conversion

**Files:**
- Create: `studio/src/features/advanced/RawEditor.tsx`
- Create: `studio/src/features/advanced/KanataLanguage.ts`
- Create: `studio/src/features/advanced/KanataCompletions.ts`
- Create: `studio/src/features/advanced/DiagnosticsPanel.tsx`
- Create: `studio/src/features/advanced/ConvertToRawDialog.tsx`
- Create: `studio/src/features/advanced/RawEditor.test.tsx`
- Create: `studio/src-tauri/src/commands/raw.rs`

**Interfaces:**
- Visual → Raw conversion:
  1. compile current visual config;
  2. validate;
  3. backup visual profile;
  4. replace `ProfileSource::Visual` with `ProfileSource::Raw`;
  5. Raw text becomes source of truth.

No automatic Raw → Visual conversion.

- [ ] **Step 1: Write failing conversion tests**

Assert:
- conversion output equals generated current `.kbd`;
- backup is created;
- visual editor becomes read-only;
- conversion failure leaves source Visual.

- [ ] **Step 2: Write failing raw editor tests**

Assert:
- 350 ms debounce validation;
- invalid current text never reloads engine;
- previous valid runtime stays active while editor shows errors;
- next valid text auto-applies;
- diagnostics jump to line/column when parser span exists.

- [ ] **Step 3: Verify RED**

```bash
cargo test -p kanata-studio raw
cd studio && pnpm vitest run src/features/advanced/RawEditor.test.tsx
```

- [ ] **Step 4: Implement CodeMirror syntax support**

Highlight:
- parentheses;
- comments;
- section keywords (`defcfg`, `defsrc`, `deflayer`, `deflayermap`, `defalias`, `defvar`, etc.);
- actions;
- strings/numbers.

Autocomplete from a maintained list sourced from current Kanata docs/parser names. Completion is advisory; parser validation is authoritative.

- [ ] **Step 5: Add Raw import/export**

Import `.kbd`:
- validate first;
- create a new Raw profile;
- never try to reverse-engineer it into visual mode.

Export:
- Visual profile → generated `.kbd`.
- Raw profile → exact raw text.

- [ ] **Step 6: Verify GREEN**

```bash
cargo test -p kanata-studio raw
cd studio
pnpm test
pnpm lint
pnpm lint:lines
```

- [ ] **Step 7: Commit**

```bash
git add studio/src/features/advanced studio/src-tauri/src/commands/raw.rs
git commit -m "feat(studio): add validated raw Kanata mode"
```

---

### Task 18: Implement Tray, Start-with-OS, Background Startup, and Single Instance

**Files:**
- Create: `studio/src-tauri/src/tray/mod.rs`
- Create: `studio/src-tauri/src/tray/menu.rs`
- Create: `studio/src-tauri/src/tray/events.rs`
- Create: `studio/src-tauri/src/startup.rs`
- Modify: `studio/src-tauri/src/lib.rs`
- Modify: `studio/src-tauri/Cargo.toml`

**Interfaces:**
Tray menu:

```text
Kanata Studio ●
──────────────
✓ Remapping enabled
Profile: <active>
Keyboard: <active/all>
──────────────
Open Studio
Pause remapping
Restart engine
──────────────
Start with system ✓
Quit
```

- [ ] **Step 1: Write failing tray-state tests**

Build menu model as pure data and test:
- active/paused/crashed status;
- current profile label;
- pause/resume label;
- start-with-system checked state.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio tray::
```

- [ ] **Step 3: Implement tray events**

- Open → show/focus window.
- Pause → stop engine topology.
- Resume → start last-known-good topology.
- Restart → restart engines.
- Quit → stop engines → exit.

- [ ] **Step 4: Intercept window close**

Prevent close and hide main window. Explicit Quit is the exit path.

- [ ] **Step 5: Add autostart**

Autostart launches with a background flag. On autostart:
- do not show main window;
- load last-known-good config;
- start engine;
- show tray.

- [ ] **Step 6: Add single-instance behavior**

Second manual launch raises existing main window instead of spawning a second engine set.

- [ ] **Step 7: Verify**

```bash
cargo test -p kanata-studio tray::
cargo clippy -p kanata-studio -- -D warnings
```

- [ ] **Step 8: Commit**

```bash
git add studio/src-tauri/src/tray studio/src-tauri/src/startup.rs \
        studio/src-tauri/src/lib.rs studio/src-tauri/Cargo.toml
git commit -m "feat(studio): run remapping from tray and autostart"
```

---

### Task 19: Implement Crash Recovery and Last-Known-Good Runtime Semantics

**Files:**
- Create: `studio/src-tauri/src/engine/recovery.rs`
- Modify: `studio/src-tauri/src/engine/supervisor.rs`
- Modify: `studio/src-tauri/src/app_state.rs`
- Create: `studio/src/features/status/RecoveryBanner.tsx`

**Interfaces:**
Recovery state:

```rust
pub enum RuntimeHealth {
    Running,
    Paused,
    Recovering,
    RecoveryRequired { message: String },
}
```

- [ ] **Step 1: Write failing recovery tests**

Cases:
- malformed candidate → no runtime mutation.
- engine reload fails → old engine config remains active when possible.
- engine exits unexpectedly → restart once using last-known-good.
- second failure → stop restart loop and enter `RecoveryRequired`.
- user can disable remapping from recovery state.

- [ ] **Step 2: Verify RED**

```bash
cargo test -p kanata-studio recovery
```

- [ ] **Step 3: Implement bounded restart**

No infinite restart loop.

- [ ] **Step 4: Implement UI recovery banner**

Actions:
- Restart engine.
- Restore last-known-good.
- Disable remapping.
- Open logs.

- [ ] **Step 5: Verify GREEN**

```bash
cargo test -p kanata-studio recovery
cd studio && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add studio/src-tauri/src/engine/recovery.rs \
        studio/src-tauri/src/engine/supervisor.rs \
        studio/src-tauri/src/app_state.rs \
        studio/src/features/status/RecoveryBanner.tsx
git commit -m "feat(studio): recover from invalid configs and engine crashes"
```

---

### Task 20: Implement Settings, Platform Setup Guidance, Logs, and Unified Updates

**Files:**
- Create: `studio/src/features/settings/SettingsView.tsx`
- Create: `studio/src/features/settings/GeneralSettings.tsx`
- Create: `studio/src/features/settings/KeyboardSettings.tsx`
- Create: `studio/src/features/settings/UpdatesSettings.tsx`
- Create: `studio/src-tauri/src/updates/mod.rs`
- Create: `studio/src-tauri/src/updates/version.rs`
- Create: `studio/src-tauri/src/commands/logs.rs`

**Interfaces:**
Settings include:
- Start with system.
- Manual ANSI/ISO/JIS override per device.
- Windows Interception capability/setup state.
- macOS permission/driver state.
- Linux input/uinput permission state.
- Check for update.
- Open logs folder.
- About: Studio version + bundled Kanata base SHA/version.

- [ ] **Step 1: Write failing settings tests**

Verify capability-specific rows are shown only on relevant platforms.

- [ ] **Step 2: Implement unified version metadata**

Build-time metadata includes:

```text
Studio version
Kanata package version
Kanata upstream SHA
```

- [ ] **Step 3: Implement updater integration**

App and sidecars update together as the Tauri bundle. Never independently replace the Kanata sidecar in-place.

- [ ] **Step 4: Verify**

```bash
cd studio
pnpm test
pnpm lint:lines
cd ..
cargo test -p kanata-studio
```

- [ ] **Step 5: Commit**

```bash
git add studio/src/features/settings studio/src-tauri/src/updates studio/src-tauri/src/commands/logs.rs
git commit -m "feat(studio): add setup settings logs and unified updates"
```

---

### Task 21: Add Studio CI and Enforce File-Size Rules on Every PR

**Files:**
- Create: `.github/workflows/studio-ci.yml`
- Modify: `.github/workflows/rust.yml` only if necessary to avoid duplicate/unintentional Studio feature matrices.

**Interfaces:**
`studio-ci.yml` runs when paths under `studio/**`, relevant Cargo files, Kanata parser/protocol interfaces, or the workflow change.

- [ ] **Step 1: Add frontend job**

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm lint:lines
pnpm typecheck
pnpm test
pnpm build
```

- [ ] **Step 2: Add Tauri Rust job on all three OS families**

At minimum:

```text
cargo fmt --all --check
cargo test -p kanata-studio
cargo clippy -p kanata-studio -- -D warnings
```

- [ ] **Step 3: Keep upstream Kanata regression checks**

Do not delete `rust.yml` coverage for no-features/default/cmd/gui/simulated configurations.

- [ ] **Step 4: Add explicit line-limit CI failure evidence**

The line-lint unit tests run before `lint:lines` itself.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/studio-ci.yml .github/workflows/rust.yml
git commit -m "ci(studio): enforce frontend Rust and line-limit checks"
```

---

### Task 22: Add Native Cross-OS Installer Builds and Release Artifacts

**Files:**
- Create: `.github/workflows/studio-build-installers.yml`
- Modify: `studio/src-tauri/tauri.conf.json`
- Add app icons under `studio/src-tauri/icons/`.

**Interfaces:**
Build matrix:
- `windows-latest` → `x86_64-pc-windows-msvc`
- `macos-latest` → `aarch64-apple-darwin`
- `macos-15-intel` → `x86_64-apple-darwin`
- `ubuntu-latest` → `x86_64-unknown-linux-gnu`

- [ ] **Step 1: Build/copy Kanata sidecar before Tauri bundle**

Use Task 6 script. Fail if expected sidecar is missing.

- [ ] **Step 2: Windows bundles**

Build:
- NSIS `.exe`
- MSI

Bundle both normal and Interception-capable Kanata engine binaries, but not the Interception driver.

- [ ] **Step 3: macOS bundles**

Build:
- `.app`
- `.dmg`

Run separately on Apple Silicon and Intel runners.

- [ ] **Step 4: Linux dependencies and bundles**

Install Tauri WebKit/AppIndicator build dependencies, then build:
- `.AppImage`
- `.deb`

- [ ] **Step 5: Artifact smoke check**

Each job has a shell step that asserts expected installer files exist before upload.

- [ ] **Step 6: Release/updater path**

On `studio-v*` tags:
- upload installers;
- generate Tauri updater artifacts;
- sign updater when signing secrets are present;
- do not fail normal PR installer builds because production signing secrets are absent.

- [ ] **Step 7: Preserve existing raw Kanata binary workflows**

Do not replace `.github/workflows/windows-build.yml`, `macos-build.yml`, or `linux-build.yml` with Studio installer jobs.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/studio-build-installers.yml studio/src-tauri
git commit -m "ci(studio): build native desktop installers"
```

---

### Task 23: Add Upstream Kanata Sync Guardrails

**Files:**
- Create: `.github/workflows/upstream-sync-check.yml`
- Create: `docs/UPSTREAM_SYNC.md`

**Interfaces:**
- Upstream remote: `jtroo/kanata`.
- Studio code stays primarily under `studio/`.
- Sync workflow never auto-merges to `main`.

- [ ] **Step 1: Document manual sync**

```bash
git remote add upstream https://github.com/jtroo/kanata.git
git fetch upstream main
git switch main
git merge --ff-only upstream/main
```

If fork Studio commits make fast-forward impossible, use a dedicated sync branch and merge upstream there; do not rebase published main history.

- [ ] **Step 2: Add scheduled/dispatch check**

Workflow:
1. fetch upstream main;
2. report upstream SHA and fork main SHA;
3. if behind/diverged, create a check summary;
4. optional manual dispatch creates `chore/sync-kanata-<sha>` and PR;
5. run upstream Rust CI + Studio CI on that PR.

- [ ] **Step 3: Add protected-path guidance**

Upstream merge conflicts under `src/gui`, parser, TCP protocol, or root Cargo should be resolved by preserving upstream behavior first and adapting Studio adapters second.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/upstream-sync-check.yml docs/UPSTREAM_SYNC.md
git commit -m "ci: guard future Kanata upstream syncs"
```

---

### Task 24: End-to-End Functional and Visual QA

**Files:**
- Create: `studio/tests/e2e/` browser/Tauri-compatible tests where practical.
- Create: `docs/STUDIO_TEST_MATRIX.md`
- Update: `studio/README.md`
- Update: root `README.md` with a small Studio section without replacing upstream Kanata documentation.

**Interfaces:**
Release candidate must satisfy the matrix below.

- [ ] **Step 1: Windows x64 functional test**

Verify:
- first-run onboarding;
- Global mapping;
- VS Code/Chrome-style process profile switching;
- tray hide/show;
- autostart background path;
- normal all-keyboard backend;
- Interception-required message for specific-device scope when driver absent;
- installer install/uninstall.

- [ ] **Step 2: macOS arm64/x64 functional test**

Verify:
- Accessibility guidance;
- virtual HID driver detection;
- app switching;
- specific-device mapping through macOS-supported device-aware config;
- tray/autostart;
- DMG app install.

- [ ] **Step 3: Linux x64 functional test**

Verify:
- input/uinput status;
- X11 app switching;
- Wayland fallback to Global/manual profile when provider unavailable;
- specific-device filtered topology;
- AppImage and `.deb`.

- [ ] **Step 4: Beginner UX acceptance**

A new user must be able to:
1. install;
2. finish 3-step onboarding;
3. click Caps Lock;
4. choose Remap → Escape;
5. see `Applied`;
6. close window;
7. retain working mapping from tray;

without seeing or writing `.kbd`.

- [ ] **Step 5: Advanced acceptance**

Verify:
- add layer;
- add tap-hold;
- add macro;
- switch to raw;
- edit invalid syntax → runtime unchanged + diagnostic;
- fix syntax → auto-apply;
- import/export native `.kbd`.

- [ ] **Step 6: Visual fidelity review**

Compare the built app to the approved compact mock/design:
- header density;
- profile rail width;
- keyboard canvas prominence;
- right inspector;
- monochrome palette;
- 30–32px controls;
- no giant cards;
- no unexpected scrollbars;
- no clipped keyboard keys;
- Advanced raw editor readable at laptop sizes.

Check at:
- 1280×720;
- 1440×900;
- 1920×1080.

- [ ] **Step 7: Full verification commands**

```bash
cargo fmt --all --check
cargo test --all
cargo clippy --all -- -D warnings

cd studio
pnpm install --frozen-lockfile
pnpm exec node --test scripts/check-line-limits.test.mjs
pnpm lint
pnpm lint:lines
pnpm typecheck
pnpm test
pnpm build
```

Then run `studio-build-installers.yml` and require all native jobs green.

- [ ] **Step 8: Final line-count audit**

No Studio production file may exceed its hard limit. Split by responsibility rather than adding exclusions.

- [ ] **Step 9: Update documentation**

`studio/README.md` includes:
- install/start;
- Beginner quick start;
- Advanced mode;
- Windows per-device Interception caveat;
- macOS permissions/driver;
- Linux permissions and Wayland app-detection limitation;
- recovery/log location;
- upstream Kanata version/SHA policy.

- [ ] **Step 10: Commit final QA/docs**

```bash
git add studio/tests docs/STUDIO_TEST_MATRIX.md studio/README.md README.md
git commit -m "docs(studio): add desktop usage and release test matrix"
```

---

## Required Commit Sequence

Keep commits independently reviewable in this order:

```text
docs: plan Kanata Studio desktop UI
feat(studio): scaffold Tauri React workspace
feat(studio): add profile and action domain model
feat(studio): add atomic profile storage and recovery
feat(studio): resolve inherited app and device profiles
feat(studio): compile and validate visual Kanata profiles
feat(studio): supervise bundled Kanata engines
feat(studio): bridge safe external keyboard actions
feat(studio): discover keyboard and platform capabilities
feat(studio): switch profiles with the focused application
feat(studio): support platform-aware per-device mappings
feat(studio): expose transactional Tauri command API
feat(studio): add compact desktop app shell
feat(studio): add three-step keyboard onboarding
feat(studio): add app profiles and visual keyboard
feat(studio): add beginner action inspector and auto-apply
feat(studio): add advanced visual Kanata editor
feat(studio): add validated raw Kanata mode
feat(studio): run remapping from tray and autostart
feat(studio): recover from invalid configs and engine crashes
feat(studio): add setup settings logs and unified updates
ci(studio): enforce frontend Rust and line-limit checks
ci(studio): build native desktop installers
ci: guard future Kanata upstream syncs
docs(studio): add desktop usage and release test matrix
```

## Definition of Done

The feature is not complete until all are true:

- `feat/kanata-studio` exists from base SHA `0a391a0`.
- Upstream Kanata CLI/library tests remain green.
- Beginner user can create app profiles without editing `.kbd`.
- Global inheritance works.
- Same key can resolve differently by active application.
- Specific-device UI truthfully reflects platform/backend capability.
- Beginner actions are exactly the approved seven categories.
- Visual edits validate before activation and roll back on failure.
- Advanced visual features compile to parser-valid Kanata config.
- Raw mode is source-of-truth after conversion and does not fake round-trip visual parsing.
- Tray keeps remapping alive with window hidden.
- OS autostart launches tray-only.
- Engine crash/reload failure has bounded recovery and last-known-good fallback.
- UI/Tauri files pass hard line-count lint.
- Windows/macOS/Linux native installer jobs produce the requested artifacts.
- App update bundles the tested Kanata engine version together.
- `studio/` remains the main divergence zone so syncing future `jtroo/kanata/main` is manageable.
- Documentation states Linux Wayland and Windows Interception limitations plainly.
