import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionSpec, BootstrapState, StudioProfile, StudioSettings, UiMode } from '../lib/types';
import { applyRuntime, checkForUpdate, convertProfileToRaw, createProfile, getBootstrapState, openLogs, previewProfile, restartEngines, setManualProfile, setRawProfileText, setStartWithSystem, updateProfile, updateSettings, validateRawProfile } from '../lib/tauri';
import { AdvancedInspector } from '../features/advanced/AdvancedInspector';
import { AdvancedWorkspace } from '../features/advanced/AdvancedWorkspace';
import { ConvertToRawDialog } from '../features/advanced/ConvertToRawDialog';
import { KeyInspector } from '../features/inspector/KeyInspector';
import { KeyboardCanvas } from '../features/keyboard/KeyboardCanvas';
import { KeyboardManagerDialog } from '../features/keyboards/KeyboardManagerDialog';
import { KeyboardSelector } from '../features/keyboards/KeyboardSelector';
import { KeyboardSetupPane } from '../features/keyboards/KeyboardSetupPane';
import { initialKeyboardId, keyboardGlobal, profilesForKeyboard } from '../features/keyboards/keyboardCatalog';
import { useKeyboardRegistry } from '../features/keyboards/useKeyboardRegistry';
import { Onboarding } from '../features/onboarding/Onboarding';
import { CreateProfileDialog, type NewProfileInput } from '../features/profiles/CreateProfileDialog';
import { ProfileRail } from '../features/profiles/ProfileRail';
import { SettingsView } from '../features/settings/SettingsView';
import { RuntimeErrorDialog } from '../features/status/RuntimeErrorDialog';
import { AppShell } from './AppShell';
import { completeOnboarding } from './onboardingRuntime';
import { autostartIssue, engineIssue, errorDetails, type RuntimeIssue } from './runtimeIssues';
import { useRuntimeIssueQueue } from './useRuntimeIssueQueue';
import { addLayer, layerMappings, makeAppProfile, setLayerMapping } from './profileHelpers';

const fallback: BootstrapState = {
  profiles: [],
  settings: { onboardingCompleted: false, startWithSystem: true, remappingEnabled: true, deviceLayoutOverrides: {}, uiMode: 'Beginner' },
  devices: [], configuredKeyboards: [],
  capabilities: { platform: 'Windows', perAppAutoSwitch: true, perDeviceMapping: 'RequiresWindowsInterception', windowTitleMatching: true, manualProfileSelection: true, permissions: {} },
  engineStatuses: [], activeProfileId: 'global', health: 'Running',
  version: { studio: '0.1.0', kanata: 'unknown', sha: 'unknown' },
};

export function App() {
  const [state, setState] = useState<BootstrapState>(fallback);
  const [selected, setSelected] = useState('');
  const [selectedKeyboardId, setSelectedKeyboardId] = useState<string>();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [activeLayer, setActiveLayer] = useState('base');
  const [mode, setMode] = useState<UiMode>('Beginner');
  const [view, setView] = useState<'editor' | 'settings'>('editor');
  const [createOpen, setCreateOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [preview, setPreview] = useState<string>();
  const [applyState, setApplyState] = useState('Applied');
  const [updateMessage, setUpdateMessage] = useState<string>();
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [undoStack, setUndoStack] = useState<StudioProfile[]>([]);
  const { issue: runtimeIssue, report: queueRuntimeIssue, dismiss: dismissRuntimeIssue, retry: retryRuntimeIssue, retrying } = useRuntimeIssueQueue();
  const serverProfiles = useRef(new Map<string, StudioProfile>());
  const pending = useRef<StudioProfile | undefined>(undefined);
  const applying = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const markRuntimeApplied = useCallback((engineStatuses: BootstrapState['engineStatuses']) => setState(old => ({ ...old, engineStatuses, health: 'Running' })), []);
  const retryRuntime = useCallback(async () => markRuntimeApplied(await applyRuntime()), [markRuntimeApplied]);
  const reportIssue = useCallback((issue: RuntimeIssue) => {
    if (issue.kind === 'engine') setState(old => ({ ...old, health: { RecoveryRequired: { message: issue.technicalDetails } } }));
    queueRuntimeIssue(issue);
  }, [queueRuntimeIssue]);
  const syncServerProfiles = useCallback((profiles: StudioProfile[]) => {
    serverProfiles.current = new Map(profiles.map(profile => [profile.id, profile]));
  }, []);
  const keyboard = useKeyboardRegistry({
    state,
    setState,
    reportIssue,
    onProfilesSynced: syncServerProfiles,
    selectedId: selectedKeyboardId,
    setSelectedId: setSelectedKeyboardId,
  });
  const applyBootstrap = useCallback((next: BootstrapState) => {
    setState(next);
    setSelected(next.activeProfileId || '');
    setSelectedKeyboardId(current => initialKeyboardId(next.configuredKeyboards, next.devices, current));
    setMode(next.settings.uiMode);
    syncServerProfiles(next.profiles);
    if (typeof next.health !== 'string') queueRuntimeIssue(engineIssue(next.health.RecoveryRequired.message, retryRuntime));
  }, [queueRuntimeIssue, retryRuntime, syncServerProfiles]);
  const load = useCallback(async () => applyBootstrap(await getBootstrapState()), [applyBootstrap]);
  useEffect(() => {
    let cancelled = false;
    void getBootstrapState().then(next => { if (!cancelled) applyBootstrap(next); }).catch(error => queueRuntimeIssue({ key: 'bootstrap-state', kind: 'persistence', title: 'Could not load Kanata Studio', message: 'Studio state could not be loaded.', technicalDetails: errorDetails(error), retry: load }));
    return () => { cancelled = true; };
  }, [applyBootstrap, load, queueRuntimeIssue]);

  const scopedProfiles = useMemo(() => profilesForKeyboard(state.profiles, keyboard.selectedId), [keyboard.selectedId, state.profiles]);
  const baseProfile = useMemo(() => keyboardGlobal(state.profiles, keyboard.selectedId), [keyboard.selectedId, state.profiles]);
  const profile = scopedProfiles.find(item => item.id === selected)
    ?? baseProfile
    ?? scopedProfiles[0];
  const sharedGlobal = state.profiles.find(item => item.id === 'global');
  const inheritedFrom = profile?.appMatcher ? baseProfile : sharedGlobal;
  const direct = useMemo(() => layerMappings(profile, activeLayer), [profile, activeLayer]);
  const inherited = useMemo(() => layerMappings(inheritedFrom, activeLayer), [inheritedFrom, activeLayer]);
  const currentAction = selectedKey ? direct[selectedKey] ?? inherited[selectedKey] : undefined;
  const layout = keyboard.selected?.layoutOverride ?? keyboard.selected?.layout ?? 'Ansi';

  const flush = useCallback(async function applyPending() {
    if (applying.current || !pending.current) return;
    const draft = pending.current; pending.current = undefined;
    const server = serverProfiles.current.get(draft.id); if (!server) return;
    applying.current = true; setApplyState('Applying');
    try {
      const result = await updateProfile({ profile: { ...draft, revision: server.revision }, expectedRevision: server.revision });
      serverProfiles.current.set(result.profile.id, result.profile);
      setState(old => ({ ...old, profiles: old.profiles.map(item => item.id === result.profile.id ? { ...item, revision: result.profile.revision } : item), engineStatuses: result.engineStatuses }));
      setApplyState(result.applied ? 'Applied' : 'Error');
    } catch { setApplyState('Error'); await load().catch(() => undefined); }
    finally { applying.current = false; if (pending.current) void applyPending(); }
  }, [load]);
  const queueApply = useCallback((next: StudioProfile, pushUndo = true) => {
    if (pushUndo && profile) setUndoStack(stack => [...stack.slice(-49), structuredClone(profile)]);
    setState(old => ({ ...old, profiles: old.profiles.map(item => item.id === next.id ? next : item) }));
    pending.current = next; window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush(), 180);
  }, [flush, profile]);
  const setAction = (action: ActionSpec) => {
    if (profile && selectedKey && profile.source.kind === 'visual') queueApply(setLayerMapping(profile, activeLayer, selectedKey, action));
  };
  const onCreate = async (input: NewProfileInput) => {
    if (!keyboard.selectedId || !keyboard.selected?.configured) return;
    const created = await createProfile({ profile: makeAppProfile(input.name, input.executable, keyboard.selectedId) });
    serverProfiles.current.set(created.id, created); setState(old => ({ ...old, profiles: [...old.profiles, created] }));
    setSelected(created.id); setCreateOpen(false);
  };
  const onMode = (next: UiMode) => {
    setMode(next); setState(old => ({ ...old, settings: { ...old.settings, uiMode: next } })); void updateSettings({ uiMode: next });
  };
  const onOnboarding = (settings: StudioSettings, first?: { name: string; exe: string }) => {
    setOnboardingBusy(true);
    void completeOnboarding({ settings, firstProfile: first && { name: first.name, executable: first.exe } }, {
      persistSettings: value => updateSettings(value), persistProfile: (value, options) => createProfile({ profile: value, apply: options.apply }),
      setStartWithSystem, applyRuntime, makeProfile: ({ name, executable }) => makeAppProfile(name, executable),
      onPersisted: ({ settings: saved, profile: created }) => { if (created) serverProfiles.current.set(created.id, created); setState(old => ({ ...old, settings: saved, profiles: created ? [...old.profiles, created] : old.profiles })); },
      onIssue: reportIssue, onRuntimeApplied: markRuntimeApplied,
    }).catch(() => undefined).finally(() => setOnboardingBusy(false));
  };
  const onUndo = () => { const previous = undoStack.at(-1); if (previous) { setUndoStack(stack => stack.slice(0, -1)); queueApply(previous, false); } };
  const onAddLayer = () => { if (!profile) return; const name = window.prompt('Layer name', 'nav')?.trim(); if (name) { queueApply(addLayer(profile, name)); setActiveLayer(name); } };
  const applyRaw = async (text: string) => {
    if (!profile) return; const server = serverProfiles.current.get(profile.id) ?? profile;
    const result = await setRawProfileText({ id: profile.id, text, expectedRevision: server.revision });
    if (!result.applied) throw new Error(result.validation.message ?? 'Invalid config');
    serverProfiles.current.set(result.profile.id, result.profile); setState(old => ({ ...old, profiles: old.profiles.map(item => item.id === result.profile.id ? result.profile : item) }));
  };
  const manageKeyboard = async (id: string) => { await keyboard.select(id); setManagerOpen(true); };
  const selectProfile = (id: string) => {
    setSelected(id); setActiveLayer('base');
    if (!state.capabilities.perAppAutoSwitch) void setManualProfile(id).then(engineStatuses => setState(old => ({ ...old, activeProfileId: id, engineStatuses }))).catch(error => reportIssue(engineIssue(error, retryRuntime)));
  };
  const main = view === 'settings'
    ? <SettingsView state={state} keyboards={keyboard.catalog} onStart={value => void saveSetting({ startWithSystem: value })} onManageKeyboard={id => void manageKeyboard(id)} onUpdate={checkUpdate} />
    : !keyboard.selected?.configured ? <KeyboardSetupPane keyboard={keyboard.selected} onSetup={() => void keyboard.setupSelected()} />
    : mode === 'Advanced' && profile ? <AdvancedWorkspace profile={profile} layout={layout} activeLayer={activeLayer} selectedKey={selectedKey} direct={direct} inherited={inherited} preview={preview} onSelectKey={setSelectedKey} onLayer={setActiveLayer} onAddLayer={onAddLayer} onConvertRaw={() => setConvertOpen(true)} onRawValidate={text => validateRawProfile({ text })} onRawApply={applyRaw} onPreview={() => void previewProfile(profile.id).then(result => setPreview(result.text))} />
    : <KeyboardCanvas layout={layout} selected={selectedKey} onSelect={setSelectedKey} direct={direct} inherited={inherited} />;
  const inspector = view === 'settings' ? <div className="inspector-body"><strong>Version</strong><p className="muted">Studio {state.version.studio}<br />Kanata {state.version.kanata}<br />{state.version.sha.slice(0, 12)}</p>{updateMessage && <p className="muted">{updateMessage}</p>}</div>
    : !keyboard.selected?.configured ? <div className="empty-inspector">Set up this keyboard to edit mappings.</div>
    : mode === 'Advanced' ? <AdvancedInspector keyId={selectedKey} action={currentAction} onChange={setAction} status={applyState} /> : <KeyInspector keyId={selectedKey} action={currentAction} onChange={setAction} status={applyState} />;
  const errorDialog = <RuntimeErrorDialog issue={runtimeIssue} busy={retrying} onRetry={() => void retryRuntimeIssue()} onLogs={() => void openLogs()} onDismiss={dismissRuntimeIssue} />;
  if (!state.settings.onboardingCompleted) return <><Onboarding devices={state.devices} capabilities={state.capabilities} settings={state.settings} busy={onboardingBusy} onFinish={onOnboarding} />{errorDialog}</>;

  return <>
    <AppShell mode={mode} onMode={onMode} keyboardControl={<KeyboardSelector items={keyboard.catalog} selectedId={keyboard.selectedId} onSelect={id => { setActiveLayer('base'); setSelectedKey(undefined); void keyboard.select(id); }} onManage={() => setManagerOpen(true)} />} rail={<ProfileRail profiles={scopedProfiles} selected={profile?.id ?? ''} keyboardName={keyboard.selected?.name} canCreate={Boolean(keyboard.selected?.configured)} onSelect={selectProfile} onCreate={() => setCreateOpen(true)} />} main={main} inspector={inspector} status={runtimeLabel(state)} onSettings={() => setView(old => old === 'editor' ? 'settings' : 'editor')} onUndo={undoStack.length ? onUndo : undefined} onRestart={() => void restartRuntime()} />
    {createOpen && <CreateProfileDialog onClose={() => setCreateOpen(false)} onCreate={input => void onCreate(input)} />}
    <KeyboardManagerDialog open={managerOpen} keyboard={keyboard.selected} items={keyboard.catalog} onClose={() => setManagerOpen(false)} onSetup={keyboard.setupSelected} onUpdate={keyboard.update} onCopy={keyboard.copyFrom} onRefresh={keyboard.refresh} />
    <ConvertToRawDialog open={convertOpen} onCancel={() => setConvertOpen(false)} onConvert={() => void convertRaw()} />
    {errorDialog}
  </>;

  async function convertRaw() { if (!profile) return; const server = serverProfiles.current.get(profile.id) ?? profile; const result = await convertProfileToRaw(profile.id, server.revision); serverProfiles.current.set(result.profile.id, result.profile); setState(old => ({ ...old, profiles: old.profiles.map(item => item.id === result.profile.id ? result.profile : item) })); setConvertOpen(false); }
  async function saveSetting(input: Partial<StudioSettings>) { const settings = await updateSettings(input); setState(old => ({ ...old, settings })); if (input.startWithSystem !== undefined) { try { await setStartWithSystem(input.startWithSystem); } catch (error) { reportIssue(autostartIssue(input.startWithSystem, error, () => setStartWithSystem(input.startWithSystem!))); } } }
  async function restartRuntime() { try { markRuntimeApplied(await restartEngines()); } catch (error) { reportIssue(engineIssue(error, retryRuntime)); } }
  async function checkUpdate() { try { setUpdateMessage(await checkForUpdate()); } catch { setUpdateMessage('Updater is enabled only in signed release builds.'); } }
}
function runtimeLabel(state: BootstrapState) { if (!state.settings.remappingEnabled) return 'Paused'; if (typeof state.health === 'string') return state.health; return 'Recovery required'; }
