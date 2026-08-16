import type { ActionSpec, Modifier } from '../../../lib/types';
const mods: Modifier[] = ['Ctrl', 'Shift', 'Alt', 'Meta'];
export function ShortcutEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'shortcut';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <div className="field"><label>Modifiers</label><div>{mods.map(m => <label key={m}><input type="checkbox" checked={action.modifiers.includes(m)} onChange={() => onChange({ ...action, modifiers: action.modifiers.includes(m) ? action.modifiers.filter(x => x !== m) : [...action.modifiers, m] })}/>{m} </label>)}</div><input className="ui-input" value={action.key} onChange={e => onChange({ ...action, key: e.target.value })}/></div>; }
