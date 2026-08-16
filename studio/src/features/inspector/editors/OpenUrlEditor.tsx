import type { ActionSpec } from '../../../lib/types';
export function OpenUrlEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'openUrl';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <label className="field">URL<input className="ui-input" value={action.url} onChange={e => onChange({ type: 'openUrl', url: e.target.value })}/></label>; }
