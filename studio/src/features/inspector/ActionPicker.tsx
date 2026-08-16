import type { ActionSpec } from '../../lib/types';
import { Select } from '../../components/Select';
export const beginnerActions = ['Remap key', 'Shortcut', 'Type text', 'Launch app', 'Open URL', 'Media controls', 'Disable key'] as const;
export function ActionPicker({ action, onChange }: {
    action: ActionSpec;
    onChange: (type: string) => void;
}) { const value = action.type === 'key' ? 'Remap key' : action.type === 'shortcut' ? 'Shortcut' : action.type === 'text' ? 'Type text' : action.type === 'launchApp' ? 'Launch app' : action.type === 'openUrl' ? 'Open URL' : action.type === 'media' ? 'Media controls' : action.type === 'disabled' ? 'Disable key' : 'Advanced action'; return <Select aria-label="Action" value={value} onChange={e => onChange(e.target.value)}>{beginnerActions.map(x => <option key={x}>{x}</option>)}{action.type === 'advanced' && <option>Advanced action</option>}</Select>; }
