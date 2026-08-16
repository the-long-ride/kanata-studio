import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import type { ApplyResult, BootstrapState, EngineStatus, KeyboardDevice, StudioProfile, StudioSettings, ValidationResult, } from './types';
export type PreviewResult = {
    text: string;
    validation: ValidationResult;
};
export const getBootstrapState = () => invoke<BootstrapState>('get_bootstrap_state');
export const createProfile = (input: unknown) => invoke<StudioProfile>('create_profile', { input });
export const updateProfile = (input: unknown) => invoke<ApplyResult>('update_profile', { input });
export const deleteProfile = (id: string) => invoke<void>('delete_profile', { id });
export const validateRawProfile = (input: unknown) => invoke<ValidationResult>('validate_raw_profile', { input });
export const setRawProfileText = (input: unknown) => invoke<ApplyResult>('set_raw_profile_text', { input });
export const convertProfileToRaw = (id: string, expectedRevision: number) => invoke<ApplyResult>('convert_profile_to_raw', { id, expectedRevision });
export const previewProfile = (id: string) => invoke<PreviewResult>('preview_profile', { id });
export const readRuntimeConfig = (engineId: string) => invoke<string>('read_runtime_config', { engineId });
export const listKeyboards = () => invoke<KeyboardDevice[]>('list_keyboards');
export const setRemappingEnabled = (enabled: boolean) => invoke<EngineStatus[]>('set_remapping_enabled', { enabled });
export const restartEngines = () => invoke<EngineStatus[]>('restart_engines');
export const setManualProfile = (id?: string) => invoke<EngineStatus[]>('set_manual_profile', { id: id ?? null });
export const updateSettings = (input: Partial<StudioSettings>) => invoke<StudioSettings>('update_settings', { input });
export const openLogs = () => invoke<void>('open_logs');
export async function checkForUpdate(): Promise<string> {
    const update = await check();
    if (!update)
        return 'You are using the latest version.';
    return `Version ${update.version} is available.`;
}
