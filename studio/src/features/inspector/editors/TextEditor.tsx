import type { ActionSpec } from '../../../lib/types';
export function TextEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'text';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <label className="field">Text<textarea className="ui-textarea" value={action.text} onChange={e => onChange({ type: 'text', text: e.target.value })}/></label>; }
