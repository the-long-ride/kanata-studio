import { afterEach, describe, expect, test } from 'vitest';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import {
  applyRuntime,
  convertProfileToRaw,
  createProfile,
  deleteProfile,
  getBootstrapState,
  listKeyboards,
  openLogs,
  previewProfile,
  readRuntimeConfig,
  restartEngines,
  setManualProfile,
  setRawProfileText,
  setRemappingEnabled,
  setStartWithSystem,
  updateProfile,
  updateSettings,
  validateRawProfile,
} from './tauri';

type Call = { cmd: string; args: Record<string, unknown> };

function recorder() {
  const calls: Call[] = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args: (args ?? {}) as Record<string, unknown> });
    return null;
  });
  return calls;
}

afterEach(() => clearMocks());

describe('Tauri IPC wrapper contract', () => {
  test('profile commands preserve backend command names and argument envelopes', async () => {
    const calls = recorder();
    const create = { profile: { id: 'code' } };
    const update = { profile: { id: 'code', revision: 1 } };
    const raw = { id: 'code', text: '(defsrc)', expectedRevision: 1 };

    await createProfile(create);
    await updateProfile(update);
    await deleteProfile('code');
    await setRawProfileText(raw);
    await convertProfileToRaw('code', 7);
    await previewProfile('code');

    expect(calls).toEqual([
      { cmd: 'create_profile', args: { input: create } },
      { cmd: 'update_profile', args: { input: update } },
      { cmd: 'delete_profile', args: { id: 'code' } },
      { cmd: 'set_raw_profile_text', args: { input: raw } },
      { cmd: 'convert_profile_to_raw', args: { id: 'code', expectedRevision: 7 } },
      { cmd: 'preview_profile', args: { id: 'code' } },
    ]);
  });

  test('runtime and settings commands preserve exact IPC arguments', async () => {
    const calls = recorder();
    await getBootstrapState();
    await listKeyboards();
    await setRemappingEnabled(false);
    await restartEngines();
    await setManualProfile('code');
    await setManualProfile();
    await updateSettings({ startWithSystem: false });
    await setStartWithSystem(false);
    await applyRuntime();
    await readRuntimeConfig('all');
    await openLogs();

    expect(calls).toEqual([
      { cmd: 'get_bootstrap_state', args: {} },
      { cmd: 'list_keyboards', args: {} },
      { cmd: 'set_remapping_enabled', args: { enabled: false } },
      { cmd: 'restart_engines', args: {} },
      { cmd: 'set_manual_profile', args: { id: 'code' } },
      { cmd: 'set_manual_profile', args: { id: null } },
      { cmd: 'update_settings', args: { input: { startWithSystem: false } } },
      { cmd: 'set_start_with_system', args: { enabled: false } },
      { cmd: 'apply_runtime', args: {} },
      { cmd: 'read_runtime_config', args: { engineId: 'all' } },
      { cmd: 'open_logs', args: {} },
    ]);
  });

  test('raw validation input is sent as a single typed command envelope', async () => {
    const calls = recorder();
    const input = { text: '(defsrc)\n(deflayermap (base) caps esc)' };
    await validateRawProfile(input);
    expect(calls).toEqual([{ cmd: 'validate_raw_profile', args: { input } }]);
  });
});
