import type { BootstrapState, KeyboardLayout } from '../../lib/types';
import { GeneralSettings } from './GeneralSettings';
import { KeyboardSettings } from './KeyboardSettings';
import { UpdatesSettings } from './UpdatesSettings';
export function SettingsView({ state, onStart, onLayout, onUpdate }: {
    state: BootstrapState;
    onStart: (v: boolean) => void;
    onLayout: (id: string, l: KeyboardLayout) => void;
    onUpdate: () => void;
}) { return <div style={{ padding: 16, display: 'grid', gap: 20 }}><GeneralSettings start={state.settings.startWithSystem} onStart={onStart}/><KeyboardSettings devices={state.devices} capabilities={state.capabilities} onLayout={onLayout}/><UpdatesSettings version={state.version} onCheck={onUpdate}/></div>; }
