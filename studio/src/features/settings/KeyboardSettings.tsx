import type { CapabilitySet, KeyboardDevice, KeyboardLayout } from '../../lib/types';
import { Select } from '../../components/Select';
export function KeyboardSettings({ devices, capabilities, onLayout }: {
    devices: KeyboardDevice[];
    capabilities: CapabilitySet;
    onLayout: (id: string, l: KeyboardLayout) => void;
}) { return <section><h3>Keyboards</h3>{devices.map(d => <div className="settings-row" key={d.id}><span>{d.name}</span><Select value={d.manualLayout ?? d.layout} onChange={e => onLayout(d.id, e.target.value as KeyboardLayout)}>{['Ansi', 'Iso', 'Jis', 'Unknown'].map(x => <option key={x}>{x}</option>)}</Select></div>)}<p className="muted">Per-device: {capabilities.perDeviceMapping}</p></section>; }
