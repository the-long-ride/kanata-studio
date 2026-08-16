import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Select } from '../../components/Select';
import type { ActionSpec, Modifier } from '../../lib/types';

const modifiers: Modifier[] = ['Ctrl', 'Shift', 'Alt', 'Meta'];
type RowKind = 'Key' | 'Chord' | 'Delay' | 'Layer held' | 'Layer switch';

export function NestedActionList({
  actions,
  onChange,
  allowDelay = true,
}: {
  actions: ActionSpec[];
  onChange: (actions: ActionSpec[]) => void;
  allowDelay?: boolean;
}) {
  const update = (index: number, action: ActionSpec) => {
    const next = [...actions];
    next[index] = action;
    onChange(next);
  };
  const remove = (index: number) => onChange(actions.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return <div className="nested-actions">
    {actions.map((action, index) => <div className="nested-action-row" key={index}>
      <Select value={rowKind(action)} onChange={event => update(index, defaultFor(event.target.value as RowKind))}>
        <option>Key</option><option>Chord</option>
        {allowDelay && <option>Delay</option>}
        <option>Layer held</option><option>Layer switch</option>
      </Select>
      <ActionFields action={action} onChange={next => update(index, next)} />
      <div className="nested-action-tools">
        <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={13} /></IconButton>
        <IconButton label="Move down" disabled={index === actions.length - 1} onClick={() => move(index, 1)}><ArrowDown size={13} /></IconButton>
        <IconButton label="Remove" onClick={() => remove(index)}><Trash2 size={13} /></IconButton>
      </div>
    </div>)}
    {!actions.length && <p className="muted">No actions yet.</p>}
    <div className="nested-action-add">
      <Button onClick={() => onChange([...actions, defaultFor('Key')])}>Add key</Button>
      <Button onClick={() => onChange([...actions, defaultFor('Chord')])}>Add chord</Button>
      {allowDelay && <Button onClick={() => onChange([...actions, defaultFor('Delay')])}>Add delay</Button>}
      <Button onClick={() => onChange([...actions, defaultFor('Layer switch')])}>Add layer</Button>
    </div>
  </div>;
}

function ActionFields({ action, onChange }: {
  action: ActionSpec;
  onChange: (action: ActionSpec) => void;
}) {
  if (action.type === 'key') {
    return <input className="ui-input" aria-label="Key" value={action.key} onChange={event => onChange({ type: 'key', key: event.target.value })} />;
  }
  if (action.type === 'shortcut') {
    return <div className="nested-chord">
      <div className="modifier-grid">{modifiers.map(modifier => <label key={modifier}>
        <input type="checkbox" checked={action.modifiers.includes(modifier)} onChange={() => onChange({ ...action, modifiers: toggle(action.modifiers, modifier) })} />
        {modifier}
      </label>)}</div>
      <input className="ui-input" aria-label="Chord key" value={action.key} onChange={event => onChange({ ...action, key: event.target.value })} />
    </div>;
  }
  if (action.type === 'delay') {
    return <label className="nested-number"><input className="ui-input" type="number" min={1} max={60000} value={action.ms} onChange={event => onChange({ type: 'delay', ms: Number(event.target.value) })} /><span>ms</span></label>;
  }
  if (action.type === 'advanced' && (action.action.type === 'layerMomentary' || action.action.type === 'layerSwitch')) {
    return <input className="ui-input" aria-label="Layer" value={action.action.layer} onChange={event => onChange({ type: 'advanced', action: { ...action.action, layer: event.target.value } })} />;
  }
  return <Button onClick={() => onChange(defaultFor('Key'))}>Convert to key</Button>;
}

function rowKind(action: ActionSpec): RowKind {
  if (action.type === 'shortcut') return 'Chord';
  if (action.type === 'delay') return 'Delay';
  if (action.type === 'advanced' && action.action.type === 'layerMomentary') return 'Layer held';
  if (action.type === 'advanced' && action.action.type === 'layerSwitch') return 'Layer switch';
  return 'Key';
}
function defaultFor(kind: RowKind): ActionSpec {
  if (kind === 'Chord') return { type: 'shortcut', modifiers: ['Ctrl'], key: 'c' };
  if (kind === 'Delay') return { type: 'delay', ms: 150 };
  if (kind === 'Layer held') return { type: 'advanced', action: { type: 'layerMomentary', layer: 'nav' } };
  if (kind === 'Layer switch') return { type: 'advanced', action: { type: 'layerSwitch', layer: 'base' } };
  return { type: 'key', key: 'a' };
}
function toggle(values: Modifier[], value: Modifier): Modifier[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}
