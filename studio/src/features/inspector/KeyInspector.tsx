import type { ActionSpec } from '../../lib/types';
import { ActionPicker } from './ActionPicker';
import { RemapEditor } from './editors/RemapEditor';
import { ShortcutEditor } from './editors/ShortcutEditor';
import { TextEditor } from './editors/TextEditor';
import { LaunchAppEditor } from './editors/LaunchAppEditor';
import { OpenUrlEditor } from './editors/OpenUrlEditor';
import { MediaEditor } from './editors/MediaEditor';
import './inspector.css';
const fromType = (type: string): ActionSpec => type === 'Remap key' ? { type: 'key', key: 'esc' } : type === 'Shortcut' ? { type: 'shortcut', modifiers: ['Ctrl'], key: 'c' } : type === 'Type text' ? { type: 'text', text: '' } : type === 'Launch app' ? { type: 'launchApp', path: '', args: [] } : type === 'Open URL' ? { type: 'openUrl', url: 'https://' } : type === 'Media controls' ? { type: 'media', action: 'PlayPause' } : { type: 'disabled' };
export function KeyInspector({ keyId, action, onChange, status = 'Applied' }: {
    keyId?: string;
    action?: ActionSpec;
    onChange: (a: ActionSpec) => void;
    status?: string;
}) {
    if (!keyId)
        return <div className="empty-inspector">Select a key</div>;
    const a = action ?? { type: 'key', key: keyId };
    return <><div className="panel-title">{keyId}<span className="apply-state">{status}</span></div><div className="inspector-body"><label className="field">Action<ActionPicker action={a} onChange={t => onChange(fromType(t))}/></label>{a.type === 'key' && <RemapEditor action={a} onChange={onChange}/>} {a.type === 'shortcut' && <ShortcutEditor action={a} onChange={onChange}/>} {a.type === 'text' && <TextEditor action={a} onChange={onChange}/>} {a.type === 'launchApp' && <LaunchAppEditor action={a} onChange={onChange}/>} {a.type === 'openUrl' && <OpenUrlEditor action={a} onChange={onChange}/>} {a.type === 'media' && <MediaEditor action={a} onChange={onChange}/>} {a.type === 'disabled' && <p className="muted">Key disabled.</p>} {a.type === 'advanced' && <p className="muted">Advanced action. Switch to Advanced to edit.</p>}</div></>;
}
