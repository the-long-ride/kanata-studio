import { useMemo } from 'react';
import { Select } from '../../components/Select';
import type { ActionSpec } from '../../lib/types';
import { KeyInspector } from '../inspector/KeyInspector';
import { MacroEditor } from './MacroEditor';
import { NestedActionList } from './NestedActionList';

const advancedTypes = [
  'Basic', 'Tap / Hold', 'Macro', 'Multi-key', 'Tap dance',
  'Layer momentary', 'Layer switch', 'Raw Kanata action',
] as const;
type AdvancedType = (typeof advancedTypes)[number];

export function AdvancedInspector({ keyId, action, onChange, status }: {
  keyId?: string;
  action?: ActionSpec;
  onChange: (action: ActionSpec) => void;
  status?: string;
}) {
  const kind = useMemo<AdvancedType>(() => advancedKind(action), [action]);
  if (!keyId) return <div className="empty-inspector">Select a key</div>;
  if (kind === 'Basic') return <>
    <div className="advanced-kind"><span>Editor</span><KindSelect value="Basic" onChange={value => onChange(defaultAdvanced(value))} /></div>
    <KeyInspector keyId={keyId} action={action} onChange={onChange} status={status} />
  </>;
  return <>
    <div className="panel-title">{keyId}<span className="apply-state">{status}</span></div>
    <div className="inspector-body">
      <label className="field">Advanced action<KindSelect value={kind} onChange={value => onChange(defaultAdvanced(value))} /></label>
      <AdvancedFields action={action!} onChange={onChange} />
    </div>
  </>;
}

function KindSelect({ value, onChange }: { value: AdvancedType; onChange: (value: AdvancedType) => void }) {
  return <Select value={value} onChange={event => onChange(event.target.value as AdvancedType)}>
    {advancedTypes.map(type => <option key={type}>{type}</option>)}
  </Select>;
}

function advancedKind(action?: ActionSpec): AdvancedType {
  if (action?.type !== 'advanced') return 'Basic';
  switch (action.action.type) {
    case 'tapHold': return 'Tap / Hold';
    case 'macro': return 'Macro';
    case 'multi': return 'Multi-key';
    case 'tapDance': return 'Tap dance';
    case 'layerMomentary': return 'Layer momentary';
    case 'layerSwitch': return 'Layer switch';
    case 'rawAction': return 'Raw Kanata action';
  }
}

function defaultAdvanced(kind: AdvancedType): ActionSpec {
  switch (kind) {
    case 'Basic': return { type: 'key', key: 'esc' };
    case 'Tap / Hold': return { type: 'advanced', action: { type: 'tapHold', tap: { type: 'key', key: 'esc' }, hold: { type: 'key', key: 'lctl' }, timeoutMs: 200 } };
    case 'Macro': return { type: 'advanced', action: { type: 'macro', actions: [{ type: 'key', key: 'h' }] } };
    case 'Multi-key': return { type: 'advanced', action: { type: 'multi', actions: [{ type: 'key', key: 'lctl' }, { type: 'key', key: 'lalt' }] } };
    case 'Tap dance': return { type: 'advanced', action: { type: 'tapDance', timeoutMs: 200, actions: [{ type: 'key', key: 'a' }, { type: 'key', key: 'b' }] } };
    case 'Layer momentary': return { type: 'advanced', action: { type: 'layerMomentary', layer: 'nav' } };
    case 'Layer switch': return { type: 'advanced', action: { type: 'layerSwitch', layer: 'base' } };
    case 'Raw Kanata action': return { type: 'advanced', action: { type: 'rawAction', expression: '(tap-hold 200 200 esc lctl)' } };
  }
}

function AdvancedFields({ action, onChange }: { action: ActionSpec; onChange: (action: ActionSpec) => void }) {
  if (action.type !== 'advanced') return null;
  const current = action.action;
  if (current.type === 'tapHold') {
    const tap = current.tap.type === 'key' ? current.tap.key : 'esc';
    const hold = current.hold.type === 'key' ? current.hold.key : 'lctl';
    return <>
      <label className="field">Tap key<input className="ui-input" value={tap} onChange={event => onChange({ type: 'advanced', action: { ...current, tap: { type: 'key', key: event.target.value } } })} /></label>
      <label className="field">Hold key<input className="ui-input" value={hold} onChange={event => onChange({ type: 'advanced', action: { ...current, hold: { type: 'key', key: event.target.value } } })} /></label>
      <label className="field">Timeout (ms)<input className="ui-input" type="number" min={1} max={60000} value={current.timeoutMs} onChange={event => onChange({ type: 'advanced', action: { ...current, timeoutMs: Number(event.target.value) } })} /></label>
    </>;
  }
  if (current.type === 'macro') return <MacroEditor actions={current.actions} onChange={actions => onChange({ type: 'advanced', action: { ...current, actions } })} />;
  if (current.type === 'multi') return <NestedActionList actions={current.actions} allowDelay={false} onChange={actions => onChange({ type: 'advanced', action: { ...current, actions } })} />;
  if (current.type === 'tapDance') return <>
    <label className="field">Tap window (ms)<input className="ui-input" type="number" min={1} max={60000} value={current.timeoutMs} onChange={event => onChange({ type: 'advanced', action: { ...current, timeoutMs: Number(event.target.value) } })} /></label>
    <NestedActionList actions={current.actions} allowDelay={false} onChange={actions => onChange({ type: 'advanced', action: { ...current, actions } })} />
  </>;
  if (current.type === 'layerMomentary' || current.type === 'layerSwitch') {
    return <label className="field">Layer<input className="ui-input" value={current.layer} onChange={event => onChange({ type: 'advanced', action: { ...current, layer: event.target.value } })} /></label>;
  }
  return <label className="field">Kanata expression<textarea className="ui-textarea code-field" value={current.expression} onChange={event => onChange({ type: 'advanced', action: { ...current, expression: event.target.value } })} /></label>;
}
