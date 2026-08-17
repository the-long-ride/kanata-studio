import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

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

test('macOS Studio builds target 10.15 or newer', () => {
  const config = json('../src-tauri/tauri.macos.conf.json');
  assert.equal(config.bundle?.macOS?.minimumSystemVersion, '10.15');

  const workflow = read('../../.github/workflows/kanata-gui.yml');
  const exports = workflow.match(/MACOSX_DEPLOYMENT_TARGET=10\.15/g) ?? [];
  assert.ok(exports.length >= 2, 'native and installer jobs must export MACOSX_DEPLOYMENT_TARGET=10.15');
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
  assert.ok(!sidecars.includes("'gui'"), 'Studio sidecar build must not select Kanata legacy GUI entry point');
});

test('Windows installer bundles the Interception backend and DLL together', () => {
  const config = json('../src-tauri/tauri.windows.conf.json');
  const external = config.bundle?.externalBin ?? [];
  assert.ok(external.includes('binaries/kanata-engine'));
  assert.ok(external.includes('binaries/kanata-engine-interception'));
  assert.equal(
    config.bundle?.resources?.['binaries/interception.dll'],
    'interception.dll',
    'Interception DLL must be installed next to the Windows Studio executable and sidecars',
  );

  const sidecars = read('../scripts/prepare-kanata-sidecars.mjs');
  assert.match(sidecars, /resolve\(outputDir, 'interception\.dll'\)/);
});

test('first-run setup does not start Kanata before onboarding is complete', () => {
  const lib = read('../src-tauri/src/lib.rs');
  assert.match(lib, /if settings\.remapping_enabled && settings\.onboarding_completed \{/);
});

test('Windows Studio release executable does not allocate its own console', () => {
  const main = read('../src-tauri/src/main.rs');
  assert.match(main, /#!\[cfg_attr\(not\(debug_assertions\), windows_subsystem = "windows"\)\]/);
});

test('engine event listener reuses the readiness TCP connection', () => {
  const process = read('../src-tauri/src/engine/process.rs');
  const supervisor = read('../src-tauri/src/engine/supervisor.rs');

  assert.ok(
    !process.includes('KanataTcpClient::connect_with_retry('),
    'listener must not open a second TCP connection after the readiness hello',
  );
  const reused = supervisor.match(/start_listener\(self, id\.clone\(\), client\)/g) ?? [];
  assert.equal(reused.length, 2, 'start and restart must hand the validated client to the listener');
});
