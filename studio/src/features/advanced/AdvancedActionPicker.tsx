import { Select } from '../../components/Select';
export const advancedActions = ['Remap', 'Tap / Hold', 'Macro', 'Layer momentary', 'Layer switch', 'Raw action'] as const;
export function AdvancedActionPicker({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) { return <Select value={value} onChange={e => onChange(e.target.value)}>{advancedActions.map(x => <option key={x}>{x}</option>)}</Select>; }
