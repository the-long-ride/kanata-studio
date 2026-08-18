import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  BootstrapState,
  KeyboardLayout,
  KeyboardVisualPreset,
  StudioProfile,
} from '../../lib/types';
import {
  applyRuntime,
  configureKeyboard,
  copyKeyboardConfiguration,
  listKeyboards,
  updateConfiguredKeyboard,
} from '../../lib/tauri';
import { engineIssue, keyboardPersistenceIssue, type RuntimeIssue } from '../../app/runtimeIssues';
import { buildKeyboardCatalog } from './keyboardCatalog';

type KeyboardUpdateInput = {
  id: string;
  name?: string;
  layoutOverride: KeyboardLayout | null;
  visualPresetOverride?: KeyboardVisualPreset | null;
};

export function useKeyboardRegistry({
  state,
  setState,
  reportIssue,
  onProfilesSynced,
  selectedId,
  setSelectedId,
}: {
  state: BootstrapState;
  setState: Dispatch<SetStateAction<BootstrapState>>;
  reportIssue: (issue: RuntimeIssue) => void;
  onProfilesSynced: (profiles: StudioProfile[]) => void;
  selectedId?: string;
  setSelectedId: (id: string) => void;
}) {
  const catalog = useMemo(
    () => buildKeyboardCatalog(state.configuredKeyboards, state.devices),
    [state.configuredKeyboards, state.devices],
  );
  const selected = catalog.find(item => item.id === selectedId);

  const refresh = useCallback(async () => {
    const devices = await listKeyboards();
    setState(old => ({ ...old, devices }));
  }, [setState]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh().catch(() => undefined), 3000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const syncResult = useCallback((result: {
    keyboard: BootstrapState['configuredKeyboards'][number];
    profiles: StudioProfile[];
  }) => {
    setState(old => ({
      ...old,
      profiles: result.profiles,
      configuredKeyboards: replaceKeyboard(old.configuredKeyboards, result.keyboard),
    }));
    onProfilesSynced(result.profiles);
  }, [onProfilesSynced, setState]);

  const applyPersistedRuntime = useCallback(async () => {
    const engineStatuses = await applyRuntime();
    setState(old => ({ ...old, engineStatuses, health: 'Running' }));
  }, [setState]);

  const applyAfterPersist = useCallback(async () => {
    try {
      await applyPersistedRuntime();
    } catch (error) {
      reportIssue(engineIssue(error, applyPersistedRuntime));
    }
  }, [applyPersistedRuntime, reportIssue]);

  const configureById = useCallback(async (id: string) => {
    const result = await configureKeyboard(id);
    syncResult(result);
    setSelectedId(id);
    await applyAfterPersist();
  }, [applyAfterPersist, setSelectedId, syncResult]);

  const select = useCallback(async (id: string) => {
    const item = catalog.find(value => value.id === id);
    if (!item) return;
    if (item.configured) {
      setSelectedId(id);
      return;
    }
    try {
      await configureById(id);
    } catch (error) {
      reportIssue(keyboardPersistenceIssue('configure', error, () => configureById(id)));
    }
  }, [catalog, configureById, reportIssue, setSelectedId]);

  const setupSelected = useCallback(async () => {
    if (selectedId) await select(selectedId);
  }, [select, selectedId]);

  const persistUpdate = useCallback(async (input: KeyboardUpdateInput) => {
    const keyboard = await updateConfiguredKeyboard(input);
    setState(old => ({
      ...old,
      configuredKeyboards: replaceKeyboard(old.configuredKeyboards, keyboard),
      devices: old.devices.map(device => device.id === keyboard.id
        ? { ...device, manualLayout: keyboard.layoutOverride ?? null }
        : device),
    }));
    await refresh();
  }, [refresh, setState]);

  const update = useCallback(async (input: KeyboardUpdateInput) => {
    try {
      await persistUpdate(input);
    } catch (error) {
      reportIssue(keyboardPersistenceIssue('update', error, () => persistUpdate(input)));
      throw error;
    }
  }, [persistUpdate, reportIssue]);

  const copyConfigurationFrom = useCallback(async (sourceId: string) => {
    if (!selectedId) return;
    const result = await copyKeyboardConfiguration(sourceId, selectedId);
    syncResult(result);
    await refresh();
    await applyAfterPersist();
  }, [applyAfterPersist, refresh, selectedId, syncResult]);

  const copyFrom = useCallback(async (sourceId: string) => {
    try {
      await copyConfigurationFrom(sourceId);
    } catch (error) {
      reportIssue(keyboardPersistenceIssue('copy', error, () => copyConfigurationFrom(sourceId)));
      throw error;
    }
  }, [copyConfigurationFrom, reportIssue]);

  return {
    catalog,
    selected,
    selectedId,
    select,
    setupSelected,
    update,
    copyFrom,
    refresh,
  };
}

function replaceKeyboard<T extends { id: string }>(items: T[], next: T): T[] {
  const found = items.some(item => item.id === next.id);
  return found
    ? items.map(item => item.id === next.id ? next : item)
    : [...items, next];
}
