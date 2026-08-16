import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionSpec, BootstrapState, KeyboardLayout, StudioProfile, StudioSettings, UiMode, } from '../lib/types';
import { checkForUpdate, convertProfileToRaw, createProfile, getBootstrapState, previewProfile, restartEngines, setManualProfile, setRawProfileText, updateProfile, updateSettings, validateRawProfile, } from '../lib/tauri';
import { AdvancedInspector } from '../features/advanced/AdvancedInspector';
import { AdvancedWorkspace } from '../features/advanced/AdvancedWorkspace';
import { ConvertToRawDialog } from '../features/advanced/ConvertToRawDialog';
import { KeyInspector } from '../features/inspector/KeyInspector';
import { KeyboardCanvas } from '../features/keyboard/KeyboardCanvas';
import { Onboarding } from '../features/onboarding/Onboarding';
import { CreateProfileDialog, type NewProfileInput } from '../features/profiles/CreateProfileDialog';
import { ProfileRail } from '../features/profiles/ProfileRail';
import { SettingsView } from '../features/settings/SettingsView';
import { AppShell } from './AppShell';
import { addLayer, layerMappings, makeAppProfile, setLayerMapping } from './profileHelpers';
import { canTargetSpecificDevice, selectProfileDevice } from './profileUiRules';
const fallback: BootstrapState = {
    profiles: [],
    settings: {
        onboardingCompleted: false,
        startWithSystem: true,
        remappingEnabled: true,
        deviceLayoutOverrides: {},
        uiMode: 'Beginner',
    },
    devices: [],
    capabilities: {
        platform: 'Windows',
        perAppAutoSwitch: true,
        perDeviceMapping: 'RequiresWindowsInterception',
        windowTitleMatching: true,
        manualProfileSelection: true,
        permissions: {},
    },
    engineStatuses: [],
    activeProfileId: 'global',
    health: 'Running',
    version: { studio: '0.1.0', kanata: 'unknown', sha: 'unknown' },
};
export function App() {
    const [state, setState] = useState<BootstrapState>(fallback);
    const [selected, setSelected] = useState('global');
    const [selectedKey, setSelectedKey] = useState<string>();
    const [activeLayer, setActiveLayer] = useState('base');
    const [mode, setMode] = useState<UiMode>('Beginner');
    const [view, setView] = useState<'editor' | 'settings'>('editor');
    const [createOpen, setCreateOpen] = useState(false);
    const [convertOpen, setConvertOpen] = useState(false);
    const [preview, setPreview] = useState<string>();
    const [applyState, setApplyState] = useState('Applied');
    const [updateMessage, setUpdateMessage] = useState<string>();
    const undo = useRef<StudioProfile[]>([]);
    const serverProfiles = useRef(new Map<string, StudioProfile>());
    const pending = useRef<StudioProfile | undefined>(undefined);
    const applying = useRef(false);
    const timer = useRef<number | undefined>(undefined);
    const load = useCallback(async () => {
        const next = await getBootstrapState();
        setState(next);
        setSelected(next.activeProfileId || 'global');
        setMode(next.settings.uiMode);
        serverProfiles.current = new Map(next.profiles.map((profile) => [profile.id, profile]));
    }, []);
    useEffect(() => { void load().catch(() => undefined); }, [load]);
    const profile = state.profiles.find((item) => item.id === selected) ?? state.profiles[0];
    const global = state.profiles.find((item) => item.id === 'global');
    const direct = useMemo(() => layerMappings(profile, activeLayer), [profile, activeLayer]);
    const inherited = useMemo(() => profile?.id === 'global' ? {} : layerMappings(global, activeLayer), [profile, global, activeLayer]);
    const currentAction = selectedKey ? direct[selectedKey] ?? inherited[selectedKey] : undefined;
    const layoutDevice = selectProfileDevice(profile, state.devices);
    const layout = (layoutDevice?.manualLayout ?? layoutDevice?.layout ?? 'Ansi') as KeyboardLayout;
    const flush = useCallback(async function applyPending() {
        if (applying.current || !pending.current)
            return;
        const draft = pending.current;
        pending.current = undefined;
        const server = serverProfiles.current.get(draft.id);
        if (!server)
            return;
        applying.current = true;
        setApplyState('Applying');
        try {
            const result = await updateProfile({ profile: { ...draft, revision: server.revision }, expectedRevision: server.revision });
            serverProfiles.current.set(result.profile.id, result.profile);
            setState((old) => ({
                ...old,
                profiles: old.profiles.map((item) => item.id === result.profile.id
                    ? { ...item, revision: result.profile.revision }
                    : item),
                engineStatuses: result.engineStatuses,
            }));
            setApplyState(result.applied ? 'Applied' : 'Error');
        }
        catch {
            setApplyState('Error');
            await load().catch(() => undefined);
        }
        finally {
            applying.current = false;
            if (pending.current)
                void applyPending();
        }
    }, [load]);
    const queueApply = useCallback((next: StudioProfile, pushUndo = true) => {
        if (pushUndo && profile)
            undo.current = [...undo.current.slice(-49), structuredClone(profile)];
        setState((old) => ({ ...old, profiles: old.profiles.map((item) => item.id === next.id ? next : item) }));
        pending.current = next;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush(), 180);
    }, [flush, profile]);
    const setAction = (action: ActionSpec) => {
        if (!profile || !selectedKey || profile.source.kind !== 'visual')
            return;
        queueApply(setLayerMapping(profile, activeLayer, selectedKey, action));
    };
    const onCreate = async (input: NewProfileInput) => {
        const created = await createProfile({ profile: makeAppProfile(input.name, input.executable, input.deviceId) });
        serverProfiles.current.set(created.id, created);
        setState((old) => ({ ...old, profiles: [...old.profiles, created] }));
        setSelected(created.id);
        setCreateOpen(false);
    };
    const onMode = (next: UiMode) => {
        setMode(next);
        setState((old) => ({ ...old, settings: { ...old.settings, uiMode: next } }));
        void updateSettings({ uiMode: next });
    };
    const onOnboarding = async (settings: StudioSettings, first?: {
        name: string;
        exe: string;
    }) => {
        const saved = await updateSettings(settings);
        setState((old) => ({ ...old, settings: saved }));
        if (first)
            await onCreate({ name: first.name, executable: first.exe });
    };
    const onUndo = () => {
        const previous = undo.current.pop();
        if (previous)
            queueApply(previous, false);
    };
    const onAddLayer = () => {
        if (!profile)
            return;
        const name = window.prompt('Layer name', 'nav')?.trim();
        if (!name)
            return;
        queueApply(addLayer(profile, name));
        setActiveLayer(name);
    };
    const applyRaw = async (text: string) => {
        if (!profile)
            return;
        const server = serverProfiles.current.get(profile.id) ?? profile;
        const result = await setRawProfileText({ id: profile.id, text, expectedRevision: server.revision });
        if (!result.applied)
            throw new Error(result.validation.message ?? 'Invalid config');
        serverProfiles.current.set(result.profile.id, result.profile);
        setState((old) => ({ ...old, profiles: old.profiles.map((item) => item.id === result.profile.id ? result.profile : item) }));
    };
    const main = view === 'settings'
        ? <SettingsView state={state} onStart={(value) => void saveSetting({ startWithSystem: value })} onLayout={saveLayout} onUpdate={checkUpdate}/>
        : mode === 'Advanced' && profile
            ? <AdvancedWorkspace profile={profile} layout={layout} activeLayer={activeLayer} selectedKey={selectedKey} direct={direct} inherited={inherited} preview={preview} onSelectKey={setSelectedKey} onLayer={setActiveLayer} onAddLayer={onAddLayer} onConvertRaw={() => setConvertOpen(true)} onRawValidate={(text) => validateRawProfile({ text })} onRawApply={applyRaw} onPreview={() => void previewProfile(profile.id).then((result) => setPreview(result.text))}/>
            : <KeyboardCanvas layout={layout} selected={selectedKey} onSelect={setSelectedKey} direct={direct} inherited={inherited}/>;
    const inspector = view === 'settings'
        ? <div className="inspector-body"><strong>Version</strong><p className="muted">Studio {state.version.studio}<br />Kanata {state.version.kanata}<br />{state.version.sha.slice(0, 12)}</p>{updateMessage && <p className="muted">{updateMessage}</p>}</div>
        : mode === 'Advanced'
            ? <AdvancedInspector keyId={selectedKey} action={currentAction} onChange={setAction} status={applyState}/>
            : <KeyInspector keyId={selectedKey} action={currentAction} onChange={setAction} status={applyState}/>;
    if (!state.settings.onboardingCompleted) {
        return <Onboarding devices={state.devices} capabilities={state.capabilities} settings={state.settings} onFinish={(settings, first) => void onOnboarding(settings, first)}/>;
    }
    return (<>
      <AppShell mode={mode} onMode={onMode} rail={<ProfileRail profiles={state.profiles} selected={selected} onSelect={(id) => { setSelected(id); setActiveLayer('base'); if (!state.capabilities.perAppAutoSwitch)
        void setManualProfile(id).then((engineStatuses) => setState((old) => ({ ...old, activeProfileId: id, engineStatuses }))); }} onCreate={() => setCreateOpen(true)}/>} main={main} inspector={inspector} status={runtimeLabel(state)} onSettings={() => setView((old) => old === 'editor' ? 'settings' : 'editor')} onUndo={undo.current.length ? onUndo : undefined} onRestart={() => void restartEngines().then((engineStatuses) => setState((old) => ({ ...old, engineStatuses })))}/>
      <CreateProfileDialog
        open={createOpen}
        devices={state.devices}
        specificDeviceEnabled={canTargetSpecificDevice(state.capabilities.perDeviceMapping)}
        deviceCapability={state.capabilities.perDeviceMapping}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => void onCreate(input)}
      />
      <ConvertToRawDialog open={convertOpen} onCancel={() => setConvertOpen(false)} onConvert={() => void convertRaw()}/>
    </>);
    async function convertRaw() {
        if (!profile)
            return;
        const server = serverProfiles.current.get(profile.id) ?? profile;
        const result = await convertProfileToRaw(profile.id, server.revision);
        serverProfiles.current.set(result.profile.id, result.profile);
        setState((old) => ({ ...old, profiles: old.profiles.map((item) => item.id === result.profile.id ? result.profile : item) }));
        setConvertOpen(false);
    }
    async function saveSetting(input: Partial<StudioSettings>) {
        const settings = await updateSettings(input);
        setState((old) => ({ ...old, settings }));
    }
    function saveLayout(id: string, value: KeyboardLayout) {
        const overrides = { ...state.settings.deviceLayoutOverrides, [id]: value };
        void saveSetting({ deviceLayoutOverrides: overrides });
        setState((old) => ({ ...old, devices: old.devices.map((device) => device.id === id ? { ...device, manualLayout: value } : device) }));
    }
    async function checkUpdate() {
        try {
            setUpdateMessage(await checkForUpdate());
        }
        catch {
            setUpdateMessage('Updater is enabled only in signed release builds.');
        }
    }
}
function runtimeLabel(state: BootstrapState) {
    if (!state.settings.remappingEnabled)
        return 'Paused';
    if (typeof state.health === 'string')
        return state.health;
    return 'Recovery required';
}
