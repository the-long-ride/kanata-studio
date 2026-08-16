import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');

async function importRequired(path) {
  const full = resolve(root, path);
  try { await access(full); }
  catch { assert.fail(`${path} must exist`); }
  return import(pathToFileURL(full).href);
}

test('keyboard registry is persisted and exposed in bootstrap state', async () => {
  const [paths, state, bootstrap] = await Promise.all([
    read('src-tauri/src/storage/paths.rs'),
    read('src-tauri/src/app_state.rs'),
    read('src-tauri/src/commands/bootstrap.rs'),
  ]);
  assert.match(paths, /pub fn keyboards\(&self\)/);
  assert.match(state, /configured_keyboards:/);
  assert.match(bootstrap, /configured_keyboards/);
});

test('keyboard commands configure update and copy device-scoped profiles', async () => {
  const commands = await read('src-tauri/src/commands/keyboards.rs').catch(() => '');
  assert.match(commands, /pub fn configure_keyboard/);
  assert.match(commands, /pub fn update_configured_keyboard/);
  assert.match(commands, /pub fn copy_keyboard_configuration/);
  assert.match(commands, /ensure_keyboard_global_profile/);
});

test('runtime topology ignores disconnected device targets', async () => {
  const topology = await read('src-tauri/src/engine/topology.rs');
  assert.match(topology, /filter\(\|id\| devices\.iter\(\)\.any/);
});

test('keyboard catalog retains disconnected configured devices and marks new devices', async () => {
  const { buildKeyboardCatalog, profilesForKeyboard, initialKeyboardId } = await importRequired('src/features/keyboards/keyboardCatalog.ts');
  const configured = [{ id: 'a', name: 'Office', detectedName: 'A', vendorId: null, productId: null, layoutOverride: null }];
  const detected = [
    { id: 'b', name: 'New board', vendorId: null, productId: null, path: null, layout: 'Ansi', manualLayout: null },
  ];
  const catalog = buildKeyboardCatalog(configured, detected);
  assert.deepEqual(catalog.map(item => [item.id, item.connected, item.configured]), [
    ['a', false, true],
    ['b', true, false],
  ]);
  const profiles = [
    { id: 'all', deviceTarget: { kind: 'all' } },
    { id: 'a-global', deviceTarget: { kind: 'device', id: 'a' } },
    { id: 'b-global', deviceTarget: { kind: 'device', id: 'b' } },
  ];
  assert.deepEqual(profilesForKeyboard(profiles, 'a').map(profile => profile.id), ['a-global']);
  assert.equal(initialKeyboardId(configured, detected), 'a');
  assert.equal(initialKeyboardId(configured, detected, 'b'), 'b');
});

test('keyboard-centric UI exposes selector manager setup and background refresh', async () => {
  const [shell, app, hook, manager] = await Promise.all([
    read('src/app/AppShell.tsx'),
    read('src/app/App.tsx'),
    read('src/features/keyboards/useKeyboardRegistry.ts').catch(() => ''),
    read('src/features/keyboards/KeyboardManagerDialog.tsx').catch(() => ''),
  ]);
  assert.match(shell, /keyboardControl/);
  assert.match(app, /KeyboardSelector/);
  assert.match(app, /profilesForKeyboard/);
  assert.match(hook, /setInterval/);
  assert.match(manager, /Copy everything from/);
});

test('keyboard persistence issues use keyboard-specific recovery messages', async () => {
  const { keyboardPersistenceIssue } = await importRequired('src/app/runtimeIssues.ts');
  const issue = keyboardPersistenceIssue('copy', new Error('disk full'));
  assert.equal(issue.key, 'keyboard-copy');
  assert.equal(issue.title, 'Could not copy keyboard settings');
  assert.match(issue.technicalDetails, /disk full/);
});

test('Linux device identity distinguishes identical models with stable hardware hints', async () => {
  const linux = await read('src-tauri/src/platform/devices/linux.rs');
  assert.match(linux, /unique_name\(\)/);
  assert.match(linux, /physical_path\(\)/);
  assert.match(linux, /stable_id/);
});

test('configured keyboard registry is canonical for layout overrides', async () => {
  const [devices, commands] = await Promise.all([
    read('src-tauri/src/platform/devices/mod.rs'),
    read('src-tauri/src/commands/keyboards.rs'),
  ]);
  assert.doesNotMatch(devices, /if let Some\(layout\) = &saved\.layout_override/);
  assert.doesNotMatch(commands, /settings_store/);
});

test('new keyboard selection becomes active before runtime activation completes', async () => {
  const hook = await read('src/features/keyboards/useKeyboardRegistry.ts');
  const configureStart = hook.indexOf('const configureById = useCallback');
  const selectStart = hook.indexOf('const select = useCallback', configureStart);
  const body = hook.slice(configureStart, selectStart);
  const selectedAt = body.indexOf('setSelectedId(id)');
  const appliedAt = body.indexOf('await applyAfterPersist()');
  assert.ok(selectedAt >= 0 && appliedAt > selectedAt);
});

test('configured layout override is applied before final layout detection', async () => {
  const [deviceModule, setup, command] = await Promise.all([
    read('src-tauri/src/platform/devices/mod.rs'),
    read('src-tauri/src/lib.rs'),
    read('src-tauri/src/commands/devices.rs'),
  ]);
  assert.match(deviceModule, /pub fn detect_layouts/);
  for (const source of [setup, command]) {
    const configuredAt = source.indexOf('apply_configured_layouts');
    const detectedAt = source.indexOf('detect_layouts', configuredAt);
    assert.ok(configuredAt >= 0 && detectedAt > configuredAt);
  }
});

test('device providers contribute best-effort physical layout detection', async () => {
  const [generic, linux, windows] = await Promise.all([
    read('src-tauri/src/platform/layout/mod.rs'),
    read('src-tauri/src/platform/devices/linux.rs'),
    read('src-tauri/src/platform/devices/windows.rs'),
  ]);
  assert.match(generic, /device\.layout != KeyboardLayout::Unknown/);
  assert.match(linux, /KEY_102ND/);
  assert.match(linux, /KEY_RO|KEY_YEN/);
  assert.match(windows, /RIDI_DEVICEINFO/);
  assert.match(windows, /dwType == 0x7/);
  assert.match(windows, /dwNumberOfKeysTotal/);
});

test('layout and copy changes refresh detected device metadata immediately', async () => {
  const hook = await read('src/features/keyboards/useKeyboardRegistry.ts');
  const updateStart = hook.indexOf('const persistUpdate = useCallback');
  const updateEnd = hook.indexOf('const update = useCallback', updateStart);
  const copyStart = hook.indexOf('const copyConfigurationFrom = useCallback', updateEnd);
  const copyEnd = hook.indexOf('const copyFrom = useCallback', copyStart);
  assert.match(hook.slice(updateStart, updateEnd), /await refresh\(\)/);
  assert.match(hook.slice(copyStart, copyEnd), /await refresh\(\)/);
});

test('later device connections never replace the current editor keyboard selection', async () => {
  const hook = await read('src/features/keyboards/useKeyboardRegistry.ts');
  const app = await read('src/app/App.tsx');
  assert.doesNotMatch(hook, /const preferred =/);
  assert.match(hook, /selectedId,/);
  assert.match(hook, /setSelectedId/);
  assert.match(app, /setSelectedKeyboardId/);
});
