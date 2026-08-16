import type { ActionSpec, MediaAction } from '../../../lib/types';
import { Select } from '../../../components/Select';
const actions: MediaAction[] = ['PlayPause', 'Next', 'Previous', 'VolumeUp', 'VolumeDown', 'Mute'];
export function MediaEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'media';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <label className="field">Media action<Select value={action.action} onChange={e => onChange({ type: 'media', action: e.target.value as MediaAction })}>{actions.map(a => <option key={a}>{a}</option>)}</Select></label>; }
