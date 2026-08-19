import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test('shared Switch is the only production checkbox primitive', () => {
  const root = new URL('../src', import.meta.url).pathname;
  const offenders = sourceFiles(root)
    .filter(path => !path.endsWith('/components/Switch.tsx') && !path.includes('.test.'))
    .filter(path => /type\s*=\s*["']checkbox["']/.test(fs.readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, [], 'boolean controls must reuse components/Switch.tsx');
  assert.match(read('../src/components/Switch.tsx'), /type="checkbox"/);
});

test('updater plugin is not registered without a complete updater config', () => {
  const lib = read('../src-tauri/src/lib.rs');
  const config = json('../src-tauri/tauri.conf.json');
  const registered = lib.includes('tauri_plugin_updater::Builder::new().build()');
  const updater = config.plugins?.updater;
  const configured = updater && typeof updater === 'object' && Array.isArray(updater.endpoints) && typeof updater.pubkey === 'string' && updater.pubkey.length > 0;
  assert.ok(!registered || configured, 'registering tauri-plugin-updater without plugins.updater causes startup failure');

  const frontend = read('../src/lib/tauri.ts');
  if (!registered) {
    assert.ok(!frontend.includes("from '@tauri-apps/plugin-updater'"), 'frontend updater IPC must also be disabled');
  }
});

test('macOS Studio bundle targets 10.15 or newer', () => {
  const config = json('../src-tauri/tauri.macos.conf.json');
  assert.equal(config.bundle?.macOS?.minimumSystemVersion, '10.15');
});

test('custom title bar has permission for every window action it invokes', () => {
  const capability = json('../src-tauri/capabilities/default.json');
  const permissions = new Set(capability.permissions ?? []);
  for (const permission of [
    'core:window:allow-minimize',
    'core:window:allow-toggle-maximize',
    'core:window:allow-close',
    'core:window:allow-start-dragging',
  ]) {
    assert.ok(permissions.has(permission), `${permission} is required by the custom title bar`);
  }
});

test('Windows build workflow remains manual only', () => {
  const workflow = read('../../.github/workflows/windows-manual-build.yml');
  assert.match(workflow, /^on:\s*\n\s+workflow_dispatch:/m);
  assert.ok(!/^\s+(push|pull_request|schedule):/m.test(workflow), 'Windows build must not run automatically');
});

test('onboarding persistence is separated from autostart and runtime activation', () => {
  const settings = read('../src-tauri/src/commands/settings.rs');
  const profiles = read('../src-tauri/src/commands/profiles.rs');
  const engine = read('../src-tauri/src/commands/engine.rs');
  const lib = read('../src-tauri/src/lib.rs');

  const updateBody = settings.match(/pub fn update_settings[\s\S]*?\n}\n/)[0];
  assert.ok(!updateBody.includes('autolaunch()'), 'update_settings must only persist settings');
  assert.match(settings, /pub fn set_start_with_system\(/);
  assert.match(engine, /pub fn apply_runtime\(/);
  assert.match(profiles, /pub apply: bool/);
  assert.match(profiles, /persist_profile_set/);
  assert.match(lib, /commands::set_start_with_system/);
  assert.match(lib, /commands::apply_runtime/);
});

test('profile edits are persisted before runtime activation so apply failures cannot erase mappings', () => {
  const profiles = read('../src-tauri/src/commands/profiles.rs');
  const commit = profiles.match(/pub\(crate\) fn commit_profile_set[\s\S]*?\n}\n/)[0];
  const persistAt = commit.indexOf('persist_profile_set(state, next)');
  const applyAt = commit.indexOf('apply_current_context(state)');
  assert.ok(persistAt >= 0, 'commit_profile_set must persist the candidate profile set');
  assert.ok(applyAt >= 0, 'commit_profile_set must attempt runtime activation');
  assert.ok(
    persistAt < applyAt,
    'profile storage must be committed before runtime activation so a runtime failure cannot discard the edit',
  );
  assert.ok(
    !commit.includes('*state.profiles.write() = previous'),
    'runtime activation failure must not roll profile state back to the previous mappings',
  );
});

test('blocking Studio commands use async Tauri dispatch', () => {
  const sources = [
    read('../src-tauri/src/commands/settings.rs'),
    read('../src-tauri/src/commands/profiles.rs'),
    read('../src-tauri/src/commands/raw.rs'),
    read('../src-tauri/src/commands/engine.rs'),
  ].join('\n');
  const blocking = [
    'set_start_with_system',
    'create_profile',
    'update_profile',
    'delete_profile',
    'set_raw_profile_text',
    'convert_profile_to_raw',
    'set_remapping_enabled',
    'restart_engines',
    'set_manual_profile',
    'apply_runtime',
  ];
  for (const name of blocking) {
    const pattern = new RegExp(`#\\[tauri::command\\(async\\)\\]\\s*pub fn ${name}\\(`);
    assert.match(sources, pattern, `${name} can block and must not run on Tauri main thread`);
  }
});

test('Windows Studio sidecars are headless without enabling Kanata legacy GUI', () => {
  const cargo = read('../../Cargo.toml');
  const main = read('../../src/main.rs');
  const sidecars = read('../scripts/prepare-kanata-sidecars.mjs');

  assert.match(cargo, /^studio_sidecar = \[\]$/m);
  assert.match(
    main,
    /cfg_attr\(\s*any\(feature = "gui", feature = "studio_sidecar"\),\s*windows_subsystem = "windows"\s*\)/,
  );
  assert.match(sidecars, /cmd,tcp_server,winiov2,win_manifest,studio_sidecar/);
  assert.match(sidecars, /cmd,tcp_server,interception_driver,win_manifest,studio_sidecar/);
});

test('Windows bundle includes the Interception backend and pinned DLL together', () => {
  const config = json('../src-tauri/tauri.windows.conf.json');
  const sidecars = read('../scripts/prepare-kanata-sidecars.mjs');
  assert.ok(config.bundle?.externalBin?.includes('binaries/kanata-engine-interception'));
  assert.equal(config.bundle?.resources?.['binaries/interception.dll'], 'interception.dll');
  assert.match(sidecars, /assets[',\s]+Interception\.zip/);
  assert.match(sidecars, /copyPinnedInterceptionDll\(\)/);
});

test('first-run setup does not start Kanata before onboarding is complete', () => {
  const lib = read('../src-tauri/src/lib.rs');
  assert.match(lib, /if\s+settings\.remapping_enabled\s*&&\s*settings\.onboarding_completed\s*\{/);
});

test('Windows Studio release executable does not allocate its own console', () => {
  const main = read('../src-tauri/src/main.rs');
  assert.match(main, /cfg_attr\(not\(debug_assertions\), windows_subsystem = "windows"\)/);
});

test('engine event listener reuses the readiness TCP client', () => {
  const supervisor = read('../src-tauri/src/engine/supervisor.rs');
  const process = read('../src-tauri/src/engine/process.rs');
  assert.match(supervisor, /client\.hello\(\)\?/);
  assert.match(supervisor, /start_listener\(self,\s*id\.clone\(\),\s*client\)/);
  assert.match(process, /mut client:\s*KanataTcpClient/);
  assert.ok(!process.includes('KanataTcpClient::connect'), 'listener must consume the existing ready TCP client');
});
