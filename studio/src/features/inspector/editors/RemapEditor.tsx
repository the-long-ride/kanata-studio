import type { ActionSpec } from '../../../lib/types';
export function RemapEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'key';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <label className="field">Output key<input className="ui-input" value={action.key} onChange={e => onChange({ type: 'key', key: e.target.value })}/></label>; }
