import type { ActionSpec } from '../../../lib/types';
export function LaunchAppEditor({ action, onChange }: {
    action: Extract<ActionSpec, {
        type: 'launchApp';
    }>;
    onChange: (a: ActionSpec) => void;
}) { return <><label className="field">Application path<input className="ui-input" value={action.path} onChange={e => onChange({ ...action, path: e.target.value })}/></label><label className="field">Arguments<input className="ui-input" value={action.args.join(' ')} onChange={e => onChange({ ...action, args: e.target.value.split(' ').filter(Boolean) })}/></label></>; }
